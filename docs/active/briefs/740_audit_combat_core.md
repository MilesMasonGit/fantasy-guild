# Brief 740 — Audit fixes: the fight, enemies, kills and the combat screen

*Written 2026-11-21 by the planning agent from the Systems Audit, group 2 (Combat), systems A31, A33,
A32, A34 and A35 ([the hit](../audit/A31_the_hit.md), [statuses and boss moves](../audit/A33_statuses_boss_moves.md),
[enemies](../audit/A32_enemies_encounters.md), [winning, losing and loot](../audit/A34_winning_losing_loot.md),
[the combat screen](../audit/A35_combat_screen.md)). The owner's rulings of 2026-11-20 are in each ticket
row and each card's "Owner feedback"; they are locked. Runs after briefs 710, 720 and 730 (Effects).
Its sister brief is [750 The combat styles](750_audit_combat_styles.md), which runs after this one's engine phases.
Owner answers 2026-11-21 folded in.*

**What the player gets.** One clear rule for how a hit is worked out (damage types without groups,
resistance cutting what a boost leaves, Venom as Poison damage, every fraction rolled the same way).
Enemies that fight in two plain ways, always-on traits and the attacks they choose, with each move
called by its own name. Enemies that come back only from their camps, keep their wounds and heal
quickly, and never turn up as loose bosses: a boss is what a boss camp spawns. A kill that pays as a combat cycle, counted once. An
enemy's Token card that shows everything about it, health bars that turn green, amber and red, the
fight window and the mat showing a hit the same way, and one word, Defeated, for winning and losing.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (combat, effects and fight
moments, loot, saves, the content boundary), GDD §6. Each phase's cards (above) and ticket rows in
`docs/reference/TICKETS.md`; the ticket rows carry file:line read at `50cd9b2f` (check the code, it
wins; comments in this area are often wrong). Topic files: [effect wording](../audit/topic_effect_wording.md)
(C3), [news told twice](../audit/topic_banners_twice.md) (C10).

**Standing rules for every phase.**

- **Numbers for the tuning page.** The owner wants several numbers on the CMS tuning page (T-253,
  not built yet): the enemy heal of 5% a second, the 5-stack limit. Each
  becomes one named constant beside the other combat numbers in `src/config/FormulaRegistry.js`, so
  T-253 lifts them from one place. If T-253 has landed by then, they go on the page.
- **Content goes as change packs.** Never hand-edit `data/`. Where a phase needs content changed, the
  content agent writes the pack; the order (pack first or code first) is in the phase and in Owner
  to-do. A test fixture stands in for content in tests.
- **Hover words wait for their writer.** Where a ticket says "its hover says so" (T-534, T-550,
  T-551), this brief makes the rule true; the effect descriptions are T-495's (the Telling the player
  group). If T-495 has landed, add the line to the effect's description; if not, note it for T-495.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| C1 | T-533, T-534, T-535 | **The hit's maths.** (1) A hit part's type factor becomes part × (1 + Type Damage %) × (1 − resistance after Sunder), never below 0 (`CombatFormulas.js:321-324`): Poison +20% on 50% resistance does 60%, 100% resistance is always 0, a −50% weakness is ×1.5; the Weak!/Resisted label follows the same maths (`:426-435`). (2) Venom's ticks deal Poison-type damage, which Poison resistance cuts (`DealDamage.js:117-137`); Burn and other statuses unchanged. (3) All damage rolls its fraction, as a swing does (1.5 is 1 or 2): rule damage (Deals) and status ticks stop rounding to nearest (`DealDamage.js:82, 101`), drawing from the same seeded order so a catch-up replays it. Red-first tests for each. | builder |
