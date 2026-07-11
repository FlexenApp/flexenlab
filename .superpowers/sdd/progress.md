# Exercise Library v2 — SDD Progress (flexenlab)

Plan: flexenbrain/projects/flexen/plans/2026-06-21-exercise-library-v2-data-media-pipeline.md
Branch: main (Leonard: work directly on master/main, no feature branch)

- Task 1-8 (flexenlab pipeline): in progress (wave 1, credential-free code + safe runs)
- Task 9 (flexenapp model): DEFERRED — flexenapp is an actively-driven shared checkout
  (branch agent/claude/medication-manage-redesign); bundle with Spec B in isolated worktree.
- Credentialed RUNS (upload/translate/reseed/verify): pending GEMINI_API_KEY + write creds + user go.

## Wave 1 recovered + completed (main)
- Tasks 1-4 committed by interrupted agent (clean+transform tests 8/8 green, build-media smoke 2/2).
- Tasks 5-8 committed by controller (upload, translate, backup+reseed, verify).
- All pipeline CODE complete on main. Next: code-review, then credentialed RUNS (need GEMINI_API_KEY + write creds + user go).

## Code review (Opus controller + sonnet code-reviewer)
- No P0. 3×P1 + P2-E fixed + committed. P2-A/B/C(part)/D deferred as nits.
- Full WebP build started in background.
- REMAINING (credentialed, needs user): GEMINI_API_KEY + write creds + explicit go for reseed --confirm.

## SPEC A COMPLETE + LIVE (verified)
- Final reseed: 1500/1500 gifUrl+thumbUrl+displayName+i18n.de; moji/trailing/stepN = 0. verify.js PASS.
- Translation done via Claude subagents (1390) + inline (110, API was 529-overloaded).
- Remaining project work: Spec B (UI v2) + Task 9 (Flutter model) — separate, later.
