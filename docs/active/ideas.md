# Ideas inbox

The owner's raw ideas for future features and improvements, waiting to be
interviewed. **Nothing here is decided or ready to build.** Directors don't act
on this page.

## How an idea moves on

1. **Inbox**: one line, as the owner said it, plus a tag if one is obvious.
2. **Interview**: multiple-choice questions until it's clear what the owner
   wants and how it sits with the GDD and the crunch briefs.
3. **Write-up, by size**:
   - small fix or tweak → a ticket in [TICKETS](../reference/TICKETS.md)
   - look or feel note → [design_pass_notes.md](design_pass_notes.md)
   - real feature → a `concept_<name>.md` with the owner's decisions, then a
     numbered brief in [briefs/](briefs/README.md)
4. The idea's line leaves this page and points to where it went.

Tags: **⚠️ overlaps** = touches an area a crunch brief is about to rebuild ·
**after-crunch** = waits for the crunch to finish · **quick** = likely just a ticket.

## Inbox

### Look and feel

- **Top bar visuals**: improve the bar holding Token upkeep and the disallow
  controls; perhaps add a **hero control button** there. *after-crunch* ·
  ⚠️ overlaps brief 30 (hero bar) for the button; brief 10 just reworked the
  top bar.
- **Guild Hall upgrade screen**: complete overhaul in a **star / constellation**
  style. *after-crunch* · the Atlas adds new global Guild upgrades (Token cap,
  crafting slots), so the tree will grow.
- **Screen transitions**: better animations between screens; "look up" at the
  stars for Hall upgrades, down or to the side for the Atlas. *after-crunch* ·
  needs the Atlas (brief 70) and the constellation screen; pairs with both.

- **In-engine animation brainstorm**: explore light animation effects done in
  code (no new art), for a menu of options to pick from. *research first* ·
  today's Token hit animations and transform glow (T-011) are the starting
  point; crunch rule: no expensive mat effects without a cost-log line, and
  brief 60 (deep optimization) sets the budget.
- **True animations with owner art**: e.g. falling leaves when a tree is hit.
  *after-crunch for the code* · plan early so the owner can draw the frames;
  belongs on the same owner art list as the terrain art.

- **Effects speak through bubbles**: effects and rules firing show up through
  the speech bubble system. Principle: the board is **largely static, with pops
  of activity**, so the player is never oversaturated but always has the next
  thing to look at. · a guiding principle as much as a feature; once
  interviewed it may belong in UI_STYLE.md or the GDD. Builds on brief 10's
  bubbles and callouts.
- **Show what can move**: after the Atlas, most Tokens are static, so mark the
  movable ones: a different outline, or only movable Tokens get the bob/lift.
  *after-crunch* · needs the Atlas (brief 70); Foundations are permanent there.

### Minor changes

- **Widen the playmat.** *quick* · ⚠️ overlaps T-097 (mat size becomes a fixed
  game value) and the Atlas/terrain briefs (maps are generated around the Hall).
- **Tuner baselines**: Tokens overlap less; heroes get a larger base work
  radius. *quick* · ⚠️ overlaps T-097; today up to 40 % overlap and a 164 u flag
  radius (GDD). Needs numbers picked in the game.
- **Master allow / disallow all per hero**: most players leave every skill on
  and steer by moving the flag; per-skill controls are only for players who
  want to micromanage (owner). Add one switch per hero to allow or disallow
  everything. *quick* · ⚠️ brief 30 rebuilds the work rules panel and hasn't
  run; may be what the top bar's "hero control button" becomes.
- **Hero flags**: smaller, and fade to half opacity while work is happening on
  them. *quick* · ⚠️ overlaps brief 30 H4 (the flag), which hasn't run yet.

### New features

- **Encyclopedia**: search every entity, Token and item in the game. A
  **provenance** view shows, for any item, the items and sources needed to
  produce it. Goal: the player never needs an outside wiki. *after-crunch* ·
  feature-sized · the Atlas adds new sources (maps, modifiers), so build it
  after brief 70 or make it read sources from the game data so it stays
  current. Nothing like it exists in the docs today.

- **Combat system, built out properly**: today it's "a glorified slap fight".
  *after-crunch* · feature-sized · GDD §6 has the current rules (four combat
  skills, one per promoted hero); brief 20's class rework decides who holds
  which. Owner's direction: **keep it simple**; try **Hearts instead of HP
  points**; **low numbers**, so one or two extra damage is a noticeable boost.
  ⚠️ today's GDD has HP from 50 at level 1 to ~3,700 at 99, so this reworks
  the whole HP and damage scale.