| C2 | T-532 | **Damage types without groups.** Only the nine types carry numbers; a fighter's resistance or Type Damage for a type is all its lines for that type added, heroes and enemies alike (`damageTypes.js:138-144`, `CombatFormulas.js:290-310`); until C5, an enemy's authored line still replaces its kind's preset for that type; from C5, when kinds are effects, everything adds (see C5). Enemy kind presets split in code (Armoured: Slash, Crush and Stab 50, `enemyKinds.js`). An enemy's plain swing hits as Crush, like a fist. The CMS loses the group rows and gains a fill-in button (set all Physical fills Slash, Crush and Stab; the same for Elemental and Special); the content audit names any group line left in data. **The content agent's pack splitting today's group lines (gear, effects such as Flutter, the Wind Elemental's Physical 25) is Synced first**: under today's code a split line adds or replaces exactly as its group did, so the pack is safe before the code. The Crab keeps its Crush −50. | builder |
| C3 | T-536, T-561, T-537 | **Attack Speed, Strike, Damage, and the fight's leftovers.** The effect's name, Attack Speed, and its sign flip so good reads plus are brief 790 W3's (W3 owns the three renames, Recovery, Lap Speed and Attack Speed); C3 runs after W3 and does the rest. A weapon or enemy **Attacks every 3s**, in the game and the CMS (`en.json:141, 487`, `TokenEditor.jsx:794`, the CMS rule name); an unnamed move reads **Strike**; item tooltips say **Damage** and **Attacks every 3s**, not DMG and Speed (`en.json:138, 141`); no swing words left (`en.json:367, 400-410, 460, 471, 487, 513, 519, 527, 531`). Code names follow; an id stored in `data/` does not change here (stop and report if one would). Leftovers (T-537): `ignoresArmor` read by nothing (the code side; its data is the content agent's pack); the CMS's Armor, Resistance and Pierce rule rows marked does nothing (`modifierPalette.js:561-638`) removed; the CMS content generator stops writing the old enemy shape (`contentGenerator.js:131-142, 436-455`); `heroDamageMultiplier`'s `1 + (x − 1)` becomes `x` (`CombatFormulas.js:257`); the Crit Chance hint covers enemies too (`modifierPalette.js:649`). | builder |
| C4 | T-539, T-541 | **An enemy's effects are Passive or Active, each move named.** Passive: a trait always on, or a rule that fires on a fight condition (below a health line, when struck). Active: the enemy's moves, picked by weight only (no every-Nth timing for an enemy). A move's effect on the hero lands only if that attack hits, by the same accuracy as any attack, with no separate chance; an effect on the enemy itself (Flutter, a heavy swing) always happens (`FightMoments.js:40-56, 104-119, 148-157`, `CombatAttackProcessor.js:146-178`). A move is announced by its own name (Heavy Strike, Tail Smash) over the enemy and in the log; a passive by the effect it lands (Enrage) (`effectLibrary.js:210`, `FightMoments.js:198`, `CalloutLayer.jsx:120-123`). Heroes' gear rules keep their fight moments. **Two steps**: step 1 lets moves carry hero effects and merges with the Venomous kind still working; the content agent's pack re-authors the Goblin Chief, Wind Elemental, Greater Slime, Fire Elemental Chief, Queen Bee and Toxic Frog (poisoning moves carry Venom) and the owner Syncs; step 2 retires the Venomous kind (`enemyKinds.js:57-68`, `VENOM_EFFECT_ID`). | builder |
| C5 | T-540, T-542, T-548 | **Enemy kinds become CMS effects; status and enemy leftovers.** Each kind is an ordinary library effect the owner edits (Armoured: Slash, Crush and Stab 50, slow) and the Token editor's kind boxes pick from library effects; one system for every number change (`enemyKinds.js:32-67`, `enemyProfile.js:109-116`). **A kind's numbers add to the enemy's written lines** (one rule, as every effect; planning agent's call 2026-11-21): the content agent rewrites kinded enemies' lines to keep today's numbers (the Crab's Crush −50 becomes −100 on top of Armoured's 50). **Swift and Brute become plain effects**: Swift a faster Attack Speed and Damage −33%, Brute a slower Attack Speed and Damage +33%, rolled each hit like any Damage %; Brute's "at least 1 more" floor retires, and the Fire Elemental's hit is written by the content agent so it plays as now (planning agent's call 2026-11-21). **A boss is what a boss camp spawns** (owner 2026-11-21): the CMS's boss tick on an enemy (`enemy.boss`) goes with the boss flag below; anything that needs to know reads the camp (check the drawer line, `lifecycleLines.js:160`, and the world generator's boss camp, `generate.js:544`). **Two steps**, as C4: step 1 reads kind effects with the code presets as fallback, the content agent's pack authors today's four kinds with the same numbers, the owner Syncs, step 2 removes the presets. Leftovers (T-542): retire the game-time effect clock (`durationMs`, `LiveEffects.js:194, 240`), the boss flag and its CMS tick (`isBossEnemy`, `enemyProfile.js:63`, its tests and drawer line; the data is the pack), the Poison-to-Venom id migration (`effectIdMigration.js:32-35`), the unread `traits` (`enemyProfile.js:169-171`), the comments naming a Hide Vest, Stone Skin and Poison on Aela (`CombatFormulas.js:176`, `modifierPalette.js:754`, `fightWatch.js:335`); the 5-stack limit (`effectLibrary.js:39`) becomes a named tuning number and the CMS effect editor shows it. Enemy leftovers (T-548): `hostile`, `budgetScale` (and its CMS field, `TokenEditor.jsx:734-743`; no enemy uses it), the work-cycle `config.xp` and `cycleTimeMs` on enemy Tokens (code side; the data is the pack), Beaten and Waiting for moved to `en.json` (`heroSpeech.js:58, 64`), one test for an enemy camp (`SpawnerSystem.isEnemyCampType`, `reachDisplay.js:51-54`), stale comments (`enemyProfile.js:84-86`, `SpawnerSystem.js:401`, `BoardCombat.js:103-104`). `traits` appears in both tickets: remove it once. | builder |
| C6 | T-545, T-546, T-547 | **Enemies on the mat.** (1) Every enemy has one use and comes back only by its camp's clock; the 2 s stand-up retires (`CombatResolutionProcessor.js:53`, `CombatProcessor.js:38-47`, the intermission in `BoardCombat.js:426-432, 541-543`) and the CMS stops offering uses on an enemy. The content agent's pack (Cow Pasture and Thorn Thicket intervals, the Cow and Thorn Elemental at one use) goes first: it is safe under today's code. The 2 s rest after a kill retires with the stand-up (planning agent's call 2026-11-21): it never runs once every enemy is one use, and the tuning page drops it. (2) An enemy keeps its damage when a fight ends without a kill (flee, swap heroes, leave the Region, `BoardCombat.js:314, 358-362, 618-621`) and, out of a fight, heals 5% of its max health a second, rounded up; kept on the enemy, saved, and caught up after time away or a Region swap; 5% a named tuning number. Builds on the saved enemy health from brief 650 where it has landed. (3) Arrivals no longer roll a loose boss (`Arrival.js:184-212`, `bossChance` in the CMS world rings); the field leaves the CMS, and the content agent's pack clears it from `data/world.json` after the code. | builder |
| C7 | T-550, T-551, T-552, T-554 | **A kill is a combat cycle.** A kill pays as a cycle of its own kind: Yield, Double Loot, Double Item, bonus drops and the XP bonus reach it; Refresh, Fail and Giant Harvest do not (`LootSystem.js:50-92` beside `BoardRunner.js:264-420`). Kill loot counts for the collection log, On Produces rules and item-made quests; a kill counts once for quests (today twice, `QuestManager.js:130-139, 214-218`). Giant Harvest works on Farming work cycles only (`OutputRules.js:47-48`). A kill reaches neighbours as On Kill only: no On Neighbour's Cycle, and an enemy's own On Cycle rules no longer fire at its death (`BoardCombat.js:517, 525`, `triggerRegistry.js:86-91`, `TriggerSystem.js:646`). Loot leftovers (T-554): bonus drops counted in the fight window's Drops line and the time-away tally (`LootSystem.js:90-91`, `CatchUp.js:318`); a fight's drop list read at each kill, not frozen at fight start (`BoardCombat.js:401`); the dead direct-to-Bank branch (`LootSystem.js:84-88`) and `isFleeing` (`CombatProcessor.js:80`) removed; T-554's ask to keep the 2 s rest's leftover time closes with the rest itself (retired in C6). | builder |
| C8 | T-544 | **No enemy hover; its Token card shows everything.** The mat hover over an enemy goes (`EnemyCard.jsx:35-80`); the Token card (`tokenCard.js:516-528`) shows level, Style, health, moves, resistances, kinds and drops. Kinds stay hidden (? fight one) until that enemy has been fought; the rest shows from the start. Reads moves and kinds in the shape C4 and C5 leave. | builder |
| C9 | T-556, T-557, T-562 | **The combat screen's look.** (1) Every health bar green, amber and red by health (hero bar, Hero drawer, fight window and tabs, fighters on the mat, heroes and enemies alike; `healthBar.js:4`, `VitalBar.jsx:5-11`), replacing the light red of T-317; build with green above 50%, amber 25% to 50%, red below 25% (where heroes eat), one place to change them; the owner sets the lines at the eye-check. (2) The fight window and the mat show a hit with the same look and timing from one shared set of colours, icons and lengths: what landed, a move, a Venom or Burn tick with its drop or flame (`FightPanel.jsx:50-53, 99-120`, `fightFloats.js:25-34, 56-82, 115-119`, `callouts.js:11`); the phase proposes which of today's two timings to keep (strike frame or not) in its report, recommendation first, and the director parks it for the eye-check. (3) Every hero whose fight window is open shows an open fight button, top or not; a minimised window counts as closed (`FightLayer.jsx:39-95, 129`, `fightPanelStore.js:50-53, 107`). | builder |
| C10 | T-558, T-559, T-560, T-563 | **The fight's words and logs.** An elixir drunk mid-fight appears in that fight's log at once (`fightWatch.js:209-214, 289-295`). **Defeated** for winning and losing: `Defeated Goblin in 42s`, `Defeated by Goblin after 1m 5s`, Defeats in the away summary; it replaces knock-out and knocked out everywhere the player reads them (fight screens, banners, the loss rules, wounds, tips; `en.json:388, 439-441`, `fightWatch.js:347-365`, `heroSpeech.js:64`, `CatchUpOverlay.jsx`); code names may follow. The away summary lists defeats first (`CatchUpOverlay.jsx:338-369, 469-481`): if T-506 (brief 795 M3, the summary's one writer) has landed, in its writer; if not, here, and M3 keeps the order. T-560 stays in this phase. Leftovers (T-563): the computed title, clock and health text never shown (`fightView.js:384-388`, `healthBar.js:36, 48`), two unused keys (`en.json:431-432`), leftover float styles (`tailwind.css:656-662`), the copied helper (`fightWatch.js:336`, `callouts.js:35`); the redraw on every swing only if it is a small change (else note it on T-198). Nothing drawn changes. | builder-lite |

**Order and parallel work.** Two lanes, at most two code agents at once:

- **Lane A (the fight's rules):** C1 → C2 → C4 → C5 → C8. C1 and C2 both touch `CombatFormulas.js`;
  C4 and C5 both touch `enemyProfile.js` and the effect code; C8 reads what C4 and C5 leave.
- **Lane B (the mat and the screen):** C3 → C6 → C7 → C9 → C10. C3 and C10 both touch `en.json`;
  C6 and C7 both touch `BoardCombat.js` and the combat processors; C9 and C10 both touch
  `healthBar.js` and `callouts.js`; C10 also waits for C5 (`heroSpeech.js`).
- C3 may run beside C1 (its one line in `CombatFormulas.js:257` merges after C1). **C3 after brief 790 W3**
  (W3 owns the effect renames; T-536 and T-561 follow it). The two-step phases (C4, C5) leave their step 2 waiting on the owner's Sync;
  the lane carries on with the next phase meanwhile.
- **Before this brief:** brief 730 (Effects). Nothing here needs a 730 ticket first; C5's library
  effects and the CMS effect editor sit next to 730's effect work (T-516's caps in `effectLibrary.js`),
  so take C5 after 730 has merged.
- **After this brief:** brief 750 needs C1, C2, C6 and C7 merged before its engine phases. The living
  mat brief's T-619 (a kill listed once in the away summary) assumes C6's one-use enemies.
- **Across briefs:** brief 730 D2 (guild combat effects reach heroes) sums per type only once C2
  (T-532) has landed. C10's defeats-first order (T-560) goes into brief 795 M3's summary writer
  (T-506) when M3 has landed; brief 765 W3 owns the time-away threshold, which C10 does not touch.

## Done when

- Gate green on every phase; the director reads each Sonnet diff whole.
- **Bench work check** (`npm run bench -- --compare`):
  - **WORK CHANGED expected**: C1 (rolled rule and tick damage, and resistance after boosts, move the
    fingerprint), C4 (moves by weight only, move effects only on a hit), C6 (two enemies become one-use;
    no loose bosses in arrivals), C7 (quests count a kill once, kill loot feeds On Produces, Giant
    Harvest scoped). The director names each in STATUS and checks the move is only what the ticket
    says.
  - **Small WORK CHANGED expected at C5 step 2**: Swift's and Brute's hits become plain effects rolled
    each hit and Brute's +1 floor retires; named in STATUS. Resistances stay the same once the kinded
    enemies' lines are rewritten.
  - **Same work**: C2 (once the split pack is in: if it moves, check the plain swing as Crush against
    the heroes' type lines and report), C3, C8, C9, C10.
- `bench:draw --compare` once with the C9 eye-check build for the cost log; no drag bench (no drag
  code changes).
- **Seen in the running game**: a hero with Poison resistance under Venom; a status tick rolling its
  fraction in the log; the Crab still weak to Crush; a move's effect missing with its attack and
  named over the enemy; the Cow coming back from its camp; an enemy fled from keeping its wound and
  healing; a kill's loot ticking a quest once; an enemy's Token card before and after its first
  fight; the health bars at three healths; a hit and a Venom tick on the mat and in the window side by
  side; two fight windows open with both buttons open; Defeated in the window, log, banner and away
  summary.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent told which packs can go.

**Eye-check: yes**, two looks. (1) **Enemies** (C4, C6, C8): moves named and landing only on a hit,
enemies keeping their wounds and coming back from camps, the enemy's Token card. (2) **The combat
screen** (C9, with C10's Defeated in passing): the health colours (the owner sets the lines), a hit
the same on the mat and in the window (the owner picks the timing), the fight buttons. C1, C2, C3, C5,
C7 and C10 merge on the gate with one line each in STATUS.

## Owner to-do

The content agent writes each pack; the owner reviews and Syncs on `main`.

1. **Before C2**: the pack splitting group lines into types (gear, effects, the Wind Elemental).
2. **Before C6**: the Cow Pasture and Thorn Thicket pack (intervals, one use each).
3. **After C3**: the pack clearing `ignoresArmor` from three effects.
4. **Between C4's two steps**: the pack re-authoring six enemies' moves (Goblin Chief, Wind Elemental,
   Greater Slime, Fire Elemental Chief, Queen Bee, Toxic Frog), with the Goblin Chief's description
   (no raw `applies effect_heavy_strike`).
5. **Between C5's two steps**: the pack authoring Armoured, Nimble, Swift and Brute as library effects
   (Swift and Brute as Attack Speed and Damage %), rewriting kinded enemies' resistance lines to add on
   top of their kind (the Crab's Crush −100) and the Fire Elemental's hit; with it, the pack clearing
   enemy leftovers (`hostile`, the Cow's `config.xp`, `cycleTimeMs`, the boss tick).
6. **After C6**: the pack clearing `bossChance` from the world rings.
7. **After C7**: the content agent checks every Giant Harvest use is on Farming.
8. **Picks**: the health bar lines and the hit timing at the combat screen eye-check.

## Handled outside this brief

- **T-538** (planning agent): GDD §6 The fight matches the game, after C1 to C3.
- **T-543** (planning agent): GDD §6 statuses and boss moves, after C4 and C5.
- **T-549** (planning agent): GDD §6 enemies and encounters, after C5, C6 and C8.
- **T-553** (content agent): rare drop tables for work and enemies, the enemies' banner maps and
  prospecting maps moved into them; a change pack. The engine already rolls an enemy's rare table
  (`LootSystem.js:66-70`), so it needs no code; best after C7.
- **T-555** (planning agent): GDD on kills and rare tables (§3, §6, §7), after C7 and T-553.
- **T-564** (planning agent): GDD and UI_STYLE on the combat screen (the light red ruling replaced),
  after C9 and C10.
- **T-530** (Effects group, brief 730): Limes' lines on defeat losses use the word Defeated (T-559).
