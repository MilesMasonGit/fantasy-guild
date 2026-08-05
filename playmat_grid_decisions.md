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

---

## Why a Grid, Having Just Left One

The previous rework replaced a spatial playmat with the Area Deck Loop, citing *"visual clutter, high drag-and-drop friction, and layout micromanagement."* Those objections were not obsolete, and this design has explicit answers to each:

| Objection | Answer |
| :--- | :--- |
| **Visual clutter** | D-85 caps the tile to art, progress and one alert mark. D-84 keeps connection lines off until hover. |
| **Drag-and-drop friction** | The Tray (D-107) makes the Bank → board flow work. Managers (D-35) automate restocking. |
| **Layout micromanagement** | D-54 makes fiddling cost throughput. D-63 makes leaving a hero in place *compound*, rewarding stability. |

The affirmative case: a card loop is a **list**; a board is a **picture**. Spatial adjacency gives synergy a physical language the player can see and arrange, placement replaces menus outright, and earning a Token is a stronger beat than earning a card because the player immediately places it and watches the board change.
