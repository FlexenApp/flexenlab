// Upload train/eval JSONL to Together AI and start a LoRA fine-tune job.
//
// Schema validated 2026-04-09 against docs.together.ai/reference/post-fine-tunes:
//   - LoRA config lives under `training_type: {type: "Lora", lora_r, lora_alpha, lora_dropout}`
//   - `n_evals` must be >0 to get validation metrics
//
// Modes:
//   PILOT=1  →  200-sample train, 1 epoch, rank 8   (~$5-8, schema/pipeline sanity)
//   (unset)  →  full 7390-sample train, 3 epochs, rank 16   (~$20, production run)
//
// Run:  PILOT=1 node finetune/03_upload_and_train.mjs
//       node finetune/03_upload_and_train.mjs

import fs from "fs";
import path from "path";
import Together from "together-ai";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
if (!TOGETHER_API_KEY) {
  console.error("Missing TOGETHER_API_KEY in api_keys.env");
  process.exit(1);
}

const PILOT = !!process.env.PILOT;
const FULL_TRAIN = "finetune/train.jsonl";
const EVAL_FILE = "finetune/eval.jsonl";
const PILOT_TRAIN = "finetune/train_pilot.jsonl";

if (!fs.existsSync(FULL_TRAIN) || !fs.existsSync(EVAL_FILE)) {
  console.error("Missing train.jsonl or eval.jsonl. Run 02_build_training_data.mjs first.");
  process.exit(1);
}

// ── Build pilot file if needed ──
let trainFile = FULL_TRAIN;
if (PILOT) {
  const lines = fs.readFileSync(FULL_TRAIN, "utf8").trim().split("\n");
  // Random shuffle, take 200
  const shuffled = lines.slice().sort(() => Math.random() - 0.5).slice(0, 200);
  fs.writeFileSync(PILOT_TRAIN, shuffled.join("\n") + "\n");
  console.log(`PILOT mode: wrote ${PILOT_TRAIN} with 200 lines`);
  trainFile = PILOT_TRAIN;
}

// SDK's upload.mjs uses CJS require() which is broken in ESM, so we replicate
// the exact HTTP flow it performs.
async function uploadFile(filePath) {
  const abs = path.resolve(filePath);
  console.log(`Uploading ${abs}...`);
  const buf = fs.readFileSync(abs);
  const fileSize = buf.length;

  const params = new URLSearchParams({
    file_name: abs,
    file_type: "jsonl",
    purpose: "fine-tune",
  });

  const step1 = await fetch(`https://api.together.xyz/v1/files?${params}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: params.toString(),
  });
  if (step1.status !== 302) {
    throw new Error(`Step 1 failed ${step1.status}: ${await step1.text()}`);
  }
  const signedUrl = step1.headers.get("location");
  const fileId = step1.headers.get("x-together-file-id");
  if (!signedUrl || !fileId) throw new Error("Missing Location/X-Together-File-Id");

  const step2 = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileSize),
    },
    body: buf,
  });
  if (step2.status !== 200) {
    throw new Error(`Step 2 PUT failed ${step2.status}: ${await step2.text()}`);
  }

  console.log(`  → file id: ${fileId}  (${(fileSize / 1024).toFixed(1)} KB)`);

  // Step 3 — preprocess (marks file as ready for training)
  const step3 = await fetch(`https://api.together.xyz/v1/files/${fileId}/preprocess`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOGETHER_API_KEY}` },
  });
  if (!step3.ok) throw new Error(`Preprocess failed ${step3.status}: ${await step3.text()}`);
  const meta = await step3.json();
  console.log(`    preprocessed: ${meta.bytes} bytes, ${meta.LineCount} lines`);

  // Poll a few seconds in case LineCount lags
  for (let i = 0; i < 10 && meta.LineCount === 0; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`https://api.together.xyz/v1/files/${fileId}`, {
      headers: { Authorization: `Bearer ${TOGETHER_API_KEY}` },
    });
    if (r.ok) {
      const j = await r.json();
      if (j.LineCount > 0) { console.log(`    lines: ${j.LineCount}`); break; }
    }
  }
  return fileId;
}

async function createFineTuneJob(trainFileId, evalFileId) {
  const payload = PILOT
    ? {
        training_file: trainFileId,
        validation_file: evalFileId,
        model: "openai/gpt-oss-120b",
        n_epochs: 1,
        n_evals: 2,
        n_checkpoints: 1,
        learning_rate: 1e-4,
        batch_size: 16,
        training_type: { type: "Lora", lora_r: 8, lora_alpha: 16, lora_dropout: 0.05 },
        suffix: `flexen-pilot-${new Date().toISOString().slice(0, 10)}`,
      }
    : {
        training_file: trainFileId,
        validation_file: evalFileId,
        model: "openai/gpt-oss-120b",
        n_epochs: 3,
        n_evals: 6,
        n_checkpoints: 1,
        learning_rate: 1e-4,
        batch_size: 16,
        training_type: { type: "Lora", lora_r: 16, lora_alpha: 32, lora_dropout: 0.05 },
        suffix: `flexen-food-v1-${new Date().toISOString().slice(0, 10)}`,
      };

  console.log(`\n${PILOT ? "PILOT" : "FULL"} job payload:`);
  console.log(JSON.stringify(payload, null, 2));

  const res = await fetch("https://api.together.xyz/v1/fine-tunes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Job creation failed ${res.status}: ${err}`);
  }
  const body = await res.json();
  console.log("\n✓ Job created:", body.id);
  console.log("Status:", body.status);
  console.log("Monitor: node finetune/04_monitor_job.mjs", body.id);
  return body;
}

const trainFileId = await uploadFile(trainFile);
const evalFileId = await uploadFile(EVAL_FILE);
const job = await createFineTuneJob(trainFileId, evalFileId);

const outFile = PILOT ? "finetune/last_pilot_job.json" : "finetune/last_job.json";
fs.writeFileSync(outFile, JSON.stringify({
  job_id: job.id,
  train_file_id: trainFileId,
  eval_file_id: evalFileId,
  created_at: new Date().toISOString(),
  mode: PILOT ? "pilot" : "full",
  ...job,
}, null, 2));
console.log(`\n→ ${outFile} saved`);
