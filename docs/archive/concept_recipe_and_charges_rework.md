# Concept Document: Recipe & Charges Rework

## 1. Vision & Core Design Goals
The Recipe and Charges rework transitions the crafting and station mechanics from an implicit, token-keyed lookup system to an explicit, player-driven recipe selection model while streamlining context tokens and introducing modular, effect-level charge consumption.

- **Explicit Station Recipe Selection**: Rather than relying purely on adjacent tokens to determine what a station produces ("no menus" model), station tokens now feature a direct recipe selection modal accessed via a gear icon on the station's alert badge.
- **Skill-Based Station Association & Progression**:
  - Each Station is tied to a specific **Skill** (e.g., Blacksmithing, Alchemy, Carpentry).
  - Stations only offer recipes belonging to their assigned skill.
  - **Worker-Driven Eligibility & Progression**: The assigned worker's individual skill level determines active recipe eligibility, and successful craft cycles award skill XP directly to that worker.
  - **Initial Placement Default**: Upon placing a fresh station from the vault, it automatically defaults to the lowest tier / first unlocked recipe of its skill.
- **Station Memory**: Placed station tokens persist their selected recipe on the playmat until recalled/stored in the Vault.
- **Repurposed Context Tokens**: Context tokens (e.g., Tools, Schematics, Heat sources) remain physical tokens placed on the playmat adjacent to the station, but now function as structured, hardcoded **prerequisite inputs / tool tiers** rather than ambiguous lookup selectors.
- **Automated Bank Drawing**: Material item inputs continue to be drawn automatically from the bank when crafting cycles run.
- **Atomic Recipe Consumption**: Crafting requires all inputs (bank items, station charges, context token charges) to be 100% available upfront before initiating a craft cycle.
- **Floor Drop Outputs**: When a recipe outputs/drops a Token, it utilizes the existing **loot floor drop mechanics** (identical to token drops when spawning from a Map).
- **Effect-Level Charge Costs ("Planeswalker Model")**: Individual effect blocks on tokens specify their own distinct charge deltas (consuming, generating, or passive at 0 cost), allowing multi-ability tokens with varying resource dynamics.
- **Code & UI Reusability**: Leverage existing codebase structures (repurposing sound logic) and existing UI patterns/styles (CMS Token I/O editor paradigms, Statements block editor, Playmat alert badge system, loot drop system).

---

## 2. In-Game Playmat & Station UX

### 2.1 Station Card & Alert Badge Integration
- **Gear Icon Alert**: Station cards on the playmat display a **gear icon** via the existing Alert Badge system.
- **Recipe Modal**: Clicking the gear icon opens a modal listing all recipes for that station's skill.
- **Selection & Persistence**: Selecting a recipe assigns it to that specific station instance. The station remembers this recipe until it is returned to the Vault.
- **Hover Quick-Inspect**: Hovering over the gear icon displays a tooltip previewing the current recipe's outputs and requirements.

### 2.2 Recipe Selection Modal Hierarchy & Indicators
The modal presents recipes ordered by level with clear visual tiers and markers:
1. **Active / Craftable Range (Assigned Worker)**: Recipes at or below the currently assigned worker's skill level (enabled and selectable).
2. **Worker Threshold Marker**: A visual line marker / indicator showing the current worker's level cutoff.
3. **Guild Potential Range (Roster Cap)**: Recipes exceeding the current worker's level, but unlockable by the highest-level worker in the player's overall roster (marked with a hint indicating a more skilled worker is available in the guild).
4. **Guild Threshold Marker**: A visual line marker showing the highest level currently attained by any worker in the guild.
5. **Locked Range (Unattained)**: Recipes exceeding the entire roster's current skill levels (displayed disabled/grayed out with required skill level).

### 2.3 Worker Assignment States & Speed Scaling
- **Under-Leveled / Unassigned Worker**: If a station's worker is removed or swapped for someone with insufficient skill for the currently selected recipe, the station pauses and displays an alert badge ("Worker skill too low"), preserving the configured recipe until an eligible worker is placed or the player changes the recipe.
- **Duration & Speed Scaling**: Each recipe has a base duration authored in the CMS, which is accelerated by the assigned worker's skill level and active speed buffs/modifiers on the station.
- **Skill XP Reward**: Completing a craft cycle awards the recipe's configured Skill XP directly to the assigned worker.

