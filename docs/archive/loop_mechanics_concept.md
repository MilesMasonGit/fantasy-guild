# Area Deck Loop System: Core Gameplay Mechanics

This document outlines the core gameplay mechanics that govern the 1D Area Deck Loop System. These mechanics serve as the building blocks for designing player cards, hazard cards, outpost stations, and hero skill trees.

---

## 1. Time & Efficiency Mechanics

These mechanics alter the execution speed of the loop, serving as a primary progression vector across multiple skills.

### A. Task Haste (Duration Reduction)
*   **Description:** Decreases the duration required to complete an active card task.
*   **How it Works:** Subtracts a percentage from the base execution timer of standard cards. This is a very common modifier found across many gathering and processing skills.
*   *Example:* A base 10-second *Chop Wood* task is resolved in 8.5 seconds under a +15% Woodcutting Haste modifier.

### B. Adjacency (Positional Synergy)
*   **Description:** Gaining bonuses based on what cards are placed next to each other in the deck layout.
*   **How it Works:** The efficiency, speed, or yield of a card scales based on its immediate neighbors in the 1D queue sequence.
*   *Example:* A *Lumberyard* boost slot grants +10% yield to any woodcutting task cards placed directly adjacent to it.

---

## 2. Yield & Output Manipulation

These mechanics dictate the efficiency, volume, and quality of resources returned from loop actions.

### A. Yield Multiplication (Output Boosting)
*   **Description:** A chance to double or triple the quantity of items produced by a task.
*   **How it Works:** When a task completes, the engine rolls against the hero's yield multiplier stats. If successful, it multiplies the output payload before depositing it in the Guild Bank. Very common gathering modifier.
*   *Example:* Mining a copper vein normally yields 2x Copper Ore, but a successful roll yields 4x Copper Ore.

### B. Upkeep Discount (Material Preservation)
*   **Description:** A percentage chance to execute resource-consuming cards or crafting recipes without consuming the input ingredients.
*   **How it Works:** When resolving a card requiring inputs, the engine rolls to preserve the materials. If successful, the outputs are created but the bank quantities remain unchanged.
*   *Example:* Smelting an Iron Bar normally costs 1x Iron Ore and 1x Coal. A successful discount roll processes the bar for 0x Coal.

### C. Rare Table Rollover (Special Drops)
*   **Description:** Rather than direct tier upgrades, this grants a percentage chance to access a rare drop table instead of the standard harvest table.
*   **How it Works:** On task resolution, a roll is made (e.g., via a *Keen Eyes* status). On success, the normal loot table is replaced by a specialized Rare Table.
*   *Example:* A basic *Mining* task has a 10% chance to roll on the *Precious Gems* table instead of returning Stone and Copper.

### D. Passive Generation (Unassigned Productivity)
*   **Description:** Generating gold, resources, or stats automatically over time without requiring a hero to be actively assigned to the slot or Area.
*   **How it Works:** Passive structures (like gardens, gold mines, or traps) deposit resources directly into the Guild Bank at fixed real-time intervals, letting certain skills remain productive even when heroes are busy elsewhere.
*   *Example:* An active *Apiary* card in the Outpost passively generates 1x *Honey* every 60 seconds, regardless of whether a hero is stationed there.

---

## 3. Station Crafting Mechanics (Deterministic Recipe Conversion)

These mechanics run at Outpost Stations while in *Stationed Mode*. They are 100% deterministic and do not run on a loop. Instead, they produce outputs that directly fuel the active loop mechanics.

### A. Provisioning (Food & Drink Production)
*   **Description:** Crafting consumable provisions that restore vitals and apply positive status buffs.
*   **Gameplay Purpose:** Directly feeds the *Consumable Restoration* mechanic during adventure loops.
*   *Example:* A *Kitchen* station processes Raw Meat and Vegetables into a *Steak Dinner*.

### B. Equipment Smithing (Weapons & Armor Fabrication)
*   **Description:** Manufacturing permanent gear for heroes to scale their stats.
*   **Gameplay Purpose:** Provides combat stat progression and enables *Passive Status Immunity* (e.g., crafting insulated armor to resist fire damage).
*   *Example:* A *Blacksmith Forge* processes Iron Bars and Leather into an *Iron Breastplate*.

### C. Alchemy (Potions & Elixirs Synthesis)
*   **Description:** Compounding liquid mixtures designed for immediate health/energy recovery or temporary chemical buffs.
*   **Gameplay Purpose:** Feeds the *Active Status Cleansing* mechanic (purging poisons/curses) and grants temporary buffs like *Task Haste*.
*   *Example:* An *Alchemist Laboratory* processes Herbs and Water into a *Poison Antidote*.

### D. Enchanting (Runes, Scrolls, & Magic Augmentation)
*   **Description:** Imbuing gear with magical properties or crafting magic scrolls.
*   **Gameplay Purpose:** Dynamically alters other systems, such as modifying equipment traits or creating single-use *Card Mutator* / Transmutation scrolls.
*   *Example:* An *Enchanter's Altar* processes Mana Crystals and Parchment into a *Smelting Scroll*.

