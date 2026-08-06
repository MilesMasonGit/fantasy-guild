# Playmat Rework — Decisions Log

The reasoning behind all three playmat specs — [`playmat_grid_concept.md`](playmat_grid_concept.md), [`playmat_hero_concept.md`](playmat_hero_concept.md) and [`playmat_ui_concept.md`](playmat_ui_concept.md). Each entry records the call, why it was made, and what it cost.

**This file exists to stop settled ground being re-litigated.** If a future session wants to change something, the trade-off it was chosen against is here. Struck and superseded entries are kept rather than deleted, so a reversal can be seen for what it is.

Decided 2026-08-04 and 2026-08-05 across a feature-by-feature design pass and a hero rework session.

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
| D-37 | Maps are worked by a hero on a timer | **Struck by D-142.** Maps are opened by the player and burst; they cost no hero-time. |
| D-49, D-87 | Themed restock packs as a separate purchase route | **Struck by D-153.** Packs are retired; Maps absorbed them. |
| D-58 | Heroes are numerous: 10–20 on the board | **Superseded by D-181.** The roster runs 1 → ~8 across the whole game. |
| D-65 | Equipment cut to 3–4 slots | **Superseded by D-184.** A 9-slot flexible grid; the cut was justified by a 20-hero roster that no longer exists. |
| D-39, D-50, D-169, D-170 | Rarity determines depletion and ownership caps; rarity communicates behaviour | **Struck by D-175/D-176.** Rarity now means **drop frequency only**. Charges are a per-Token property, independent of tier. |
| D-124 | A duplicate Mythic converts to a consolation payout | **Struck by D-177.** Duplicates can simply be owned; only one may be *placed*. |

---

## The Board

**D-1 — The board is 7×7, forever.** Re-confirmed after challenge.
*Why:* strategy comes from optimisation within a fixed budget, not from growth. An odd size gives it a true centre, which D-106 later depends on.
*Revisit trigger:* the ratio of worked to support tiles was later revised sharply by D-181 (8 heroes, not 15). If content cannot supply ~3 support Tokens per worked one, 7×7 is too large and this decision is the one to reopen.
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

~~**D-50 — Four rarity tiers, keyed to depletion.**~~ **STRUCK by D-175.** The four tier *names* survive; what they meant does not. Rarity now indicates drop frequency only, and depletion is a per-Token property (D-176).

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

**D-66 — The skill list is redesigned from scratch, not migrated.**
The existing 15 skills were sized for a game with a handful of heroes; at a 10–20 roster they would mean 225–300 individually levelling bars.
*Two constraints bind the replacement:* small enough to read across ~15 heroes, and **scoped by job** (D-68) so each hero shows only a handful regardless of how many exist in the world — which is what lets the global list stay richer than any one hero's view of it.
*The list itself is open* — see [`playmat_hero_concept.md`](playmat_hero_concept.md) §4.1.

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

~~**D-49 / D-87**~~ — **STRUCK by D-153.** Packs are retired; Maps absorbed them. Original reasoning kept below for the record.
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

**D-103 — A short rest follows every kill.**
Time per kill is **fight duration + a fixed rest**.
*Why:* it puts a ceiling on kill rate without flattening the value of hero power. **Power shortens the fight but not the rest** — so against an enemy that takes minutes to grind down, more damage means meaningfully faster kills, and power pays off exactly where the challenge is real. Once fights are already shorter than the rest interval, extra power buys nothing more.
*The targeting is deliberate:* the cap bites only on an over-levelled hero one-shotting a long line of weak enemies. **Farming trivial content is capped; fighting hard content is not.**
*Corrects an earlier error in this document*, which claimed hero power did not increase kill rate at all. It does — up to the ceiling the rest imposes.

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

## Review Pass — Contradictions Resolved

A review of the spec surfaced four problems: an inconsistency about what is actually scarce, a Token type whose justification had been deferred away, a system with no home, and a missing starting state. These are the resolutions.

**D-115 — Heroes bind, not tiles.**
§5.2 and §6.2 both argued tiles were scarce; §4.1 said heroes were. With ~15 heroes on 48 tiles and only staffed Tokens producing, **tiles are comparatively abundant and hero-time is the real constraint.** The tile-scarcity arguments were rewritten: §6.2 is now *Depth Costs Heroes* — a five-step chain consumes a third of the workforce.
*Cost:* this invalidated D-82's justification for uncapped buff stacking, which rested entirely on buff Tokens costing scarce tiles. Resolved by D-119.

**D-116 — Passive Generators are strictly worse per tile.**
They need no hero, they may consume inputs, and they produce **less than the same job staffed while often consuming more.** Overflow capacity for a player out of people, never a preferred option.
*Why this rule is load-bearing:* with tiles abundant (D-115), an unstaffed Token that ever beat a staffed one would make the optimal board mostly unstaffed, and heroes would stop being the ceiling. The original "life-support" framing is dropped — it was justified by a food death spiral, and food moved to the hero session.

**D-117 — Tools become Context Tokens.** The tool item category is retired. A Tool Rack is placed next to a station and benefits whatever works there.
*Why:* tools had no home in the Token model — they were assigned to task cards, which no longer exist. Folding them into adjacency uses machinery that already exists rather than adding a second slot system.

**D-118 — Token depletion replaces item durability entirely.**
A Tool Rack is a Common Token that wears out, which *is* durability expressed in the Token system. Hero equipment becomes permanent and `DurabilitySystem` retires.
*Why:* one wear mechanic instead of two, and tool replacement joins the existing restock loop (packs, Managers).
*Cost:* defeat-loss becomes the only sink for hero gear, so crafted equipment is a milestone purchase rather than a consumable (D-125).

