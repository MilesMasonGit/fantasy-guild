# Playmat Grid — Decisions Log

The reasoning behind [`playmat_grid_concept.md`](playmat_grid_concept.md). Each entry records the call, why it was made, and what it cost. **This file exists to stop settled ground being re-litigated** — if a future session wants to change something, the trade-off it was chosen against is here.

Decided 2026-08-04 across a feature-by-feature design pass. Struck and superseded entries are kept, not deleted.

---

## Superseded and Struck

| ID | Was | Fate |
| :--- | :--- | :--- |
| D-9, D-10, D-11, D-12 | Hero reach of 8 tiles; idle-if-no-neighbours; fixed clockwise processing order; sequential completion across neighbours | **Struck by D-57.** Heroes work one Token and stand on it, so there is no reach and no rotation. |
| D-28 | Defeated enemies enter cooldown "and the hero's clock moves on" | **Rationale struck by D-103.** The gap survives, as a rate limiter rather than a rotation artifact. |
| D-39 | Three rarity tiers | **Superseded by D-50** (four tiers). |
| D-44 (playset clause) | Playsets and the Binder collection metagame survive | **Superseded by D-52.** Cut entirely. |
| D-46, D-47 | Upkeep as a continuous per-Token resource drain; "upkeep is the scarcity spine" | **Struck.** Inaccurate — Tokens consume inputs *when worked*, not continuously. The economy's real constraint (a consumer implies upstream producers, which cost tiles and heroes) survives without the framing. |
| D-56 | The board's centre is premium because a hero there reaches 8 tiles | **Void.** D-57 deleted hero reach. Replaced by D-61 (all tiles equal), then partly by D-106 (the Guild Hall makes the centre valuable again, for a different reason). |
| D-69, D-72 | Food and drink as continuous hero upkeep; passive food generators to prevent a starvation spiral | **Suspended.** Depends on whether Energy survives — deferred to the hero replanning session. |
| D-89, D-91 | Themed Cartographer Tokens; the player is granted the first one | **Struck by D-98/D-99.** Cartographers are an off-board NPC menu, and all Maps are available from the start. |
| D-92 (unlock mechanism) | Each biome's Maps rarely drop the next biome's Mythic Cartographer | **Superseded by D-99.** Cost replaced discovery as the gate. |
| D-30 … D-34 | The hazard, event and invasion system | **Suspended** pending a test of whether the board needs an antagonist. |

---

## The Board

