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

### Post-Atlas content

- **One core loop per skill**: so each skill feels different, and to prototype
  how they'll work. *after-crunch* · feature-sized; builds on brief 20's new
  skill list (in flight now). First content to build; owner, 2026-10-08.
- **Guild upgrade content**: build out the Guild Hall upgrades. Pairs with the
  constellation screen above and the Atlas's new global upgrades.

## Being interviewed

*(none)*

## Moved on

*(none)*