**D-119 — Buff Tokens are scarce, and their effects are small.**
A representative buff is "1% chance of double yield", not "doubles output". Stacking stays uncapped because eight times a very small number is still small.
*Why:* replaces D-82's dead justification. Stacking is safe because **effects are small**, not because space is dear.

**D-120 — All adjacency effects are small. D-80 is demoted.**
Adjacency is a light optimisation layer, not the upgrade path. Real power comes from acquiring better Tokens through Maps.
⚠️ *This is the most consequential call of the review.* It trades away the "build one monster tile" fantasy and weakens the spatial pillar as originally stated. **What saves it is that adjacency's real job is definition, not amplification** — a Forge with a Helmet Schematic makes helmets, and without one makes nothing. That is binary and decisive. Numerical buffs sit on top as polish.
*Bonus:* with no dominant stacking pattern, boards no longer converge on one optimal geometry — the "board gets solved" and "checkerboard convergence" risks both shrink.
*New risk:* adjacency may now matter *too little*. If placement stops feeling meaningful, the lever is more recipe-defining context Tokens, not bigger buff numbers.

**D-121 — Guild Hall upgrades have two reaches.** Aura upgrades affect the 8 neighbours per D-81; global upgrades (Bank capacity, roster cap, sell rates, drop rates) are not spatial at all.
*Why:* resolves an inconsistency between §2 ("nearby or all") and §5 ("the 8 surrounding tiles"), and matches what Guild Upgrades already did.

**D-122 — Starting state: 2 heroes, a few basic Commons, a little gold, Cartographer open.**
*Why:* D-91 (start with a Cartographer) was struck and nothing replaced it. The core loop must be reachable within a minute and the progression loop within a session, with the first Map priced as a visible near-goal.

**D-123 — A sparse early board is intended.** Emptiness is progress feedback: four Tokens on 48 tiles at the start, a packed board later.
*Why:* with ~15 heroes, weak passives and scarce buffs, realistic occupancy is well under 48. Rather than inventing filler, the empty space becomes the visible measure of growth.
*Watch:* if the early board feels barren rather than promising, board size (D-1) is the thing to revisit.

**D-124 — A duplicate Mythic roll converts to a large consolation payout.**
*Why:* Mythics are one-copy-ever, so the roll needed a defined outcome. A payout keeps the rare moment landing and keeps late-game Map runs worth doing once most Mythics are owned.

**D-125 — Hero gear is a milestone purchase, not a consumable.**
Demand comes from roster growth and from better recipes unlocking, not from wear.
*Watch:* gear crafting goes quiet between Map unlocks. If the chain feels dead, promotion costs are the natural place to add demand.

**D-126 — Context and Buff Tokens wear one use per cycle of each adjacent Token they serve.**
A Tool Rack serving two Forges wears twice as fast as one serving a single Forge.
*Why:* D-118 made tools into Context Tokens whose depletion *is* durability, but Context Tokens are never worked by a hero, so nothing consumed their uses. Tying wear to service restores the link between tool use and tool wear.
*Bonus:* this gives D-113's shared-context rule a real cost. Clustering stays efficient, but sharing burns infrastructure faster — a trade-off between throughput now and restocking sooner, rather than free upside.
*Unresolved:* combat is not cycle-based (D-90), so a Context Token adjacent to an enemy Token has no defined wear trigger.

**D-127 — Input allocation is first-come; there are no partial cycles.**
A Token runs at full speed when it has its inputs and waits when it does not. Whichever Token's cycle completes first takes what is in the Bank.
*Corrects D-48*, which described Tokens running "at 70% speed". Degradation is **emergent, not per-cycle**: two Forges sharing one Forge's worth of Coal alternate, each running full cycles about half the time, landing near 50% aggregate without either running slowly.
*Why:* far simpler to implement than partial cycles, and it preserves the property that matters — the board glides down rather than falling over.
⚠️ *Two costs:* **cheap consumers systematically beat expensive ones**, because a Token needing 1 Coal can act sooner than one needing 5 — so under shortage the deep chains the design wants players to build starve first, which inverts §6.2's intended pressure. And **two identical Tokens can behave differently** for no visible reason; the alert mark is what makes that legible.

**D-128 — Items are worth more used than sold.**
Sale prices are deliberately poor relative to an item's value as a crafting input.
*Why:* this closes the money printer — buy a pack, work the Tokens, sell the output, buy another pack. Feeding items into a chain always beats liquidating them, so the loop never spins up.
*Corollary:* **deep chains are how a player gets rich.** Raw Wood sells for little, Planks for more, finished goods for much more — so gold income rewards board depth, pointing the economy at the same behaviour §6.2 does.

**D-129 — A kill counts as one cycle for every board system outside the combat engine.**
Context and Buff Tokens adjacent to an enemy wear per kill, adjacency effects apply per kill, and the tile's progress ring tracks the current fight.
*Why:* D-90 made combat a separate real-time system, which left it disconnected from the board's machinery and gave D-126 no wear trigger next to enemies. One shared unit reconnects it without turning combat into a Token cycle. It also gives the 8 tiles around an enemy a purpose — combat gets a placement puzzle.

