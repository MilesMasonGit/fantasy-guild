# Concept: The 7×7 Playmat Grid

The game is replaced by a single, permanent **7×7 board**. The player places **Tokens** on it and stations **heroes** on those Tokens to work them. There are no Areas, no decks, no card loops, and no travel — the board is the entire game.

This document specifies **the board, Tokens and the economy**. Two companion specs own the rest:

| Document | Owns |
| :--- | :--- |
| [`playmat_hero_concept.md`](playmat_hero_concept.md) | What a hero *is* — skills, jobs, promotion, perks, equipment, recruitment, recovery. **In progress.** |
| [`playmat_ui_concept.md`](playmat_ui_concept.md) | Layout, the tile, feedback and interaction. |
| [`playmat_grid_decisions.md`](playmat_grid_decisions.md) | The reasoning behind every decision ID (D-nn) across all three, including rejected alternatives. |

Each rule lives in exactly one document. Where a topic spans two, the owning document states the rule and the other cross-references it.

> **Status:** settled at the mechanism level. Tuning values and content lists are deliberately not specified — see §11.

---

## 1. Design Philosophy

* **The board is the interface.** Placement *is* configuration. There is no recipe menu and no assignment screen — to change what a station produces, move a Token next to it; to change what a hero does, move the hero.
* **Adjacency governs *what*, not *how much*.** Context Tokens **define what a station makes**, which is binary and decisive. Numerical effects from adjacency are deliberately **small** (D-120). Real power comes from acquiring better Tokens, not from stacking modifiers.
* **Heroes are the constraint.** Roughly 15 heroes on 48 tiles. Tiles are comparatively abundant; **hero-time is what the player is always short of** (D-115).
* **Optimization, not expansion.** The board is 7×7 forever. Improvement comes from better Tokens, never from more room.
* **The board shows the work; menus handle the admin.** Everything that *produces* is on the board and visible. Management surfaces are off-board by design — the Banks, the Hero Dock, the Cartographer, Guild Upgrades and item selling. The rule is not "no menus"; it is **"no menu decides what the board does."**
* **Tokens are the reward.** Items are throughput; Tokens are progression. Acquiring one visibly changes what the board can do.
* **Consumption is a rhythm.** Common Tokens are used up and replaced. The loop has an inhale (acquire) and an exhale (deplete), not a monotonic climb.

---

## 2. The Board

| Rule | Detail |
| :--- | :--- |
| **Size** | Fixed 7×7 = 49 tiles, forever. No expansion mechanic. (D-1) |
| **Guild Hall** | The centre tile is a permanent Guild Hall — not placeable, not removable. **48 tiles are usable.** (D-106) |
| **Occupancy** | One Token per tile. Heroes overlay the Token they work; loot sprites float above the grid. Nothing else stacks. (D-2, D-57) |
| **Terrain** | None. All tiles are identical. (D-55, D-61) |
| **Edges** | No special rule. A corner Token has 3 neighbours and a central one has 8, which is the only positional difference. (D-61) |

### The Guild Hall
The centre tile is where **Guild Upgrades** are installed. Guild Upgrades survive the rework and live here.

> **In v1 the Guild Hall does upgrades and nothing else.** It is also the reserved landing site for board-wide events if Hazards and Invasions are ever restored (§11) — but that role is a **hook, not a feature**. No event system should be built for the first version (D-135).

Upgrades come in two reaches (D-121):

| Reach | Examples |
| :--- | :--- |
| **Aura** — affects the Guild Hall's 8 neighbours, per the standard adjacency rule (D-81) | Yield, speed and efficiency bonuses to adjacent Tokens |
| **Global** — not spatial at all | Bank capacity, roster cap, sell rates, drop rates |

Aura upgrades make the 8 tiles around the centre the board's most valuable real estate.

---

## 3. Tokens

A Token is a placeable object: a resource, an enemy, a crafting station, a context piece, a passive generator, a buff, a structure, or a Map.

**Existing Cards convert to Tokens one-for-one and keep their execution model** (D-79). A *Wishing Well* task card becomes a *Wishing Well* Token: a hero is assigned, it works on a cycle, it produces output. Cycle timing, inputs, outputs, drop tables and XP awards all carry over. A Token is a **card definition plus board state** — the registry holds the type; a light instance holds position, uses remaining, and which hero is on it.

### 3.1 Token Types

| Type | Behaviour | Needs a hero? |
| :--- | :--- | :--- |
| **Resource** | Yields materials when worked. Forest → Wood. | Yes |
| **Enemy** | Fought for loot and XP. | Yes |
| **Crafting Station** | Produces items defined by adjacent context Tokens. | Yes |
| **Context** | **Defines what an adjacent station produces**, and modifies it slightly. Schematics, anvils, tool racks. Inert alone. | No |
| **Passive Generator** | Produces on its own timer with no hero. Deliberately weaker than the same job staffed. | No |
| **Buff** | Small effects on adjacent Tokens *or* adjacent heroes. Scarce. | No |
| **Structure** | Managers, and similar utility. | No |
| **Map** | Worked to yield Tokens rather than items. See §7. | Yes |

