# Playmat Rework Concept: 7x7 Grid

## Overview
The Playmat system is transitioning from a card-based task delivery mechanic to a spatial 7x7 grid system. This represents a fundamental shift in the game's structure: **There are no longer separate "Areas" to travel between. The game takes place entirely on this single, permanent playmat.** 

Players interact with the game by dragging and organizing tokens onto this grid. These tokens act as the core gameplay units, representing enemies to fight, resources to gather, structures, and hazards. Earning tokens is a major reward and dopamine hit.

---

## Core Mechanics

### The Single Grid
A persistent 7x7 spatial board. It is the sole environment of the game.
- **Availability:** The full 7x7 space is completely open and available right from the beginning of the game.
- **Density:** Strictly one token per tile. No overlapping.
- **Progression:** The game gets harder and progresses by the player acquiring higher-tier tokens that spawn tougher enemies and yield better resources.
- **Size Cap:** ✅ **DECIDED** — The grid is a **fixed 7x7 (49 tiles) forever.** Strategy comes from optimization, not expansion. There is no grid expansion mechanic.

### Tokens & Storage
Tokens do not clear automatically. If the board gets cluttered, tokens can be stashed away into storage by the player and taken out as needed.

- **Depletion Model:** ✅ **DECIDED** — **Mixed model.** Basic/common tokens are finite and disposable (e.g., a "Forest" token yields 5,000 Wood before depleting and is consumed). Rare/crafted tokens are permanent or replenishable.
- **Stacking:** ✅ **DECIDED** — Tokens are **stackable** in storage. If you own 5 Forest tokens, they appear as "5x Forest" in one slot.
- **Automation:** Depletion limits early idle automation. Later mechanics use **Manager tokens** (see Automation section) to auto-replace depleted tokens.
- **Hazard Safety Net:** If a negative event/hazard spawns and "destroys" a token while the player is AFK, the token is not permanently lost. It is safely sent back to storage.

### Token Bank & Tray Flow
✅ **DECIDED** — The player manages tokens through a three-tier system:

1. **Token Bank** — A separate UI panel (similar to the existing Item Bank) that stores **unlimited tokens**. Tokens stack here (5x Forest, 3x Iron Mine, etc.).
2. **The Tray** — A physical space adjacent to the grid playmat. It has a **limited physical size** but does NOT use a grid. Tokens can be freely moved around inside it. No gameplay happens on the Tray — it's purely an organizational staging area where the player sorts tokens before placing them.
3. **The Grid (7x7)** — The active gameplay area. Only tokens placed here are "live."

**Flow:** Token Bank → Tray → Grid (or Grid → Tray → Token Bank to stash).

### Passive Token Interactions
✅ **DECIDED** — Tokens can interact with each other independently of the hero, primarily for passive generation (e.g., Waterfall → Farm for water supply).

- **Timing:** Each token has its own **independent production timer** (e.g., Farm = 10s, Mine = 15s).
- **Chain Depth:** Chaining is **unlimited** — A → B → C → D is valid. However, this works because all items flow through the **universal item bank**. Token A produces output → goes to Bank → Token B pulls input from Bank → produces output → goes to Bank → Token C pulls from Bank, etc. There's no direct token-to-token transfer; it's all mediated through the global inventory.
- **Output Destination:** 🔶 **DEFERRED** — How token output is stored/collected deserves its own focused conversation.

---

## The Hero

### Core Behavior
The hero is physically represented as a token on the grid.

- **Movement:** ✅ **DECIDED** — The hero is **stationary**. The player drags them to a new position and they stay there, interacting with whatever is adjacent. No auto-walk, no teleport.
- **Reach:** 1-Tile Radius (the 8 adjacent tiles). Everything is strictly adjacent — no ranged interactions.
- **Idle State:** ✅ **DECIDED** — If the hero has NO adjacent tokens, they stand still and do nothing until the player moves them or a token is placed nearby.

### Interaction Model
✅ **DECIDED** — The hero auto-processes adjacent tokens **sequentially, one at a time.**