**D-130 — Risk is managed by attention, not information.**
No difficulty warning, no skill gate, no preview on enemy Tokens. Retreat is always available — pull the hero off and the fight ends. The player is expected to watch the first few fights of a new enemy; leaving a hero unattended in a fight they cannot win means death and gear loss.
*Why this is more than a UI call:* it states the game's rhythm outright. **Production is the idle half; combat is the active half.** Everything else is built to run unattended and wind down gracefully — combat is deliberately the one place that rewards being at the keyboard, and it gives D-60's wind-down a sharper edge on combat tiles specifically.
*Cost:* players will misjudge fights and lose gear. That is the intended lesson rather than a failure of the design.

**D-131 — Moving a hero off a Token mid-cycle forfeits the cycle.** Extends D-54 to heroes.
*Why:* one rule for every interruption, and it applies the same friction to hero shuffling that D-54 applies to Token shuffling — which matters, since reassigning a scarce workforce is the player's most frequent action.

**D-132 — Maps sit outside the rarity system.**
Never Common, Rare or Mythic: always consumable, always bought, never placed to produce.
*Why:* §3.2 ties depletion to rarity, and Maps have durability without a rarity. Rather than forcing them into a tier, they are acknowledged as a different kind of object — one that occupies a tile while being spent rather than sitting on the board making things.

**D-133 — A Manager with an empty Bank fails silently.**
It can only move a Token from storage to the board, not conjure one. No Bank stock means the depleted tile stays depleted, the hero idles, and the alert mark shows.
*Why this is better than auto-purchasing:* it makes **stocking the Bank a preparatory act** and completes the automation chain — *gold → themed packs → Token Bank → Manager → board*. The AFK story becomes "the board runs as long as you left it supplies for" rather than "automation runs forever", which turns logging off into a decision.
*Cost:* silent failure while the player is away. The alert mark is the only cue on return.

**D-134 — Dropping a Token on an occupied tile swaps them; heroes move tile-to-tile directly.**
*Why:* swapping matters on a board with no spare tile to shuffle through, and reassigning heroes is the game's most frequent action — it should cost one drag, not a round trip through the Dock.
*Cost:* accidental swaps are possible.

**D-135 — The Guild Hall's event role is a reserved hook, not a v1 feature.**
It hosts Guild Upgrades and nothing else until Hazards and Invasions are revisited.
*Why:* documenting it as dormant stops an event system being built for the first version while keeping the landing site reserved at zero cost.

**D-136 — Combat is ported, not rebuilt. Healing already exists.**
Today a hero encounters an enemy card and combat begins; under the rework a hero is dropped onto an enemy Token and combat begins. The 7-stat engine, status effects, damage resolution, the Wounded state and `RegenSystem` all carry over unchanged — **only the trigger changes.**
*Corrects an earlier error in this document*, which flagged "healing has no source" as a blocking gap. `RegenSystem` regenerates HP for **idle** heroes and always has. It also composes with D-130: a hero pulled off a Token is idle, so **retreating a wounded hero is the healing mechanic**.
*Consequence:* combat is a porting job rather than a design-and-build job, which materially reduces first-build risk.

**D-137 — Stacks are never capped; slots are.**
Unlimited quantity of any one item or Token, but a capped number of *distinct types*. Two separate Guild Upgrade tracks raise the item-Bank and Token-Bank slot counts independently.
*Why:* capping quantity punishes a productive board, which is the opposite of what the economy is for. Capping variety creates pressure to specialise without ever making success feel like a problem.
*Resolves* the contradiction between D-6 ("unlimited storage") and D-121 ("Bank capacity" as a Guild Upgrade).

**D-138 — The board is overflow storage. Nothing is ever lost to a full Bank.**
When there is no free slot for an incoming item or Token, it stays on the board as a floating sprite until the player makes room.
*Why this is more than a safety valve:* it gives the loot sprite system a **genuine mechanical job** alongside its cosmetic one, and it makes a full Bank announce itself the way everything else on this board does — **visibly**, as litter piling up across the grid, rather than through an error dialog. **It is also what protects a Mythic drop:** a one-copy-ever Token can never be wasted for want of storage.
*Consequence:* auto-collect cannot collect into a full Bank, so even a player running at zero visible stacks will see sprites accumulate once they hit their slot cap. That is the intended signal.

**D-139 — A Map's loot pool contains the complete kit for its theme.**
Producers, their Context Tokens, their Buff Tokens, their Manager, and the enemies that belong there.
*Why:* buying a Map becomes buying access to a **self-contained set**, making Map choice a strategic commitment rather than a lottery ticket. One purchase eventually yields everything needed to run that theme properly, including the automation that lets it survive unattended.
*Cost:* completing a set is a long grind, and a player unlucky with Manager drops has a worse AFK story until one lands.

**D-140 — Managers cover 8 adjacent tiles and never deplete.** Overlapping Managers resolve first-come.
*Why permanence:* a Manager that wore out would be a restocker needing restocking — exactly the chore it exists to remove. The 8-tile reach keeps automation bought cluster by cluster rather than all at once, and follows D-81 rather than inventing a new radius.

**D-141 — Market Tokens are goods-specific.**
A Lumber Market buys wood products; an Arms Market buys weapons. Each has an input list like any other Token, so a Market is simply a Token whose *output* is currency.
*Why:* keeps Markets consistent with the rest of the board, removes ambiguity about what a Market sells, and reinforces D-128 — the best gold comes from feeding **finished goods** into the right Market, so deep chains pay off in currency as well as in capability. Serious gold income costs several tiles and several heroes.

