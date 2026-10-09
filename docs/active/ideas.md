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
- **The return experience, first pass**: brief 40 built the "While you were
  away" summary. Owner (D7): a plain report focused on items and XP gained,
  a small notable-events section, enemies defeated. See
  [concept_living_game.md](concept_living_game.md).

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

### D3 — Combat and gear ✅ (general)

General direction done 2026-10-09 → [concept_combat.md](concept_combat.md);
the details (numbers, style traits, statuses, roster, gear slots) are
deferred to a later design pass. Covered: combat system, gear, enemy
variety, status effects.

### D4 — Skill loops and the board as a puzzle ✅

Done 2026-10-09 → [concept_skill_loops.md](concept_skill_loops.md): the nine
Starting skills' loops, adjacency as a theme and how it's shown, gathering
tools as hero gear (T-126); specialist skills are sketches (incl. the
Enchanting sketch); skill list scope stays open. Prototyping waits for the
Atlas.

### D5 — Knowledge ✅

Done 2026-10-09 → [concept_knowledge.md](concept_knowledge.md): one automatic
"what comes from where" graph for the CMS dependency map, the encyclopedia
(spoiler hints, 2–3 steps back, uses one step ahead), map previews, the
collection log and Bank search.

### D6 — The Guild Hall ✅

Done 2026-10-09 → [concept_guild_hall.md](concept_guild_hall.md): themed
constellations (Hearth, Vault, Compass, Well), ranked stars, neighbour and
material gates, camera-move transitions. The starter upgrade list is written
later, with the content work.

### D7 — A living game ✅

Done 2026-10-09 → [concept_living_game.md](concept_living_game.md): events
(treats, a few per hour, landings, visitors, Region happenings), dialogue in
bubbles with requests as quest Tokens, the return summary as a plain report,
hero recolouring.

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
  Map bursts, the unloaded `stations.json`, the old status engine (D3:
  statuses move to the Rules system). Leftovers breed misleading comments
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

- **D7 A living game** (events, dialogue, the return, hero identity) →
  [concept_living_game.md](concept_living_game.md), done 2026-10-09.
- **D6 The Guild Hall** (constellation screen, upgrade content, transitions)
  → [concept_guild_hall.md](concept_guild_hall.md), done 2026-10-09.
- **D5 Knowledge** (dependency map, encyclopedia, collection log, Bank at
  scale) → [concept_knowledge.md](concept_knowledge.md), done 2026-10-09.
- **D4 Skill loops and the board as a puzzle** → [concept_skill_loops.md](concept_skill_loops.md),
  done 2026-10-09. Changes the Atlas (growing places keep spawning; noted on
  brief 70) and tools (T-126: gathering tools become hero gear).
- **D3 Combat and gear** (general direction: Hearts as HP, everyone fights,
  bosses and party fights, gear crafted plus rare drops, potions from Alchemy)
  → [concept_combat.md](concept_combat.md), 2026-10-09; details deferred.
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
