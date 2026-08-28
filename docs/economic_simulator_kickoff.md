# Kickoff — Economic Simulator Design

*Paste the section below to the agent that will design the simulator. Everything above the
line is a note to the project owner.*

**How to use this:** the agent's whole job is a written plan. It will ask you questions —
that is intended, not a failure. Expect at least one round of questions before it proposes
anything, and expect to send it back for revision after it does.

---

## Your task

You are designing the **economic balance simulator** for *Fantasy Guild*, an idle/incremental
game. Your deliverable is a **written plan**, not software.

Start by reading **`docs/economic_simulator_problem_space.md`**. It is the brief: the problem,
the boundaries, what to deliver, and the criteria your design will be judged against. Read it
completely before doing anything else. Do not restate it back to me — build on it.

### What the simulator is for

The game's content is hand-authored, Token by Token, on purpose — every one has its own
character and there is no tier formula generating them. That does not scale. The simulator's
job is to take the designer's *intent* about a Token or Recipe — how fast it feels, how rare
it is, whether it exists to make gold or train heroes or churn out material — and derive the
numbers that make that intent true and consistent with the rest of the economy.

The chief number it derives is **every item's gold value**. Read §4 of the brief carefully;
this mechanism is the heart of the system and is easy to misread.

### Do not write code

No implementation, no patches, no pseudocode dumps. You may read the codebase freely — to
understand how the runtime works, what the CMS is shaped like, and what prior art exists — but
your output is a design document that a separate implementation session will work from.

### Ask before you assume

This is the most important instruction here.

**If you are unsure what the simulator should or should not control, ask.** The boundary
between what the designer authors and what the tool derives is the single thing most likely to
be got wrong, and a plan built on a wrong assumption there is worthless.

**If you need to know how the game works, or how it *should* work, ask.** Plenty is undecided.
The brief marks unresolved points as **OPEN** — those are genuinely open, not oversights, and
several are yours to propose answers for. But if you hit something the brief simply does not
cover, do not invent it and do not quietly pick the convenient reading.

When you ask, **give me labelled multiple-choice options with the trade-offs spelled out and
your recommendation first.** I design games; I do not write code and I do not read notation. An
open-ended question is much harder for me to answer than a well-framed choice. Batch your
questions rather than drip-feeding them.

### What the plan must contain

Specifically and concretely:

1. **How the simulator works.** The actual mechanism — how values get derived, in what order,
   how the circular dependencies settle without oscillating, which lever gets pulled when, how
   an item's anchor source is chosen, and what happens at the edges. Enough detail that someone
   could build it without guessing.

2. **How it integrates into the CMS.** Where it lives, when it runs, what it reads and writes,
   what happens to derived values on re-run, and what the two control surfaces in §3 of the
   brief actually look like — the per-Token/per-Recipe Simulator Panel and the global Dashboard.
   Include what I see when it refuses to balance something, since I cannot hand-fix a value.

3. **Every dial, named and explained.** What each one does, what turning it up or down does to
   the game I would actually feel, sensible ranges, and which ones interact. §7.2 of the brief
   says which need baseline numbers from you and which are deliberately mine to set by feel —
   respect that split.

4. **Data schema changes and build order**, per §7.4 and §7.5.

### Two things to get right

**Simple beats clever.** This is a solo project maintained by someone who does not code. A
design only its author can reason about has failed, however elegant. Where you face a choice
between a sophisticated approach and a comprehensible one, take the comprehensible one and say
what it costs.

**Do not calibrate to existing content.** The Tokens, Items and Maps in `data/` are
placeholder, sparse, and mid-re-authoring. Fitting your curves to them would bake today's
accidents into the design permanently — the tool exists to *replace* that data. §9 of the brief
is explicit about this. Design from stated intent and first principles.

### After you propose

Your first plan is a draft. I will come back and ask you to review it critically, stress-test
the concept, and hunt for flaws — so write it to be attacked. Where you are uncertain, say so
rather than projecting confidence. Where your design degrades or breaks, name the case. If you
conclude one of the locked constraints in §5 makes the problem unsolvable, say so plainly, name
the smallest change that would unblock it, and leave the decision to me.

Expect to iterate.

### Worth reading

- `docs/economic_simulator_problem_space.md` — **the brief. Start here.**
- `docs/cms_rework_v2_decisions.md` — the decision log. Your conclusions land here as new
  numbered decisions from **CMS-109** onward, and **CMS-107** should be marked resolved
  pointing at them. Match the house style described in §11 of the brief.
- `docs/solver_levers_brief.md` — an earlier framing of the same problem. Useful for context,
  but **its figures are out of date and one of its framings is wrong** (it treats item value as
  an untouchable anchor; §4 of the brief corrects this). Do not take its numbers.
- `docs/known_issues_after_recipe_charges.md` — open issues from a rework that just landed.
  **Read RC-8 in particular**, which flags the older brief as describing a game that no longer
  exists.
- `cms/src/engine/taskSolver.js` — prior art. A solver that worked, for a card-based version of
  the game that no longer exists. It already implements one answer to the lever-policy question.
  Read it before proposing something new; treat it as a starting point, not a verdict.
- `src/systems/board/BoardRunner.js` — the runtime cycle engine. Shows exactly how quantity,
  chance, cycle time and modifiers actually combine in play.

### Where to put it

Write the plan to **`docs/economic_simulator_plan_v1.md`**. Do not modify the brief — if you
believe it is wrong about something, say so in your response and let me change it.

Begin by reading the brief, then come back with your questions.