**Most Tokens require a hero to work them** (D-53).

**Passive Generators are the exception, and are deliberately inefficient** (D-116). They need no hero, they may consume inputs, and they produce **strictly less per tile than the same job staffed by a hero** — often while consuming *more*. They are overflow capacity for a player who has run out of people, never a preferred alternative. This is what keeps heroes the ceiling (D-115) despite tiles being abundant.

**Tools are Context Tokens** (D-117). The old tool-item category is retired: a Tool Rack is a Context Token placed next to a station, benefiting whatever works there. It depletes like any Token, which is how tool wear is now expressed (D-118).

### 3.2 Rarity and Depletion

Rarity is a fixed property of the Token *type*, never a per-instance roll. There is no "Rare Forest" (D-38).

| Rarity | Depletion | Copies |
| :--- | :--- | :--- |
| **Common** | Depletes — finite uses, then consumed | Unlimited |
| **Uncommon** | Depletes, substantially more durable | Unlimited |
| **Rare** | Never depletes | Unlimited |
| **Mythic** | Never depletes | **One copy ever** |

> ⚠️ **This four-tier shape is provisional** (D-50). Open: whether Mythic is also hazard-immune, and whether Uncommon differs from Common in anything beyond use count.

**Mythics** are ultra-rare drops from bosses and Maps, and **boss Tokens are themselves Mythic** — one copy ever, never depletes, farmable indefinitely once placed (D-102, D-105). Nothing in progression depends on obtaining one.

**A duplicate Mythic roll converts to a large consolation payout** in gold or resources (D-124). The rare moment still lands, and late-game Map runs stay worth doing once most Mythics are already owned.

**Nothing else wears out.** Token depletion is the only wear mechanic in the game — it covers resources, enemies, tools and everything else placed on the board. Hero equipment is permanent, and the separate item-durability system is retired (D-118).

**Context and Buff Tokens wear per cycle they serve** (D-126). A Tool Rack loses one use each time an adjacent station completes a cycle — so one serving two Forges wears out twice as fast as one serving a single Forge.

> This gives D-113's shared-context rule a real cost. Clustering is still efficient, but sharing a schematic across three stations burns it three times faster, so dense layouts trade **throughput now** against **restocking sooner**. Sharing is a trade-off, not free upside.

### 3.3 Improvement
**A Token is never upgraded in place** (D-80). It has the numbers it has.

Two things change what a Token is worth, and they operate at very different scales:

| | Effect |
| :--- | :--- |
| **Adjacency** | **Small.** Context and Buff Tokens nudge output by a few percent, or add a low-probability bonus (a 1% chance of double yield). They do not transform a Token. (D-119, D-120) |
| **Acquisition** | **Large.** A better Token from a Map genuinely outclasses the one it replaces. This is where power comes from. |

```
Forest alone                      →  5.0 Wood
Forest + Sawmill                  →  5.4 Wood
Forest + Sawmill + Tool Rack      →  5.9 Wood

A Rare Ancient Grove              → 22.0 Wood
```

**Adjacency's real job is not amplification — it is definition.** A Forge with a Helmet Schematic beside it makes helmets; the same Forge with nothing beside it makes nothing at all. That is binary and decisive, and it is what makes placement matter. Numerical buffs are a light optimisation layer on top.

> This deliberately trades away the "build one monster tile" fantasy. In exchange, no stacking pattern dominates, so boards do not converge on a single optimal geometry.

### 3.4 Storage

**Token Bank → Tray → Board**, and back again.

### Storage Limits
**Stacks are never capped; slots are** (D-137). The player can hold a million Wood, but only so many *distinct types* at once. Two separate Guild Upgrade tracks raise the two slot counts independently:

| Bank | Capped by | Never capped |
| :--- | :--- | :--- |
| **Item Bank** | Number of distinct item types | Quantity of any one item |
| **Token Bank** | Number of distinct Token types | Copies of any one Token |

Capping quantity would punish a productive board, which is the opposite of what the economy is for. Capping *variety* creates pressure to specialise without ever making success feel like a problem.

### The Board Is Overflow Storage
✅ **Nothing is ever lost to a full Bank** (D-138). When there is no free slot for an incoming item or Token, **it stays on the board as a floating sprite** (§9) until the player makes room. It is not destroyed, not refused, and not silently discarded.

