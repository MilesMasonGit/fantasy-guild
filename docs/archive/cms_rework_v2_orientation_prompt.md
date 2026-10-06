We're starting work on the CMS rework. Read these two documents in full before doing anything else:

1. [`cms_rework_v2_decisions.md`](cms_rework_v2_decisions.md) — 81 numbered decisions (CMS-1 through CMS-81) from a long interview with the owner. This is the *what* and *why*. It supersedes `cms_rework_concept.md` and `cms_rework_roadmap_v1.md` entirely — those describe the old card-sequence game, which no longer exists. Some entries are struck through and superseded by a later one (e.g. CMS-3 → CMS-53) — when that happens, the later entry is the one that's true; the struck one is kept only so you can see what changed and why.

2. [`cms_rework_v2_roadmap.md`](cms_rework_v2_roadmap.md) — a preliminary 10-phase build sequence against those decisions, including a table of which old CMS files (`cms/src/`, ~14,000 lines) get reused, adapted, or deleted. It's marked preliminary because it was drafted in one pass without walking it phase-by-phase with the owner.

**Your first task is to review and improve the roadmap, not implement anything yet.** Specifically:

- Check the reuse/delete/adapt claims in the roadmap's Section 0 table against the actual files in `cms/src/` — they were checked by name and line count, not read in full, so some "adapt" claims may turn out to be "delete and rewrite" once you actually read the code, or vice versa.
- Look for phases that are bigger or smaller than they look on paper, and say so.
- Look at Section 3 ("What this roadmap doesn't resolve") — some of those need answers before their phase starts, not just "early in" it. Flag any that should move earlier.
- Bring anything you find back to the owner as multiple-choice questions with your recommendation first — don't just silently rewrite the roadmap. See "How to work with me" below.

Once the roadmap review is done and the owner's signed off on changes, move into Phase 0 implementation.

## How to work with the owner

- **They don't code.** Explain git/GitHub and any technical tradeoffs in plain language — what a thing does and why, not just its name.
- **Ask, don't assume — as multiple choice.** Labelled options, trade-offs spelled out, your recommendation first. Never an open-ended question, never a silent guess.
- **Challenge them.** Point out contradictions with what's already decided (check the decisions doc) and gaps they haven't noticed. This has been the most valuable thing across the whole design interview — don't just agree.
- **Verify before saying something works.** The CMS has no automated test suite (confirmed deliberate, per the roadmap) — verification is manual click-through, actually using the screen you built.
- **Work in small slices**, one coherent chunk per session, committed at the end. Suggest commits; don't commit without asking.
- **Update the decisions log as you go.** If implementation surfaces a real design question the interview didn't cover, that's a new numbered decision (CMS-82 onward), not a silent judgment call.