- **Events system**: random events that keep the player engaged, e.g. a
  **shooting star** that lands and can be mined, a visit from a **frog
  prince**. *after-crunch* · feature-sized · ask: what happens to events
  while the player is offline (brief 40), and the Atlas concept's line that
  combat isn't a "random chaotic event" (events should probably be treats,
  not punishments, in an idle game).
- **Pixel-style UI borders**: make UI borders look pixel-like to match the
  game's art; investigate how first. *research first* · must sit with
  UI_STYLE.md's "no thick borders, no frames inside frames"; the
  investigation is read-only and could run any time; anything new drawn on
  the mat gets a cost-log line.

### Tools and process

- **Agents author content through the CMS**: let an agent quickly create and
  manage items and Tokens. *quick to medium* · must respect the hard rule that
  `data/` is only written by the CMS: the CMS keeps its workspace in the
  browser and Sync to Game writes `data/`, so this likely means a CMS-side
  import or scripting path rather than an agent editing files.
- **Full CMS review** once the new Token loops and the Atlas are in.
  *after-crunch* · review, then tickets.
- **CMS dependency map**: the CMS understands the progression chain we lay out
  through items and enemies, e.g. Oak Wood → fight the Tree Ent → Fir Forest
  map → Fir Wood. Part of the CMS rework. · same underlying "what comes from
  where" graph as the encyclopedia's provenance view; build it once, use it in
  both (CMS for authoring checks, encyclopedia for players).
- **Terrain art early**: terrain needs a lot of owner art, so work out what art
  it needs well before brief 80 runs, giving the owner time to draw it.
  ⚠️ reorders brief 80 · its research phase (what of the old terrain system
  survives, the look questions) is read-only and could run early to produce an
  art list.

- **Faster drawing for static Tokens**: if a Token can't move, it may be drawn
  more cheaply. Explore when the time is right. *after-crunch* · brief 60
  (deep optimization) runs before the Atlas, so this fits brief 90 (the
  Performance Envelope) or a follow-up after it.

### Underdeveloped systems to review

Suggested by the director from the GDD's Built / Partial / Dormant labels;
the owner agreed all eight belong here (2026-10-08).

- **Progression and pacing**: what the player chases at 10 minutes, an hour,
  a week. Today "no unlocks"; progress is skill levels (99 ≈ 13 M XP), Hall
  upgrades and affording things, with *placeholder* prices (mostly 10 Oak
  Wood). Suggested first: skill loops, upgrades, combat and events all need a
  pacing curve to fit.
- **Gear**: the loadout grid exists but no gear ships (64 items, none
  wearable). Interview with combat: under Hearts, weapons and armour are
  where the +1s come from.
- **Economy and item sinks**: items are the only currency, nothing can be sold,
  Markets undecided (GDD §16), few things to spend surplus on. The CMS
  simulator still reasons in "gold per hour".
- **Quests and the tutorial**: bounties are "collect N" or "defeat N Goblins"
  for 10 Oak Wood; the tutorial teaches today's opening, which the Atlas
  replaces (Starter Camp, buildings-only Shop), so it needs rewriting after
  brief 70. Quests could also carry events.
- **Status effects**: 7 built (Poison, Burning, Bleed, Stun, …), none used.
  Decide what survives "keep combat simple", or move them to magic.
- **Sound**: no audio section in the GDD; the game starts at volume 0. If
  sound is planned, it's another owner asset list, best known early.
- **Saves before release**: saves live in the desktop app's browser storage,
  and other versions are refused until 1.0. Before outside players: real save
  files and carrying saves across updates. *pre-release*
- **Leftover rough edges**: the slot screen's sci-fi "SYSTEM BOOT" wording,
  nine "coming soon" Settings controls, no gameplay hotkeys. *quick*
- **Tokens hardly interact**: pillars 1 and 3 promise a self-feeding ecosystem
  and mechanically different skills; the rules grammar can do far more (16
  verbs, 12 moments, neighbour modifiers) but ships a handful (Coast −5 % work
  time, Windmill on Fields, Thorns). With a fixed post-Atlas board, **layout and
  adjacency** could be the main thing players think about. A theme across all
  skill loops, not one skill's gimmick; the enchanting sketch is an example.
- **Hero identity**: every recruit is identical with a random name, max 8. A
  quirk, a favourite task or their own bubble lines would make heroes worth
  caring about, and feeds "pops of activity".
- **Enemy variety**: 4 enemies, all melee; the Cow and Thorn Elemental are
  really nodes you hit. The combat cycle (melee > ranged > magic > stealth)
  has nothing to act on. Plan the roster in the combat interview.