This gives the loot sprite system a genuine mechanical job on top of its cosmetic one. A Bank at capacity announces itself the way everything else on this board does — **visibly**, as litter piling up across the grid, rather than through an error message.

> **This is what protects a Mythic drop.** A one-copy-ever Token can never be wasted because storage was full: it sits on the board, waiting, until a slot exists.

*Consequence:* the auto-collect setting (§9) cannot collect into a full Bank, so a player running at zero visible stacks will still see sprites accumulate when they hit their slot cap. That is the intended signal.

* **Token Bank** — capped by distinct types, not by copies. Tokens stack.
* **Tray** — a permanent staging area, roughly a quarter of the screen. **Load-bearing:** opening a Bank covers the board, so Tokens cannot be dragged from Bank to tile directly. The Tray is what makes placement possible (D-86, D-107).
* **Board** — the live 48 tiles.

**Consolidation (D-77).** When a partially-used Token returns to the Bank, its remaining uses merge with other partials of the same type and re-pack into as many full Tokens as possible plus at most one remainder:

```
Bank has:  Forest (3,000 uses left)        capacity 5,000
Returning: Forest (4,000 uses left)
Result:    1× Forest (5,000, full) + 1× Forest (2,000)
```

Totals are conserved exactly, so picking a Token up and putting it back gains nothing. **Placement always draws a full Token first**; partials are used last.

### 3.5 Repositioning
Moving a Token is free and unrestricted, but **a Token part-way through a cycle loses that cycle** (D-54).

**The same rule applies to heroes** (D-131): pulling a hero off a Token mid-cycle forfeits that cycle too. One rule covers every interruption, and it applies the same gentle friction to hero shuffling that it applies to Token shuffling — which matters, because reassigning a scarce workforce is something the player will do constantly.

**Placement rules** (D-134):

* **Dropping a Token onto an occupied tile swaps the two.** No need to clear a tile first, which matters on a board with no spare space to shuffle through.
* **Heroes move tile-to-tile directly**, without a trip through the Dock. Reassigning the workforce is the game's most frequent action and should cost one drag, not two.

---

## 4. Heroes on the Board

> **This section owns only how heroes interact with the board.** What a hero *is* — skills, jobs, promotion, perks, equipment, recruitment, recovery — lives in [`playmat_hero_concept.md`](playmat_hero_concept.md), which is still in progress.

### 4.1 Placement and Work

* A hero **works exactly one Token and stands on top of it** (D-57). A hero on an empty tile does nothing.
* **One hero per Token, always.** Heroes never double up (D-111).
* **Heroes never move themselves.** A hero works their Token until the player drags them elsewhere — no auto-hop, no seeking, no queue (D-59).
* Heroes are **numerous** — on the order of 10–20 on the board. Roster size is the production ceiling: **the number of actively worked tiles equals the number of heroes** (D-58).
* Heroes have no reach and no adjacency of their own, except that **Buff Tokens adjacent to a hero's tile may target the hero** (D-112).
* Unplaced heroes live in the **Hero Dock** along the bottom of the screen, which is also where jobs, skills and equipment are managed (D-76).

**A hero whose Token stops producing simply idles** until the player returns (D-60). This is accepted as the natural limit of an idle session — the board winds down as Commons deplete, and returning to restart it is the point. Manager Tokens (§6.3) and non-depleting Rares are the mitigations.

### 4.2 What a Hero Contributes to a Token
A hero is **primarily a gate** — their presence is what makes a Token run at all — **and secondarily a modifier**. The Token sets what is possible; the hero sets how well it goes (D-62).

Three hero properties reach into board behaviour, and the board depends on all three (D-67):

| Effect | Board consequence |
| :--- | :--- |
| **Speed** | Higher skill works the Token faster. |
| **Access** | Tokens carry minimum skill requirements — the only thing gating a player from working high-tier content early. |
| **Efficiency** | Fewer inputs consumed per cycle; slower Token depletion. |

Rare drops and double yields are **properties of the Token, never the hero**, which keeps outcomes predictable.

Everything else about heroes — how they gain those skills, what jobs they hold, what they carry, how they recover — is in [`playmat_hero_concept.md`](playmat_hero_concept.md). That document also records the constraints this design imposes on it (its §5), so the hero session knows what it must not break.

---

## 5. Adjacency

**One rule everywhere: the 8 surrounding tiles** (D-81). Context, buffs, upgrades and Guild Hall aura all use the same neighbourhood. No ranges, no radii, no orthogonal exceptions.

Adjacency does three jobs, which is why it must be learned only once:

### 5.1 Context Crafting
Adjacent context Tokens define what a station makes. An Iron Anvil and a Helmet Schematic next to a Forge tell it to produce Iron Helmets. No menus (D-18).