**D-142 — Maps are opened by the player, not worked by a hero.**
Double-click and the Map **bursts**, scattering Tokens and items across the board as sprites.
*Why:* Maps replace booster packs, and opening one should feel like tearing open a pack — a physical burst, not a task in a queue. It is the game's headline reward beat.
*Consequence, and it is deliberate:* **progression no longer competes with production.** A hero exploring a Map would have been a hero not producing, out of a workforce of ~15, making advancement cost present output. That tension was considered and rejected in favour of the reward moment.
*Supersedes* D-37's worked-on-a-timer model and the "Map needs a hero" classification.
*Open:* whether a Map bursts from a tile or from the Tray, and whether it is one burst or several charges.

**D-143 — Tokens are weighty physical objects; the grid is real but invisible.**
No drawn gridlines. Displacement **shoves**: an incoming Token pushes the old one out, and a hero working that tile is **knocked off** back to the Dock. Maps burst. Loot has mass.
*Why:* a fixed 7×7 lattice could easily read as a spreadsheet. The rules are ordinary grid rules — the *presentation* is a table of physical pieces, and subtle physics throughout is what makes it feel like a playmat rather than a grid view. A stated design goal, not a polish afterthought.
*Also resolves* what happens when a Token is dropped on a tile with a hero on it. The hero is displaced to the Dock rather than auto-assigned to whatever arrived, so the player is never left with someone quietly working a Token they did not choose for them.

**D-144 — Tokens come from several sources; Maps are the main one.**
Maps yield themed kits; **crafting stations can produce Tokens as their output**; themed packs supply bulk Commons; bosses drop Mythics.
*Why crafted Tokens matter:* they turn the item economy into a **Token economy** — raw materials become planks become a Tool Rack that goes on the board. This gives items a major new sink, answers how a player keeps up with support-Token wear (D-126) without relying solely on gold, and provides a **production route to progression** alongside the gold route, so a board rich in materials but poor in coin still advances.
*Natural division:* producers and enemies are **found**; tools and support are **made**. Nothing forbids exceptions.

**D-145 — Token detail is available before placement.**
Selecting a Token in the Bank, Tray or board shows outputs, inputs, skill requirement and pairings.
*Why:* hero-time is the scarce resource, so a player must never spend a tile and a hero to learn what something does. The existing inspection panel already does this job.

**D-146 — Tokens can be sold for gold, at a deliberately poor rate.**
*Why:* slot caps (D-137) require an exit. A Map burst hands the player Tokens they have no use for, and without disposal those eventually fill the Bank.
*Constraint:* selling must stay an **escape valve, not a strategy** — the same spirit as D-128's treatment of items.
⚠️ *Mythics need protection:* one copy ever means selling one is permanent and irreversible. Block it or require explicit confirmation.

**D-147 — Dropping a hero onto an occupied tile knocks the occupant to the Dock.**
*Why:* one displacement rule for everything on the board — the incoming thing wins, the displaced thing goes somewhere safe (D-143). Swapping the two heroes was considered and rejected as a second, inconsistent rule.
*Cost:* a working hero is silently idled and must be re-placed.

**D-148 — A Token recipe is an ordinary recipe; crafted Tokens burst onto the board as sprites.**
A station with the right Context Token adjacent consumes items and outputs a Token rather than an item.
*Why:* no new system. The sprite layer already carries Tokens since Maps burst them (D-142), and crafting one earns its own small reward moment.
*Watch:* bulk-producing support Tokens could carpet the board in sprites. The Max Item Stacks setting and auto-collect absorb this.

**D-149 — An alert means "staffed but stuck". An unstaffed Token is not an error.**
With ~15 heroes on 48 tiles, most of the board is unstaffed at any moment — flagging all of it would make the alert mark meaningless. Alerts appear only when a Token **has a hero and still cannot work**: missing inputs, context conflict, or a hero below the skill requirement.
*Why:* keeps alerts rare enough to mean something. Three red marks means three real problems; none means healthy, even if half the tiles are dark.
*Open:* an idle hero on an emptied tile is a **wasted person**, not a broken Token — a different problem the tile's vocabulary does not cover, and the most actionable one on an unattended board. Probably belongs on the hero or in the Dock.

**D-150 — A Map's material cost is pulled automatically from the Bank.**
The purchase is refused if the Bank is short, naming what is missing.
*Why:* the same rule Tokens already use for their inputs (D-24). One consistent way the game consumes items, and no inventory management on a purchase.

**D-151 — A Manager restocks whether or not a hero is standing there; the hero resumes automatically.**
*Why:* this is the entire point of Managers. A hero whose Forest ran dry does not need re-placing — a fresh one arrives under their feet and they carry on. The alternative would restock empty tiles while leaving idle heroes idle, which is the opposite of the AFK mitigation Managers exist to provide.

**D-152 — Token buffs are inert while their target is idle; hero buffs always apply.**
A Sawmill next to an unstaffed Forest does nothing (and costs nothing). A Campfire next to a hero works whenever that hero is present, including while resting.
*Why the asymmetry is deliberate:* **a Campfire helping a resting hero is exactly when healing matters most.** It is what turns retreat-and-recover (D-130, D-136) into a real tactic rather than merely a way to stop losing.