- **Priority Order:** ✅ **DECIDED** — **Fixed clockwise** (N, NE, E, SE, S, SW, W, NW). The player cannot override this order. The ONLY way to control priority is by **placing tokens in specific positions** around the hero.
- **Processing:** The hero fully completes one token's interaction before moving to the next in the clockwise cycle.
- **Combat as a Task:** Combat works like any other interaction, except it continues **until the combat is resolved** (the enemy or hero dies), whereas harvesting tasks complete after a set timer.
- **Interleaving Example:** If the hero is adjacent to a Cow (enemy) and a Wheat Field (resource):
  1. Hero fights the Cow to the death (mutual damage, could take many rounds).
  2. Hero harvests the Wheat Field (single timed action).
  3. Hero fights the Cow again (it has respawned after its cooldown).
  4. Cycle repeats.

### Combat
- **Risk:** ✅ **DECIDED** — **Enemies attack back.** Combat is a mutual exchange of blows. The enemy damages the hero each round, and the hero CAN lose/die.
- **Failure State:** Standard existing mechanics apply — the hero is unassigned from the board and loses some equipment.
- **Focus:** Strictly 1-on-1. If surrounded by multiple enemies, the hero fights only the one dictated by clockwise order. Other enemies wait passively.
- **Enemy Behavior:** ✅ **DECIDED** — Enemies are **completely inert when not targeted.** They sit on their tile like any other token. They only fight when the hero's clockwise cycle reaches them. They NEVER initiate combat or aggro.
- **Combat Depth:** 🔶 **DEFERRED** — The nuances of combat resolution (stats, abilities, etc.) are a separate discussion. The focus here is on the grid interaction model.

### Multi-Hero Support
✅ **DECIDED** — The game **will eventually support multiple heroes** on the grid, each with their own reach radius, acting independently.
- **Equipment:** ✅ **DECIDED** — Each hero has **independent equipment.** Hero A wears a sword, Hero B wears a pickaxe — fully separate inventories.
- **Hero Differentiation:** 🔶 **DEFERRED** — How heroes differ from each other (specializations, classes, etc.) deserves its own isolated conversation.

### Equipping the Hero
- **Constraint:** Items from the inventory/bank CANNOT be dragged directly onto the playmat. The playmat remains strictly for Tokens and the Hero.
- **Solution:** The existing "Hero Dock" UI element sits off-board. Players drag and drop items from their inventory onto the Hero within this dock.
- **Open Concern:** This might feel clunky or disconnected from the grid.
- **Interaction Requirement:** The system needs a streamlined, intuitive way to manage equipment without dragging items onto the playmat.

---

## Spatial Synergy & Adjacency (The Spatial Puzzle)

Placement matters significantly. Synergies and buffs between adjacent tokens are visually communicated using **glowing connecting lines** that snap between them.

### Context-Derived Crafting
✅ **DECIDED** — Adjacency determines recipes. No menus needed.

- **How It Works:** Placing an "Iron Anvil" token and a "Helmet Schematic" token adjacent to a "Forge" token tells the Forge to produce Iron Helmets. The context tokens define the recipe purely through spatial placement.
- **Context Tokens When Isolated:** ✅ **DECIDED** — Context tokens are **inert decorations** when not adjacent to a relevant producer. They occupy a tile but do nothing until a relevant token is placed next to them.
- **Conflict Resolution:** ✅ **DECIDED** — If a station has CONFLICTING context tokens (e.g., both a Helmet Schematic AND a Sword Schematic), the station enters an **error/conflict state.** It produces NOTHING and shows a warning. The player must remove one schematic to resolve the conflict.

### Synergy Feedback
✅ **DECIDED** — **Connection lines** visually link context tokens to their associated stations. The active recipe is shown on or near the connection line.

### Synergy Discoverability
✅ **DECIDED** — **Tooltip-based.** Each token has description text explaining what it does. Hover or right-click provides full explanation of its function and synergies.

### Synergy Stacking
Synergies stack infinitely. If a player surrounds their Hero with 8 buff-providing tokens (e.g., Campfires), the Hero receives 8x the buff. The game embraces building overpowered synergies.

