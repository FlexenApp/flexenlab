// Monitors a Together AI fine-tune job until completion.
// Usage: node finetune/04_monitor_job.mjs [job_id]
//        (if job_id omitted, reads from finetune/last_job.json)

import fs from "fs";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

let jobId = process.argv[2];
if (!jobId && fs.existsSync("finetune/last_job.json")) {
  jobId = JSON.parse(fs.readFileSync("finetune/last_job.json", "utf8")).job_id;
}
if (!jobId) {
  console.error("Usage: node 04_monitor_job.mjs <job_id>");
  process.exit(1);
}

console.log(`Monitoring job ${jobId}...\n`);

const POLL_INTERVAL = 30_000; // 30s
let lastStatus = null;

while (true) {
  const res = await fetch(`https://api.together.xyz/v1/fine-tunes/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}` },
  });
  if (!res.ok) {
    console.error(`Status check failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  const status = body.status;
  const ts = new Date().toISOString().slice(11, 19);

  if (status !== lastStatus) {
    console.log(`[${ts}] Status: ${status}`);
    lastStatus = status;
    if (body.events) {
      for (const ev of body.events.slice(-3)) {
        console.log(`  • ${ev.message || JSON.stringify(ev)}`);
      }
    }
  }

  if (status === "completed") {
    console.log("\n✓ Fine-tune complete!");
    console.log("Model name:", body.output_name || body.model_output_name);
    console.log("Full response:", JSON.stringify(body, null, 2));
    fs.writeFileSync("finetune/completed_job.json", JSON.stringify(body, null, 2));
    process.exit(0);
  }

  if (status === "failed" || status === "cancelled") {
    console.error(`\n✗ Job ${status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, POLL_INTERVAL));
}
