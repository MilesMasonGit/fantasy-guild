# Kickoff — Economic Simulator: Technical Implementation Plan

You are writing the **technical implementation roadmap** for the economic balance
simulator. The design is finished and approved; your job is to turn it into a
build plan, not to redesign it.

## Read first, in this order

1. **`docs/economic_simulator_plan_v1.md`** — the approved design, v1.3. This is
   the authority. Its §21 ledgers 22 owner rulings from the design interviews;
   its §19 holds the proposed decisions (CMS-117–137); its §17 sketches a build
   order your roadmap should expand.
2. `docs/economic_simulator_problem_space.md` — the original brief, for the
   constraints in its §5. Where it disagrees with the plan, **the plan wins**
   (the plan's §1 lists the brief's known-stale claims).
3. `cms_rework_v2_decisions.md` — the decisions log. CMS-109–116 are struck;
   don't resurrect anything from them.

## What to produce

A roadmap document (`docs/economic_simulator_roadmap_v1.md`) in the style of
`docs/recipe_and_charges_roadmap_v1.md`: numbered phases sized to single
sittings, each naming its files, its engine-vs-CMS halves, its tests, and how
it is verified end to end. I work in small slices — a plan that only pays off
when finished is not usable.

## Rules for this session

- **Do not re-open design decisions.** The plan's §19 and §21 are settled. If
  you find a genuine contradiction or impossibility while planning, say so
  plainly and ask — as labelled multiple-choice options with your
  recommendation first. I design games; I don't code and I don't read notation.
- **Game-side fixes are deliberately queued for this phase**, not done ahead of
  it. The roadmap must schedule them: bursts become exactly 3 with at least one
  Token guaranteed (`Cartographer.js`, supersedes D-167's range); `epic` joins
  `TOKEN_RARITIES`; `ContentRules.test.js`'s 30-second cycle rule relaxes to
  tempo-band membership; the legacy EV fields and `isPrimarySource` on recipes
  are removed/migrated per the plan's §16.
- **First implementation task: transcribe the plan's §19 decisions (CMS-117
  through CMS-137) into `cms_rework_v2_decisions.md`** in the house style, and
  point CMS-107's note at them.
- Read the real code before planning against it — this project has a history of
  docs drifting from code. Start with `cms/src/engine/` (the old solver being
  replaced), `cms/src/engine/recipeSync.js` (the bypass seam the plan retires),
  `src/systems/board/BoardRunner.js`, and the `data/*.json` shapes.
- Keep `npm test` green at every phase boundary; verify anything player-visible
  in the running game. Commit each phase on main when verified, and log it in
  `CHANGELOG.md` under `## [Unreleased]`.