### E. Utility Engineering (Tools & Devices Construction)
*   **Description:** Assembling utility items that allow heroes to interact with and navigate the adventure loop safely.
*   **Gameplay Purpose:** Directly fuels *Resource-Based Mapping* (skips) and *Keyed Loot Extraction* cards.
*   *Example:* A *Workshop* processes Wood and Hemp into a *Rope* or *Lockpick*.

---

## 4. Active Adventure Extraction

Mechanics used to pull items from the wilds using active consumables during the loop.

### A. Keyed Loot Extraction (Active Action Card Drops)
*   **Description:** Expending a specific single utility/tool item to roll on a random loot table during the active adventure loop.
*   **How it Works:** Slotted directly in the deck as an Action Card. Reaching the slot consumes 1x utility item (e.g., a key or lockpick) and rewards the player with a randomized roll on a treasure table.
*   *Example:* A *Locked Chest* card consumes 1x *Lockpick* to roll on the *Dungeon Loot* table, yielding random gold, potions, or rare materials.

---

## 5. Loop Navigation & Avoidance

How the player avoids or bypasses disadvantageous slots (like combat or environmental hazards).

### A. Agility-Based Avoidance (RNG Check)
*   **Description:** A chance-based passive check to bypass a card for free.
*   **How it Works:** Upon reaching a hazard slot, the hero's relevant skill (e.g., Agility) rolls a percentage check. On success, the slot is skipped at zero time and resource cost. On failure, the card executes as normal (taking damage or causing delays).
*   *Example:* A hero has a 20% chance to swing past a *Ravine* hazard card without stopping or falling.

### B. Resource-Based Mapping (Deterministic Skip)
*   **Description:** Spending a specific consumable utility item to guarantee a slot skip.
*   **How it Works:** The player slots a mapping or mobility utility card in front of a hazard. Executing the card consumes 1x item (e.g., a *Rope* or *Scouting Map*) from the bank to bypass the immediate next hazard card.
*   *Example:* Spending 1x *Rope* to guarantee skipping the *Rapid Waters* card with 100% certainty.

### C. Cross-Area Telemetry (Synchronized Guild Statuses)
*   **Description:** Modifying active loops across different Areas based on guild-wide telemetry, station structures, or active hero roles.
*   **How it Works:** A card, active hero skill, or station in Area A projects a passive status effect that applies to some or all other Areas.
*   *Example:* Stationing a hero at a *Guard Tower* in the outpost grants all other active heroes in the guild a 10% chance to automatically skip random Combat slots in their respective adventure loops.

---

## 6. Vitals Restoration Mechanics

How the player recovers the hero’s health and energy to keep the loop running without pausing or retreating.

### A. Consumable Restoration (High Cost/High Benefit)
*   **Description:** Expending one-time supply items from the bank for major vitals recovery and powerful buffs.
*   **How it Works:** When the loop reaches the slot, it consumes 1x consumable item. This restores large percentages of HP or Energy, and applies a temporary status buff.
*   *Example:* Eating a cooked *Steak* restores 50 HP and grants a +10% Strength status buff for the next 3 combat rounds.

### B. Reusable Restoration (Zero Cost/Lower Benefit)
*   **Description:** Using slotted camp structures or static tasks to passively recover vitals for free.
*   **How it Works:** Reaching the slot requires zero resource inputs from the bank. The hero pauses to execute the card (e.g., resting), recovering a smaller amount of HP or Energy, and receiving a basic resting buff.
*   *Example:* Laying in a *Cozy Bed* slot restores 15 HP and grants a basic *Well Rested* speed buff.

---

## 7. Status Mitigation & Buffing Mechanics

How the player manages the application, prevention, and removal of loop-wide status effects.

### A. Passive Status Immunity (Negation)
*   **Description:** Passively preventing a debuff from ever landing on the hero.
*   **How it Works:** When entering a hazard slot, equipped gear, skill passives, or active buffs absorb the threat completely, resulting in zero damage or negative statuses.
*   *Example:* An equipped *Insulated Shield* makes the hero immune to the *Burning* debuff when passing a *Lava Vent* slot.

### B. Active Status Cleansing (Purging)
*   **Description:** Actively removing negative status effects that have already been applied to the hero.
*   **How it Works:** The hero takes the debuff (which can interact with low-health or desperation mechanics), but clears it later in the loop cycle by executing a specific cleansing card slot.
*   *Example:* Running a *Drink Antidote* card slot to remove the *Poisoned* debuff.

---

## 8. Queue Manipulation Mechanics

How players alter the deck sequence itself during active runtime.

### A. Card/Slot Injection (Queue Expansion)
*   **Description:** Temporarily inserting single-use slots into the loop sequence, increasing loop length.
*   **How it Works:** Resolving a card appends temporary slots immediately after its position in the queue. These slots execute once and disappear, helping to dilute the deck's wrap-around shuffle tax.
*   *Example:* Running a *Tavern* card temporarily injects 1x *Eat* slot and 1x *Drink* slot into the loop.

### B. Card Mutator / Transmutation (Queue Override)
*   **Description:** Reversing or overriding the behavior of a slot for a single cycle, keeping deck length constant.
*   **How it Works:** Instead of executing the card currently in the slot, a status effect or adjacent card overrides its behavior when drawn.
*   *Example:* *Pocket Smelter* overrides the output of the next raw resource gathered, converting it directly into its refined form; a *Decoy Trap* overrides the next *Combat* card, turning it into a blank slot.