### 2.4 Context Tokens & Tool Tier Requirements
- Context tokens placed on the playmat adjacent to the station satisfy recipe requirements.
- **Hardcoded Tool Tiers**: Context items/tools are categorized into clean, structured tiers (e.g., Anvil Tier 1, Anvil Tier 2, Hammer Tier 1).
- **Hierarchical Tier Fulfillment**: Higher tier tools satisfy lower tier requirements (e.g., a Tier 2 Iron Anvil satisfies a recipe requiring Tier 1 Anvil).
- Recipes specify required context tokens / tool tiers as explicit inputs alongside standard item costs.

---

## 3. Modular Charges System ("Planeswalker Model")

### 3.1 Dual-Axis Recipe Charge Consumption
For crafting stations and contextual recipes:
1. **Station Charge Consumption**: The charges deducted from the Station token itself per craft cycle (standard operational wear).
2. **Context Token Charge Cost**: Specific charge amounts consumed from adjacent context tokens (e.g., Recipe requires and consumes 2 charges from an adjacent Pickaxe, alongside 4 Oak Wood items).
   - Context token charge deduction acts as a direct input cost in the recipe definition.

### 3.2 Flexible Effect-Level Charge Deltas
Across all token types (Resources, Buffs, Triggers, Passives, Stations):
- **Charge Consumption (-Charges)**: Firing the effect deducts N charges. The effect cannot activate if current charges < N.
- **Charge Generation (+Charges)**: Firing the effect restores/adds N charges to the token up to its defined maximum charges ceiling (`maxCharges = initial starting charges`).
- **Passive / Zero-Cost (0 Charges)**: Operates freely without consuming or modifying the token's charge pool.

### 3.3 Depletion & Execution Rules
- **Atomic Requirement Check**: If a station has charges but lacks the required items from the bank or lacks adjacent context tokens with sufficient charges, the station pauses/stalls and alerts the player until 100% of requirements are available. No partial item or charge deduction occurs.
- **Standard Depletion**: When a Station or Context Token reaches 0 charges, it is destroyed and removed from the playmat.
- **Multi-Station Sharing**: If a single Context Token is adjacent to multiple stations, charges are consumed on a **first-come, first-served** basis as stations fire their cycles.
- **Multi-Token Prioritization**: If multiple adjacent tokens satisfy the same requirement, charges are consumed from the token with the **lowest remaining charges first** to cleanly clear near-depleted tiles.

---

## 4. CMS Authoring & Data Model Upgrades

### 4.1 Recipe Editor Realignment
- Align the **Recipe Editor** UI with the existing, proven **Token Editor** Input/Output UI.
- **Duration & XP Configuration**: Base crafting cycle duration and Skill XP yield fields per recipe.
- **Token-Level Inputs & Outputs**:
  - Support **Token requirements** (Context tokens / tools / station tiers) directly within Recipe Inputs with required charge deductions.
  - Support **Tokens as Drops / Outputs** in Recipe Outputs (in addition to standard item drops).

### 4.2 Statements & Effect Block Charge Configuration
- Update the **Statements / Effect Authoring UI** in the CMS:
  - Add a **Charge Delta / Cost** field to individual effect blocks / statements (supporting negative, zero, and positive deltas).
  - Enable authoring multi-ability tokens with distinct charge mechanics.

---

## 5. Architectural & System Reusability Notes
- Reuse existing Adjacency / Perimeter detection for checking adjacent Context Tokens.
- Repurpose `RecipeResolver` logic from token-matching to input-validation against the station's explicitly selected recipe.
- Maintain existing Bank drawing and Item allocation mechanics.
- Reuse floor drop spawning pipeline for token output rewards.
- Leverage the existing Statements / Trigger engine in `TriggerSystem.js` and `Effects` for attaching charge delta evaluation to effect execution.