* A context Token with nothing relevant adjacent is **inert** (D-19).
* **Conflicting** context Tokens put the station into an error state — it produces nothing and shows a warning until the player resolves it (D-20).
* **A context Token serves every adjacent station.** A schematic between two Forges drives both, so dense clever layouts are mechanically better than sprawling ones (D-113).

### 5.2 Buffs
**Buff effects are small, and Buff Tokens are scarce** (D-119). A typical buff nudges output by a few percent or adds a low-probability bonus — "1% chance of double yield" is a representative effect, not "double all output."

Stacking is therefore left **uncapped** (D-23): eight Sawmills genuinely give eight times a very small number, which is still a small number. No cap is needed because there is nothing to break. Individual Buff Tokens may still carry a **"does not stack with duplicates"** flag where repetition would be degenerate (D-82).

> **Note:** the original justification for uncapped stacking was that buff Tokens cost scarce tiles. That is no longer true — tiles are abundant (D-115). Stacking is safe now because **effects are small**, not because space is dear.

A Buff Token targets **either the adjacent Token or the adjacent hero**, depending on the Token: a Sawmill nudges the Forge, a Campfire heals the hero, a Shrine speeds their skill gain (D-112). A hero-targeting buff with no hero adjacent is inert.

### 5.3 Feedback
**Connection lines are shown on hover or selection only** (D-84). The board is clean by default; hovering a Token lights up its relationships with the active recipe on the line. Tooltips give full detail on hover or right-click (D-22).

---

## 6. The Economy

### 6.1 Inputs, Not Upkeep
**There is no continuous upkeep drain.** Tokens consume resources **when they work** — inputs per cycle, exactly as the current card system already does. A Forge burning Coal burns it per craft, not per second. Some passive Tokens consume inputs per cycle too. Whether a Token consumes anything, and what, is a **per-Token property** with no category rule deriving it (D-97).

Base resource Tokens generally consume nothing — a Forest makes Wood from nothing. This is a convention of how they are authored, not a law the system enforces (D-51).

Inputs are pulled automatically from the global Bank (D-24).

### 6.2 Depth Costs Heroes
Because Tokens consume items, and items are produced by Tokens, every consumer implies upstream producers — and **every producing step needs a hero standing on it**:

```
Armoury  needs Steel               ← hero
   └── Forge  needs Iron Ore + Coal ← hero
         ├── Iron Mine              ← hero   (base — no inputs)
         └── Charcoal Kiln needs Wood ← hero
               └── Forest           ← hero   (base — no inputs)
```

**That five-step chain costs five of your ~15 heroes — a third of the entire workforce for one output.** This is the board's central constraint (D-115). Tiles are comparatively abundant; **people are what you never have enough of.** Every hero assigned to deepening a chain is a hero not widening another.

Three release valves stop deep chains outgrowing the roster (D-94):
1. **Rares collapse steps** — a Rare Steelworks does in one tile, with one hero, what three Commons needed three of.
2. **Players specialise** — a mature board runs two deep chains, not eight.
3. **Authored chains stay bounded** rather than growing indefinitely deeper.

**Passive Generators are the pressure valve on this**, and the reason they must stay strictly inefficient (D-116): they let a player run a step without spending a hero on it, at the price of worse output and higher input cost.

### 6.3 Supply Shortfall
**A Token runs at full speed when it has its inputs, and waits when it does not.** There are no partial cycles. Allocation is **first-come: whichever Token's cycle completes first takes what is in the Bank**, and others wait for more to arrive (D-127).

Degradation is therefore **emergent rather than per-cycle**. Two Forges sharing a Coal supply that only covers one will alternate — each running full cycles about half the time — so aggregate throughput lands near 50% each without any Token ever running "at half speed". Shortfall is resolved **per item**, so a Coal shortage affects only coal-burners, and throttling cascades downstream naturally with no explicit cascade logic.

The board still **glides down rather than falling over**, which is what matters for the unattended case: Tokens wait, resume, and wait again.

⚠️ **Two consequences to watch:**
* **Cheap consumers systematically beat expensive ones.** A Token needing 1 Coal can act sooner than one needing 5, so under sustained shortage the *deep* chains the game wants players to build are the ones that starve first. This is the opposite of the intended pressure and needs checking during balance (risk 13).
* **Two identical Tokens can behave differently** for no visible reason — one running, its neighbour waiting. The alert mark (§9.2) is what makes this legible.

Because base Tokens need no inputs, a chain that runs dry always restarts from the bottom. **Supply deadlock is structurally impossible** (D-51).

**Diagnosis is on the Token** (D-114). A Token that cannot work shows a **glowing red alert mark**; hovering states exactly what it lacks and by how much. There is no aggregate supply dashboard.

