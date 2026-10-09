# Progression, pacing and the Atlas loop

*D2 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview, started
2026-10-09. **Done** (owner closed it 2026-10-09); "What grows with level" is
deferred. Story context (the cartographer, maps that write
worlds, the ritual, prestige as the loop) is in
[concept_tone_and_world.md](concept_tone_and_world.md).*

⚠️ Parts of this change or add to the Atlas
([concept_atlas.md](concept_atlas.md), brief 70). Settle them before brief 70
starts.

## Pacing

- **First ritual in about 1–3 months** of play for a typical player.
- **The target player leaves the game open in the background and glances
  often**, with occasional focused sessions to rearrange things. Offline
  catch-up covers the gaps.
- **Minute to minute the player chases**: the next unlock (a level that opens a
  new node or recipe), the next map or Region, and gear and combat. Guild Hall
  upgrades were not picked as a main driver.
- **Moves every few days**: 20+ new Regions in a first run, so moving has to
  stay quick and pleasant (see Moving day).

## Tiers are a design concept, not a gameplay one

There are no "Tier 1 / Tier 2" labels in the game. A new tier is just the next
link in a chain, and the player understands it without being told: Fir Wood is
harder to get and needed for an Iron Pickaxe; the Iron Pickaxe is needed to
mine Gold; so there's no Gold until the guild moves past Oak and starts
chopping Fir.

- **Chains usually cross skills**: most new resources need something from
  another skill (a tool, an ingredient, a building), so skills advance
  together. Some steps stay inside one skill for breathing room.
