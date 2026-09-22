# Hero Movement — roadmap v1

**Written 2026-09-21. Approved by the owner 2026-09-22. Status: M1 done.**

The first item of the owner's post-playmat list ("Hero NPC logic"): heroes stop
being drawn at their job and start **living on the mat** — walking, pottering,
coming and going through the Guild Hall. Think of a fish in a tank: the player
never steers them, but they follow rules you can predict by watching.

This replaces the roadmap outline "Stage 2 — Autonomous heroes, 2.1 Walking and
2.2 Crew behaviour" in `docs/free_playmat_roadmap_v1.md` §5. The vision is
`docs/concept_hero_animations.md`; where this document differs, this document
wins (noted in §3).

---

## 1. Already decided — not re-opened

| Id | Decision |
| :-- | :-- |
| FP-26 | **Walking costs work time**, marginally: a job's timer runs only once the hero has arrived. |
| FP-51 | Health and energy recover while walking, like everything else. |
| FP-76 | The player never moves a hero. Dragging a hero moves their **flag**. |
| FP-29 / FP-84 | An idle hero goes back to their flag. (HM-1 says what they do there.) |
| FP-68 | A hero leaving a Token mid-cycle resets its progress; a moved Token keeps its progress and carries its hero. |
| FP-80 | A hero never leaves mid-cycle for better work; they look again when the cycle ends. |
| Concept | Heroes enter from the Guild Hall and leave into it; sprites face right and flip to walk left; one flat walking speed for everyone at first. |

## 2. Owner decisions, 2026-09-21

