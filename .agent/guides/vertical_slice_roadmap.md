# Vertical Slice Roadmap: Fantasy Guild Idle

This document outlines the "crunch road map" for completing the vertical slice of Fantasy Guild Idle. It groups tasks by feature area and defines the execution sequence based on dependencies.

## 🎯 Vertical Slice Goal
A complete gameplay loop consisting of:
1. **Recruitment**: Gaining a Hero and assigning it to the Guild.
2. **Exploration**: Deploying Heroes to the Forest to gather resources and complete quests.
3. **progression**: Using gathered resources to build Guild Hall projects and upgrade Heroes.
4. **Combat**: Defending the Guild or clearing high-threat areas.

---

## ⚙️ Feature Area: Effect & Modifier Engine
*The shared backend foundation for all passive and active bonuses.*

### Sub-Components
- [ ] **Unified Modifier Interface**: A standard way for cards, items, and biomes to register modifiers (Speed, Damage, Regen, etc.).
- [ ] **Aura & Proximity Logic**: The "Pulse" system that checks grid adjacency and applies/removes buffers dynamically.
- [ ] **Logic Override System**: Hooks for complex effects like "Save 1 Input" or "Ignore Defence" (assisting the Alpha Content phase).
- [ ] **Stacking & Capping Rules**: Logic to handle multiplicative vs. additive stacking and hard caps for speed/damage.

### Sequence & Dependencies
1. **Baseline Actors** (Hero Cards) -> **Effect Engine**
2. **Effect Engine** -> **Combat & Project Integration**

---

## 🎓 Feature Area: Skill & Sub-Skill System
*Defining the hierarchy of hero expertise and granular specialization.*

### Sub-Components
- [ ] **Skill Registry Consolidation**: Reducing combat skills to 3 core types (Melee, Ranged, Magic). **Defence** is removed as a standalone skill.
- [ ] **Hero-Combat Specialization**: Logic to ensure each hero is assigned exactly ONE of the 3 combat skills upon recruitment.
- [ ] **Sub-Skill Hierarchy Mappings**: Categorizing tasks into granular sub-skills (e.g., **Industry** -> Mining, Crafting, Smelting; **Nature** -> Logging, Foraging).
- [ ] **Granular Modifier Logic**: Updating the Effect Engine to apply bonuses to specific sub-skills (e.g., "+10% Mining Speed") without affecting the parent skill level.
- [ ] **Skill UI Overhaul**: Visualizing the single combat skill and the specialization tree for sub-skills.

### Sequence & Dependencies
1. **Skill Registry** -> **Hero Generation Logic**
2. **Sub-Skill Mappings** -> **Effect Engine Support**

---

## 💾 Feature Area: Global Persistence & Save System
*The iron-clad data layer ensuring player progress is never lost.*

### Sub-Components
- [ ] **GameState Serialization**: Logic to convert the entire complex state (Inventory, Roster, Playmat) into a storable format.
- [ ] **LocalStorage Manager**: Robust saving/loading with versioning to prevent data loss during system updates.
- [ ] **Manual & Auto-Save Triggers**: Implementation of frequent auto-saves and a "Save Game" button in the menu.
- [ ] **State Restoration Logic**: Ensuring the game boots back exactly where the player left off.

### Sequence & Dependencies
1. **Core Systems Baseline** -> **Save Logic**

---

## 🛡️ Feature Area: Hero Cards & Management
*The core of the guild. Heroes need to be more than just icons; they are the primary actors in the game.*

### Sub-Components
- [ ] **Hero Slots & Inventory**: Fixed-ratio slots on Hero cards for equipment and held items.
- [ ] **Stat & Skill Persistence**: Ensuring Hero levels and skills are correctly tracked and visually updated.
- [ ] **Trait System**: Implementing active and passive traits that affect card tick speeds or combat power.
- [ ] **Equipment System**: Logic for applying item bonuses to Hero stats when equipped.

### Sequence & Dependencies
1. **Hero Slots** (UI) -> **Inventory Logic** (System)
2. **Stat Tracking** -> **Equipment Bonuses**
3. **Trait Definitions** -> **Gameplay Integration**

---

## 🍻 Feature Area: Recruiting & Roster Management
*Acquiring new heroes/villagers and managing the guild's active roster.*

### Sub-Components
- [ ] **Recruitment System**: The logic for generating and "hiring" new Heroes and Villagers.
- [ ] **Tavern Storage (The Bench)**: A dedicated UI/system for hibernating heroes when the active roster is full (similar to the Card Library).
- [ ] **Roster Scaling**: Logic for increasing the active roster size through Guild Hall upgrades.
- [ ] **Entity Persistence**: Reliable saving/loading of the roster and storage states.