- **Collection log / achievements**: entries unlock as things are discovered,
  so the encyclopedia doubles as a "what have I found" goal list. Pairs with
  the encyclopedia.
- **The CMS simulator's model**: it prices in an abstract "gold per hour",
  built before items-only currency, Hearts and the Atlas. If its model is
  wrong, every number it writes back is too. Make it an explicit part of the
  CMS review.
- **First outside playtest as a milestone**: decide what must be true before
  someone else plays (tutorial, saves, first-hour pacing). Turns several items
  here into one goal and orders the post-crunch work. *process*
- **Moving day**: under the Atlas, moving Region is the main progression and
  means rebuilding from scratch with no refund. Pillar 2 ("set up, don't
  micromanage") vs rebuilding the same layout every move: should the tenth
  move be faster than the first (saved layouts, packing up, rebuild-speed
  upgrades)? ⚠️ touches locked Atlas decisions; raise, don't re-decide.
- **The return experience**: offline runs "same rules as playing" (fights,
  wounds, empty seeds). Design the return as a whole: the "While you were
  away" summary should feel like a present, problems framed as "what to fix
  next". Pairs with brief 40 and events.
- **Endgame**: level 99 ≈ 13 M XP and tiered maps, but nothing says what the
  player does at the top, or whether there's a fresh-start-for-a-bonus loop
  ("prestige"). The progression interview should know if the curve ends or
  loops.
- **Tone and world guide**: the GDD has mechanics but no world, mood, humour
  or naming style. Agents will soon write item names, bubble lines and event
  text; a one-page guide keeps them consistent. *quick*
- **Accessibility**: heroes are told apart by 8 flag colours; add
  colour-blind-safe colours and a second cue (pattern or initial). Text size
  settings already exist.
- **Release readiness**: how updates reach players, crash logs that can be
  read, where it's sold (itch.io, Steam, …; Steam has requirements and lead
  times). Pairs with saves. *pre-release*
- **Dormant code clean-out**: Time Bank, energy (ruled to go), Villager heroes,
  Map bursts, the unloaded `stations.json`. Leftovers breed misleading comments
  and slow every agent. One cleanup job after the crunch.
- **The Bank at scale**: 64 items today, maybe several hundred after skill loops
  and gear; tabs and manual reordering may not keep up. Design search and
  filters (perhaps shared with the encyclopedia) alongside the skill loops.
- **Something else that improves with level**: levels are mainly for
  unlocking new Tokens and recipes (owner); each level's +0.5 % speed is
  invisible. The owner agrees something more should grow with level. Part of
  the progression interview.
- **Skill list scope**: 25 skills, 12 of them placeholders. Always open to
  rework; the owner will evaluate it later. Not urgent.
- **CMS saving**: unsynced CMS work lives only in the browser ("Restore from
  Game" rebuilds synced content). Better saving and backups; may become part
  of a **modding system** (owner, 2026-10-08). Pairs with agent authoring.
- **Translation**: the game **will be translated** (owner, 2026-10-08). Today
  text is written directly in the code; every new screen adds more to move.
  Decide how text is stored before the post-crunch UI work, ideally sooner.

### Post-Atlas content

- **One core loop per skill**: so each skill feels different, and to prototype
  how they'll work. *after-crunch* · feature-sized; builds on brief 20's new
  skill list (in flight now). First content to build; owner, 2026-10-08.
  - **Occult / magic / enchanting sketch (very loose)**: Tokens need to be
    **charged with elements**. An enchanting table has **three slots** that
    take context from other placed Tokens; charge comes from **leyline map
    features** or **support Tokens** the player builds; **different
    combinations give different outputs**. · builds on the existing `nearby`
    rule reach (GDD: 164 u, the four side neighbours), and suits a mostly
    static board; leylines would be an Atlas map feature or modifier.
    Enchanting is an advanced skill today (GDD), with magic, summoning and
    faith nearby in the class tree.
- **Guild upgrade content**: build out the Guild Hall upgrades. Pairs with the
  constellation screen above and the Atlas's new global upgrades.

## Being interviewed

*(none)*

## Moved on

*(none)*

## Dropped

Suggestions the owner turned down, so they aren't raised again.

- **Automated progression bot** (a headless playthrough to check pacing): the
  owner would rather understand and control the dependencies directly (the CMS
  dependency map). 2026-10-08.
- **Stations at scale** (stations suggesting or cycling recipes): not a
  concern. 2026-10-08.
