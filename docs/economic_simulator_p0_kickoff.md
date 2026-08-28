# Kickoff — Economic Simulator Roadmap P0: Decisions Transcribed

You are the **director** for Phase 0 of the economic simulator roadmap. You
delegate the work to subagents and review everything yourself before it is
committed — nothing lands on your say-so alone that you have not read.

**P0 is docs only. No code, no data files, and ⚠️ never press CMS Sync**
(roadmap §6: until phase P5 lands, Sync mutates content through the retired
engine).

## Read first (you; give each subagent only what its task needs)

1. `docs/economic_simulator_roadmap_v1.md` — **its P0 section is your work
   order**, and §1 (rules of engagement) binds this whole session.
2. `docs/economic_simulator_plan_v1.md` **§19** — the verbatim source: 22
   decisions, **CMS-117 through CMS-138** (CMS-138 and the CMS-129 tutorial
   clarification arrived with plan v1.4).
3. `cms_rework_v2_decisions.md` — the target file. Learn the house style from
   its existing entries: the decision as a bold claim first, then *Rejected:*
   alternatives, then *Cost:* accepted; supersessions named; struck decisions
   left struck-through, never deleted.

## The work

1. **Transcribe CMS-117–138** into `cms_rework_v2_decisions.md`, in house
   style, after the struck CMS-109–116 block. Faithful transcription is the
   whole job: nothing paraphrased weaker, no tension "fixed" — CMS-127 and
   CMS-137 both go in as the plan wrote them, with a one-line note on CMS-127
   that CMS-137 governs the shipped dial values (roadmap S14). CMS-129 carries
   its tutorial-exemption clarification.
2. **Re-point CMS-107's note**: it currently says decisions land "once the plan
   is approved" — the plan is approved and they have landed; point it at
   CMS-117+.
3. **Strike CMS-45** in place with a pointer to CMS-119, and **CMS-54** with a
   pointer to CMS-124.
4. **Annotate D-167** (`playmat_decisions.md:539`) as superseded on burst size
   and composition by CMS-129 — its presentation half ("spectacle over
   volume") explicitly stands. Annotate; do not rewrite history.
5. **CHANGELOG.md** under `## [Unreleased]`, one entry.

## Suggested delegation

- One subagent transcribes (steps 1–4).
- A **separate** subagent with fresh eyes verifies: a line-by-line read-back of
  the transcription against plan §19 — all 22 decisions present, every
  *Rejected* and *Cost* carried, no claim softened, the two strikes and both
  re-pointed notes correct.
- You read the final diff yourself before committing.

## Verify and finish

- `npm test` green — this phase touches no code, so the suite must be exactly
  as it was (1381 passed / 31 skipped at last run). Any change means something
  went wrong.
- One commit on `main` when verified.

## Rules

- The owner designs games and does not code or read notation — plain language
  everywhere, and any question goes to them as **labelled multiple-choice
  options with your recommendation first**.
- Do not re-litigate anything in plan §19/§21 or roadmap §7. If a genuine
  contradiction surfaces during transcription, stop and ask — do not resolve it
  yourself.
- Stay in P0. Anything else you notice gets reported, not fixed.
