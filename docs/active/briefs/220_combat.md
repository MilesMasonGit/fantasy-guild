# Brief 220 — combat, the detail pass

*Written 2026-10-24 by the combat planning agent from the owner's interview
(2026-10-22 to 24). The design is
[`concept_combat.md`](../concept_combat.md), section "Detail pass rulings":
**read it whole before any phase; it is the spec, and this brief only splits
it into phases.** Where the older "Direction" lines disagree, the detail-pass
rulings win (amendments are marked there). Built by the **Systems director**;
the owner gave the go on 2026-10-24.*

Background, not spec: [`research/combat_review.md`](../research/combat_review.md)
(an executive summary of the finished system, plus gaps; the owner's
answers to it are in the concept doc) and
[`research/combat_depth_options.md`](../research/combat_depth_options.md)
(the options the depth rulings were picked from, with worked numbers).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, GDD §4 (health, equipment), §6
(combat), §7 (the Rules grammar), §14 (the Performance Envelope), and
`concept_combat.md` "What the code does today" (checked 2026-10-22; verify
again, comments in `src/systems/combat/` are hypotheses).

## Ground rules

- **Small numbers everywhere.** HP 10 + combat level; a bronze sword hits
  about 2. Every percentage rounds to the nearest whole, halves up; a hit
  always does at least 1.
- **Abilities, elixirs, boss moves and statuses are Rules-system effects**
  (`src/systems/effects/`), authored in the CMS, not fixed code lists. Where
  the grammar lacks a moment or a modifier, add it to the grammar.
- **⚠️ Performance.** An even fight now lasts 30 s or more, so more fights
  overlap. GDD §14 designs for 1–2 fights at once and about 6 enemies alive;
  measure how many fights run at once on the reference board before and
  after C1 and C5, and **stop and report** if long duels push it past the
  envelope. The cost is fights at once, not the swings per fight.
- **WORK CHANGED is expected** on C1–C5 (combat outcomes change): explain it
  before accepting each one.
- **Old saves**: fight state is not saved (memory only). Heroes' stored max
  HP must be recomputed from the new formula on load and on level-up.
- **Content**: none ships yet. Test with fixtures; the first real items come
  from a CMS change pack (C0) the owner reviews.
- Overlaps with the skill-loops and basic-content planners are listed at the
  end of the concept doc; don't build their parts (drink buffs, work
  elixirs' content, the map chain, the enemy roster).

## C0: the director accepts the test batch (owner 2026-10-24)

The owner is away from their PC and allowed the director to put in the
test batch itself. This is a **one-off exception for this pack only** to
"the owner Syncs" (ruling 2026-10-13); `data/` is still never hand-edited.

1. In the main checkout, on `main` (`git branch --show-current`), with
   nothing uncommitted under `data/`.
2. **Guard the owner's unsynced work first**: compare the CMS workspace
   (its autosave on disk) with `data/`. If the workspace differs from
   `data/` in anything, the owner has unsynced edits: **stop**, don't
   Sync, and park it as a question in STATUS.
3. Run the CMS in the browser pane, open the pack in "Changes to review",
   accept it, then **Sync to Game**.
4. **Id-diff every data file** against the commit before the Sync: only
   the pack's new or changed ids may differ. Anything else changed or lost:
   revert that Sync commit and stop.
5. Push `main`, one STATUS line, and tell the owner what went in; they can
   undo the pack from the CMS archive when they're back.

## Phases

Two code subagents at most at once. C1 goes first; C2 and C3 may run in
parallel after it; C4 after C2; C5 after C1; C6 last. Tiers are
suggestions; the director picks.

