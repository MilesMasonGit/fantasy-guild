# Fantasy Guild CMS & Balancing Engine - Detailed Design Document

## 1. Project Vision: The Universal Web of Effort
The **Fantasy Guild CMS** is a "Simulation-First" Content Management System and Balancing Engine. It is built on the philosophy that **Value is a Direct Derivative of Effort.** 

In a massive, 99-level ecosystem, balancing thousands of items manually is impossible. This system replaces "guessing" with a mathematical model where every reward—be it Gold, XP, or Area Unlocks—is calculated based on its position within a massive interlocking web of hero skill, time investment, and resource scarcity.

## 2. The Philosophy of Interlocking Value
The core intent of this system is to manage the four primary "currencies" of the game as a single, unified entity:

### 2.1. Time (The Absolute Baseline)
Time is the player's primary investment. The simulation uses a **Baseline Gold-Per-Tick (GPT)** to define the fundamental worth of a hero's second. Every task consumes this "Time Currency," and the output must compensate for that consumption.

### 2.2. Skill Level (The Labor Multiplier)
Skill levels (1–99) represent the **Quality of Labor.** 
- A hero at Level 99 is a master; their time is fundamentally more valuable to the guild than a Level 1 novice. 
- The simulation applies a **Skill Level Multiplier** to all labor. This ensures that high-tier items (which require higher levels) naturally command higher prices and XP rewards, reflecting the difficulty of training a hero to that mastery.

### 2.3. Gold and Expected Value (EV) as a Diagnostic Metric
Gold is the "liquid" value of an item, determined by base values and inputs.
- **EV as a Profitability Ratio:** Expected Value (EV) is a **calculated diagnostic metric** showing the profitability of a task. It is the ratio of total rewards to total costs:
    - `EV = (Sum of Output Gold Values + XP Gold Equivalent) / (Material Cost + Labor Cost + Energy Cost + Tool Depreciation)`
    - An EV of **1.00** means the task breaks even. **1.02** means 2% profit. **1.30** means 30% profit.
- **Balancing via EV:** The designer looks at the calculated EV to determine if a task is too powerful or too weak. To create a "Power Boost" (e.g., a better wood-producing task), the designer tweaks the task's parameters (shorter work cycle, larger drops, removing prerequisites) until the system calculates the desired, higher EV.
- **Escalating Targets:** As items move higher up the production chain, the designer targets a higher EV. A basic gathering item (Water) might target an EV of 1.00, while an endgame boss fight (Dragon) targets 1.30.

### 2.4. XP (The Meta-Progression Reward)
XP is the reward for **Skill Effort.** 
- The simulation treats XP as a parallel value to Gold. For tasks like *Burying Bones* (which give no gold), the XP must have a "Gold Equivalent" value that makes the task competitive with farming.
- This creates a constant, balanced tension for the player: *"Do I farm for Gold to buy more packs, or do I sacrifice resources for XP to unlock higher-value labor tiers?"*

### 2.5. Connectivity (The Path to Value)
Nothing exists in a vacuum. A **Quest** that requires an item is the "Lock," and the **Production Chain** for that item is the "Key." The simulation ensures that every Key is obtainable within the current Tier, and that the "Cost of the Key" is proportional to the "Value of the Lock" (the rewards of the new Area).

## 2. Core Design Methodology: "Backward Chaining"
The workflow follows a recursive "Item-First" approach:
1. **Define Goal:** Create a new Item (e.g., *Apple Pie*).
2. **Assign Source:** Link the Item to a **Task** (e.g., *Baking*).
3. **Identify Requirements:** The Task demands inputs (*Dough*, *Apples*), a Skill level (*Culinary 15*), and Time (*30s*).
4. **Recursive Resolution:** The system flags *Dough* and *Apples* as "Orphaned" until their own sources are defined.
5. **Base Case:** This process continues until every branch reaches a **Root Task** ("Something from Nothing" gathering or Combat).

## 3. Pillar 1: Connectivity & Dependency Dashboard (Phase 1)
The primary goal is to ensure the "Skeleton" of the game is free of deadlocks and gaps.

### 3.1. Entity Relationships & "Something from Nothing" Roots
The graph begins at the **Root Tasks**, which require no item inputs.
- **Gathering Tasks:** Manual or skilled extraction of raw materials (Wood, Water). Root Items produced by gathering have their `baseValue` **manually assigned** by the designer as the anchor of the value chain.
- **Combat Cards (Enemies):** These are also "Something from Nothing" tasks where the player's primary investment is **Risk** (HP/Energy) rather than materials.
- **Processing Tasks:** Convert inputs into higher-value outputs.
- **Quests & Areas (Progression Gates):** Quests are parallel entities that require specific Items to complete. Completing a set of Quests unlocks an Area. These are strictly **Progression Gates** and are not evaluated for economic return (EV) by the simulation.