**D-153 — Packs are retired. Maps absorbed them.** *(Strikes D-49 and D-87.)*
Anything a themed restock pack would have supplied, a Map supplies.
*Why this is a genuine simplification:* one purchase mechanism instead of two, and it gives the price curve a second unadvertised job — **a cheap Map bought repeatedly is restocking; an expensive Map bought once is progression.** Same menu, same act, same burst; only the player's position on the curve changes. A Woodland Map bought for the twentieth time is a supply run, a Volcanic Map bought for the first time is an achievement.
*Consequences:* gold now has exactly two sinks (Maps, Guild Upgrades); the two purchasable Token routes take **different currencies** — Maps cost gold, crafting costs materials — so a board rich in one and poor in the other still has a way forward; and D-139's "complete kit" becomes more load-bearing, since Maps must yield producers in enough quantity to serve as restocking.

**D-154 — Map bursts are random. There is no reliability guarantee.**
A Woodland Map might yield six Forests or three Bears and a Tool Rack. No targeting, no guaranteed minimum.
⚠️ *This is a real cost, accepted.* Packs were reliable restocking; Maps are not. A player who needs Forests specifically cannot ask for them.
*Two mitigations, neither designed for the purpose:* unwanted Tokens **sell** (D-146), so a bad burst converts to gold that buys another Map — bad luck partly pays for its own correction; and support Tokens can be **crafted** (D-144), so randomness really only bites on *producers*. Over time the Bank accumulates a buffer of everything and Managers draw from it.
*The exposure is the early game*, before either mitigation exists. If it bites, weight early Map pools toward producers rather than adding a targeting mechanism.

**D-155 — A Map is a single burst, openable from the Tray or from a tile, and is consumed.**
Opening it on the board scatters contents around where it sat; opening it in the Tray throws them onto the grid.
*Why single-burst:* it is the pack-opening moment (D-142). Multiple charges would make a Map squat on a tile for a long time and would feel like a dispenser rather than a package.

**D-156 — Maps cannot be stored. A purchase goes straight to the Tray.**
No Map inventory; Maps never occupy Token Bank slots.
*Why:* it removes the storage question entirely and keeps buying and opening close together, which is where the fun is.
*Neat side effect:* **Tray capacity becomes the natural limit on stockpiling.** A player can save up several Maps for one big session, but only as many as the Tray holds — and those slots compete with Tokens they were staging.
*Needs a rule:* what happens when a Map is bought with a full Tray — refuse the purchase, or open it immediately.

