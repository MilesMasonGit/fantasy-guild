# Ideas and the post-crunch plan

The owner's ideas for future features and improvements, sorted into the order
they'll be designed and built. **Nothing here is decided or ready to build**
until its interview is done and it has moved on to a ticket, concept or brief.
Directors don't act on this page.

## How an idea moves on

1. **Listed** here, as the owner said it, in the stage it belongs to.
2. **Interview**: multiple-choice questions until it's clear what the owner
   wants and how it sits with the GDD and the crunch briefs.
3. **Write-up, by size**:
   - small fix or tweak → a ticket in [TICKETS](../reference/TICKETS.md)
   - look or feel note → [design_pass_notes.md](design_pass_notes.md)
   - real feature → a `concept_<name>.md` with the owner's decisions, then a
     numbered brief in [briefs/](briefs/README.md)
4. The idea's line leaves this page and points to where it went.

Tags: **⚠️ overlaps** = touches an area a crunch brief is rebuilding ·
**quick** = likely just a ticket · **research** = read-only investigation.

---

## The plan at a glance

The order follows three rules (owner, 2026-10-08): small and simple changes
early; design docs that later work depends on are finished first; each piece
comes after the things it builds on, so planning stays clean.

**Stage A — now, alongside the crunch.** Small changes, quick rulings and
read-only research. None needs a design doc, none blocks a crunch brief.

**Stage B — design interviews, in this order.** Each ends in a concept doc
(or a section of an existing one). Interviews only need the owner's time, so
they run while the crunch builds.

| # | Design doc | Why here | Deadline |
|---|---|---|---|
| D1 | **Ground rules**: tone and world, "pops of activity", sound | Short; guides every later doc and all agent-written text | — |
| D2 | **Progression, pacing and the Atlas loop** | Everything else needs a pacing curve; some questions change the Atlas | **before brief 70 (Atlas)** |
| D3 | **Combat and gear** | Hearts resets every HP and damage number; the Atlas places enemies, ambushes and lures | ideally before brief 70 |
| D4 | **Skill loops and the board as a puzzle** | The biggest content job; needs D2's pacing and D3's numbers | before post-crunch content |
| D5 | **Knowledge: dependency map, encyclopedia, collection log** | Same "what comes from where" data; the CMS map should exist before D4's content is authored | with or right after D4 |
| D6 | **The Guild Hall**: constellation screen, upgrades, transitions | Upgrades are progression (D2); transitions need the Atlas screen | after D2 |
| D7 | **A living game**: events, the return, hero identity, bubbles | Builds on D1's principle and brief 40's summary | after D4 |
| D8 | **Quests and the tutorial** | Teaches what D2–D7 settle; the Atlas replaces today's opening | after the Atlas |
| D9 | **Release package**: saves, playtest, distribution, modding | Last before outside players | pre-release |

**Stage C — build after the crunch, in this order.**

1. Dormant code clean-out (clears the ground for everything after it).
2. CMS dependency map and agent authoring at full strength (tools first, so
   content goes faster).
3. Combat and gear (sets the number scale content uses).
4. Skill loops and adjacency content, neighbour previews, movable markers.
5. Full CMS review and the simulator's model (owner: once loops and the Atlas
   are in).
6. The Guild Hall: constellation screen, upgrade content, transitions.
7. Encyclopedia, collection log, Bank search.
8. Events, hero identity, effects through bubbles.
9. Quests and the tutorial rewrite.
10. Look polish: top bar, pixel borders, animations, faster static Tokens.

**Stage D — before release.** Saves, distribution, translating existing text,
the first outside playtest, modding.

---

## Stage A — now, alongside the crunch

### Follow-ups after the running briefs

- **Hero flags**: smaller, and fade to half opacity while work is happening on
  them. *quick* · follow-up after brief 30 (owner, 2026-10-08: don't
  interrupt the running session; there will be several design passes).
- **Accessibility**: heroes are told apart by 8 flag colours; add
  colour-blind-safe colours and a second cue (pattern or initial). Text size
  settings already exist. · could ride with the flag change above.
- **The return experience, first pass**: brief 40 (running) is building the
  "While you were away" summary now. At its eye-check, judge it as a present,
  problems framed as "what to fix next". The full design is in D7.

### Quick changes and rulings

- **Widen the playmat** and **tuner baselines** (Tokens overlap less; heroes
  get a larger base work radius). *quick* · do with **T-097**, which turns the
  Mat Tuner's numbers into fixed game values; the owner picks the numbers in
  the game. Today: up to 40 % overlap, 164 u flag radius.
- **Translation** setup: ticket **T-119** (the game will be translated, owner
  2026-10-08). Pick how text is stored; new UI uses it.
- **Credits register**: T-124. List every asset pack, its licence and the
  attribution wording, so nothing used goes uncredited.
- **"No work in range." bubble goes** (D1 pops rule): with the brief 30
  follow-up.
