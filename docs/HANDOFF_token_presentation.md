# Handoff — Token work presentation

*Written 2026-09-22 for the agent picking this up. Paste the prompt below, or
point the agent at this file.*

---

## The prompt

You are picking up **Token work presentation** on Fantasy Guild.

**Read `CLAUDE.md` first — it is how the owner wants to be worked with, and it is
not optional.** In short: the owner does not code, so explain in plain language;
ask design questions as multiple choice with trade-offs and your recommendation
first, never open-ended and never a silent guess; verify by running `npm test`
and by actually playing the game before you call anything done; stay in scope
and mention anything unrelated rather than folding it in; work in small slices,
each committed.

**The job, in the owner's words:** *"A worked token's UI is still the same from
when we had the grid system, so it's going to need an overhaul. Some examples:
instead of the token shifting slightly to the left, it should stay in place and
the Hero walks to its position. Heroes should be able to approach a token from
either the right or the left, instead of just the right. We have more space to
show what's happening, so some badges and the progress bar could be moved."*

**Two of those three are already done** (Hero Movement, merged 2026-09-22): the
Token no longer shifts, and heroes walk up and work from either side. What is
left is the **look of a Token being worked** — the badges, the progress bar, the
alert marks — which are still laid out for the old grid, where a hero and their
Token were one stacked square.

**How to work this, before any code:**
1. **Explore.** Read the current drawing code and the decisions behind it.
2. **Write a short brief** for the owner: what you understand them to want, what
   exists today, and the open questions as **multiple choice with a
   recommendation**. Expect questions like: what a worked Token should show at
   rest versus on hover; where the progress bar goes now that the hero stands
   beside the Token rather than on it; whether badges follow the Token, the
   hero, or the pair; what a stuck Token looks like; how it all reads with eight
   heroes at work.
3. **Get the owner's answers**, write them into a concept/roadmap doc the way
   `docs/hero_movement_roadmap_v1.md` does (locked decisions with ids, director's
   picks marked provisional, slices with a "verified when").
4. **Build one slice at a time**, each with tests, a run in the game, a commit
   and a merge.

**Where things are:**
* `src/ui/components/board/MatToken.jsx` — one Token on the mat: art, badges,
  progress bar, alert marks.
* `TokenBadges.jsx`, `TokenProgressBar.jsx`, `TokenEventAlert.jsx`,
  `MatPointAlerts.jsx`, `boardConstants.js` — the pieces it draws.
* `MatBoard.jsx` — the mat: Tokens, heroes, loot, rings, layer order in
  `matLayers.js`.
* `MatHero.jsx` + `src/systems/board/HeroMotion.js` — where a hero actually is
  (`heroPointOf`, `bodyView`, `standingSpot`, `idleSpot`). **Positions are the
  engine's; the screen only draws them.**
* `docs/hero_movement_roadmap_v1.md` — what heroes now do, and the decisions
  HM-1…HM-7 behind it.
* `docs/free_playmat_roadmap_v1.md` — the playmat's locked decisions (FP-*).
  **Anything marked locked is not to be re-litigated**; bring evidence to the
  owner if you think one is wrong.
* `docs/concept_free_playmat.md` — the vision and the risk list.

**Traps that have cost this project real time:**
* **Never hand-edit `data/*.json`.** The CMS is the only authoring surface and
  its "Sync to Game" overwrites anything authored outside it. Use the CMS or a
  test fixture.
* **`main` is not green.** Exactly **11 tests fail** on a clean checkout
  (ContentRules, EconSimRunner, EconSimTime, ItemSellValue, OneRuleOnePlace ×2,
  TerrainRegistry ×5) and ESLint reports **73** errors. Compare failing test
  *names* against that list before blaming your own change.
* **Verifying in the browser pane:** screenshots time out — read the page and
  probe instead. `window.Game` and `window.GameState` work, and dynamic
  `import()` works when the path matches what the app loaded. **A hidden pane
  freezes `requestAnimationFrame`**, so drag-pointer tracking and anything that
  waits a frame will not run; polyfill rAF with `setTimeout` in the page to test
  drags. Editing a module reloads the page and drops you back to slot select, so
  do each in-game check in one script.
* **Tests run with heroes arriving instantly** (`src/tests/setup/instantArrival.js`,
  a global marker). Turn it off with `BoardState.setInstantArrival(false)` when a
  test is about walking, and put it back afterwards.
* Commit messages: no double quotes (PowerShell mangles them).

**Out of scope** (each is its own item on the owner's list): hero speech bubbles
replacing alert badges, green/yellow "can be worked" dots, enemies that wander,
flags placed onto Tokens, the horizontal hero dock redesign, and tools becoming
equipment. If the presentation work seems to need one of them, say so and let
the owner decide rather than pulling it in.

**Start by exploring and coming back with the brief and your questions. No code
until the owner has answered them.**