### Global Inventory Access
Tokens that require consumables (like bait for fishing or inputs for farming) automatically pull what they need directly from the player's infinite global bank/inventory.

---

## Token Types

### Standard Tokens
- **Resource Tokens** — Yield materials when the hero interacts with them (e.g., Forest → Wood, Iron Mine → Iron Ore).
- **Enemy Tokens** — Represent creatures to fight (e.g., Cow, Goblin, Dragon). See Enemy section.
- **Crafting Stations** — Produce items based on adjacent context tokens (e.g., Forge, Loom, Alchemy Table).
- **Context Tokens** — Placed purely to modify adjacent crafting/harvesting tokens (e.g., Schematics, Anvils).
- **Passive Generators** — Produce output independently of the hero (e.g., Farm, Waterfall).
- **Buff Tokens** — Provide stat buffs to adjacent heroes or tokens (e.g., Campfire, Shrine).
- **Building/Structure Tokens** — Special functional tokens (e.g., Automation Managers, Guard Towers).
- **Environmental Hazards** — Negative tokens that appear via events (e.g., Sinkhole, Blight). See Hazards section.

### Boss Tokens
✅ **DECIDED** — Bosses are **1×1 tokens** like everything else, just with much higher stats and special mechanics. They do NOT occupy multiple tiles (changed from original doc concept).

### Token Visuals
✅ **DECIDED** — Every token type has its own **unique 32px pixel art sprite** on the grid (Forest looks like trees, Forge looks like an anvil, etc.).

---

## Enemy Tokens (Detailed)

### Spawning
✅ **DECIDED** — **Both player-placed and event-spawned:**
- **Player-Placed:** The player deliberately places enemy tokens as permanent farming spots (e.g., place a "Goblin Camp" to farm goblins for gold/XP).
- **Event-Spawned:** Invasion events spawn enemy tokens on random empty tiles (see Hazards & Events section).

### Lifecycle
✅ **DECIDED** — Enemy tokens are **permanent tokens that refresh.**
- When the hero defeats an enemy token, the enemy does NOT despawn. Instead, it enters a **cooldown/refresh cycle** (e.g., 10+ seconds).
- During the cooldown, the token is inactive. The hero moves on to the next clockwise token.
- After the cooldown, the enemy is "alive" again and can be fought on the hero's next cycle pass.
- This motivates the player to place other productive tokens adjacent to the hero to **fill the downtime** between enemy respawns.

### Rewards
✅ **DECIDED** — **Loot per kill** with optional depletion.
- Each time the hero defeats the enemy, the player receives loot (gold, items, XP).
- Some enemy tokens will **deplete** after a number of kills (like resource tokens), while others are permanent.

---

## Hazards & Events

### Event Triggers
✅ **DECIDED** — **Mix of passive and active:**
- Low-tier invasions/hazards happen on **timers** (periodic random events).
- Big events are **player-triggered** (voluntary high-risk/high-reward raids) or **milestone-triggered** (progression gates).

### Hazard Behavior
✅ **DECIDED** — **Type-dependent.** Different hazards do different things:
- **Sinkhole** — Blocks the tile (occupies space, does nothing but waste a slot).
- **Invasion** — Spawns enemy tokens on adjacent empty tiles.
- **Blight** — Disables adjacent farm/production tokens.
- Other hazard types can be designed with unique mechanics.

### Hazard Impact (AFK Safety)
✅ **DECIDED** — Hazards primarily **disable/stop adjacent tokens** rather than destroying them.
- Hazards do NOT destroy tokens permanently.
- If unchecked, hazards will gradually **grind the entire operation to a halt** (because they disable more and more adjacent tokens).
- The player can easily clear them once they return.
- **Defense tokens** (e.g., Guard Tower) can auto-resolve hazards if placed adjacent.

### Hazard Clearing
✅ **DECIDED** — **Both combat and resource-based:**
- Some hazards require the hero to move adjacent and **fight** them (e.g., Invasion enemies).
- Others require the player to **pay resources** to clear (e.g., Sinkhole needs 100 Dirt).

---

## Automation

### Manager Tokens
✅ **DECIDED** — Manager tokens are **type-specific** and handle common resource chains.

