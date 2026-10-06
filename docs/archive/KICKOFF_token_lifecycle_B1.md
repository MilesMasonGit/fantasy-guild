# Kickoff prompt — Token Lifecycle feedback, B1: ring badges

Paste the text below into a new session.

---

You are the **director** for rework **B1 (ring badges)** from my Token Lifecycle feedback. Your job
is to plan it with me, hand the building to subagents, review what they return, verify it
yourself, and merge it. You write little code yourself.

**Read these first, in this order:**

1. `CLAUDE.md`: how I work. I don't code, so explain things in plain language. Ask me design
   questions as multiple choice with your recommendation first. Verify before you say something is
   done. Stay in scope. Work in small, committed slices.
2. `docs/token_lifecycle_feedback_v1.md`: my feedback list and its decisions. For B1 you need
   **FB-3, FB-4, FB-5**, the brief **B1** in §4.2, and the §4.1 rows **Q2, Q3, Q4 and Q8**, which
   built what B1 replaces or sits beside. Its §3 decisions (TL-12…TL-21) stand; don't re-open them.
3. `docs/token_lifecycle_roadmap_v1.md` **§0.3–§0.5**: the rules that have bitten before, the test
   baseline and the lessons from earlier sessions.

**What B1 is:** circular ring badges that fill or empty, with the number inside, for things like
cycle time, charges and a spawner's count. They sit in **one uniform row under the hero and the
Token together**, replacing today's progress bar, which sits under the Token alone.

**What's on the mat today** (built in the quick-win session, 2026-09-26/27):

* Gear top-left (choose a recipe; pulses while nothing is chosen). Disallow sprite top-right.
  One alert mark at the centre.
* A plain spawner count `n/cap` bottom-left, and a sky-blue `m:ss` countdown on Tokens that turn
  (the Coast). Both were built as stand-ins for B1's rings.
* `TokenProgressBar`: the work progress bar under the Token, which also carries some red/yellow
  alert labels while a hero is on it. Decide with me where those labels go once the bar goes.
* Z-order bands (`matLayers.js`), hit animations on the Token's art (`TokenHitArt.jsx`) and the
  transform glow (`TokenGlows.js`): keep them working.

**How I'd like this run:**

* **Mockup first.** Before any code, show me a visual mockup of the badge row (e.g. an Artifact or an
  inline widget), with 2–3 options. Put the open questions to me as multiple choice at the same
  time. For example: which badges appear and in what order; whether the row shows always, only
  while worked, or on hover; how it sits when no hero is there; ring colours; and what happens to
  the alert labels the progress bar carries.
* Then **small slices**, each on its own branch from `main`, built by a subagent, **verified by
  you** (`npm test` against the baseline in roadmap §0.4, then the running game), and merged. Tell
  me what you observed. Record my answers in the feedback doc; if one changes an existing
  decision, add it as a new TL- decision (the next is **TL-22**).
* **Test games go in save slot 3 only**, and delete that save afterwards
  (`window.Game.SaveManager.deleteSlot(2)`). Never touch slots 1 and 2.
* The agents' Browser pane is usually hidden, which freezes animations and stops drawers opening.
  Say plainly what you checked by probe and what I still need to look at by eye.
* If you notice something worth fixing outside B1, tell me rather than folding it in.

When you've read everything, show me the mockup and your questions, then begin.