**D-157 — Shared context is a rate trade, not free value.** *(Corrects D-113's wording, not its mechanic.)*
Because a Context Token wears once per cycle it serves (D-126) and its effect is small (D-120), one serving three stations delivers the same **total** benefit as one serving a single station — three times faster, and worn out three times sooner.
*Why accept rather than fix:* the maths is what it is, and throughput-now versus restocking-later is a real choice. Clustering is no longer *strictly* better, and the design should not claim it is.
*Cost:* weakens the spatial claim a second time, on top of D-120. What still makes placement matter is **recipe definition** (D-18), not optimisation.

**D-158 — Sprites route by kind: items to the Bank, Tokens to the Tray.**
Items are for storing; Tokens are for placing, so each lands where it will next be used. A Token sprite can be **grabbed and dragged straight onto a tile**; hovering and moving away without clicking routes it to the Tray instead.
*Why:* it makes opening a Map flow directly into building — burst, grab the two things you want, let the rest tidy itself away. The most common motion after a burst costs one drag rather than four.
*Needs a rule:* Tray overflow. A burst can yield more Tokens than the Tray holds; overflow should fall through to the Token Bank, then remain on the board as sprites if that is full too (D-138).

**D-159 — The Cartographer shows each Map's full pool, with undiscovered entries as silhouettes.** *(Extends D-101.)*
*Why this does two jobs:* it makes **restocking deliberate** — a player who needs Forests can see which Maps yield them and shop accordingly, which is the main answer to D-154's randomness. And it restores a **collection hook** that D-52 removed when playsets were cut: an unopened silhouette is something to want, and filling one in is its own small reward.
*Context for the change:* D-101 decided price-order-only guidance *before* D-153 made Maps the restocking route as well as the discovery route. Blind shopping was acceptable for discovery; it is not for supply.

**D-160 — Buying a Map with a full Tray is refused, with the reason stated.**
The same shape as a purchase refused for missing materials (D-150). Clear space, then buy.

**D-161 — Token numbers are hand-authored, not formula-derived.**
Yield, cycle time, uses and input costs are set individually per Token.
*Why:* every Token gets its own character, and nothing is forced through a curve that doesn't suit it.
⚠️ *This is the expensive option, chosen knowingly.* Roughly 60+ Tokens to tune by hand, and **each new tier of content risks invalidating the balance of everything below it.** It also compounds D-109 — until the CMS is rebuilt, all of it is hand-edited JSON. *The previous design went formula-driven specifically to avoid this; the trade here is extensibility for control.*

**D-162 — Everything becomes craftable eventually.**
Given the right recipe and materials, any Token can be manufactured — including producers. Maps are the fast route, not the only one.
⚠️ **This creates a tension that needs resolving:** Maps are both the progression system (D-99) and the primary gold sink (D-96). If crafting eventually supersedes them, gold loses its main sink exactly when income peaks, and progression stalls.
*The natural resolution, not yet confirmed:* **Maps remain the only way to obtain a Token type you don't already have; crafting only duplicates what you've discovered.** Recipes would themselves come from Maps, so Maps stay the entry point to every theme while crafting handles restocking. See the open question in §12.

**D-163 — Guild Upgrades offer four tracks: Storage, Roster, Aura and Economy.**
Bank slots (both kinds), hero cap, centre-tile aura bonuses, and sell rates plus Tray size.
*Why all four:* gold has only two sinks, so the upgrade track has to be broad enough to absorb income across the whole game. Each targets a different pressure the design creates — slot caps, the roster ceiling, the value of central tiles, and Tray capacity.
*Note:* the roster cap itself is owned by the hero document; only its presence as a purchasable upgrade is settled here.

**D-164 — A typical cycle runs 10–30 seconds.**
*Why:* with ~15 heroes working at once this yields roughly one completion per second across the board — a steady rhythm where each drop still registers, rather than a blur. Existing card timings already sit in this band, so **ported content needs no re-pacing**.
*Useful derived figure:* 500 uses × 20s ≈ 2.8 hours of continuous work. A Common's use count is therefore really a statement about **how long it survives unattended**, which is the number that matters for the AFK story.

**D-165 — Token crafting is late-game, and always dearer than buying.** *(Resolves risk 18.)*
Crafting is unavailable early and mid game, and manufacturing a Token always costs more than the Map equivalent.
*Why:* Maps are simultaneously the progression system and the primary gold sink. Cheap or early crafting would make both bypassable exactly as income peaks. Gating it late and pricing it above Maps keeps buying the practical route throughout, and leaves crafting as the **renewability** option — a way to keep a mature board supplied without shopping, paid in materials rather than gold.
*The characteristic shape* is a **Token that renews another Token** — a nursery that grows Forests, making a resource the player once bought indefinitely self-sustaining. The late-game payoff is **independence, not power.**
⚠️ *Cost:* "always more expensive" must hold across every Token and tier — per-item price policing stacked on top of D-161's hand-authored numbers.

**D-166 — Map prices step between themes and stay flat within one.**
Every Woodland Map costs the same forever; the next theme costs an order of magnitude more.
*Why:* this is what lets one curve do two jobs (D-153) without them fighting. **Restocking stays cheap and predictable forever** — a player grinding Woodland Maps for supply is never punished for it — while **advancing to the next theme is a genuine saving-up**, and the gap always reads as a milestone rather than a slightly larger number.
*Rejected:* rising price per purchase (discourages spamming one Map, but makes restocking progressively punishing — directly against D-153's supply role).

**D-167 — A Map burst yields 3–6 things.**
*Why:* with D-166's flat within-theme pricing, this makes shopping **frequent and cheap** rather than occasional and momentous — closer to opening packs regularly than unwrapping a chest.
⚠️ *Cost:* the burst spectacle now rests on **presentation, not volume.** D-142 asks the burst to be the headline reward beat, and four items cannot carry that on quantity. It must come from how it looks and how often it happens — physicality, scatter, bounce (D-143), and a rare drop landing distinctly. If a four-item burst reads flat in testing, reach for presentation before volume.

**D-168 — The Tray is roomy from the start, around 15–20 slots.**
*Why:* a full burst always fits, so the common case never hits a wall.
⚠️ *Two costs:* the Tray no longer meaningfully limits Map stockpiling, weakening D-156's natural cap; and **Tray size becomes a thin Guild Upgrade**, leaving D-163's Economy track leaning mostly on sell rates.

**D-169 — Rarity is a communication tool, not a power scale.**
Its job is to tell the player at a glance **how a Token behaves** — wears out, lasts forever, or is the only one there will ever be. All Forests are Common; all Dragon's Perches (the Manager that refreshes Dragons) are Rare; the Deck of Many Things is Mythic.
**Power comes from the Token's theme instead** (D-95). A Common Volcanic producer can far outproduce a Rare Woodland one. Two independent axes: *rarity → behaviour, theme → strength.*
*Corrects an example in §3.3*, which showed a Rare yielding four times a Common's output and implied rarity drove power. **A Rare is a convenience, not an upgrade** — a Forest you never have to replace, at the same yield.
*One rule follows automatically:* Managers never deplete (D-140) and rarity communicates permanence, so **every Manager is Rare or above.** A Common Manager would be a contradiction.

**D-170 — Uncommon is kept as a tier, but its defining attribute is undecided.**
"Depletes, just more slowly" makes it a bigger Common rather than a distinct thing.
*Candidates:* it is the tier a Manager can restock automatically, making automation itself a tier reward; it is repairable rather than merely long-lived; or it is the tier that can be crafted while Commons cannot.
⚠️ *Needs answering before loot tables are authored*, since it decides what belongs at the tier.

**D-171 — Tokens render at 4× — 32px art at 128px per tile, giving an 896px board.**
Integer scaling is required rather than preferred: the art is pixel art and fractional scaling blurs it. A **"small mode" viewport** renders shrunk sprites for smaller windows; full fidelity is the 4× view.

**D-172 — Idle heroes are marked in bright yellow, on the hero, not the tile.**
Two alert colours with no overlap: **red on a Token** means *staffed but stuck*; **yellow on a hero** means *this person has nothing to do*.
*Why the split:* an idle hero is a wasted person, not a broken Token — a different problem with a different fix, and the most actionable thing on an unattended board. Putting the mark on the hero costs nothing against the tile's information budget (D-85), and spotting idle people is the main thing a returning player needs to do.

**D-173 — Convert what fits; cut the rest.**
The ~15 authored cards are reviewed individually. Anything mapping cleanly onto a Token becomes one; anything built around deck mechanics that no longer exist is dropped rather than forced.
*Why:* the set is small enough that a card-by-card pass is short, and cards built around draw order, loop position or hazard slots have nothing to convert *into*. Porting them would mean carrying content that needs redesigning anyway.

**D-174 — Desktop only. Touch support is dropped.**
The game ships as a Tauri desktop application. Drag-only interaction is fine, and small windows are handled by "small mode" (D-171).
*Why:* it closes a question the design was accommodating for a platform that isn't targeted — and hover carries a great deal here (tooltips, connection lines, loot collection), so designing around a possible touch port would have cost real compromises.

**Hero Dock ergonomics — deferred to the hero session.** Its shape depends on what heroes turn out to need managing.

**D-175 — Rarity means drop frequency, and nothing else.** *(Strikes D-39, D-50, D-169, D-170.)*
Common / Uncommon / Rare / Mythic describe **how rare a Token is to find**. The purpose is **excitement** — the flash of a Mythic landing in a burst is the payoff, and rarity is what makes that legible. It is a **general guideline, not a hard rule**, and it carries no mechanical consequence at all.
*Why this is simpler than what it replaces:* rarity had been asked to carry depletion rules, ownership caps and a behavioural identity for every tier — which is why Uncommon kept failing to find one (D-170). Once rarity means only "how often you see this", Uncommon needs no special identity: it is simply a pleasant find.
*Rarity remains a fixed property of the Token type* (D-38). All Forests are Common.

**D-176 — Charges are a per-Token property, independent of rarity.**
A Token has limited charges or unlimited use because of what it *is*, not what tier it sits in. A Common may be unlimited; a Mythic may have charges. **The correlation is soft and deliberate** — unlimited use is *more likely* at higher rarities, because that is part of what makes a rare find feel good.
*Why it produces a good arc:* an early board is mostly charged Tokens, so §1's inhale-and-exhale rhythm is strongest at the start; a mature board accumulates unlimited-use Tokens and settles down. That is the same "independence, not power" payoff late-game crafting delivers (D-165), arrived at from a different direction.
*Consequence:* the three axes are now fully independent — **rarity → how often you find it, charges → how long it lasts, theme → how strong it is.**

**D-177 — Mythics are unique on the board, not unique to own.**
A player may accumulate several copies of a Mythic; **only one may be placed at a time.** Duplicates are spares rather than waste, which is why D-124's consolation payout is no longer needed.

**D-178 — Rarity tiers hold different content, not graded versions of the same Token.**
There is no Forest → Uncommon Forest → Rare Forest ladder. There is a Forest, and separately an Ancient Grove, and separately a Heartwood — related things with their own art, behaviour and reasons to exist.
*Why:* a per-Token ladder would have tripled the authoring load, which matters a great deal under D-161's hand-authored numbers. It also avoids "the same thing with a bigger number", which is exactly what D-175 removed rarity's power to express.

---

## Heroes (rework session)

**D-179 — Heroes are named individuals you train.**
Not staff, not units. Because traits and random rolls are cut (D-73), **a hero's identity is entirely a record of the player's decisions** — which Tokens they were left on, which job they were promoted into.
*Why this became safe to commit to:* the framing tension — *a guild of named adventurers is an RPG; twenty interchangeable staff is a colony sim* — was a function of roster size. D-181 brought the number to eight, and eight named people is a cast you can hold in your head.

**D-180 — A hero always has exactly six skills. Promotion removes two and adds two.**
Never more, never fewer. A hero's skill list is a **constant width with changing contents.**
*Why this is better than a growing sheet:* promotion feels like becoming a *different person* rather than accumulating more. You give something up to gain something, and what you gain is access to skills that did not exist for you before. It also fixes the roster's information cost permanently — 8 heroes × 6 skills = 48 values, and that number never grows.
*Removed skills are banked at level* (D-71), so a reversed promotion restores them intact. The world's skill list is larger than any hero's six; how much larger is open.

**D-181 — The roster runs from 1 hero at the start to about 8 at the end.** *(Supersedes D-58's 10–20.)*
Seven recruitments across the entire game.
⚠️ **This breaks a stated constraint** — the hero doc's §5 required 10–20 and warned that far fewer "leaves a dead board". At 8 heroes only 17% of tiles are worked, so **the board only stays full if content supplies roughly three support Tokens per worked one.** That is a higher support ratio than previously assumed and must be treated as a content target.
*What it buys:* the colony-sim failure mode disappears entirely; **chain depth becomes far sharper** — a five-step chain costs 5 of 8 heroes, over 60% of the guild, against 33% at a roster of 15; and recruitment becomes a **milestone rather than a transaction**, which repairs D-73's accepted cost that recruits are fungible. At this scale each new person matters regardless of arriving as a blank slate.

**D-182 — Hero level is derived from the six skills.**
A summary for comparing and sorting, not a separate grind. There is no hero XP independent of skill XP.

**D-183 — Energy is cut. Food and drink both restore HP.**
Nothing meters how much work a hero can do, only how much punishment they can take.
*Why cutting Energy is safe:* nothing else depended on it. Skill Efficiency (D-67) governs *input* consumption rather than stamina, pacing is set by cycle time (D-164), and the throughput ceiling is roster size (D-181). Energy had no remaining job.
*Why the death spiral cannot recur:* with `RegenSystem` already healing passively (D-136), consumables are the *fast* heal rather than a requirement. An unfed hero heals slowly instead of stopping, so nothing can starve.
*Still open:* **when** a consumable fires — see the hero doc §4.7. Threshold auto-consume works for healing but expresses only one kind of trigger, which rules out any consumable that isn't food.

**D-184 — Equipment is a 9-slot flexible grid.** *(Supersedes D-65's 3–4 slots.)*
Any item in any slot; the item-tag rule still prevents two of the same equipment type.
*Why the earlier cut is reversed:* D-65 was justified entirely by a 20-hero roster producing ~90 slot decisions. At eight heroes (D-181) that is 72 slots filled gradually across a whole game.
*Clarification recorded:* gear **does not wear out** — durability is retired game-wide (D-118) — but it is **not permanent**, because defeat can still take it (D-74). Combat is the only thing that costs a player gear.
*The real open question is the equipping interaction*, not the slot count: nine slots across eight heroes is a great deal of drag-and-drop through a Dock whose ergonomics were already flagged.

**D-185 — The world holds around 20 skills.**
Each hero carries six (D-180) and touches roughly ten across two promotions, so **half the list is never seen by any one hero.**
*Why this size:* jobs should feel like different professions rather than variations — a Ranger and a Smith share almost nothing beyond basics. It also leaves room for **signature skills** granted by exactly one job (Fletching, Runecraft), which is what makes promotion feel like gaining access rather than swapping a number.

**D-186 — Consumables fire automatically at the start of every fight.**
One of each carried consumable is used; each applies a status effect to the hero or the enemy for the fight's duration.
*Why this solves the timing problem:* it finds **the one moment every consumable naturally shares.** Threshold auto-consume only expressed "I am hurt", which silently forbade any consumable that wasn't food. A fight has a beginning; buffs, debuffs and heals can all hang off it. It satisfies every constraint the question set — no micromanagement, varied effects, works unattended, no menu.
*Bonus:* it gives D-184's nine flexible slots a real decision. A slot spent on a consumable is a slot not spent on gear, so a loadout becomes a stance — *permanently stronger* versus *stronger in every fight* — and two heroes with the same job can be built entirely differently.

**D-187 — Consumables are bulk goods; one crafting cycle yields many.**
One herb and one reagent making twenty potions is the intended scale.
*Why:* it follows directly from D-186. If every fight consumes one of each carried consumable, demand is continuous and high, and producing them singly would make alchemy and cookery a bottleneck rather than a supply. **Consumables are ammunition, not treasures.**
*Economic consequence:* combat becomes a permanent sink for the culinary and alchemical chains — something they lost entirely when Energy was cut (D-183). The more a player fights, the more those production lines matter.

**D-188 — An equipped consumable is a link to the Bank, not a stack the hero carries.**
The slot names a *type*; each trigger draws one from the global Bank. Equip once and never reload. An empty Bank is graceful — the hero simply fights without that buff and resumes when supply returns, exactly as Tokens behave when starved (D-24, D-48).
*The interesting consequence:* **heroes share one stockpile.** Two heroes carrying the same potion burn it twice as fast. Consumable supply becomes a **roster-wide budget rather than a per-hero one**, so outfitting everyone with the same premium draught quadruples its drain. The player must scale production or diversify loadouts — scarcity emerging from the roster rather than from a rule.

**D-189 — Food and Drink are a separate category from Consumables.**
Consumables subdivide into Potion, Scroll, Rune and similar; D-186's fight-start rule governs *those*. Food and Drink restore HP and keep their own trigger.
*Why the split matters:* it lets healing have a trigger that suits healing without forcing every other consumable to share it — which was exactly the flaw in the old threshold model.

**D-190 — Production consumables run on duration, not per cycle.**
On a production Token a consumable fires at the start, applies a status lasting a set number of work cycles, and re-fires the moment it expires.
*Why duration is essential:* a per-cycle trigger would consume an order of magnitude more than combat — eight heroes at a 20-second cycle would burn forty a minute. A tonic lasting twenty cycles is roughly one per hero every seven minutes, which bulk production (D-187) sustains comfortably.

**D-191 — Status effects split into production and combat families.**
*Haste* speeds production; *Aggression* speeds attacks. A consumable's family decides where it does anything at all. Both are carried by the **existing status-effect engine**, which survives the rework and was previously exercised only by combat — it now carries the entire consumable layer on both sides of the board.

**Hero sprite work — deferred as polish.** D-75 stands unexamined for now; whether eight named heroes get individual portraits on the board is a question for the art pass, not the design.

---

**Prestige — a future direction, not part of this design.**
The intended shape is *Halo skulls*: a fresh run with freaky modifiers that change the game and may deliberately unbalance it, rather than a numerical reset with a multiplier.
*Note this reverses a pillar of the previous design*, which stated "no prestige, no resets — content is the ceiling." It is recorded because it answers what happens after the last Map, and because it means **the game does not need an authored ending**. Nothing in the current spec should assume it exists.

---

## Why a Grid, Having Just Left One

The previous rework replaced a spatial playmat with the Area Deck Loop, citing *"visual clutter, high drag-and-drop friction, and layout micromanagement."* Those objections were not obsolete, and this design has explicit answers to each:

| Objection | Answer |
| :--- | :--- |
| **Visual clutter** | D-85 caps the tile to art, progress and one alert mark. D-84 keeps connection lines off until hover. |
| **Drag-and-drop friction** | The Tray (D-107) makes the Bank → board flow work. Managers (D-35) automate restocking. |
| **Layout micromanagement** | D-54 makes fiddling cost throughput. D-63 makes leaving a hero in place *compound*, rewarding stability. |

The affirmative case: a card loop is a **list**; a board is a **picture**. Spatial adjacency gives synergy a physical language the player can see and arrange, placement replaces menus outright, and earning a Token is a stronger beat than earning a card because the player immediately places it and watches the board change.