- **Example:** A "Lumber Camp" manager token auto-replaces exhausted "Forest" tokens within its radius, pulling replacement Forest tokens directly from the Token Bank. This lets the player keep woodcutting without interruption.
- Managers are specialized, not generic. You need different managers for different token types.

---

## Progression

### Token Acquisition
✅ **DECIDED** — **Organic discovery** through multiple sources. No explicit tier or tech tree system — progression is emergent.

**Primary Source — Map Tokens:**
- **Map Tokens** are the main way to acquire core resource/enemy tokens.
- A Map Token works like any other task token. The hero "explores" it (timed interaction), and instead of receiving an item, the player receives a **Token** from the Map's drop table.
- Maps have **durability** (e.g., 5 uses). Each exploration drops a random token from the Map's pool, then after all uses are spent, the Map Token is consumed.
- **Example:** An "Ancient Woods" Map drops Forest tokens, Lumber Camp manager tokens, Bear enemy tokens, etc.
- Map Tokens are acquired through a **mix of sources:** basic Maps are **crafted** (e.g., at a Cartography station from Paper + Ink + biome-specific drops), rare Maps **drop from bosses**, and special Maps are **quest rewards**.

**Secondary Sources:**
- Loot drops from enemies and task completion
- Crafting recipes at stations
- Quest and milestone rewards

### Token Rarity
✅ **DECIDED** — Rarity is a **fixed property of the token type**, not a random roll per instance. All Forests are Common. All Dragons are Rare. There is no "Rare Forest."

| Rarity | Depletion | Ownership Cap | Notes |
|---|---|---|---|
| **Common** | ✅ Depletes (finite uses, permanently consumed) | Unlimited copies | The bread-and-butter. Consumed and replaced constantly. This is the core loop |
| **Rare** | ❌ Never depletes (permanent) | Unlimited copies | Enduring upgrades. A Rare version of a resource replaces the need to constantly re-acquire Commons |
| **Mythic / Artifact** | ❌ Never depletes, indestructible | **One copy EVER** | Endgame prize. Permanent, unique, powerful, safe. Cannot be destroyed by hazards or any mechanic |

- **Common tokens are always finite, no exceptions.** They are meant to be consumed and replaced. The player's goal is to eventually replace Common tokens with Rare equivalents.
- **Mythic/Artifact tokens** are the ultimate endgame rewards. One copy, indestructible, unique effects.

---

## Logical Scenarios

### Scenario 1: Fishing
The Hero interacts with a "Fishing Spot" token on the board to catch fish.
- **Action/Yield:** The Hero can catch multiple kinds of fish from this token.
- **Requirements:** The interaction requires a specific tool (e.g., a Fishing Rod).
- **Consumables:** The interaction actively consumes an item from the player's inventory (e.g., Bait) for each action.

### Scenario 2: Crafting & Recipe Selection
The Hero interacts with a crafting token (e.g., a "Smithing Station") to produce gear.
- **Resolution:** ✅ **DECIDED** — Adjacent context tokens (Schematics) define the recipe. No menu needed.
- **Conflict:** If multiple conflicting schematics are adjacent, the station enters an error state and produces nothing until the player resolves the conflict.

### Scenario 3: Farming (Passive Generation)
The player places a Farming token (e.g., a "Wheat Field") on the board.
- **Hero Independence:** This is a purely passive task that does NOT require the Hero's active interaction.
- **Requirements:** The farm requires specific inputs (e.g., water, seeds, compost).
- **Sourcing:** Inputs are pulled automatically from the global bank/inventory. Adjacent passive tokens (e.g., Waterfall) can also supply inputs via the bank.
- **Continuous Yield:** As long as inputs are supplied, the farm continuously produces output at its own independent timer rate.

### Scenario 4: Hazardous Events
A negative event occurs on the playmat.
- **Resolution:** See Hazards & Events section above for full details.
- **AFK Safety:** Hazards disable but don't destroy. Defense tokens auto-resolve if adjacent. Extended AFK leads to gradual gridlock, not permanent loss.

