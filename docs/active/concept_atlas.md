# Atlas System Specification

This document expands on the **Map System & Region Generation Concept** to provide a concrete, actionable blueprint for implementing the Atlas System. It is designed to fully equip the agent responsible for planning and executing this feature.

---

## ⚠️ Owner decisions, 2026-10-07 (these override the sections below)

The concept was written by another tool on 2026-10-05; the owner reviewed it
against the current game and decided:

| Topic | Decision |
|---|---|
| **Resource nodes** | **Respawning fixtures** (as §3.3): the map places permanent nodes that deplete and come back in place. Spawners remain **only for enemies and lures**. |
| **Respawn** | Time **set per Token in the CMS** (10–15 s is a starting value). Each node type also chooses **refill or regrow**: an ore vein refills; a tree comes back as a sapling that grows (today's growth system), keeping the mat visibly alive. |
| **The Shop** | Sells **buildings and tools only** (Foundations, anvils, tools, lures). Resources come from the Region. |
| **Removing buildings** | **Demolition is a low-level Construction job**: the player marks a Token for demolition and a hero with Construction removes it. **No refund.** Replaces the discard bin. (Replaces the concept's "hold to deconstruct".) |
| **Token cap** | **Everything on the mat counts**, generated nodes included, so a map's budget must fit the cap; Guild upgrades raise it. |
| **New game** | A **hand-made Starter Camp** Region: fixed nodes for the tutorial, a few enemies, safe. The tutorial ends by giving the first Maps. |
| **Guild Hall** | **On every Region, in the centre**; each Region is generated around it. Its upgrades are global. |
| **Ambushes** | Kept, as a **per-Token rule** authored in the CMS (a chance to spawn an enemy when worked; the effect grammar's "spawns"). |
| **Map sources** | **Rare enemy drops and quest rewards**. Maps are special items (owner, 2026-10-07); the old Map Tokens retire. |
| **Biomes and terrain** | **The terrain rework paints each Region's biome** from its Base Maps, blending hybrids; it follows the Atlas in the crunch. |
| **Offline** | Only the active Region runs; offline catch-up (`concept_offline_progress.md`) applies to it alone. |

**What this changes in today's game** (for the roadmap):
- The **Spawner System** narrows to enemies and lures; forests and mines stop
  being Shop purchases.
- **Charges become "until depleted"**: a node at 0 charges depletes and
  respawns instead of being removed.
- The **discard bin and its refunds** are replaced by demolition (T-101's bin
  bug matters only until then).
- The **Token cap** (T-102) covers generated nodes; map budgets are sized to it.
- The **opening mat** (Hall, Oak Forest, Copper Mine bought from the Shop)
  becomes the Starter Camp.

---

## 1. Executive Summary
The Atlas System replaces a linear or purely procedural world map with a player-driven, chemistry-style crafting system. Players loot base Maps and Modifiers, combine them in the Cartography interface to define a "generation budget," and generate a custom Region layout. They can infinitely reroll the spatial layout before "Settling" the region permanently into their Atlas. Traveling to a Region relocates all Heroes to that screen, where they can build Foundations and interact with organic nodes and integrated combat threats.

---



## 3. Mechanics & Workflows

### 3.1. Acquisition (Looting)
- **Starter Region**: Before players interact with the Atlas, they begin in a predefined, hardcoded "Starter Camp" Region. They use this safe region to learn gathering and combat, complete tutorials, and loot their very first Maps.
- **Initial Maps**: The player receives their first set of basic maps as guaranteed drops from introductory tutorial quests.
- **Ongoing Acquisition**: Maps and Modifiers are rare loot drops gated behind enemies. The player must be able to farm these enemies safely and in large quantities to reliably acquire new Map and Modifier drops.
- **Inventory Format**: Maps and Modifiers are purely stackable commodities (e.g., a stack of 5x "Forest Map" or 10x "+10% Trees Modifier"). They have no randomized properties or rarity tiers. While they are treated as standard inventory items, their sprites are scaled to 64px (larger than standard 32px items) to visually distinguish them.
  - *Map Upcycling*: Because idle players will eventually accumulate thousands of low-tier maps with no downside, a future "Upcycling" or transmutation crafting mechanic will allow players to combine large quantities of excess early maps into better, later-tier maps.

### 3.2. Cartography (Map Chemistry) UI & Flow
- **Access**: The Atlas is accessed via a dedicated bubble navigation button.
- **Layout**: 
  - **Left Panel (Inventory)**: A simplified inventory specifically filtered to show the Maps and Modifiers the player currently owns.
  - **Main Area (The Workbench)**: Takes up most of the screen and is divided into three parts:
    1. **Crafting Slots**: Designated slots where players drag and drop their maps from the left panel. The player starts with a small fixed number (e.g., 2 slots) and can unlock more slots through Guild upgrades (e.g., up to 8 slots). **Each slot holds exactly ONE item.**
    2. **Node Summary**: A dynamic readout displaying the exact Node Budget (e.g., exactly how many trees, ores, or enemies) that will result from the currently slotted items.
    3. **Generation Preview**: A visual preview showing the resulting geographical layout.
- **Recipe Discovery**: Pure experimentation. There are no "blueprints" to unlock. Players simply drag and drop maps and modifiers into the slots and watch the live Node Summary and Generation Preview change before deciding to generate. **Any combination is allowed**, allowing players to create "semi-broken" maps (e.g., stacking multiple Forest and Jungle modifiers to make a map densely packed with Ebony Trees). The natural limit to combinations is simply the number of available slots.
  - *Hybrid Biomes*: Players are not restricted to just one Base Map per recipe. They can slot multiple Base Maps (e.g., Forest + Desert) to procedurally blend the node types and visuals together into a hybrid region.
- **Progression Logic (Points System)**: Total node density on a map remains relatively consistent (though later maps or Guild upgrades may increase the total size/cap). Instead of simply adding nodes, maps and modifiers contribute to a "Points" or "Weight" system that dictates how the available space is populated. Progression is horizontal and combinatorial, rather than vertical.

### 3.3. Generation, Settling & Respawning
- **Instantiating the Playmat**: Once the recipe is confirmed, the game generates a preview of the Region on a single, screen-sized playmat. The map's **physical grid size remains fixed** (e.g., a single non-scrolling screen or fixed camera bounds). Stacking multiple Density Modifiers simply packs the nodes tighter together within that fixed space.
- **The Reroll Action**: The player can click "Reroll" indefinitely to shuffle the layout. This action is **completely free and unlimited**; hunting for the absolute perfect geographic layout for a base is an intended and valid playstyle.
  - *UX Feedback*: Rerolling triggers a snappy, immediate visual reshuffle on the preview. It includes a tiny (e.g., 0.5s) cooldown to prevent macro-spamming while keeping the interaction satisfying.
  - *Crucial Rule*: Rerolling **does not change the Node Budget**. It only recalculates the procedural layout (coordinates) of the nodes.
  - *Purpose*: Allows players to find a geographical layout that suits their intended base design (e.g., grouping all trees together, or finding a nice clearing for their camp).
- **Cancellation**: Ingredients are only consumed when the player officially "Settles" the region. If the player closes the Cartography UI or clicks "Cancel," all slotted ingredients are safely returned to their inventory and the Generation Preview is discarded.
- **Settling**: When the player accepts the layout, they "Settle" the map. This permanently consumes the recipe ingredients, saves the layout, and adds the `AtlasRegion` to their Atlas UI.
- **Node Respawning**: 
  - Standard resource nodes (e.g., Copper Ore) temporarily deplete into a "depleted" state when worked, and respawn shortly after (e.g., 10-15 seconds).
  - Special exploration nodes (e.g., Ruins) deplete permanently once cleared, acting as a one-time bonus for generating that specific map.

### 3.4. Travel, Relocation & Progression
- **The Atlas UI**: Players open the Atlas UI to view a permanent list of every region they have Settled. To manage UI clutter, players can **"Archive" or "Abandon"** old Regions. Abandoned regions are permanently deleted, along with any Foundations left behind.
- **Map Naming UX**: Settled regions receive a dual-name system to help organize the Atlas:
  - *Practical Name*: Unchangeable, based on the ingredients used (e.g., "Granite Hillside Forest").
  - *Flavor Name*: Procedurally generated based on inputs (e.g., "Rockblight Valley"). The player can freely rename this at any time directly from the Atlas UI by clicking an "Edit" icon next to the name.
- **Traveling**: Clicking "Travel" instantly relocates **all** Heroes to the selected Region. This action **instantly interrupts all current actions** (gathering, crafting, combat) and resets their state to idle upon arrival. The Active Gameplay loop takes place entirely on this single screen until the player travels again.
  - *Offline/Background Regions*: Previously Settled Regions are completely **frozen** when you leave them. Because all Heroes travel with you, only the active Region generates resources or spawns enemies.
- **The Core Progression Loop**: Because standard resources respawn and moving is expensive (Foundations yield no refund), the primary motivation for abandoning an established base is **resource progression**. When the Guild requires Tier 2 resources (e.g., Fir Wood instead of Oak), the player must craft a new map containing those resources, travel there, and establish a new base. This is the core progression driver of the game, balanced against soft skill gates.

### 3.5. Foundations & Active Gameplay
- **Organic Nodes**: The static generated elements (Trees, Ore, Ruins).
- **Foundations**: Player-placed structures (e.g., Lumber Mill, Furnace, Campfire) built using a Construction skill. They can be placed around the static nodes. 
  - *Placement constraints*: Foundations require **clear space** to be placed. If a player generates a map too dense with organic nodes (e.g., 100% trees), they must manually chop down trees to clear space for building. Organic node respawns are already handled to find a clear space, meaning they won't spawn inside a placed foundation.
  - *Permanence*: Foundations are permanently tied to the map they are built on. They can be deconstructed to clear space, but this refunds **zero** resources. To prevent accidental frustration without disrupting game flow, deconstructing requires a **"Hold to Deconstruct" action** (e.g., holding the mouse button for 2 seconds) instead of a popup dialog. Relocating to a new map means rebuilding infrastructure from scratch.
- **Fallback Processing**: To prevent Heroes from idling if a Region lacks specific resources, Foundations can process items from the **Global Inventory**.
  - *Example*: A Hero can refine previously gathered Ore at a Forge, even if the current Region is entirely forest.

### 3.6. Integrated Combat & Enemies
Combat is not a separate screen or random chaotic event; it is tied directly to the economy and geography.
- **Static Spawners**: Nodes generated from the Map Budget (e.g., Bandit Camps, Monster Dens). These are **permanent fixtures** of the region that continuously spawn enemies forever, providing a steady farming source.
- **Triggered Spawns (Ambush)**: Gathering from organic nodes carries a risk of spawning an enemy (e.g., mining Copper spawns a Rock Elemental). Heroes do not cower or flee; they will **fight back** when attacked. This means players can (and should) equip their gatherers with both tools and combat equipment so they are prepared for ambushes, or assign dedicated combat escorts.
- **Lure Foundations**: Player-constructed buildings used to farm specific enemies. 
  - *Example*: A "Cow Pasture" foundation requires Wheat upkeep. It acts as bait, periodically spawning Wolves for the player to farm for pelts/meat.
  - *Upkeep Mechanics*: This relies entirely on the game's existing spawner upkeep mechanics and requires no net-new systems.
- **Hero Response Logic**: The Atlas system does not require custom combat AI. When an ambush or spawn occurs, existing Hero and Enemy proximity AI takes over (if the Hero has combat enabled, they will engage).
  - *Foundation Invulnerability*: To preserve the "Idle Game" experience and prevent players from returning to a destroyed base, enemies strictly target Heroes within their aggro radius. They completely **ignore Foundations**, ensuring player infrastructure is never damaged.

---

## 4. Content Framework: Base Maps & Modifiers

### 4.1. Base Maps
Base Maps act as the foundational canvas for a Region. They define the visual biome and come pre-populated with a baseline distribution of low-tier resources and low-threat enemies (e.g., a Forest map inherently spawns Oak trees, basic grass, and Wolves). 

Additionally, Base Maps possess inherent Points of Interest (POIs) and environmental Events rather than relying on Modifiers to add them. For example, a Jungle Map will inherently generate at least one Ruins node, and a Coastal Map will have a chance for Typhoon events.

**Initial Starter Set:**
- **Plains/Meadow**: Balanced mix of basic grass, loose stones, and basic wildlife (Slimes, etc.).
- **Forest**: High concentration of wood (Oak), low stone.
- **Mountain/Crags**: High concentration of ore/stone (Copper), low wood.
- **Swamp/Bog**: Unique herbs, poisonous enemies.

### 4.2. Modifiers
Modifiers are slotted alongside Base Maps to push the Region into specialized farming territory or higher tiers.
- **Density Modifiers**: Increases the raw amount of a base node type (e.g., an "Overgrown" Modifier drastically increases the number of tree nodes).
- **Upgrade Modifiers**: Replaces basic nodes with higher-tier versions. For example, to farm Tier 2 Fir Wood, players use a "Fir Grove" Modifier which converts the base Oak nodes of a Forest into Fir nodes.
- **Threat Modifiers**: Adds specific, tougher enemy spawners to the region (e.g., "Bandit Camp") for targeted loot farming.