### 6.4 Supply Is Not Spatial
Chains route through the **global Bank**. A Forest in one corner supplies a Forge in the other exactly as well as a neighbour would. There is no locality bonus, no routing, no range (D-83).

> **What a Token makes is spatial. Where its materials come from is not.**

### 6.5 Gold

**Sources** (D-93) — three, with deliberately different cost profiles:
* **Market Tokens** — best rate, but cost a tile and a hero.
* **Selling from the Bank UI** — convenient, always available, poorer rate. *An off-board exception, kept deliberately worse than the on-board option.*
* **Enemy drops.**

**Markets are goods-specific** (D-141). A Lumber Market buys wood products; an Arms Market buys weapons. Each has an input list like any other Token, so a Market is simply a Token whose *output* happens to be currency rather than items.

This keeps Markets consistent with everything else on the board, removes any ambiguity about what a Market sells, and reinforces D-128 below: the best gold comes from feeding **finished goods** into the right Market, which means deep chains pay off in currency as well as in capability. Serious gold income costs several tiles and several heroes.

**Sinks** (D-96):
* **Map purchases** — the primary sink, and the one that scales with play forever.
* **Guild Upgrades.**
* **Themed restock packs.**

**Items are worth more used than sold** (D-128). Sale prices are deliberately poor relative to what an item does as a crafting input, so **selling is for genuine surplus and never a strategy**. This is what stops the obvious money printer — buy a pack, work the Tokens, sell the output, buy another pack — from ever spinning up: feeding items into a chain always beats liquidating them.

> The corollary is that **deep chains are how a player gets rich.** Raw Wood sells for very little; Planks sell for more; a finished good sells for much more. Gold income is therefore a direct reward for board depth, which points the economy at the same behaviour §6.2 does.

### 6.6 Restocking
Commons deplete constantly, and hand-replacing them would be the busywork that sinks the game. **Themed packs** solve this: the player buys a *Woodland Pack* for gold and receives woodland Commons, randomised within the theme (D-49, D-87). Restocking becomes a transaction rather than a chore.

**Manager Tokens** automate it further. A Manager is type-specific — a Lumber Camp auto-replaces exhausted Forests from the Bank; a Goblin Camp refreshes Goblin-type enemy Tokens (D-35, D-104). Managers need no hero, and are the mid-game automation reward and the main mitigation for idle heroes.

**Managers cover their 8 adjacent tiles and never deplete** (D-140). They are permanent infrastructure — place one and that cluster restocks itself forever. Where two Managers cover the same tile, whichever acts first does the job.

> Permanence matters here: a Manager that wore out would be a restocker needing restocking, which is exactly the chore the Manager exists to remove. The 8-tile reach means a large board wants several, so automation is bought cluster by cluster rather than all at once.

**A Manager with an empty Bank fails silently** (D-133). It cannot conjure a Token — it can only move one from storage to the board. If there is no Forest in the Bank, the depleted tile stays depleted, the hero idles (D-60), and the tile shows its alert mark.

This makes **stocking the Bank a preparatory act**. Unattended runtime is something the player provisions for before logging off, and it completes the automation chain:

```
gold → themed packs → Token Bank → Manager → board
```

> **Consequence:** the AFK story is not "automation runs forever." It is "the board runs as long as you left it supplies for." How long a board survives unattended is a direct function of how well the player prepared — which turns logging off into a decision rather than an event.

---

## 7. Cartography and Maps

**This is the replacement for the pack/booster economy.** It is how the player acquires new Token types, and it is the game's progression system.

### 7.1 The Cartographer
The Cartographer is an **off-board NPC with a menu** — not a Token, not a board object (D-98). The player opens the menu and buys Maps. This is the second deliberate off-board exception; the **Map itself is a Token** that is placed and worked, so only the transaction leaves the board.

### 7.2 The Menu
**Every Map is listed from the very start, in price order** (D-99, D-101).

```
THE CARTOGRAPHER
  Woodland Map ......... 200g + a few basic goods   ← affordable now
  River Map ............ 2,000g + goods
  Mountain Map ......... 20,000g + goods
  Volcanic Map ......... 200,000g + goods           ← visible from day one
```

* **Nothing is ever locked.** Cost is the only gate.
* **Price order is the guidance.** The top entry is the obvious first purchase; the list below is the visible future. No tutorial, no recommendations, no greyed-out nodes.
* Maps cost **mainly gold, plus a small material component** (D-100).

### 7.3 Working a Map
A Map is a Token. A hero works it like any other, and instead of items the player receives a **Token drawn from that Map's loot pool**, which goes to the Token Bank. Maps have **durability** — a set number of uses — and are consumed when spent (D-37).

**Maps sit outside the rarity system entirely** (D-132). They are never Common, Rare or Mythic: they are always consumable, always bought rather than found, and never placed to produce. Rarity governs Tokens that sit on the board and make things; a Map is a different kind of object that happens to occupy a tile while being spent.