### Scenario 5: Equipping the Hero
The Hero needs combat gear and utility tools.
- **Constraint:** Items cannot be dragged onto the playmat — it's tokens and hero only.
- **Proposed Solution:** Hero Dock UI element off-board.
- **Open Concern:** May feel clunky. Needs a streamlined approach.

---

## Item Drop Mechanic ("Loot Piñata")
✅ **DECIDED** — Items produced by ANY source (hero harvesting, passive tokens, combat loot) drop as **floating visual sprites** on the playmat.

### Core Behavior
- **All items use this system.** Every item produced anywhere on the grid drops as a floating loot sprite. No distinction between hero-produced and passively-produced items.
- **Items are real.** They exist on the grid as collectible objects. They are NOT in the Bank until collected.
- **Visual style:** Each item type has its own **distinct pixel sprite** floating above the grid layer (not occupying a tile slot).

### Drop Animation
- **Physics scatter:** Items pop out of the producing token with a small random arc and land **1–2 tiles away** with a satisfying bounce.
- **Stacking:** After a short time, scattered items of the same type **merge into stacks** on a tile, showing a count badge. This prevents visual overload from individual sprites.

### Collection
- **Hover to collect:** Mousing over a floating item/stack instantly sends it to the Bank with a satisfying fly-away animation.
- **Hover sweep:** Clicking and dragging across the grid collects everything the cursor passes over.
- **Collect All button:** A single button that vacuums ALL floating items into the Bank at once.
- **No mechanical bonus:** Collection is purely visual/feel. There is no gameplay advantage to manual pickup vs. auto-collect. The mechanic is about dopamine, not strategy.

### AFK Accumulation & Performance
- **Items accumulate with no limit** in theory — creating massive satisfying stacks for the player to discover when they return.
- **"Max Item Stacks on Playmat" setting:** A player-configurable cap on the number of visible item stacks on the grid. When the cap is exceeded, the game **auto-collects** the least interesting stacks first:
  1. Common item stacks before rare drops
  2. Items before tokens
  3. Duplicate item stacks before unique ones
- This ensures that when the player returns, they see stacks of the **most interesting/rare drops** that occurred since they left.
- **Setting to zero** effectively disables the mechanic entirely (all items auto-collect instantly). This is intentional and acceptable — the mechanic has no gameplay effect, it's purely for fun.

### Production Chain Integration
- **Items on the grid do NOT block production chains.** The item drop mechanic is a separate concern from production.
- **Lookup order:** When a consuming token needs an input, it checks the **Bank first**. If the Bank is empty of that item, it pulls from **any matching item sprite on the grid** (regardless of location). The consumed sprite disappears from the grid.
- This means production chains are never starved by items sitting on the ground — they'll pull from the grid as a fallback.
- Combined with the auto-collect setting, a player who sets max stacks to zero has a functionally identical experience to "items go straight to Bank."

---

## Deferred Topics
The following topics were explicitly scoped out of this session and need their own dedicated conversations:

1. **🔶 Hero Differentiation** — How multiple heroes differ (specializations, classes, roles, etc.)
2. **🔶 Combat Depth** — Stats, abilities, combat resolution mechanics

---

## Open Design Questions (Still Unresolved)

1. **Hero Equipping UX** — The Hero Dock works functionally but may feel disconnected. What's a more intuitive approach?
2. **Token Visual Feedback** — Beyond connection lines and tooltips, how much real-time info should each token display on the grid? (timers, progress bars, output counts?)
3. **Passive vs. Active Token Ratio** — What's the intended balance between tokens that need the hero vs. tokens that run independently? Is there a design goal for how many of the 49 tiles should be passive vs. active?
4. **Multiplayer / Social** — Is there any future consideration for social features (visiting other players' grids, trading tokens, etc.)?
5. **Save/Load & Offline Progress** — How does offline progress calculate for a grid with 20+ independently-timed tokens?
6. **Map Token Balance** — How many uses should Maps have? What's the crafting cost? How rare are boss Map drops?
7. **Item Drop Visual Polish** — Exact scatter radius, merge timing, stack visual style (count badge vs. pile height), and rare item drop effects (glow, sound, etc.).