- **Leftover rough edges**: the slot screen's "SYSTEM BOOT" (already T-039),
  nine "coming soon" Settings controls, no gameplay hotkeys. *quick* · tickets.

### Tools that speed everything after

- **Agents author content through the CMS**: let an agent quickly create and
  manage items and Tokens. *quick to medium* · `data/` is only written by the
  CMS (its workspace lives in the browser; Sync to Game writes `data/`), so
  this likely means a CMS-side import or scripting path the owner reviews and
  syncs. Helps the owner's brief 20 content (Academies) too. Short interview:
  how the owner wants to review agent-made content.
- **CMS saving**: unsynced CMS work lives only in the browser ("Restore from
  Game" rebuilds synced content). Backups; may grow into the modding system.
  Pairs with agent authoring.

### Read-only research (any time, in parallel)

- **Owner art list**: one to-draw list, so art is ready before the code.
  - **Terrain**: brief 80's research phase (what of the old terrain system
    survives, the look questions) run early to produce its art list.
    ⚠️ reorders brief 80's first phase only; the code still follows the Atlas.
  - **True animations** with owner art, e.g. falling leaves when a tree is
    hit: plan which and how many frames.
- **In-engine animation brainstorm**: light effects done in code, no new art,
  as a menu to pick from with a rough cost each. Starts from today's hit
  animations and transform glow (T-011); crunch rule: no expensive mat
  effects without a cost-log line.
- **Pixel-style UI borders**: how to make borders look pixel-like to match the
  art, within UI_STYLE.md's "no thick borders, no frames inside frames".
  Related: T-013 (switch the remaining glows and text-shadows to the
  hard-pixel style).

---

## Stage B — design interviews

### D1 — Ground rules

- **Tone and world guide**: the GDD has mechanics but no world, mood, humour
  or naming style. Agents will soon write item names, bubble lines and event
  text; a one-page guide keeps them consistent.
- **"Pops of activity"** as a rule for the whole game: the board is **largely
  static, with pops of activity**, so the player is never oversaturated but
  always has the next thing to look at. Likely lands in UI_STYLE.md or the GDD.
- **Sound**: no audio section in the GDD; the game starts at volume 0. Will
  there be sound, and who makes it? If yes, it joins the asset lists early.

### D2 — Progression, pacing and the Atlas loop ✅

Done 2026-10-09 → [concept_progression.md](concept_progression.md). Covered
progression and pacing, endgame, economy and item sinks, moving day, showing
what can move; "something else that improves with level" is deferred there.

### D3 — Combat and gear

- **Combat system, built out properly**: today it's "a glorified slap fight".
  Owner's direction: **keep it simple**; try **Hearts instead of HP points**;
  **low numbers**, so one or two extra damage is a noticeable boost.
  ⚠️ today HP runs from 50 at level 1 to ~3,700 at 99, so this reworks the
  whole HP and damage scale. GDD §6 has the current rules.
- **Gear**: the loadout grid exists but no gear ships. Under Hearts, weapons and
  armour are where the +1s come from.
- **Enemy variety**: 4 enemies, all melee; the Cow and Thorn Elemental are
  really nodes you hit. The combat cycle (melee > ranged > magic > stealth)
  has nothing to act on. Plan the roster, including Atlas spawners, ambushes
  and lures.
- **Status effects**: 7 built (Poison, Burning, Bleed, Stun, …), none used.
  Decide what survives "keep combat simple", or move them to magic.

### D4 — Skill loops and the board as a puzzle

- **One core loop per skill**: so each skill feels different, and to prototype
  how they'll work. The first content to build (owner, 2026-10-08).
  - **Occult / magic / enchanting sketch (very loose)**: Tokens need to be
    **charged with elements**. An enchanting table has **three slots** that
    take context from other placed Tokens; charge comes from **leyline map
    features** or **support Tokens** the player builds; **different
    combinations give different outputs**. · builds on the existing `nearby`
    reach (164 u, the four side neighbours); leylines would be an Atlas map
    feature or modifier (raise in D2 if it changes brief 70).
- **Tokens hardly interact**: pillars 1 and 3 promise a self-feeding ecosystem
  and mechanically different skills; the rules grammar can do far more (16
  verbs, 12 moments, neighbour modifiers) than the handful that ships. With a
  fixed post-Atlas board, **layout and adjacency** could be the main thing
  players think about: a theme across all loops.
- **Show neighbour effects while placing**: while a Token is held over the mat,
  the Tokens it would help or be helped by light up ("+5 % speed from Coast").
  Without it, adjacency is invisible maths.
- **Skill list scope**: 25 skills, 12 of them placeholders. Always open to
  rework; the owner will evaluate it later. Revisit here if loops need it.

### D5 — Knowledge: dependency map, encyclopedia, collection log

