# Brief 60 — Deep optimization

Runs after the UI rework, class rework, offline progress and drag work, when
the systems are stable (crunch plan: "deep pass only at milestones").

**Inputs:** the UI rework cost log and baselines in `PERFORMANCE.md`; the
per-system cost table (`npm run bench:draw -- --switches --cpu=4`); the
target "**perf build, 4× slowdown, smooth**" (crunch plan); the torture board
(~320 Tokens) at 83 % of frames in budget (T-071); with the Atlas, **the Token
cap counts everything on the mat**, so the cap is the size optimization must
handle.

**Branch:** `crunch/optimize`. **Tier:** engineer. Look-preserving: anything
that changes how the game looks goes to the owner.

## P1 — Re-measure and rank (engineer)

Fresh `bench:draw` (perf, 1× and 4×), the 4× cost table, and the engine bench
on the post-rework game. Rank causes by cost × how often players hit them.
Write the ranking and the plan into `PERFORMANCE.md`.

## P2… — Fix in ranked order (engineer, one cause per phase)

Each: before/after numbers back to back, the engine bench's same-work gate,
the draw bench's compare. Stop when the target is met at the cap the owner
wants, or when the next fix needs a design change (ask the owner, batched).

**Done when:** the realistic mat at 4× slowdown is "smooth" by a definition
written down in P1 (e.g. ≥ 95 % of frames in budget) at the planned cap; the
results and what's left go to the Performance Envelope (brief 90).
