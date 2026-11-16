# Review round 4: status

*Kept by the reviewer. Next free finding number: **CR4-168**.*

## Sessions

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| R0 | The map | triaged | 2026-11-07 | ea6b9f92 | `R0_the_map.md`: 12 findings (10 cleanup, 1 test, 1 docs; 0 owner-decision). The architecture doc holds; tools at ea6b9f92 match the baselines; the production bundle has no dev code. Top: the GameState rehydration cycle (CR4-001), terrain painters under systems (CR4-003), CMS-only ledger in src (CR4-010). |
| R1 | Tick and time | triaged | 2026-11-07 | 08d86ba1 | `R1_tick_and_time.md`: 5 findings (2 bug, 1 owner-decision, 1 perf reasoned P3, 1 cleanup). The best-kept corner of the code; nothing to bench. Top: playtime counts time away (CR4-013), dead sound hooks (CR4-014), live rules on the wall clock (CR4-015). |
| R2 | Board and mat engine | triaged | 2026-11-07 | 9d03ffb1 | `R2_board_and_mat_engine.md`: 15 findings (7 perf reasoned, 1 memory, 2 bug, 4 cleanup, 1 docs; 0 owner-decision). Sound engine; the costs are on the tick path. Top: room searches on the tick and a memo wiped by enemy steps (CR4-018), a move onto a copy leaves a zero-charge ghost (CR4-027), per-worked-Token recomputation that the catch-up multiplies (CR4-019/020). Measure first: a CPU profile of the catch-up and of C240 at p99. |
| R3 | Heroes, combat, equipment, progression | triaged | 2026-11-07 | b7559216 | `R3_heroes_combat_equipment_progression.md`: 13 findings (3 perf reasoned, 3 bug, 6 cleanup, 1 docs; 0 owner-decision, 1 owner question). Good, with one hot spot and card-era residue. Top: the loadout rebuilt on every per-tick work-time read, so T-078 is hot not latent (CR4-033); the bucket maths written four times with drift (CR4-036); two save fields written on every item gain and read by nothing (CR4-040). |
| R4 | Drawing | triaged | 2026-11-07 | 83461380 | `R4_drawing.md`: 15 findings (1 memory measured, 10 perf reasoned, 1 bug, 2 cleanup, 1 docs; 0 owner-decision). Good, much better than round 3 left it. Top: the cause of T-333, one-shot mat effects that only remove themselves when a frame finishes (CR4-046); a document query and layout read on every pointer move (CR4-048); fifteen pollers that never pause and an upkeep badge recomputing the mat per Bank change (CR4-050). Measure first: the soak hidden phase after CR4-046, a pointer-move trace, the ground build marks. |
| R5 | React plumbing | triaged | 2026-11-07 | 01830b61 | `R5_react_plumbing.md`: 6 findings (2 perf reasoned, 1 a11y owner-decision, 2 cleanup, 1 docs). Good: every subscription unsubscribes, no store hands React a fresh object, selectors keep the contract. Top: a hero's status recomputed by four stores per walk tick (CR4-061); the root redrawing the whole screen for a hover or a click (CR4-062); drag sources announcing a keyboard drag that cannot happen (CR4-063, owner). Measure first: re-run `bench/tick-commits.mjs`. |
| R6 | State and saves | triaged | 2026-11-07 | e16338be | `R6_state_and_saves.md`: 5 findings (1 cleanup, 2 perf reasoned, 1 bug, 1 docs; 0 owner-decision). Good and careful: whole-file writes, a rolling backup, a retry, an undo; the architecture map is exact here. Top: seventeen saved fields nothing reads and a required key for a dead system (CR4-067); the title screen parsing whole saves for five numbers (CR4-068); a save that grows per Region and has never been measured (CR4-069). Measure first: save size and stringify time on the owner's slot. |
| R7 | World, atlas, quests | triaged | 2026-11-07 | 18fd3e7f | `R7_world_atlas_quests.md`: 6 findings (2 cleanup, 2 perf reasoned, 1 bug, 1 docs; 0 owner-decision). Good: all seeded, nothing per tick but the quest clock, the map's counts exact. Top: migration code for saves the version check already refuses (CR4-072); settling lays the mat out up to nine times with a whole-field rasterise per candidate pond (CR4-073); the open world map recomputing every cell on every Bank change (CR4-074). Measure first: time `Atlas.settle` and `worldView()`. |
| R8 | Content boundary and CMS layer | triaged | 2026-11-07 | 18fd3e7f | `R8_content_boundary_and_cms.md`: 4 findings (2 bug, 1 cleanup, 1 docs; 0 owner-decision). Good: small startup work, one shared copy of nearly every rule, the map exact. Top: the Sync's stale-workspace guard compares ids only and the write is not atomic (CR4-078, P2, the owner's content); a recipe's items are checked nowhere but the CMS page (CR4-079); the Sync's words still promise maps (CR4-081). |
| R9 | Dead code, duplicates, cycles, lint | triaged | 2026-11-07 | 1410f15e | `R9_dead_code_duplicates_cycles_lint.md`: 5 findings (4 cleanup, 1 docs; 0 owner-decision). The tools' lists read item by item: about fifty dead exports and 127 stray `export default` lines (CR4-082), nine groups of logic written twice or three times (CR4-083), five lint errors that are lost logic among 74 (CR4-084); the cycle and dependency reports add nothing to R0. Nothing to measure. |
| R10 | Tests | triaged | 2026-11-07 | 1410f15e | `R10_tests.md`: 5 findings (1 test P2, 2 perf measured, 1 cleanup, 1 docs; 0 owner-decision). Strong: 7,875 of 7,880 pass at the default seed and all but one under a second seed. Top: one test relies on luck, the farming harvest (CR4-087); half the suite's time is thirty files, mostly seed sweeps and spawned processes (CR4-088); 57 files boot a browser environment for `localStorage` alone (CR4-089). Measured in two full runs. |
| R11 | Memory and idle | triaged | 2026-11-07 | b22900a1 | `R11_memory_and_idle.md`: 4 findings (2 memory measured, 1 perf measured, 1 docs; 0 owner-decision). Good: nothing the page owns leaks while visible. Top: the hidden pile-up is R4's CR4-046 and the soak's snapshots are taken after it drains (CR4-092); the 52 KB/min heap growth cannot be attributed from a minified build (CR4-093); at idle the page spends 124 ms/s and 122 style passes/s redrawing an unchanged mat (CR4-094). Measure first: a soak with a snapshot inside the hidden phase after CR4-046; a 60-minute unminified soak. |
| R12 | Shell, build, startup | triaged | 2026-11-07 | b22900a1 | `R12_shell_build_startup.md`: 5 findings (1 memory measured, 2 perf reasoned, 1 bug, 1 docs; 0 owner-decision). Good shell, quiet. Top: the boot preloads and pins all 756 sprites, 31 MB decoded (CR4-096); one 2.1 MB script with no code splitting and no boot timing mark (CR4-097); a minimised desktop app keeps the visible page's idle costs, unmeasured (CR4-098); no Content-Security-Policy (CR4-099). Measure first: boot marks; the desktop app minimised for ten minutes. |