**A Map's loot pool is the only meaning "biome" has.** There are no biome systems, biome bonuses or biome mechanics. A "Woodland Map" is simply a Map whose pool contains woodland-flavoured Tokens. Names are flavour.

**A Map's pool contains the complete kit for its theme** (D-139) — producers, their Context Tokens, their Buff Tokens, their Manager, and the enemies that belong there:

```
WOODLAND MAP pool
  Forest, Berry Bush ........ producers
  Sawmill, Tool Rack ........ context
  Campfire .................. buff
  Lumber Camp ............... manager
  Bear ...................... enemy
```

**Buying a Map is therefore buying access to a self-contained set**, and Map choice becomes a strategic commitment rather than a lottery ticket. It also means one purchase eventually yields everything needed to run that theme properly — including the automation that makes it survive unattended.

### 7.4 Starting State
A new game opens with (D-122):

* **2 heroes**
* **A few basic Common Tokens** — enough to place and work immediately
* **A small amount of gold**
* **The Cartographer menu already open**, listing every Map from cheapest to most expensive

The first Map is priced as a visible near-goal, so the opening sequence is: place Tokens → station heroes → produce → sell → buy the first Map → work it → receive new Tokens. The core loop is reachable within the first minute, and the progression loop within the first session.

**The board starts nearly empty, and that is intended** (D-123). Filling it is the visible measure of progress — a new player has four Tokens on 48 tiles; a veteran has a packed board with heroes everywhere. Emptiness is progress feedback, not a content gap.

### 7.5 Progression Shape
Progression is **a price curve**. The player's board produces goods, goods become gold, gold buys the next Map, and that Map yields Tokens that make the board produce more. Advancement is therefore gated by **how well the board runs**, and the player is free to save for anything they can see.

Later Maps yield Tokens that are **stronger and more demanding** — higher output, but deeper chains, more inputs and higher skill requirements (D-95). Power grows and so does its footprint, which is what keeps a fixed 48-tile board meaningful at every stage.

---

## 8. Combat

> **Production is the idle half of this game. Combat is the active half.** Everything else on the board is designed to run unattended and wind down gracefully. Combat is deliberately the opposite: it is where the game asks the player to be present, and where inattention has a price (D-130).

Combat happens when a hero is placed on an enemy Token.

* **Enemies are inert until targeted.** They never initiate, never aggro (D-14).
* Combat is a **distinct real-time system** using the existing 7-stat combat engine, not a Token cycle — it has its own pacing, damage rolls and status effects (D-90).
* **Enemies fight back and the hero can lose** (D-13). See §4.3 for defeat.
* Combat is strictly **1-on-1** — automatic, since a hero stands on one Token (D-15).
* **A short rest follows every kill** (D-103). Time per kill is therefore **fight duration + a fixed rest**.

> **Hero power shortens the fight but not the rest.** Against an enemy that takes minutes to grind down, more damage means meaningfully faster kills — power pays off exactly where the challenge is real. Once fights are already shorter than the rest interval, additional power buys nothing more, so kill rate hits a ceiling.
>
> The rest is a **ceiling on kill rate, not a cancellation of power.** It bites only in the case it was built for: an over-levelled hero one-shotting a long line of weak enemies. **Farming trivial content is capped; fighting hard content is not.**

### 8.1 Risk Is Managed by Attention, Not Information
There is **no difficulty warning, no skill gate and no preview** on enemy Tokens (D-130). Instead:

* **Retreat is always available.** The player can pull a hero off an enemy at any moment, and the fight ends immediately.
* **The player is expected to watch the first few fights** of any new enemy to judge whether their hero can sustain it.
* **Leaving a hero unattended in a fight they cannot win means death** — and death costs equipment (D-74).

This makes combat the one part of the board that rewards being at the keyboard, and it gives D-60's unattended wind-down a sharper edge on combat tiles specifically. Production idles harmlessly; an unwatched fight does not.

**Retreat and healing compose.** `RegenSystem` already regenerates HP for **idle** heroes, and a hero pulled off a Token is idle — so retreating a wounded hero *is* the healing mechanic. Withdraw, let them recover, send them back. No new system is required (D-136).

### 8.1b Combat Is Ported, Not Rebuilt
The combat system already exists and works: today a hero encounters an enemy card and combat begins. Under the rework a hero is **dropped onto an enemy Token** and combat begins. The 7-stat engine, status effects, damage resolution, the Wounded state and passive regen all carry over unchanged — **only the trigger changes** (D-136).

This materially reduces the first build's risk: combat is a porting job, not a design-and-build job.

### 8.2 A Kill Is a Cycle
For every board system outside the combat engine, **one kill counts as one cycle** (D-129). This is what connects combat to the rest of the board:

* Context and Buff Tokens adjacent to an enemy **wear per kill** (D-126) — a Weapon Rack burns down as it is used.
* Adjacency effects apply per kill, so a Weapon Rack raising damage or a Shrine granting XP works exactly as it would beside a Forge.
* The tile's progress ring (§9.2) tracks the **current fight**.

Combat therefore keeps its own internal pacing while plugging into the board's economy through a single, consistent unit.

> **Consequence:** hero power does not increase kill rate. It buys survivability and access to tougher enemies. Combat output scales through **more Tokens and more heroes**, exactly as production does.

* **Enemy Tokens deplete** like any other Common and are refreshed by Managers (D-104).
* **Bosses** are 1×1 Mythic Tokens found in Maps, farmable indefinitely once placed (D-25, D-105).

---

## 9. Presentation

**Layout, the tile, feedback and interaction are owned by [`playmat_ui_concept.md`](playmat_ui_concept.md).** Only the rules with economic consequences are stated here.

* **Items drop as floating sprites** above the grid rather than going straight to the Bank. They occupy no tile and are not banked until collected (D-40).
* **Collection confers no mechanical advantage** — manual and automatic pickup are identical in outcome. The mechanic exists for feel, and can be disabled entirely by a player setting (D-41, D-88).
* **If the Bank lacks an item a Token needs, it is pulled from any matching sprite on the board** (D-42). Loot on the ground therefore never starves a chain.
* **A tile surfaces a single alert mark** when a Token cannot work, with the cause on hover. This is what makes supply shortfall (§6.3) visible, since throughput degrades without any change in animation (D-85, D-114).

---

## 10. What This Replaces

### 10.1 Deleted
Areas and everything scoped to them — the World Map, map fragments, area unlock quests, area-scoped card pools, per-area binders. Area Banners. The deck loop, its slots, draw and shuffle timing, and the Prep Phase. Adventure/Stationed mode. Outpost Banners. Playsets and Mastery bonuses. Hero traits. Biomes and biome modifiers as systems. **The tool item category** (D-117) and **the item durability system** (D-118) — both replaced by Token depletion.

### 10.2 Survives
The global item Bank and the item economy. The 7-stat combat engine and the status-effect engine. Heroes and equipment — though equipment drops to 3–4 slots and no longer degrades. Guild Upgrades, re-homed to the Guild Hall tile. The card *schema and execution model*, which becomes the Token model. The nav bubble menu, drawers and inspection panel.

### 10.3 Requires Rebuilding

**The buff/modifier system.** The existing system applies effects to **downstream cards in a deck** — `LoopBuffs.js` uses an `EFFECT_REACH` of `loop` (active until the loop wraps) or `next_card`. With decks and loops gone, that targeting layer is meaningless and requires a near-complete rebuild.

| Keep | Replace |
| :--- | :--- |
| `ModifierAggregator` and the **Three-Bucket math** — `(Base + Σflat) × (Σmultipliers) × (1 + Σpercentages)`, already covered by tests | `EFFECT_REACH` targeting — `loop` / `next_card` becomes **the 8 adjacent tiles** |
| `EFFECT_TYPES` — SPEED, YIELD, WORK_TIME, INPUT_COST, DAMAGE, DEFENSE, XP_BONUS and the rest | `LoopBuffs.js` and `AreaModifiers.js`, both of which assume a deck and an area |

The effect maths is sound and tested. It is the delivery mechanism that changes.

**The card-mutator "Token" system** (`TokenRegistry.js`, `SlotTokens.js`, `TokenAxes.js`) stamps modifiers onto **deck slot indices** and wipes them at the **Cycle boundary**. Both concepts are deleted by this rework, so the system most likely retires with the loop — freeing the name "Token" for grid objects. If the *concept* is wanted on the board, it needs a name that does not collide with `statusRegistry`, `effectRegistry` or `LoopBuffs`; **Mark**, **Sigil** and **Condition** are free.

**The CMS** will be almost completely rebuilt, **after** this rework and out of its scope (D-109). Token content is hand-authored in JSON meanwhile. ⚠️ The CMS's "Sync to Game" destroys unmodelled content and **must not be run against hand-authored Token data**.

### 10.4 Saves
**Existing saves are wiped.** The save version gate is bumped and older saves are refused with a clear message (D-110). Nothing meaningful maps across — heroes lose traits and gain jobs, cards become Tokens with board state, and the board replaces areas entirely.

---

## 11. Open Questions

**Owned by other documents**
* **Hero identity, skills, jobs, recruitment, food/drink/Energy** → [`playmat_hero_concept.md`](playmat_hero_concept.md) §4. That document also lists the constraints this design imposes on it.
* **Screen layout, Hero Dock ergonomics, board scale, Tray capacity, touch support** → [`playmat_ui_concept.md`](playmat_ui_concept.md) §7.