| Phase | What | Needs | Tier | Eye-check |
|---|---|---|---|---|
| C0 | **First combat content as a CMS change pack** (brief 200's way): bronze and copper weapon families (sword, dagger [melee + stealth], cleaver, bow, wand, a two-hander), leather armour (hat, chest), two elixirs (Valor +1 damage, Ironskin +1 armour), and kinds on the goblins (the Goblin Chief as the Iron Ore map's skill gate, numbers for a well-equipped combat-20 hero). Draft after C2 has the fields. **The director accepts it itself** (owner 2026-10-24, see below). | C2 | builder writes, director accepts | no (test batch) |
| C1 | **The numbers.** HP 10 + combat level, recomputed on level-up and on load; damage = weapon + about 1 per 20 levels; fixed hits; miss = 10 % ± level gap + enemy Dodge − hero Accuracy, clamped 5–40 %; crit 5 % (gear can raise it), doubled **before** armour; flat armour, minimum 1; Pierce ignores that many armour points; weapon speed fast 2 s / normal 3 s / slow 4 s; style cycle kept, ±25 % damage; Recruits punch for 1 every 3 s with no weapon, style or XP; no regen in fights, about 1 HP / 10 s outside. **Propose the enemy level table and weapon tiers** (level → HP, hit, armour, speed, XP; tier → damage), tuned so an even fight lasts 10+ swings, as one table in the concept doc for the owner. Retire the old exponential curve (`FormulaRegistry.js`, `CombatFormulas.js`). | — | engineer | no (numbers; the owner plays it at C6) |
| C2 | **Gear and enemies.** A weapon names its style(s); a hero equips only weapons of their own style (a Dagger is melee and stealth). Weapon and armour **families carry an ability** as a Rules effect (Spear: Pierce 1; Cleaver: a chance to double Meat drops; a Hide Vest: poison stacks at most 1 lower); an ability may touch anything, work included. Enemies gain armour, Dodge and speed; the CMS fills HP, hit, armour, speed and XP from the level table and lets the author override any; the five **enemy kinds** (Armoured, Nimble, Swift, Brute, Venomous) are CMS presets, none to two per enemy. Slots stay as built. | C1 | engineer | no |
| C3 | **Supplies.** Food heals below 25 % HP, taking the swing, as today. Drinks stop healing (their buffs are the skill-loops planner's; leave a drink equipped as a no-op until then). **Elixirs**: drunk at fight start, each lasts **10 fights** (one number for every elixir), every equipped elixir type active at once, effects stack; wire `consumeLoopConsumables` or replace it. **The "used" bubble** over the hero for food, drink and elixirs (icon + effect, about 1.5 s). Defeat keeps today's cost (25 % of each carried food's Bank stack, a 10 % gear loss roll): deliberate, don't soften. | C1 | builder | yes (bubble) |
| C4 | **Statuses and boss moves in the Rules system.** Poison (stacks to 3, 1 per stack per tick) and Burn (1 per tick for a few ticks, no stacks, food heals half); tick about 3 s; all statuses end with the fight. Retire `StatusEffectSystem.js` and `statusRegistry.js` once nothing borrows from them (check the Rules tick first). New moments for boss moves: **every Nth swing** and **when HP falls below X**; first moves: heavy strike, status attack, heal or gain +2 armour, enrage. | C2 | engineer | no |
| C5 | **Encounters.** Every fight one-on-one: a second hero flagged at a busy enemy waits or picks another (no more restart). **Guardians** block their node until beaten and return on a timer. **Node ambushes**: an ambush rule on a Token, a chance per finished cycle (about 5 %) to spawn its enemy against the worker (the engine's `Spawns` with a firing chance). **Bosses** live in lair Tokens or come from summon items, never ambush, heal to full between attempts, return on a short timer, and are fought offline like everything else. Camps unchanged. | C1 | engineer | yes |
| C6 | **The combat screen.** **Mock-ups first** on the style-sheet page (two or three; the owner picks from screenshots on their phone). Then: floating text for every hit both ways (white on the enemy, red on the hero, "Miss", a bigger "Crit!", green heals, poison/burn ticks); HP bars with number and percentage ("8 · 50%"); a small **combat icon over each fight** that opens the **combat panel over the playmat, like the Token inspection popup** (both fighters' HP, styles, statuses with stacks, elixirs, what just happened); the **enemy card** on hover and in the panel (level, style icon, HP, hit, armour, speed; kinds once fought); the hero-to-enemy link in the bubble row of brief 210 F2 (T-239: build that part after it lands, the rest needn't wait); an **overnight combat block** in the catch-up summary. ⚠️ Drawn things: measure with `bench:draw --compare`. | C3, C4, C5 | engineer | yes |

## Done means

Each phase: the merge gate (`TESTING.md`), exercised in the running game
(a Recruit against a goblin, a promoted hero against a fixture enemy of each
kind, an elixir lasting 10 fights, a boss lair), the engine work check on
every merge with WORK CHANGED explained, the cost log for C3 and C6, and
the fights-at-once count from Ground rules. GDD §4, §6 and §7 updated to the
new rules as each phase merges; changelog entries.

## Owner CMS to-do

- Nothing needed for C0: the director accepts the test batch (owner
  2026-10-24); the owner may look it over or undo it in the CMS later.
- After C1: look over the proposed level table in the concept doc; tune
  freely.
- Later, with the basic-content planner: the real enemy roster, weapon and
  armour families, and which enemies gate which maps.