### Sequence & Dependencies
1. **Hero Generation** -> **Recruitment UI**
2. **Entity Manager** -> **Tavern Storage**

---

## 🗺️ Feature Area: Exploration & Quests
*Filling the world with content and meaningful progression.*

### Sub-Components
- [ ] **Forest Biome Content**: Complete set of Forest tasks (Logging, Foraging, Hunting).
- [ ] **Quest Progression UI**: Real-time tracking of quest objectives on the playmat/side-car.
- [ ] **Dynamic Area Spawning**: Logic for spawning new task cards as quests are progressed.
- [ ] **Loot Tables**: Finalizing drop rates for Forest resources.

### Sequence & Dependencies
1. **Task Card Registry** -> **Loot Tables**
2. **Quest Logic** -> **Dynamic Spawning**
3. **Progression UI** -> **User Feedback Loop**

---

## 🗺️ Feature Area: Area Unlock & World Map Logic
*Connecting the biomes into a cohesive world.*

### Sub-Components
- [ ] **World Map UI**: A top-level view of available biomes and their unlock status.
- [ ] **Biome Gating**: Logic to lock/unlock areas based on quest milestones or boss defeats.
- [ ] **Area Transition System**: Smooth handling of the camera and state when moving between the World Map and a Biome.

### Sequence & Dependencies
1. **Quest System** -> **Biome Unlocks**
2. **Exploration Engine** -> **Area Transitions**

---

## 📜 Feature Area: Blueprint & Recipe Cards
*The design system for item production and specialization.*

### Sub-Components
- [ ] **Blueprint Attachment Logic**: Enabling Blueprint cards to be assigned to Crafting/Cooking tasks (e.g., Forge, Kitchen).
- [ ] **Dynamic Input Scaling**: Logic to adjust required input items based on the active Blueprint (e.g., Pi tin + Fruit = Pie).
- [ ] **Output Designation**: Ensuring the task output matches the Blueprint's definition.
- [ ] **Blueprint Registry**: Expanding the library of crafting and culinary blueprints.

### Sequence & Dependencies
1. **Crafting System** -> **Blueprint Logic**
2. **Item Registry** -> **Output Scaling**

---

## 🏗️ Feature Area: Project Cards
*Upgradable structures placed on the tile grid to enhance surrounding areas.*

### Sub-Components
- [ ] **Grid-Based Placing**: Logic for assigning Project cards to specific tiles on the playmat grid.
- [ ] **Area-of-Effect (AoE) Bonuses**: Implementing passive buffs that apply to neighboring task or combat cards.
- [ ] **Upgrade System**: Phased progression for projects, increasing their bonus values or range.
- [ ] **Building Visuals**: Unique idle/active states and level-based visual upgrades for projects.

### Sequence & Dependencies
1. **Grid Placement System** -> **Project Cards**
2. **Effect Engine (AoE)** -> **Project Bonuses**

---

## 🗺️ Feature Area: Booster Packs & Acquisition
*The gacha-inspired card acquisition loop.*

### Sub-Components
- [ ] **Pack Opening Logic**: The "Unwrap" animation and card reveal mechanics.
- [ ] **Scaling Pack Costs**: Gold cost incrementation per purchase within an Area.
- [ ] **Deck Containers**: Managing "Pack Decks" on the playmat for bulk storage.
- [ ] **Area Set Rarity**: Implementing drop weightings and rarity visual effects for pulled cards.

### Sequence & Dependencies
1. **Gold Economy** -> **Pack Pricing**
2. **Card Registry** -> **Drop Tables**

---

## 🏛️ Feature Area: Guild Hall & Industry
*The meta-progression hub.*

### Sub-Components
- [ ] **Project Chain System**: Finalizing the "Unlock -> Build -> Benefit" loop for projects.
- [ ] **Crafting Logic**: Implementing the "Outputs" system for crafting cards (turning raw resources into gear).
- [ ] **Area Management**: Switching between the Guild Hall (Home) and Active Biomes (Away).

### Sequence & Dependencies
1. **Project Registry** -> **Crafting System**

---

## ⚔️ Feature Area: Combat Mechanics
*The core engine for damage exchange and tactical resolution.*