**Deferred until the board is playable**
* **Hazards, Events and Invasions** — the entire system is suspended to test whether the board needs an antagonist at all. The 30 authored Threat debuffs are orphaned but not deleted; the Guild Hall is already the landing site if they return.
* **Offline progress.** Note that combat pacing is known not to scale under time acceleration, and combat is now permanent on the board — whatever model is chosen must address that deliberately.
* **Quests** — may be cut. They rewarded map fragments, which no longer exist.

**Tuning and authoring, not design**
* Tray capacity and whether it grows.
* Whether Token numbers are hand-authored or generated from a tier formula.
* The Map price curve.
* The explicit card → Token conversion table.

**Still genuinely undecided here**
* The four-tier rarity shape (§3.2) is provisional.
* Whether other off-board services (merchant, recruiter, trainer) become NPCs like the Cartographer.
* What a Map's loot pool contains — whether Managers and Context Tokens drop from Maps or are acquired some other way.
* Whether Manager Tokens themselves deplete, and what happens when two overlap.

---

## 12. Build Constraints and Known Risks

**First build target:** one Map's worth of content — roughly 15 Token types, a handful of heroes, progression stubbed (D-108). The most uncertain claim in this design is that **the board itself is enjoyable**; that needs testing before content is authored against it.

| # | Risk | What to watch |
| :--- | :--- | :--- |
| 1 | **The board gets solved.** *Substantially reduced by D-120* — with all adjacency effects small, no stacking pattern dominates enough to converge on. | Watch anyway. If experienced boards still look identical, vary context Token requirements. |
| 2 | ⚠️ **Adjacency may now matter too little.** D-120 made numerical effects small, so the spatial game rests almost entirely on **recipe definition** (D-18) rather than optimisation. | If placement stops feeling meaningful, the lever is *more recipe-defining context Tokens*, not bigger buff numbers. |
| 3 | **The price curve is the entire progression system.** With Maps paid for mainly in gold, strong income from any source lets a player skip ahead. | If skipping beats developing, raise the material component of Map cost. |
| 4 | **The design penalises absence.** Heroes idle when their Token depletes, so a long absence winds the board down. | Manager Tokens must arrive early enough to matter, and Rares must meaningfully extend unattended runtime. |
| 5 | **The board is purely constructive** while hazards are suspended. Nothing external threatens what the player builds. | This is the experiment. If it reads as unchallenging, the suspended hazard system is the answer. |
| 6 | **One Map cannot test progression.** The price curve and the strength/demand curve are invisible until a second Map exists. | Do not leave the second Map behind polish. |
| 7 | **Visual clutter** killed the previous spatial playmat. This board carries more per-tile information than that one did. | Mock a worst-case full board early — 48 Tokens, heroes, progress rings, alert marks and loot sprites together. |
| 8 | **Drag is the only verb.** No fallback exists for touch or small screens. | Decide whether click-to-place is needed. |
| 9 | **Hand-authored JSON** is the only content pipeline until the CMS is rebuilt. | Tolerable at ~15 Tokens; reassess before the second Map. |
| 10 | **Per-Token input rules give players no principle to reason from** — they must learn each Token individually. | Author consistently anyway: creates-from-nothing should be free, transforms should cost. |
| 11 | ⚠️ **Passive Generators must stay strictly inefficient** (D-116). Tiles are abundant, so if an unstaffed Token ever beats a staffed one per tile, the optimal board becomes mostly unstaffed and heroes stop being the ceiling. | Check every authored Passive Generator against its staffed equivalent. Worse output *and* higher input cost is the rule. |
| 12 | **Gear crafting goes quiet between Map unlocks.** With durability retired, equipment only leaves via defeat-loss, so demand comes from roster growth and better recipes. | If the crafting chain feels dead, promotion costs (hero session) are the natural place to add gear demand. |
| 13 | ⚠️ **First-come allocation starves deep chains** (D-127). A Token needing 1 Coal can act sooner than one needing 5, so under shortage the expensive, high-tier steps lose to cheap ones — the opposite of the pressure §6.2 intends. | Measure it directly during the first balance pass. If deep chains starve, allocation needs a rule that favours them, or expensive steps need buffered inputs. |
| 14 | ~~Combat has no recovery path.~~ **Not a risk** — `RegenSystem` already heals idle heroes and is ported unchanged (D-136). | — |
| 15 | **Managers fail silently when the Bank is empty** (D-133). An unattended board can wind down without any signal that a restock would have prevented it. | The alert mark on the depleted tile is the only cue. Check that a returning player can tell "I ran out of stock" apart from "something else went wrong." |