- **CMS dependency map**: the CMS understands the progression chain laid out
  through items and enemies, e.g. Oak Wood → fight the Tree Ent → Fir Forest
  map → Fir Wood. Build it once and use it in both the CMS and the encyclopedia.
- **Encyclopedia**: search every entity, Token and item. A **provenance** view
  shows, for any item, the items and sources needed to produce it. Goal: the
  player never needs an outside wiki. Reads sources from the game data, so it
  stays current as the Atlas adds maps and modifiers.
- **Collection log / achievements**: entries unlock as things are discovered,
  so the encyclopedia doubles as a "what have I found" goal list.
- **The Bank at scale**: maybe several hundred items after loops and gear;
  design search and filters, perhaps shared with the encyclopedia.

### D6 — The Guild Hall

- **Guild Hall upgrade screen**: complete overhaul in a **star /
  constellation** style. The Atlas adds global Guild upgrades (Token cap,
  crafting slots), so the tree will grow.
- **Guild upgrade content**: build out the Hall upgrades (follows D2's pacing).
- **Screen transitions**: "look up" at the stars for Hall upgrades, down or to
  the side for the Atlas.

### D7 — A living game

- **Events system**: random events that keep the player engaged, e.g. a
  **shooting star** that lands and can be mined, a visit from a **frog
  prince**. Ask: what happens to events while offline, and should they only be
  treats (the Atlas concept: combat isn't a "random chaotic event")?
- **The return experience**: offline runs "same rules as playing" (fights,
  wounds, empty seeds). Design the return as a whole: the summary should feel
  like a present, problems framed as "what to fix next".
- **Hero identity**: every recruit is identical with a random name, max 8. A
  quirk, a favourite task or their own bubble lines would make heroes worth
  caring about.
- **Effects speak through bubbles**: effects and rules firing show up through
  the speech bubble system (applies D1's "pops of activity").

### D8 — Quests and the tutorial

- **Quests and the tutorial**: bounties are "collect N" or "defeat N Goblins"
  for 10 Oak Wood; the tutorial teaches today's opening, which the Atlas
  replaces (Starter Camp, buildings-only Shop). Quests could also carry events.

### D9 — Release package

- **First outside playtest as a milestone**: decide what must be true before
  someone else plays (tutorial, saves, first-hour pacing). *process* · may be
  worth deciding earlier, as a target for Stage C.
- **Saves before release**: saves live in the desktop app's browser storage,
  and other versions are refused until 1.0. Real save files and carrying saves
  across updates.
- **Release readiness**: how updates reach players, readable crash logs, where
  it's sold (itch.io, Steam, …; Steam has requirements and lead times).
- **Translating existing text** (after T-119's setup).
- **Modding system**: let players make their own content. Leans on the CMS and
  its saving, translation and the encyclopedia's data.

---

## Stage C notes — build items without their own interview

- **Dormant code clean-out**: Time Bank, energy (ruled to go), Villager heroes,
  Map bursts, the unloaded `stations.json`. Leftovers breed misleading comments
  and slow every agent. First after the crunch.
- **Full CMS review** once the new loops and the Atlas are in, including **the
  simulator's model**: it prices in an abstract "gold per hour", built before
  items-only currency, Hearts and the Atlas. Review, then tickets.
- **Top bar visuals**: the bar with Token upkeep and the disallow controls;
  (the hero control button became brief 30's Work Rules button). Brief 10 just
  reworked the bar, so after the crunch.
- **Faster drawing for static Tokens**: if a Token can't move, it may be drawn
  more cheaply. Fits brief 90 (the Performance Envelope) or a follow-up; brief
  60 runs before the Atlas, so it can't use this.
- Implementing the Stage A research: pixel borders, chosen in-engine effects,
  true animations once the owner's art exists.

---

## Being interviewed

*(none)*

## Moved on

- **D2 Progression, pacing and the Atlas loop** (pacing, implicit tiers, moving
  day, economy, endgame and new game plus, the Starter Camp, movable markers)
  → [concept_progression.md](concept_progression.md), done 2026-10-09;
  brief 70 points to it; tickets T-125 (level speed), T-126 (tools last
  forever), T-127 (markets cut). **What grows with level** stays open there,
  deferred.
- **D1 Ground rules** (tone and world, story hook, pops of activity, sound) →
  [concept_tone_and_world.md](concept_tone_and_world.md), done 2026-10-09.
- **Master allow / disallow all per hero** and the **hero control button** →
  brief 30's work rules grid (owner eye-check, 2026-10-09): a Work Rules
  button on the hero bar; clicking a hero's row header allows or disallows
  the whole row.

## Dropped

Suggestions the owner turned down, so they aren't raised again.

- **Automated progression bot** (a headless playthrough to check pacing): the
  owner would rather understand and control the dependencies directly (the CMS
  dependency map). 2026-10-08.
- **Stations at scale** (stations suggesting or cycling recipes): not a
  concern. 2026-10-08.