| Id | Decision |
| :-- | :-- |
| **HM-1** | **Idle heroes potter near their flag**: short strolls to random spots close to it, pausing a few seconds between, playing the idle animation while stopped. They stay within easy sight of the flag. |
| **HM-2** | **A hero works from the side they arrive on** — left or right of the Token, facing it. **The Token stays where it is**; it no longer shifts over to make room (retires D-266's pairing shift). |
| **HM-3** | **Straight lines, over Tokens.** No pathfinding (keeps assumption A-1). A walking hero is drawn above the Tokens they pass. Steering around Tokens can be added later without redoing this. |
| **HM-4** | **"Nearest" is measured from the hero**, priority first as today (FP-72). Heroes work through a cluster instead of zig-zagging back to the flag's centre. Replaces FP-57's "nearest to the flag" as that decision foresaw. |
| **HM-5** | **Recall is instant for the player.** The flag disappears, the hero's tab is back in the dock at once (marked as returning), and they walk into the Guild Hall. Sent out again mid-walk, they turn toward the new flag. |
| **HM-6** | **A defeated hero limps home** — walks to the Guild Hall slowly, visibly wounded, then disappears inside (FP-42 still furls the flag and says who fell). In the dock at once, as with a recall. |
| **HM-7** | ⭐ **Saves remember what each hero is working.** On load, a hero who was working stands at that Token and carries on; the Token's cycle progress (already saved today) continues from where it was — this matters for Tokens with very long cycles. Idle or walking heroes start at their flag. **Amends FP-58** (claims were never saved). A fight in progress still restarts, as today. |

## 3. Director's picks (provisional — the owner can overturn any)

* **HMP-1 — A newly planted hero walks from the Hall straight to their first job**
  (the nearest in their flag's area, HM-4), or to the flag if there is none. The
  concept says "walk to the flag first"; going straight there saves a pointless
  detour.
* **HMP-2 — A hero claims a Token when they set off toward it**, so two heroes
  never race for one (FP-25). They count as *working* it — for buffs, statuses
  and the "who works this" questions — only once they arrive.
* **HMP-3 — A Token moved while its hero walks toward it: the hero follows it.**
* **HMP-4 — Walking speed is a Mat Tuner slider** ("Walk speed", FP-66),
  starting around 120 mat units a second (the mat is 1760 wide, so ~15 s edge to
  edge). Limping (HM-6) is half speed. The owner tunes both by feel.
* **HMP-5 — Heroes without an animation sheet** (only Recruit, Fighter, Ranger,
  Rogue and Wizard have one) glide as a still picture until their art exists.
* **HMP-6 — Differences from the concept doc:** heroes stand *beside* a Token,
  not on its centre (HM-2); they work "until the cycle ends, then look for
  better work" (FP-80), not "until the Token is depleted".

## 4. How it is built (technical)

* **A position of their own.** Each hero on the mat gets a runtime position and
  a state — *entering, walking, working, pottering, leaving, limping* — held
  beside the flag claims in `BoardState`, never in the three seam functions'
  meaning. `displayPointOf` keeps meaning "where their job is".
* **⚠️ No rebuild storms.** `HERO_MOVED` (which makes `TileModifiers` rebuild two
  neighbourhoods) is still published only when a claim changes or a hero
  arrives — never per step of a walk.
* **Smooth on screen.** The engine moves heroes 10 times a second (the game
  loop); the renderer glides between those steps, so walking looks continuous.
* **Offline catch-up** (a long gap between ticks): heroes arrive instantly
  rather than walking in fast-forward.

## 5. Slices

Each slice: tests, run the game and exercise it, one commit, merge.

| Slice | What | Verified when |
| :-- | :-- | :-- |
| **M1 — Heroes have a position** | Runtime position and state; walking at the tuned speed; claim on departure, work only on arrival (FP-26, HMP-2); follow a moved Token (HMP-3); nearest measured from the hero (HM-4); offline catch-up. Drawn at their true position (jumpy until M2). | A planted hero visibly travels to a Token, its timer starts only on arrival, and two heroes never take the same Token. |
| **M2 — Walking looks right** | ⚠️ Much of this landed in M1 (glide, facing, animation rows, standing beside a still Token). What remains: an idle hero drawn by `FlagLayer` at an offset from the flag jumps when they arrive at it — one hero layer for every state; polish of the glide (a mid-tick re-target); the arrival/turn feel, judged in game by the owner. | A hero walks, turns to face, and works from either side with no jumps anywhere. |
| **M3 — The Guild Hall** | Enter from the Hall (HMP-1); recall walk home with turn-around and a "returning" dock mark (HM-5); defeated heroes limp home (HM-6). | Plant, recall mid-walk, re-send, and a defeat all play out on the mat. |
| **M4 — Pottering** | Idle heroes stroll near their flag (HM-1). | Eight idle heroes look alive but calm. |
| **M5 — Saves remember work** | Save each hero's claim; on load a working hero resumes at their Token mid-cycle (HM-7). | Save mid-cycle on a long Token, reload, and the hero is there with the bar where it was. |

**Out of scope here** (their own items on the owner's list): moving badges and
the progress bar ("Token work presentation"), speech bubbles, enemies that
wander, flags placed onto Tokens, and walking around Tokens.

## 6. Implementation status

| Slice | Status | Notes |
| :-- | :-- | :-- |
| M1 | ✅ **DONE** 2026-09-22 | `HeroMotion.js` owns each hero's body (position, target, side, `atWork`, facing) in `BoardState`'s per-board runtime; `workerOf` / `workTokenOf` answer only once the hero has arrived, and stay answered for that claim while they catch up to a moved Token (FP-68, FPP-4). Claim on departure, arrival publishes one `HERO_MOVED`, steps publish `HEROES_WALKED`. `Flags` calls `HeroMotion.settle` after every claim change; nearest measured from the hero (HM-4). New status `walking` (to a Token, or back to the flag — the latter counts as idle). Mat Tuner **Walk speed** (120 u/s). Pulled forward from M2: the Token no longer shifts for its hero (D-266's `PAIR_OFFSET_PX` deleted), heroes drawn at their body's point with a one-tick linear glide, walk / work animation rows and facing from the engine (the WIP's distance-guessed slide removed). Tests run with instant arrival (`src/tests/setup/instantArrival.js`, a global marker — importing game code there broke `vi.mock`); `HeroMotion.test.js` (14 tests) walks for real, two neuterings caught. In game: a 795 u walk took ~6.6 s, the Token's progress stayed 0 until arrival, the hero stood 80 u left of the Token, the Token did not move, 2 `HERO_MOVED` for the whole walk, walk row flipped left / work row on arrival. |
| M2 | NOT STARTED | |
| M3 | NOT STARTED | |
| M4 | NOT STARTED | |
| M5 | NOT STARTED | |