- **Every kind of gate matters**: **map access** (a map or modifier that writes
  a Region containing it), **a tool or ingredient** from earlier resources,
  **skill level**, and **combat** (a guardian, or an enemy's drop).
- **Basics stay in demand**: later recipes still use early materials, so hybrid
  maps mixing old and new resources are worth writing and old stockpiles keep
  a use.
- The planes still feel stranger the deeper the guild goes, without numbers.

## Moving day and the Region network

- **Why move: pull, not push.** The player moves for new resources, and each
  fresh Region has **one-time treasures** to make arriving exciting: **ruins
  and caches** (a burst of loot, then gone) and **a rare node** (a one-off rich
  vein or ancient tree). Old Regions never wear out.
- **Going back is part of good play.** Optimal play builds **specialised
  Regions** that produce one resource very well (back to the copper Region when
  copper runs low); **generalised Regions** let the guild work on several
  goals at once. The gameplay is the player choosing what to pursue and how.
- **Travel between settled Regions is free and instant** (as the Atlas has it).
  The cost is opportunity: only the active Region runs.
- **The whole guild moves together** (keeps the locked Atlas decision): for
  performance, for player focus, and because the lore is a plane-travelling
  Guild Hall; everyone gets back in the metaphorical spaceship.
- **Rebuilding stays light**:
  - a base is a **small core plus specialists** for the Region's purpose;
  - rebuilding is **cheap relative to income**, so a move feels like a fresh
    start, not a loss (a pricing rule);
  - much of what's built is **new anyway**: buildings specific to the Region
    (a mining Region gets minecarts and smelters), and **better versions** of
    old buildings worth building.
  - Not chosen: saved layouts, buildings travelling with the Hall, packing up
    (the locked "no refund" stays).
- **Some modifiers change how a base is built**, beyond contents: a dense
  forest leaves little room, a leyline gives free charge, a curse makes enemies
  hit harder. Each layout is a fresh small puzzle (ties to D4's adjacency).
- **Map supply is steady**: maps and modifiers drop reliably from enemies the
  player can farm safely, plus quest rewards, enough for a new Region every
  few days.
- **Showing what can move**: movable Tokens carry a **faint marker at rest**
  and **lift on hover** (with the grab cursor); fixed Tokens do neither.

## What grows with level — deferred

**Not finished; picked up later in development** (owner, 2026-10-09). The
game should stay relatively simple, and each kind of growth (yield, speed,
rare finds, perks) is a new design problem. Settled so far:

- **Levels unlock higher-level work**: new Tokens and recipes. That may be
  all they do.
- **Remove the +0.5 % speed per level** (invisible, one more number to
  balance). → T-125.
- **Possibly larger boosts at milestones**, e.g. "+10 % chance to double
  Copper Ore at Mining 50", so a flat bonus doesn't overpower later, rarer
  resources. A sample, not a commitment.
- **Mastery** (getting better at one specific Token or recipe): a later idea.
- **A craftable 99 cape for each skill**, uniquely powerful. A separate goal
  from the skill's final challenge (see Endgame).

## Economy and item sinks

- **Items stay the only currency.** **Markets are cut for now** (the Shrimp
  Market's open question in GDD §16, now closed; T-127): no exchange rates to balance; revisit if
  a real need appears.
- **The stockpile always has a use**: surplus of any material eventually has
  somewhere to go, so hoarding never feels pointless and numbers going up feels
  good.
- **Sinks**: **building and rebuilding** (Region-specific buildings, better
  versions, on every move), **gear** (crafting better weapons and armour is the
  main gear sink), and **Guild Hall upgrades**.
- **Ongoing drains**: **food and potions** used up in fights, and **building
  upkeep** (lures and other buildings that consume items to run, on the
  existing upkeep system).
- **No wear**: **tools last forever** (a pickaxe never wears out; a better one
  unlocks better work; D4 made gathering tools hero gear) ⚠️ today some recipes spend tool charges, so
  content and possibly code change (T-126); **gear never breaks** (no durability).
- **Map upcycling stays**: surplus maps turn into better maps (the Atlas
  concept's plan). It clears map clutter; it isn't a material sink.

## Endgame and new game plus

- **Each skill has a final challenge: a legendary job at the top.** A unique,
  demanding Token or recipe near level 99 (Forestry: fell a World Tree;
  Smithing: forge a masterwork; Cooking: a feast). Long, needs inputs from other
  skills, gives a one-of-a-kind output for the ritual. Uses the existing Token
  and recipe machinery.
- **Combat challenges**: **bosses per combat style** (each best beaten by one
  style, so a guild needs variety) and **party fights** (bosses that need
  several heroes at once, tied to classes). Designed in D3.
- **The 99 cape** is a separate goal (see What grows with level).
- **The ritual is a great construction at the Hall**: a multi-stage build that
  takes the final challenges' outputs and the bosses' drops piece by piece,
  with visible progress on the mat. The last piece completes the
  cartographer's work and offers new game plus.
- After the ritual the player **keeps playing indefinitely**, or starts
  **new game plus**:
  - the **same 8 heroes** (names, looks, identity), **levels reset**;
    nothing else carries over;
  - the player picks any number of **Skulls** from a list: modifiers that
    radically change how the game plays. They are **not balanced and give no
    reward**: just a wacky, different way through the same game.
  - In the story, this is the loop turning (the cartographer half-remembers
    past guildmasters).

## The Starter Camp and the first hour

- **The Starter Camp lasts about 30–60 minutes** before the first map: long
  enough to learn gathering, building, crafting and a first fight.
- **It holds an assortment of essential tutorial nodes and special sites.**
- **The endgame sites live in the Starter Camp**, visible from the first
  minute, so the player sees the final goal from the beginning:
  - **one site per skill, all 25**; each **is that skill's final challenge**
    (the legendary job);
  - a site needs **the skill at 99** and **specific late-game items** (e.g.
    100 of an item an endgame boss drops one of per kill);
  - early on a site looks like **a ruin** (an overgrown ancient anvil, the
    stump of a world tree): clearly special, clearly not ready; **inspecting
    it shows the skill, level and items**;
  - **the ritual's great construction happens here too**: the guild comes
    home to the old guild hall for the finale.
  - ⚠️ 25 sites plus tutorial nodes in one Region against the Token cap (80
    for testing): brief 70 must size the Starter Camp for this (sites exempt
    from the cap, a larger Starter Camp, or small sites).
- **Heroes**: 2–3 during the first day so the mat feels busy, the rest over
  the first couple of weeks; each new hero is a felt jump in output.
- **The first hour should leave the player wanting** a visible next unlock
  ("Fir needs Forestry 15") and their guild to grow (the next hero, the next
  Hall upgrade).