**D-1 — The board is 7×7, forever.** Re-confirmed after challenge.
*Why:* strategy comes from optimisation within a fixed budget, not from growth. At 10–20 heroes it runs roughly one-third live work, two-thirds support. An odd size gives it a true centre, which D-106 later depends on.
*Rejected:* growing it (helps deep chains, weakens the fixed-budget promise); shrinking it (tighter decisions, deep chains would not fit); progressive expansion (a strong idle beat, but reverses the design's central pillar).

**D-2 — One Token per tile.** Exceptions: heroes overlay the Token they work (D-57), loot sprites float above the grid (D-40).

**D-55 — No terrain. All tiles identical.**
*Why:* the design already carries supply chains, adjacency crafting, and the Guild Hall aura. Terrain would be a second full spatial system layered on the first, and the player would have to learn the board as well as their own layout.
*Cost:* the 40 biomes and 60 biome modifiers are cut as systems. "Biome" survives only as flavour naming on a Map's loot pool.

**D-61 — All tiles are geometrically equal.** Replaced the voided D-56. The only positional difference is neighbour count: 3 in a corner, 8 in the middle.

**D-106 — The centre tile is a permanent Guild Hall.**
*Why:* this one addition resolved four loose ends at once — it gave Guild Upgrades a physical home, re-homed the global auras orphaned when Outpost banners were deleted, provided a landing site for board-wide events, and supplied a structural reason for the odd board size (a 7×7 has a true centre; an 8×8 does not).
*Cost:* 48 usable tiles. It also amends D-61 — because the aura is strongest nearby, central tiles are valuable again, this time from a landmark rather than from geometry.

---

## Tokens

**D-78 — They are called Tokens.** "Piece" was a working placeholder.
*Requires:* the existing card-mutator `Token` system to be renamed — **unless it retires with the loop**, which is likely, since it depends on deck slots and Cycle boundaries.

**D-79 — Cards convert to Tokens one-for-one and keep working the same way.**
*Why:* the work machinery — cycle timing, inputs, outputs, drop tables, XP — carries over rather than being rebuilt. A Token is a card definition plus board state.

**D-38 — Rarity is a property of the Token type, never a per-instance roll.**

**D-50 — Four rarity tiers.** 🟡 **Provisional.**
*Why:* inserting Uncommon between Common and Rare gives escape from the depletion treadmill a middle step, so relief arrives gradually. Rarity stays about permanence and scarcity only, which keeps it simple to teach.
*Open:* whether Mythic is hazard-immune; whether Uncommon differs from Common beyond use count.

**D-77 — Returning Tokens consolidate; placement draws full ones first.**
*Why:* this resolves the stacking-versus-depletion contradiction. Totals are conserved exactly, so there is **no pick-up-and-replace refresh exploit** — which is what makes D-54's free repositioning safe for Commons. The Bank holds at most one partial per type, so it never degrades into a ragged list, and per-type state is two integers rather than per-instance sprawl.

**D-80 — Tokens are never upgraded in place; context Tokens are the upgrade path.**
*Why:* upgrading becomes an act of placement, using machinery the design already has. No new mechanic, no second XP system, no upgrade currency. It also keeps D-54 clean — Tokens accumulate no hidden per-instance power, so moving one costs only its current cycle.
*Consequence:* adjacency carries the entire in-place progression load on top of recipes and buffs.

**D-54 — Repositioning is free but forfeits the current cycle.**
*Why:* no new mechanic, no timer, no UI, instantly legible — and enough friction to discourage twitchy micro-optimisation without forbidding deliberate reorganisation. This is the design's answer to the *layout micromanagement* problem that helped kill the previous spatial playmat.

**D-86 / D-107 — The Tray is permanent, at roughly a quarter of the screen.**
*Why:* D-86 kept it as "a planning space", which was soft. The layout gives it a hard justification — **an open Bank covers the board**, so Tokens cannot be dragged from Bank to tile directly. The Tray is what makes the flow possible at all.

---

## Heroes

**D-57 — A hero works exactly one Token and stands on top of it.**
*Why:* instantly legible, costs no board space, and critically it **frees adjacency to mean one thing only**. Under the previous reach model a station competed for the same 8 tiles as the hero's attention, its schematics and its anvil; now hero placement and Token adjacency are orthogonal.
*Cost:* the "hero walks a production line" fantasy is gone — a chain's steps are worked by different heroes or not at all. It also adds a sprite layer to the tile budget.

**D-53 — Most Tokens require a hero.** Passive Generators are the deliberate exception.
*Why:* the hero is the engine of the economy, not a bonus applied to it. Without this there is a version of the board that runs itself with the hero as a mascot.

**D-58 — Heroes are numerous: 10–20 on the board.**
*Why:* the only thing that keeps a 48-tile board alive given D-53 plus D-57. "Grow your guild" is also a strong idle fantasy.
*Cost:* substantial. It forced the entire hero system to be re-derived — 15 heroes carrying names, portraits, classes, traits, 15 skills, 10 perks and 6 gear slots was untenable.

**D-59 — Heroes never move themselves.**
*Why:* keeps placement as the only verb, is perfectly predictable, and is honest idle design.
*Cost:* a hero whose Token stops producing idles until the player returns.

**D-60 — Idle heroes are the accepted limit of an idle session.**
*Why:* costs nothing to build, and gives returning to the game a purpose.
*Cost:* the design mildly penalises absence, the classic idle-game sin. Three things must carry that weight: Manager Tokens arriving early enough to matter, non-depleting Rares extending unattended runtime, and D-48's glide rather than cliff.
*Runner-up:* a fallback activity for idle heroes — revisit this if players feel punished.

**D-111 — One hero per Token, always.**
*Why:* keeps the board equation exact (worked tiles = staffed heroes), needs no stacking rules, one hero sprite per tile.
*Cost:* no way to concentrate effort on a bottleneck; improve it with context Tokens instead.

**D-62 — A hero is primarily a gate, secondarily a modifier.** The Token sets what is possible; the hero sets how well it goes.

**D-67 — Skill affects Speed, Access and Efficiency. Not quality.**
*Why:* **Access** (minimum skill requirements on Tokens) is what makes levelling necessary rather than optional. Rare drops stay properties of the Token, keeping outcomes predictable.

**D-63 — Heroes level the skills they use.**
*Why:* makes placement a **compounding** decision — leaving a hero on the mine buys tomorrow's better miner as well as today's ore. That gives the board memory and rewards layout stability, a useful counterweight to micromanagement.

**D-70 — Heroes advance along a branching class tree.** Recruit → basic class → specialised job.
*Why:* this **transforms the existing class system rather than deleting it.** The game currently rolls a class randomly and uses it as a passive bonus; here the same nine classes become an *earned* tier chosen through training. It also preserves the adventuring-guild fantasy that a large roster threatened.

**D-68 — Promotion changes what a hero can learn, not just how good they are.** Skill threshold plus resource cost; grants job perks and swaps the available skill set.

**D-71 — Removed skills are banked; jobs are reversible.**
*Why:* makes promotion a reconfiguration rather than a gamble, so the player experiments. Across 15–20 heroes, irreversible mistakes would discourage engaging with the system at all.
*Cost:* promotion loses weight. Lean on resource cost before reintroducing permanence.

**D-73 — Traits are cut; perks survive, granted automatically.**
*Why:* every difference between two heroes becomes earned, never rolled. The 90 class perks re-home onto the job tree and the 90 trait perks onto skill milestones, so all 180 survive with a new owner.
*Cost:* recruits become fungible — recruitment is *how many*, never *which*.

**D-65 — Equipment is 3–4 slots with type-uniqueness tags.**
*Why:* cuts the management surface from ~90 slots to ~45–60 at a large roster while keeping gear personal and preserving the equipment, tag and durability systems.
*Rejected:* gear as board Tokens (elegant, kills all 90 slots, but retires the Dock and "my hero's build"); one item per hero (too thin); cutting gear (deletes a working system).

**D-74 — Defeat means Wounded plus equipment loss.**
*Why:* combat needs teeth and gear loss is the equipment economy's only real sink. The old bruise is smaller here because **all combat is opt-in** — the player chose to stand a hero on an enemy, and enemies never initiate.

**D-75 — Heroes are drawn as their job, not as individuals.**
*Why:* at 15–20 heroes on small tiles, twenty faces would be unreadable and uninformative. Job sprites make **the board self-documenting**, and the art budget scales with the number of jobs rather than heroes.

**D-76 — The Hero Dock is the roster home.** Reuses the built Dock, keeps heroes distinct from Tokens, and puts the roster permanently on screen.

**D-112 — Buffs may target the Token or the hero, per Buff Token.**
*Why:* gives hero placement a second consideration. Without it, D-57 would have removed heroes from the adjacency system entirely, leaving the tiles around a working hero meaningless to that hero.

---

## Adjacency

**D-81 — One rule everywhere: the 8 surrounding tiles.**
*Why:* adjacency does three jobs at once — recipes, buffs, and all in-place upgrading. A system that busy must be learned exactly once.

**D-18, D-19, D-20 — Context Tokens define recipes; isolated ones are inert; conflicting ones cause an error state.**

**D-113 — A context Token serves every adjacent station.**
*Why:* a clever dense arrangement becomes *mechanically* better than a sprawling one, so an efficient board looks efficient. It also softens the tile cost of context Tokens.
*Risk:* may converge optimal layouts on a repeating checkerboard.

**D-23 / D-82 — Stacking is uncapped; tiles are the limit. Individual Buff Tokens may carry a no-duplicates flag.**
*Why:* eight upgrade Tokens around one Forge means eight tiles producing nothing, on a board where worked tiles equal hero count. The board already charges for it. The per-Token flag keeps the generous default while giving authors a scalpel — and puts the rule where a tooltip can state it, rather than in an invisible global formula.

**D-83 — Supply is global and non-spatial. Final.**
*Why:* avoids logistics micromanagement entirely and keeps the Bank universal. Stops adjacency acquiring a fourth job.
*Cost, plainly:* layout has no effect on supply. The logistics half of the board ignores geography by design.

**D-22 — Tooltips are the discoverability mechanism.** Every Token has description text; hover or right-click gives its full function and synergies. This is what carries D-97's per-Token input rules, which the player otherwise has no principle to reason from.

**D-24 — Tokens pull their inputs automatically from the global Bank.** No manual supply, no assignment. Combined with D-83 (supply is non-spatial), a Token simply takes what it needs from wherever it is.

**D-84 — Connection lines on hover or selection only.**
*Why:* the direct answer to the visual-clutter problem. With adjacency doing three jobs across 48 Tokens, permanent lines would recreate the mess that killed the previous playmat.
*Cost:* the whole machine cannot be seen at once. A hold-to-reveal overlay is the natural addition if that frustrates.

---

## Economy

**D-97 — Whether a Token consumes inputs, and what, is a per-Token property.** No category rule derives it.
*Cost:* no principle for players to reason from; they learn each Token individually. Tooltips and the alert mark carry that. **Author consistently anyway** — creates-from-nothing should be free, transforms should cost.

**D-51 — Base resource Tokens consume nothing.**
*Why:* this is the economy's floor and its **recovery guarantee**. A circular chain that runs dry always restarts from the bottom, so **no escape-hatch mechanic is needed at all**. It also sets a deliberate gradient: free at the base, costly at the top, so ambition is what costs.
*Cost:* base tiles are set-and-forget. All interesting play lives in the processing layer above them.

**D-48 — Shortfall causes proportional slowdown, resolved per input item.**
*Why:* the board glides to a sustainable equilibrium rather than falling over, which is the best available AFK behaviour. Throttling cascades downstream with no explicit cascade logic, and the player can never over-extend into failure, only into sluggishness.
*Cost:* the mechanic is **silent** — hence D-85's alert mark and D-114's on-Token diagnosis.

**D-94 — Chain depth is managed by three simultaneous release valves.** Rares collapse steps; players specialise; authored chains stay bounded.

**D-93 — Gold has three sources with different cost profiles.** Market Tokens (best rate, costs a tile and a hero), Bank UI selling (convenient, deliberately worse), enemy drops.

**D-96 — Gold's sinks are Map purchases, Guild Upgrades and restock packs.**
*Why:* **Map purchase is the load-bearing one.** Because progression is a price curve, gold demand **scales with play forever** rather than saturating, and all three gold sources convert directly into forward movement.

**D-49 / D-87 — Packs restock; they are themed.**
*Why:* Commons deplete constantly and hand-restocking them is exactly the busywork that would sink the game. Making it a purchase converts a chore into a transaction. Themed packs keep the opening beat — which matters more now that playsets are cut — while being reliable enough to actually solve the shortage the player has.

**D-35 / D-104 — Manager Tokens are type-specific and refresh depleted Tokens, including enemies.**
*Why:* enemies stop being a special case. They deplete like resources, restock like resources and automate like resources — **one economic model covers the whole board**.

---

## Cartography and Progression

**D-98 — The Cartographer is an off-board character, not a Token.**
*Why:* "collecting Cartographers" was an odd fiction; visiting *the* cartographer is a natural one. It also costs no board space — a Cartographer Token would have permanently consumed a tile *and* a hero purely to keep progression ticking.
*Cost:* a deliberate exception to "everything happens on the board". The Map itself is still a Token, so only the transaction leaves the grid.

**D-99 — Every Map is available from the start; cost is the only gate.**
*Why:* **the most legible progression available.** The player sees what is next and exactly what it costs, which answers the risk that a built chain reads less clearly than a tier ladder. It gives real freedom — ambition is *expensive* rather than *forbidden*, which feels far better than a greyed-out node. And it removed the design's most fragile number: progression no longer hangs on a drop rate that stalls the game if too rare and trivialises it if too common.

**D-100 — Maps cost mainly gold plus a small material component.**
*Cost, honestly:* this weakens the claim that earlier content stays *materially* necessary. The link becomes economic — *board produces → sells → gold → next Map* — which is softer and fungible. Strong income from any source lets a player skip ahead. Whether that is freedom or a hole depends on the price curve; raise the material component if skipping beats developing.

**D-101 — The menu lists Maps in price order.** Ordering does the teaching: one affordable option at the top, a descending ladder of ambitions beneath.

**D-95 — Later Maps yield stronger *and more demanding* Tokens.**
*Why the second half matters:* on a fixed board, power growth alone would just mean swapping Tokens and having spare tiles. Because later content also costs **more board**, the player faces a real choice about what to run.

**D-36 / D-37 — Maps are worked like any Token, yield a Token from their pool, have durability, and are consumed.** A Map's loot pool is the only meaning "biome" carries.

**D-102 — Mythics are ultra-rare boss and Map drops.**
*Why:* Mythics were originally going to be Cartographers, which put **progression itself** on a tiny drop chance. Now nothing rides on them — a player who never sees one still progresses; one who finds one gets a real event. Upside without fragility.

**D-105 — Bosses are Mythic Tokens found in Maps, farmable indefinitely.**
*Why:* Mythic already means permanent, indestructible, one copy ever. A boss that never wears out and that you own exactly one of *is* that definition.

---

## Combat

**D-90 — Combat is a distinct real-time system, not a Token cycle.**
*Why:* combat should feel different from mining. Folding it into a generic cycle timer would flatten the 7-stat and status-effect engines — both built and working — into a success percentage.
*Cost:* two execution systems tick side by side, and **combat pacing is known not to scale under time acceleration** — a survivable caveat when combat was an occasional card, now a standing constraint on any offline model.

**D-103 — A short rest follows every kill, as a deliberate rate limiter.**
*Why:* it caps combat throughput regardless of hero power, so an over-levelled hero cannot blitz thousands of low-tier enemies.
*Consequence:* hero power does not increase kill rate — it buys survivability and access. Combat output scales through more Tokens and more heroes, exactly as production does.

**D-13, D-14, D-15 — Enemies fight back; they are inert until targeted; combat is 1-on-1.**

**D-25 — Bosses are 1×1 Tokens.** Higher stats and special mechanics, but no multi-tile footprint — every Token on the board occupies exactly one tile.

---

## Loot and Presentation

**D-40, D-41, D-42 — The loot piñata.** Items drop as floating sprites; collection is hover, sweep or Collect All and confers **no mechanical advantage**; a Max Stacks setting auto-collects the least interesting first; consumers can pull from ground sprites if the Bank is empty.

**D-88 — Hover-collection is kept, and the three-way hover conflict is accepted.**
*Why:* collection is mechanically free, so inspecting the board also banks loot that was Bank-bound anyway. Nothing is lost and no decision is pre-empted.
*Fallback:* if players cannot study a dense board without stripping it, move collection to click and click-drag. The piñata survives intact; only the verb changes.

**D-85 — A tile shows art, progress, and at most one alert mark.**
*Why:* the design accumulated several distinct "not working" states with different causes and fixes. They collapse into one mark meaning *look at me*, with the cause on hover, instead of competing icon vocabularies on a small tile. This also repairs D-48's deliberate silence.

**D-114 — Supply problems are diagnosed on the Token, not in a panel.** A glowing red alert mark; hover states what is missing and by how much.
*Residual:* no board-wide aggregate view. Diagnosis is tile by tile. A deficit summary is the natural addition if that frustrates.

---

## Scope and Tooling

**D-43 — Areas are deleted entirely**, along with the World Map, map fragments, area unlock quests, area-scoped pools and per-area binders.
*Cost:* the entire previous progression ladder is deleted and six systems orphaned at once.

**D-52 — Playsets and Mastery are cut.**
*Why:* Tokens already stack without limit, Commons deplete constantly, and bulk Commons are a routine purchase — so "own 4 copies" had stopped being a milestone and become a stock level.
*Cost:* the collection metagame goes with them. The reward beat now rests on **new Token types from Maps**.

**D-108 — The first playable build is one Map's content, progression stubbed.**
*Why:* the most uncertain claim in this design is that **the board itself is enjoyable**. Everything downstream rests on that, and none of it is worth authoring if it is not true.
*Cost:* the price curve and the strength/demand curve are untestable until a second Map exists. Do not leave it behind polish.

**D-109 — The CMS is rebuilt afterwards, out of scope here.**
*Why:* building an authoring tool for mechanics still in flux would mean building it twice.
*Consequence:* Token content is hand-authored in JSON meanwhile, and the CMS's destructive "Sync to Game" must not be run against it.

**D-110 — Saves are wiped; the version gate is bumped.**
*Why:* nothing meaningful maps across. Migration would mean inventing values that never existed for every hero and every card. Precedent exists — the 0.2.0 gate did exactly this during the previous rework.

---

## Why a Grid, Having Just Left One

The previous rework replaced a spatial playmat with the Area Deck Loop, citing *"visual clutter, high drag-and-drop friction, and layout micromanagement."* Those objections were not obsolete, and this design has explicit answers to each:

| Objection | Answer |
| :--- | :--- |
| **Visual clutter** | D-85 caps the tile to art, progress and one alert mark. D-84 keeps connection lines off until hover. |
| **Drag-and-drop friction** | The Tray (D-107) makes the Bank → board flow work. Managers (D-35) automate restocking. |
| **Layout micromanagement** | D-54 makes fiddling cost throughput. D-63 makes leaving a hero in place *compound*, rewarding stability. |

The affirmative case: a card loop is a **list**; a board is a **picture**. Spatial adjacency gives synergy a physical language the player can see and arrange, placement replaces menus outright, and earning a Token is a stronger beat than earning a card because the player immediately places it and watches the board change.