### Sub-Components
- [ ] **Single-Skill Resolution**: Consolidating damage and defense calculations to use the hero's primary combat skill (Melee, Ranged, or Magic).
- [ ] **Skill-to-Defense Mapping**: Implementation of the math where the active combat skill inherently determines the hero's defensive capabilities.
- [ ] **Combat Registry Update**: Adjusting enemy stats and hero requirements to match the simplified one-skill model.
- [ ] **Loot & XP Loop**: Finalizing specialized resource rewards for combat completion.

### Sequence & Dependencies
1. **Skill System Overhaul** -> **Combat Logic**
2. **Effect Engine** -> **Combat Modifiers**

---

## ☣️ Feature Area: Threats & Invasions
*The high-stakes challenges that disrupt the guild's peace.*

### Sub-Components
- [ ] **Area Events**: Random or scheduled high-threat cards appearing in biomes.
- [ ] **Guild Invasions**: Threat cards spawning in the Guild Hall based on world progression.
- [ ] **Threat Management UI**: Clear indicators of incoming threats or current area danger levels.
- [ ] **Mastery & Slayer Progress**: Tracking kills and progression through the global threat network.

### Sequence & Dependencies
1. **Combat Mechanics** -> **Threat Resolution**
2. **Invasion Logic** -> **Home Base Vulnerability**

---

## 🏰 Feature Area: Dungeon & Boss Cards
*The ultimate challenges of each biome.*

### Sub-Components
- [ ] **Boss AI & Unique Ticks**: Complex attack patterns or phase-based mechanics for Boss enemies.
- [ ] **Dungeon Mastery**: Tracking "Boss Defeated" states and unlocking elite rewards.
- [ ] **Elite Loot Tables**: High-value drops reserved for dungeon completions.
- [ ] **Unique Tag Visuals**: Special "Unique" border or foil effects for dungeon cards.

### Sequence & Dependencies
1. **Combat Mechanics** -> **Boss Logic**
2. **Mastery System** -> **Reward Gating**

---

## 🔔 Feature Area: Global Notification & Ticker System
*Keeping the player informed across multiple biomes.*

### Sub-Components
- [ ] **Live News Ticker**: A non-intrusive UI element for skill level-ups and loot drops.
- [ ] **Off-Screen Alerts**: Notification system for critical events (e.g., Invasions) happening in other areas.
- [ ] **Toast System**: Visual pop-ups for quest completion and major milestones.

### Sequence & Dependencies
1. **Event Bus** -> **Notification UI**

---

## 📖 Feature Area: Collection & Progression Tracking (The Almanac)
*The player's record of discovery and meta-achievements.*

### Sub-Components
- [ ] **Item Almanac**: Discovery tracker for every resource, tool, and piece of gear.
- [ ] **Bestiary**: Record of all encountered and defeated enemies.
- [ ] **Guild Milestones**: Tracking total XP earned, bosses killed, and projects built as permanent achievements.

### Sequence & Dependencies
1. **Registry Accessors** -> **Collection View**

---

## 🎵 Feature Area: Audio & Soundscape
*The auditory layer that brings the guild to life.*

### Sub-Components
- [ ] **Core SFX System**: Implementing sound effects for card ticks, level-ups, and combat actions (hits/misses).
- [ ] **Ambient Biome Audio**: Looping environmental tracks for the Guild Hall and Active Biomes (e.g., Forest birds, Forge clanging).
- [ ] **UI Feedback Sounds**: Audio cues for button clicks, card dragging, and tab switching.
- [ ] **Audio Management**: Setting up a master controller for volume mixing and asset loading.

### Sequence & Dependencies
1. **Core Mechanics** -> **SFX Integration**
2. **Area Management** -> **Ambient Audio Switching**

---

## 🎭 Feature Area: Alpha Content
*The final polish and content population phase, occurring once core systems are functional.*

### Sub-Components
- [ ] **Core UI Shell & Navigation**: Header (currencys), sidebar/tab navigation, and global settings menu.
- [ ] **Deck & Pack Definitions**: Transitioning from test lists to finalized card lists for Area Decks and Expansion Packs.
- [ ] **Content-Specific Effects**: Defining and assigning the full suite of combat, task, and project effects.
- [ ] **Economy Balancing**: Tuning input/output ratios for crafting and project costs based on playtest data.
- [ ] **Asset Finalization**: Ensuring all cards have their unique high-res or 32px pixel art assigned.

### Sequence & Dependencies
1. **Core Systems Functional** -> **Content Population**
2. **Effect System Complete** -> **Effect Assignment**

---

## 📝 Roadmap Notes & Annotations
- *Note*: Hero Cards remain the primary anchor; Alpha Content is the final layer.
- *Dependency*: Content-specific effects require the underlying Effect engine to be bug-free.