States: `not started`, `reading`, `verifying`, `ready for triage`, `triaged`,
`closed`.

## Deep read (owner, 2026-11-15)

The owner found the twelve sessions above too shallow (one quick pass per area, 14 bugs in 100
findings) and asked for a deeper round. Rulings, 2026-11-15: **hunt bugs a player can hit**
(tidy-up and small speed notes are round 4's and are not re-filed); **one area per session,
properly** (the area split into small pieces by what the player does, each read whole by its own
read-only reader, every lead re-read by the reviewer, every finding checked by a second reader);
**start with the mat**. Findings keep the `CR4-` numbers; files are `D<n>_<area>.md`.

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| D1 | The mat: Tokens, work, orders, fights, timed changes, buffs (`src/systems/board/` and what it calls) | ready for triage | 2026-11-15 | cccf7a24 | `D1_the_mat.md`: 25 findings (22 bug, 3 owner-decision; 1 P1, 5 P2, 19 P3), 23 verified by a second reader (Opus) and 2 reasoned; 6 owner questions below. Ten readers read the area whole in eight pieces and two cross-cutting traces. The per-tick core came through clean; the bugs are where two rules meet. Top: a healing hero knocked out a second time after travel (CR4-101, P1); Thorns spending a second charge and a Thorn Elemental running out twice (CR4-103, CR4-104); a resting Forest deleted by a merge and a regrown tree or large building hopping across the mat (CR4-102, CR4-105). Thirteen latent rule shapes the CMS can author and the engine gets wrong are gathered in CR4-124. |
| D2 | Heroes, combat, gear, XP (`src/systems/hero/`, `combat/`, `equipment/`, `effects/`, `inventory/`, and the hero readouts in `src/ui/`) | ready for triage | 2026-11-15 | dcb3ff40 | `D2_heroes_combat_gear_xp.md`: 18 findings (14 bug, 4 owner-decision; 1 P1, 4 P2, 13 P3), all verified by a second reader (Opus), none refuted, 14 corrected. Ten are live, four gather 16 latent content shapes. The core rules (combat maths, fight clean-up, XP and perks, equip and swap, loot, hero state across load and travel) read sound. One ruling made, four questions below. |
| D3 | Saves and time away (`src/systems/core/` saves, load, catch-up; `src/state/`; `src-tauri/src/saves.rs`; `src/systems/world/` and `atlas/` for what is kept; the slot screen and settings) | ready for triage | 2026-11-16 | d2ce3b6d | `D3_saves_and_time_away.md`: 24 findings (20 bug, 4 owner-decision; 1 P1, 5 P2, 18 P3), all verified by a second reader (Opus), none refuted, 13 corrected. The save machinery is sound (atomic writes, backup fallback, one-tick transactions, Regions stored whole); the weak spot is CMS renames meeting old saves (CR4-158 to CR4-163). Two steps need one desktop try (CR4-144, CR4-149). Five owner questions below. |
| D4 | Screens and drag-and-drop | not started | | | |

### Questions for the owner from D1 (2026-11-15, answered the same day)

**Answered by the owner, 2026-11-15** (interview in the reviewer's session; the planning agent records them in the tickets and briefs). Where an answer differs from the question's options, the answer wins.

1. **Thorns costs no charge anywhere** (CR4-104, and CR4-103's double "ran out" goes with it).
   - *Redberry Bush*: the player gets Redberries every cycle; separately, 10 % of cycles the hero is pricked. 25 harvests per refill.
   - *Thorn Elemental*: Thorns is a passive effect with a 10 % chance each time the hero attacks the Elemental, not a cost at the kill. 100 kills.
2. **A hero needs the recipe's level to work it** (CR4-107): option (a).
3. **No Token merges, ever** (CR4-108; it also retires CR4-102 and CR4-117, and the wounded-enemy merge). Dropping a Token on its copy places it beside; the merge code and its "Restocked" notice go. Owner: *we don't have Tokens that refill this way anymore.*
4. **One spot for the whole cycle** (CR4-105). Owner: *all our Tokens should take up the same amount of space on the mat; a tree holds the same spot throughout its entire cycle.*
   - A Stump and a Sapling hold the grown Tree's spot (they may be drawn small). Today's content has them at `artSize: small`, half the Tree's width.
   - **No double-size buildings any more**: the Fighter's Academy (size 2 from a size-1 Foundation) becomes ordinary size, by change pack.
   - Reviewer's notes for triage, not ruled: the Cedar is a size-2 Tree today and by the owner's sentence would become ordinary size too (confirm with the owner in the pack); mats already saved with something tight against a Stump still need the growth to hold in place rather than hop (the finding's fix part 2).
5. **A healing hero's orders in other Regions** (CR4-101), the owner's own rule: a knocked-out hero never takes a task up again without the player. Orders in another Region are kept if the hero has healed by the time the guild arrives there; if the guild arrives while the hero is still knocked out, that hero's orders there are cleared.
6. **The next camp adopts a demolished camp's enemies** (CR4-111): option (a).
7. **A reload remembers the enemy's health** (CR4-122): the fight resumes where it stood, so closing the game mid-fight cannot turn a winning fight into a knock-out. A save-format change. Not ruled: whether an enemy still recovers when a hero walks away and comes back in live play (today it does; the planning agent asks if the fix would touch it).

The questions as asked; the reviewer's recommendation is first in each.

1. **Thorns on the Redberry Bush** (CR4-104). Each harvest spends a second charge for the prick, so the bush gives 13 harvests per refill, not 25, and the card does not say so. (a) **Free on the bush** (recommended: a code note says that was the intent; one content change by pack, 25 harvests like its neighbours). (b) Keep the cost and say it: the rule's sentence reads "uses 1 charge" and the pace maths counts it. And the Thorn Elemental (50 kills, not 100): (a) **keep its cost and say it** (recommended: "a charge on a monster" was the intent), (b) free there too.
2. **A low-level hero on a high-level recipe** (CR4-107). A level-1 smith can work a Furnace set to a level-90 recipe and earn its XP; the card and the recipe list say they cannot. (a) **A hero needs the recipe's level to work it** (recommended: what the card already says, what Foundations already do, and it closes a levelling shortcut). (b) By design: any hero may work what the guild's best hero unlocked, and the card and the list's divider stop saying otherwise.
3. **Merging Tokens that refill, and enemies** (CR4-108). Dropping a Forest on a Forest pours one into the other and removes it, though each would refill for ever; a wounded Cow merges into another Cow. (a) **Only Tokens that are used up for good merge; the rest sit beside each other** (recommended: nothing permanent is lost to a slip of the hand). (b) Keep merging for all.
4. **A tree or building with no room to grow** (CR4-105). Something placed tight against a Stump or a small Foundation leaves no room for the grown tree or the large building, which then appears up to 640 units away. (a) **It waits where it is until there is room, with the "no room" mark, and a drop beside one keeps room for what it will become** (recommended: nothing jumps, and the squeeze cannot be made by accident). (b) It may hop, but only to a spot right beside. (c) Leave it.
5. **A healing hero's orders in other Regions** (CR4-101; the double knock-out is fixed either way). (a) **The orders stay planted and the hero takes them up when healed** (recommended: the player's set-up is kept). (b) A knock-out takes down the hero's orders in every Region.
6. **A demolished camp's enemies** (CR4-111). Today they belong to no camp and a new camp spawns a second set. (a) **They stay, and the next camp of that kind beside them adopts them** (recommended). (b) They leave with the camp.

One ruling to look at, not a defect (CR4-122): on a reload a fight starts over with the enemy at full health while the hero keeps their wounds, so a fight the hero was winning when the game was closed can become a knock-out during the time away.

### Questions for the owner from D2 (2026-11-15)

**Ruled by the owner, 2026-11-15** (in the reviewer session):

- **Losing the only pickaxe** (CR4-137, P1). A renewable fallback, not an exemption: a Rusty Pickaxe and a Rusty Woodaxe drop from an early enemy or Token, work like the copper tools and have a 1 % chance to break, so the player can always restart. The defeat roll on tools stays. Reviewer notes for the content plan are in the finding (the source must need no tool and no fight a weak guild keeps losing; first shipped items with a break chance).

**Answered by the owner, 2026-11-15** (interview in the reviewer session; where an answer differs from the options offered, the answer wins):

1. **Which of two Foods a hero eats first** (CR4-126): the one in the earlier slot, moving on when the Bank runs out of it.
2. **Handing an item hero to hero onto a full loadout** (CR4-131): it replaces like a drag from the Bank does (sword for sword, hat for hat; the replaced piece goes to the Bank). This reverses the written rule: `docs/reference/GDD.md:740-745` and the test that pins the refusal change with it.
3. **A +10 % XP bonus on small awards** (CR4-138): a true 10 % by chance. The fraction is carried by chance (1.1 XP is 2 XP one time in ten); the at-least-1 floor goes. It shifts the bench fingerprint once.
4. **A fighting hero loadout** (CR4-139), the owner own rule, wider than the options: **no loadout changes at all mid-fight**, food, arrows and elixirs included, not only the hands. Locked only while trading blows: from the moment an enemy steps up until it falls or the hero leaves; between enemies the loadout is open. This also settles CR4-130 (an elixir can no longer be put on mid-fight, so its count cannot read one too high). Reviewer notes for the brief: the refusal needs a reason the player can see; eating is unaffected (a hero eats from the Bank stack, which the player can still restock); it covers every route that changes a slot (drag onto a slot, right-click, drop on the hero figure, drag to the Bank, hero-to-hero hand-over).

### Questions for the owner from D3 (2026-11-16, open)

For the planning agent to ask; the reviewer's recommendation is first in each.

1. **What a CMS rename does to existing saves** (CR4-160, and with it CR4-158, 159, 162, 163, 127). In the CMS an item or Token id follows its name, so correcting a name orphans the old one in every save. (a) **The CMS records each rename as old id to new id, the Sync carries that table, and loading a save rewrites the old ids everywhere they live** (recommended: names stay free to change and saves follow). (b) An id is frozen once the thing has been Synced; renaming changes only the display name. (c) Leave it, and only fix the worst consequences (the locked place, the unpayable price).
2. **Closing the game with the "While you were away" summary still open** (CR4-164). Today that accepts the time away and "Load as I left it" is gone. (a) **An unanswered summary is offered again on the next start, with "Load as I left it" still available** (recommended: closing is not a choice). (b) Closing accepts, as today, and the summary says so.
3. **Banners after a reload** (CR4-147). Unclicked banners are forgotten on reload, including the knock-out banner that is the only place a hero's losses are said. (a) **An event Token still on the mat gets its banner back, and unclicked knock-out and problem banners are saved and shown again** (recommended). (b) Only the event banner comes back; the losses go into a lasting log instead.
4. **Old Tokens when a type is given Charges later** (CR4-165; today six Tokens could be affected, among them the Coast, River and Lake). (a) **Copies already standing in old saves get the new Charges on load** (recommended: every copy behaves alike). (b) Old copies stay endless.
5. **Does the browser build reach players?** (CR4-145, CR4-157). If yes, the auto-save-Off tab close is P2; if it is only for development, P3. (a) **Desktop only; the browser build is for development** (recommended if so). (b) The browser build is or will be given to players.

## Round summary (reviewer, 2026-11-07)

All twelve areas are read and ready for triage: 100 findings, every one verified by a second reader
(Sonnet) against the code, 8 at P2 and 92 at P3, 2 `owner-decision`, 4 questions for the owner
below. By tag: 33 perf (6 measured, the rest reasoned and capped at P2), 32 cleanup, 14 bug, 12
docs, 5 memory, 2 test, 1 a11y. The code is in good shape everywhere; no area is unhealthy.

**Suggested triage order for the planning agent.** (1) The P2s: the stale-workspace guard in the
CMS Sync (CR4-078, the owner's content), the luck-dependent test (CR4-087), the hidden-page
pile-up and its mechanism (CR4-046, CR4-092), the zero-charge ghost (CR4-027), the loadout rebuilt
per per-tick read (CR4-033), the one-shot effects and pollers that make a minimised game cost
(CR4-050, CR4-098). (2) The four owner questions. (3) The measurements the areas ask for before
their perf fixes (each area's "Measure first" line), batched into one bench window. (4) The
deletions, by folder, from R9's lists and the areas' cleanup findings (R9's Notes gather them).
(5) Docs, in one pass over `ARCHITECTURE.md`, `TICKETS.md` and the comments each area lists.

## Findings by state

| open | verified | ticket | moot | owner-no |
|---|---|---|---|---|
| 0 | 0 | 100 | 0 | 0 |

*Triaged 2026-11-07 by the planning agent ([triage record](triage_2026-11-07.md)): every finding has a ticket (T-339 to T-382, plus T-058, T-078, T-140, T-309, T-333 and T-335 updated). None moot and none owner-no; the four parked questions were answered yes the same day.*

## Baselines (phase 1, director)

| Measure | Taken | Commit | File |
|---|---|---|---|
| engine bench | 2026-11-07 01:00 window | 85cefe1f (3f336e14) | `bench/baseline.json` |
| draw bench and calibration | 2026-11-07 01:00 window | 85cefe1f (3f336e14) | `bench/draw-baseline.json`, `bench/calibration/stamp.json` |
| memory soak, 30 min visible, 5 hidden | 2026-11-07 10:34; heap WARN 52 KB/min visible (T-335), hidden phase FAIL (T-333 confirmed: 294 nodes, 136 listeners a minute) | 44b75a7a | `bench/soak-baseline.json`, `baseline/soak.txt` |
| bundle size (`npm run build`, dist/) | 2026-11-07: one 2.13 MB script, 663 KB gzipped, no code splitting | 44b75a7a | `baseline/bundle.txt` |
| test suite wall time | 2026-11-07, quiet machine, worktree: 632 files, 7,876 tests, 206 s wall (CMS-only files 48 s) | 44b75a7a + d5a5fa9e | `baseline/suite.txt` |
| knip, depcruise, cycles, jscpd, lint | 2026-11-06 (prep) | 93338609 | `baseline/*.txt` |

## Questions for the owner

**Parked by the planning agent, 2026-11-07; answered by the owner the same day: yes to all four (each recommendation).** Recorded in T-381, T-375, T-378, T-382 and brief 540.

1. **Where the CMS's balancing code lives** (CR4-010, T-381). About 6,800 lines that only the CMS uses (the progression ledger's checks and balancing) sit in the game's code folder, and their tests add 48 s to every test run. (a) **Move them into the CMS's folder** (recommended: the game's tests get faster and the dead-code tools see the game as it is; nothing changes for the player or in the CMS). (b) Leave them where they are, with a note saying why.
2. **The "thorns" enemy trait** (CR4-039, T-375). Combat has a branch for an enemy trait that hurts the attacker, left from the card era; no enemy can carry it today. (a) **Delete it** (recommended: if thorns come back, it is designed then, with the enemy moves of brief 280). (b) Keep it for authoring later.
3. **The floating "+1 / -1 charges" number on Tokens** (CR4-055, T-378). It was switched off long ago and still ships hidden. (a) **Delete it** (recommended: nothing the player sees changes). (b) Bring it back (a look to pick from screenshots, then an eye-check).
4. **A smaller desktop installer** (CR4-100, T-382). Three standard release settings for the desktop build would shrink the installer; not a defect. (a) **Yes, add them** (recommended: one small change, checked with one desktop build). (b) No, leave the build as it is.

**Answered by the owner, 2026-11-07** (interview in the reviewer's session; the planning agent records them in the tickets):

- **Keyboard drag (CR4-063): (b).** Remove the Tab stops and the false announcement; drag sources stay pointer-only. Nothing a mouse player sees changes.
- **Playtime (CR4-013): the guild's whole time, including the away time the player accepted.** The catch-up keeps adding to it (an undone catch-up never counts: it reloads the earlier save). The word "Playtime" stays; the field's comment and the ticket change, not the code's behaviour.
- **Sounds that never play (CR4-014): (b).** Drop both sounds and their dead hooks.
- **XP bonuses on kills (CR4-037): every XP bonus is skill-specific**, and that includes the four combat skills: a bonus aimed at Melee, Ranged, Magic or Stealth applies to the XP a kill awards in that style, a bonus aimed at a work skill to that skill's cycles. The hero-side multiplier that reads nothing is replaced by that rule, not deleted. **Content to follow: four Guild Hall stars, one per combat style, raising that style's kill XP.** The owner wants a brief straight away (no concept interview): the planning agent writes it, the content agent makes the pack.

The questions as asked:


- **Keyboard drag (CR4-063).** Every hero, flag, Bank item and Shop row is a Tab stop that tells a screen reader it can be lifted with the space bar, and nothing happens when it is. (a) Add keyboard drag for real (a feature: a sensor plus a rule for where a keyboard drop lands on the free mat). (b) Remove the Tab stops and the text; drag sources stay pointer-only (the reviewer's recommendation for now: honest, small, and nothing a mouse player sees). (c) Leave it until a keyboard or screen-reader player asks.

- **"Playtime" on the slot screen** (CR4-013): today it grows while the catch-up plays the time you were away. Should it mean (a) time the game was open, so the catch-up stops adding to it (recommended: that is what the label and the field's comment say), or (b) the guild's whole life including time away, so the label changes and nothing else does?
- **Sounds that never play** (CR4-014): a defeat sound and an "invasion" sound are wired to moments the engine never announces. (a) Wire the defeat sound to a hero's defeat on the mat and decide what "invasion" means now (a settled place's enemies arriving?), or (b) drop both sounds and the dead hooks (recommended if no moment comes to mind: the knockout banner already plays a warning tone).
- **XP bonuses on kills** (CR4-037): a Guild Hall star or an item that adds XP applies to work cycles but never to the XP a kill awards; the hero-side multiplier that was meant to carry it reads a value nothing writes. (a) Kills get the same XP bonuses as work (changes the bench's XP totals), or (b) XP bonuses are for work only, by design, and the dead multiplier is deleted (recommended if that was the intent: the palette's own hint says "XP awarded to the working hero per cycle").