### Terminology Note: "Tasks" vs. "Cards"
The game engine calls all playable entities "Cards" (via `cardRegistry`). The CMS uses the term **"Tasks"** to refer specifically to the subset of cards that are economically relevant: **Task Cards** (gathering/processing) and **Combat Cards**. Other card types (Projects, Blueprints, Explore, etc.) exist in the game but are not the focus of the CMS's EV balancing engine.

### 3.2. Automated Connectivity Audit
The system monitors the graph and flags issues for the designer to resolve:
- **Orphaned Entities:** Items with no source; Tasks with no inputs (that aren't Gathering); Areas with no unlock quest.
- **Dead-End Items:** Items that are produced but never used in any recipe, quest, or building project.
- **Circular Deadlocks:** 
    - *Example:* "Mountain Quest" requires "Iron Pickaxe," but "Iron" is only found in the "Mountain" Area. The simulation flags this as a **Critical Blocking Loop**.
- **Skill Progression Gaps:** Identifying ranges (e.g., Level 30–45) where no tasks exist for a specific skill, causing a "Wall" in the hero's growth.
- **Incomplete Chains:** If the simulation encounters a task whose inputs have no defined source (e.g., Apple Pie requires Dough, but Dough has no producing task), the entity is flagged as **"Incomplete — Cannot Calculate EV"** and skipped. The designer can easily find these flags to know what still needs to be defined.

### 3.3. Reachability Simulation
A "Perfect Path" simulator that starts at Level 1 and "plays" the game structurally. It identifies the maximum possible progression based on the current blueprint.

## 4. Pillar 2: Prescriptive Economic Engine (Phase 2)
The "Flesh" of the game. Math is applied to the structural skeleton.

### 4.1. The Cost Side: "Total Investment" Formula
The total cost of running a task cycle once:
`Total Cost = (Accumulated Material Cost) + (Labor Cost) + (Energy Cost) + (Tool Depreciation)`

- **Baseline GPT:** A global variable for "Gold Per Tick" (the value of 10 seconds of a Level 1 hero's time).
- **Skill Level Multiplier:** A configurable curve (default: **+1% per 5 levels**). High-level labor is mathematically more valuable.
- **Labor Cost:** `(Task Time / 10s) * GPT * (1 + (SkillLevel / 5) * 0.01)`.
- **Energy Cost:** `energyCost * Global Energy GP Value` — the Energy drained per cycle, converted to Gold.
- **Tool Depreciation:** For tasks requiring a Tool (e.g., *Axe*), the cost of producing that tool is divided by its total durability and added as a per-cycle overhead. *(Note: Tool durability exists as a game mechanic but may not be fully implemented. The CMS models it regardless for forward-looking balance.)*

### 4.1b. The Reward Side: "Total Output" Formula (Weighted Average)
The reward side sums the **weighted average** value of all outputs:
`Total Reward = Sum(itemGoldValue * dropChance * avgQuantity) + (XP Awarded * XP-to-Gold Ratio)`

*Example:* A task produces a 10 GP Apple at 90% chance and a 100 GP Golden Apple at 10% chance.
`Total Reward = (10 * 0.90) + (100 * 0.10) = 9 + 10 = 19 GP per cycle (on average)`

This weighted average is what informs the EV. Rare, valuable drops contribute to EV proportionally to their likelihood.

### 4.1c. The EV Calculation
`EV = Total Reward / Total Cost`

An EV of 1.00 is break-even. The designer targets escalating EV values as tasks move up the progression chain.

### 4.1d. Bidirectional Value Propagation
The simulation is **bidirectional** — the designer can update any value and the system recalculates the others accordingly on the next simulation run:
- **`targetEV` Field:** Every task has a `targetEV` field (default: **1.05**) that the designer can manually adjust. This is the profitability target for that task.
- **Increase an output item's GP value** → The task's calculated EV rises (or falls) relative to the target.
- **Increase a task's `targetEV`** → The system auto-increases the downstream item `baseValue` to meet the new profitability target.
- **Shorten a work cycle or remove an input** → The task's Total Cost drops, raising its calculated EV.

This means downstream item values (`baseValue`) are **calculated as `Total Cost × targetEV`** by the simulation. Root Item values remain manually anchored.

### 4.2. Multi-Source Items & Primary Source Designation
For items with multiple sources (e.g., *Milk* from Milking, Combat, Stealing):
- **Primary Source:** The designer designates exactly one task as the **"Primary Source"** for each item. Only the Primary Source's EV drives the item's calculated `baseValue`. Changing the EV of alternative source tasks will **not** modify the item's price.
- **Diagnostic Comparison:** The simulation calculates the EV of all alternative sources against the Primary Source baseline, allowing the designer to see how competitive each alternative is.
- **Abundance Deflation:** If an item has a high number of accessible sources across different biomes, the system applies an **Abundance Penalty** (e.g., -5% value per extra source) to reflect market saturation in the final EV readout.

### 4.3. Energy & Health Maintenance (The "Resource Tax")
Energy and Health are the fundamental maintenance costs of the guild. They act as a required "tax" that the player must pay to keep their heroes working, preventing infinite, cost-free resource generation. The simulation treats these drains as direct mathematical inputs when calculating a task's EV.
- **Global Resource Values:** To evaluate costs uniformly, the CMS uses global constants for resource value (e.g., `1 Energy = 0.25 GP`, `1 Health = 0.50 GP`). 
- **Per-Cycle Drain:** Energy is consumed upon task completion as an input cost. The designer manually assigns this drain. To prevent long tasks from being disproportionately "Energy Efficient" compared to short tasks, the designer must assign larger chunks of Energy to longer tasks.
- **Passive Regen is Ignored:** While heroes possess passive Health/Energy regeneration, the simulation ignores this "free" recovery. The engine balances the economy under the strict assumption that all consumed Energy/Health must be replaced by produced Drinks/Food.
- **The Drink/Food Economy:** Because Energy has a set GP value, complex drinks (like *Lemonade*) will naturally have a higher calculated EV than *Water* because their production chain requires more labor and inputs. The player produces these higher-tier consumables to offset the massive Energy/Health taxes of higher-tier tasks.
- **Combat Health Drain (Mock Battles):** To determine the Health Cost of a combat task, the simulation runs a "Mock Battle" using a **Standard Hero Profile** for the enemy's tier.
    - **Hero Model:** Heroes have a single **Combat Stat** that determines both their damage output and HP. Additional stats come from equipped weapons and armor.
    - **Enemy Model:** Enemies have a **Combat Stat** (determining damage) and a **separately assigned HP** pool. Additional complexity comes from Modifiers (e.g., *Thorns*, *Poison*).
    - **The Mock Battle** uses these to calculate Time-to-Kill and Expected Damage Taken per cycle, converting that damage to Gold via the Global Health Value.
- **Combat as a Balancing Tool:** The Combat Model is bidirectional. The designer can tweak **enemy stats** (HP, combat stat, attack speed, modifiers) and **loot tables** (drop rates, quantities) and immediately see the impact on the combat task's EV. This makes the Enemy editor a full balancing workspace, not just a stat entry form.

### 4.3. Efficiency & Buff Modifiers
Heroes do not *technically* need food or weapons for most tasks, but they increase speed.
- **The Speed Offset:** The simulation factors in how much a "Bronze Pickaxe" vs. an "Iron Pickaxe" reduces task time.
- **Net Gain Check:** The engine verifies if the **Speed Increase** from a tool/food outweighs the **Production Cost** of that tool/food.

### 4.4. Sell-Price Modifier (Type-Derived Value Deflation & Inflation)
Every item has two distinct economic values:
- **True Production Cost:** Used internally by the simulation for all EV calculations. This is the "real" cost of an item based on its production chain.
- **Sell Price (`baseValue`):** What the player actually receives when selling. This may be artificially deflated or inflated.

The sell-price modifier is **derived from the item's `type` field**, not set per-item:
- **Component Types (Material, Ingredient):** Deflated sell price to discourage selling intermediates. The simulation still uses the True Production Cost when this item appears as an input to another task.
- **Tool/Equipment Types:** Deflated sell price. Tool cost is handled separately via Tool Depreciation (§4.1) and is not included in the task's material input cost.
- **Final Product Types (Consumable, Treasure):** Inflated sell price to reward completing full production chains.
- **Global Modifier Table:** A configurable table mapping each item type to its sell-price modifier percentage (e.g., Material: -30%, Tool: -50%, Consumable: +10%).

### 4.5. XP Valuation (Prescribed Curve)
- **XP-to-Gold Ratio:** A static exchange rate (e.g., *10 XP = 1 Gold*).
- **Duration-Normalized XP Curve:** XP awards are prescribed based on a curve tied to the task's `skillRequirement`. The award is then **normalized for task duration** so that XP-per-minute remains consistent at the same skill level.
    - *Example:* Two tasks both require Skill Level 10. Task A takes 10s, Task B takes 15s. If Task A awards 10 XP, Task B must award 15 XP (150%) so both yield the same XP/minute.
- **The Sacrifice Audit:** For tasks that only give XP (e.g., *Burying Bones*), the tool ensures the **EV of the XP** is slightly higher than the **Gold Value of the Item** consumed.

## 5. UI/UX Design Priorities: The "Comfortable Workspace"
The CMS is a professional design suite. It must feel fluid, responsive, and aesthetically premium to minimize "Design Fatigue."

### 5.1. The "Batch Run" Simulation Workflow
Unlike a real-time editor, the CMS uses a **Batch Processing** model to handle the massive computational load of a 99-level graph.
- **The "Run Simulation" Button:** The designer makes a series of structural or value changes in the workspace. Once ready, they trigger the simulation (accompanied by a progress/loading bar).
- **Draft Autosave:** While changes wait for a simulation run or final export, the UI features a silent local autosave (via IndexedDB or LocalStorage) to ensure no work is lost if the browser is closed.
- **The Audit Phase:** Once the simulation completes, the dashboard populates with newly calculated "Prescribed Values," Orphan warnings, and Deadlock alerts. The designer identifies missing points, adjusts, and repeats the cycle.

### 5.2. Focused Navigation & Filtering
Rendering the entire "Master Web" at once is unreadable and slow.
- **Search Parameters & Toggles:** The UI relies heavily on strict filtering. The designer can toggle the graph to show "Only Forest Area," "Only the Apple Pie Supply Chain," or "Only Skill Level 40-50 Tasks."
- **Global Search (Cmd+K):** A lightning-fast search bar to jump to any Item, Task, or Area.

### 5.3. Visual Feedback & "The Living Web"
- **Interactive Graph:** A smooth, zoomable canvas (D3/ReactFlow) for the *filtered* view.
- **Delta Visualization:** Clear, color-coded markers for "Prescription vs. Reality" so you can see where you've manually deviated from the balance after a simulation run.

### 5.4. Audit Results Panel
After a simulation run, all flags and warnings are presented in a **sortable, filterable table/list**:
- Columns: Entity Name, Entity Type, Issue Type (Orphan/Dead-End/Incomplete/EV Deviation), Severity, Details.
- Sortable by any column. Filterable by issue type.
- Clicking a row navigates to the entity's editor.

## 6. Entity Data Schemas
The CMS mirrors the game's existing registry structures to ensure seamless exports. Every entity field in the CMS is editable, with "Prescribed" value hints displayed for key economic properties.

### 6.1. Items (ItemRegistry)
- **ID & Metadata:** `id` (string), `name` (string), `icon` (emoji), `description` (text).
- **Economic Values (Dual Display):**
    - `trueCost` (GP — **Calculated** from the production chain. **Manual** for Root Items.)
    - `sellPrice` / `baseValue` (GP — **Calculated** from `trueCost` × type-derived sell modifier.)
- **Classification:** `type` (Material, Tool, Weapon, Food, Drink, Consumable, Treasure, etc.), `tags` (Array: e.g., 'wood', 'building').
- **Logistics:** `stackable` (bool), `maxStack` (number).
- **Utility (if Food/Drink):** `restoreAmount`, `restoreType` (HP/Energy), `regen`.
- **Equipment:** `equipSlot` (Head, Body, MainHand, etc.), `durability` (number, if applicable).
- **Effects:** `assignedEffectName` (string, optional reference to an Effect ID).

### 6.2. Tasks (CardRegistry — Task & Combat Cards)
- **ID & Context:** `id`, `name`, `cardType` (Task, Crafting, Combat), `areaId`.
- **Effort Requirements:** `baseTickTime` (ms), `skillRequirement` (level), `skill` (one of 8 fixed Skill IDs), `subskill` (category within skill), `energyCost` (per cycle).
- **Balancing:** `targetEV` (number, default: **1.05**). The designer's profitability target for this task.
- **Resource Flow:**
    - `inputs`: Array of `{ itemId, quantity }`.
    - `outputs`: Array of `{ itemId, quantity, chance, isPrimarySource }`. The `isPrimarySource` flag designates which task drives the output item's `baseValue`.
- **Meta-Rewards:** `xpAwarded` (number - **Prescribed**). XP is awarded to the parent **Skill**, not the subskill.
- **Gating:** `minToolTier`, `acceptedToolType`.
- **Diagnostics (Calculated):** `calculatedEV`, `goldPerMinute`, `xpPerMinute`.

### 6.3. Enemies (EnemyRegistry)
- **ID & Context:** `id`, `name`, `biomeId` (Area), `tier` (1–5).
- **Combat Stats:** `combatStat` (determines damage), `hp` (separate pool), `attackSpeed` (ms), `combatType` (Melee/Ranged/Magic).
- **Loot Table:** `drops`: Array of `{ itemId, minQty, maxQty, chance }`.
- **Meta-Rewards:** `xpAwarded` (number), `energyCost`.
- **Modifiers:** `assignedEffects`: Array of effect IDs representing combat modifiers (e.g., Thorns, Poison, Vampirism).
- **Diagnostics (Calculated):** `calculatedEV`, `expectedDamageTaken`, `timeToKill`.

### 6.4. Skills (Fixed Reference) & Subskills (Managed)
The game has **8 fixed skills**. Skills are not created or deleted in the CMS; they are a hardcoded reference list.
- **Skills:** Nature, Industry, Culinary, Occult, Crime, Social, Nautical, Science.
- **Subskills:** Each skill has named categories (e.g., Industry → Mining, Smithing, Crafting). Subskills do **not** earn separate XP — all XP goes to the parent skill. The subskill list is **managed in the CMS** (the designer can add new subskills as the game evolves).

### 6.5. Areas (AreaSetRegistry)
- **ID & Visuals:** `id`, `name`, `icon`, `areaArt`, `backgroundImage`.
- **Gating:** `totalFragments` (Required Map Fragments to unlock).
- **Economy:** `packBaseGoldCost` (**Prescribed** — based on the player's expected earning rate at this tier, tuned so packs are purchasable "fairly often"), `packCostScaling`.
- **Content Pools:** `cardPool` (List of cards found in this area's booster packs).
- **Diagnostics (Calculated):** `expectedPackValue` (average value of cards drawn), `estimatedTimeToPurchase` (how long it takes a player at this tier to earn enough for one pack).

### 6.5. Quests (QuestRegistry)
- **ID & Requirement:** `id`, `name`, `description`, `targetEvent` (Gain Item/Kill Enemy).
- **The "Key":** `targetId` (Item/Enemy ID), `maxProgress` (Quantity).
- **The "Lock":** `mapFragmentTarget` (Which Area this quest helps unlock).
- **Completion Rewards:** `rewards` (Array of Gold/Items).

### 6.6. Effects (EffectRegistry)
- **ID & Context:** `id`, `name`, `description`.
- **Properties:** `type` (STAT_BONUS, RESOURCE_REGEN, COMBAT_MODIFIER), `targetCategory` (ALL, COMBAT, GATHERING, PROCESSING).
- **Magnitude:** `magnitude` (Numeric multiplier or raw addition value).
- **Maintenance:** `drainTrigger` (What causes this effect to lose durability/stacks).
- **Economics:** `estimatedGpValue` (The flat GP cost this effect adds to any item that grants it).

## 7. Technical Implementation Concepts

### 7.1. Separate Siloed Architecture
- **Standalone Project:** The CMS is a completely separate React/Vite project. It does not live within the game's production bundle.
- **"From Scratch" Initialization:** The CMS is designed to build the economy entirely from scratch. It does not require a complex parsing script to ingest the game's current Day 1 data.

### 7.2. The "Export Package" Handoff
- The CMS **does not** blindly overwrite game files.
- **Export Format:** Pure `.json` data files. The exact integration format may evolve through testing.
- **Export Process:** When balancing is complete, the CMS generates an "Export Package" (a designated directory of JSON files).
- **Implementation:** The designer manually hands this package off to the game's Development Agent for review and implementation into the `src/config/registries/` directory.

## 7. Implementation Roadmap

### Phase 1: The Connectivity Skeleton
- [ ] Implement Dashboard UI and Entity Managers.
- [ ] Build the Dependency Graph (D3.js or ReactFlow).
- [ ] Implement the Backward Chaining workflow.
- [ ] Implement the Reachability & Deadlock Auditor.

### Phase 2: The Economic Brain
- [ ] Implement the Prescriptive Valuation Engine (Gold/XP).
- [ ] Add Global Variable Sliders for live-tuning.
- [ ] Implement EV Comparison for multi-source items.
- [ ] Implement Tool Depreciation and Component Deflation logic.

### Phase 3: Integration & Export
- [x] Implement JSON Snapshot/Workspace system (File Manager).
- [ ] Build the Schema-Aware Exporter for all game registries.
- [ ] Create "Progressive Gaps" reporting (TTL/XP consistency).
