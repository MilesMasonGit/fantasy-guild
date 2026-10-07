# Concept: Skill & Class Rework v2 (4-Combat / 4-Basic System)

> **Document Type:** Canonical Game Design Specification  
> **Status:** Approved / Ready for Roadmap & Implementation Planning  
> **Previous Architecture:** 27 Skills (6 Foundation, 3 Combat, 6 Shared, 12 Signature) across 19 Jobs  
> **Target Architecture:** 24 Skills (8 Starting, 4 Combat, 4 Advanced, 8 Master) across 13 Jobs  

---

## ⚠️ Amendments — owner, 2026-10-07 (these override the sections below)

Rulings made after this concept was approved clashed with it; the owner settled
them before the roadmap:

1. **Construction stays a Starting skill** (every hero builds; Foundations and
   the tutorial depend on it). Starting skills are therefore **9**: mining,
   forestry, fishing, smithing, crafting, cooking, farming, alchemy,
   construction.
2. **The Fighter's Advanced skill is Leadership** (an existing skill), replacing
   construction everywhere this concept uses it (Fighter, and the
   cross-pollination of Paladin, Knight, Scholar and Merchant). *Placeholder:*
   the owner expects to **rework all the specialist skills** (Advanced and
   Master) later.
3. **Explore is dropped.** Maps become special items in the Atlas rework. When
   Explore goes, **retire the Oak Forest Map** (the Shop's Explore Token, a CMS
   edit) and the tutorial's last step **"Explore a Map"**.
4. **Logging is renamed Forestry**, including the internal id (CMS content
   follows on its next sync).
5. **Alchemy becomes a Starting skill**, as this concept says.
6. **Academies**: the four basic classes get Academy Tokens built on Wood or
   Stone Foundations (owner, 2026-10-06), using the Foundation tiers in
   `docs/active/ui_rework_list.md`. Promotion stays free.
7. **No save migration**: saves from another version are refused until 1.0, so
   old heroes need no conversion.

Resulting count: 9 Starting + 4 Combat + 4 Advanced + 8 Master = **25 skills**.

---

## 1. Executive Summary

This rework streamlines the guild's job and skill progression into a cohesive, symmetrical four-pillar design built around **four distinct combat styles**: **Melee**, **Ranged**, **Magic**, and **Stealth**.

```
                           [ RECRUIT ]
                 Holds 8 Starting Skills (Cannot Fight)
               │          │             │          │
         Promote    Promote       Promote    Promote
               ▼          ▼             ▼          ▼
          [FIGHTER]    [RANGER]       [WIZARD]   [ROGUE]
            Melee       Ranged         Magic     Stealth
         4 Basic Classes (+1 Combat · +1 Advanced Skill)
          ┌───┴───┐    ┌───┴───┐     ┌───┴───┐ ┌───┴───┐
          ▼       ▼    ▼       ▼     ▼       ▼ ▼       ▼
        Paladin Knight Beast-  Hunter Necro- Scholar Mer-  Assassin
                      master          mancer         chant
        8 Master Classes (+1 Secondary Advanced · +1 Master Skill)
```

---

## 2. Core Progression Rules

1. **Additive Progression (No Forgotten Skills):**
   * Heroes never lose their **8 Starting Skills**. All heroes permanently retain the foundational civilian toolkit (Mining, Forestry, Fishing, Smithing, Crafting, Cooking, Farming, Alchemy).
   * Promotions expand a hero's active capabilities:
     * **Recruit:** 8 Skills (8 Starting)
     * **Basic Class:** 10 Skills (8 Starting + 1 Combat + 1 Advanced)
     * **Master Class:** 12 Skills (8 Starting + 1 Combat + 2 Advanced + 1 Master)
   * *UI Presentation:* Starting skills can be housed in a collapsible "Civic / General" drawer, keeping the active class skills highlighted at the top.
2. **Class-Locked Specialization:**
   * Combat, Advanced, and Master skills are active only while a hero is in that class branch. When retraining into a different branch, inactive class skills are locked/banked.
3. **Mastery (Level 99 Cross-Class Unlocks):**
   * Reaching **Level 99** in an Advanced or Master skill permanently unlocks it for that hero **across all classes**, opening up deep endgame theorycrafting and cross-discipline builds.

---

## 3. Skill Inventory: Exactly 24 Skills in 4 Layers

| Layer | Count | Availability | Acquired At | Primary Role |
| :--- | :---: | :--- | :--- | :--- |
| **1. Starting** | **8** | Universal to all heroes | Character Creation | The foundational gathering, refining, sustain, and early magic economy. |
| **2. Combat** | **4** | 1 active per hero | Basic Promotion | Governs attack power, defensive mitigation, and combat style. |
| **3. Advanced** | **4** | 1 at Basic, 2 at Master | Promotion | Archetype disciplines that anchor classes and cross-pollinate at Master tier. |
| **4. Master** | **8** | 1 per Master Class | Master Promotion | High-tier game-changing capabilities that manipulate Tokens & Items. |
| **TOTAL** | **24** | | | |

---

## 4. Complete Skill Layer Breakdown

### 4.1 Layer 1: The 8 Starting Skills
*Core civilian foundation. Recruits hold all 8; retained permanently through all promotions.*

1. `mining` — Extracting raw ore, stone, and gems from subterranean veins.
2. `forestry` *(formerly Logging)* — Felling timber, harvesting bark, hardwood, and tree sap.
3. `fishing` — Hauling fish, aquatic resources, and sunken salvage.
4. `smithing` — Smelting ore into ingots; forging metal tools, weapons, and basic armor.
5. `crafting` — Working leather, textiles, bone, and wood into utility gear and containers.
6. `cooking` — Preparing restorative meals, field rations, and stamina broths.
7. `farming` — Sowing, tending, and harvesting crops, grains, and garden plots.
8. `alchemy` — Brewing early potions, healing salves, elemental flasks, and pigments.

---

### 4.2 Layer 2: The 4 Combat Skills
*Each promoted hero holds exactly 1 combat skill that governs both offense and defense.*

1. `melee` *(Fighter)* — Swords, axes, maces, shields; high physical armor and frontline tanking.
2. `ranged` *(Ranger)* — Bows, crossbows, throwing weapons; distance engagement and attack speed.
3. `magic` *(Wizard)* — Staves, tomes, wands; elemental burst damage and magical wards.
4. `stealth` *(Rogue)* — Daggers, cloaks, poisons; backstabs, evasion/dodge, and critical strikes.

---

### 4.3 Layer 3: The 4 Advanced Skills
*Specialist disciplines that define the 4 Basic Classes and cross-pollinate into the Master tier.*

1. `construction` *(Fighter Origin)* — Building stations, upgrading guild infrastructure, stone fortifications, and masonry.
2. `fletching` *(Ranger Origin)* — Crafting specialty arrows, composite bows, hunting equipment, and bow tuning.
3. `enchanting` *(Wizard Origin)* — Infusing equipment with runes, essence extraction, focus crystals, and disenchanting.
4. `crime` *(Rogue Origin)* — Lockpicking, black markets, pickpocketing, contraband distribution, and bribery.

---

### 4.4 Layer 4: The 8 Master Skills (The 4 Mechanical Pairs)

Every Master Skill has a concrete mechanical role governing how it manipulates **Tokens** and **Items**:

| Pair Type | Master Skill | Class | Concrete Board Mechanic |
| :--- | :--- | :--- | :--- |
| **1. The Modifiers**<br>*(Buff vs. Debuff)* | **`faith`** | Paladin | **Tokens that Buff:** Shrines, altars, and relic wards that project positive auras onto heroes and adjacent tokens (halting decay, healing, speeding work). |
| | **`trapping`** | Hunter | **Tokens that Debuff:** Snares, pit traps, and caltrops deployed onto enemies and tiles to weaken foes, strip charges, and alter tile rules. |
| **2. Autonomous Workers**<br>*(Combat vs. Economy)* | **`summoning`** | Necromancer | **Autonomous Combat Workers:** Raises undead thralls, skeletons, or spirits that fight hostile tokens without requiring a hero. |
| | **`taming`** | Beastmaster | **Autonomous Labor Workers:** Domesticates beasts (oxen, hounds, pack mules) that harvest, haul, or graze stations unattended. |
| **3. Bulk Converters**<br>*(Wealth vs. Industry)* | **`commerce`** | Merchant | **Item $\rightarrow$ Gold Liquidation:** Trading posts and contracts that liquidate bulk surplus goods into Gold and rapid bulk purchasing. |
| | **`science`** | Scholar | **Bulk Item $\rightarrow$ Item Conversion:** Laboratories and apparatuses that convert large quantities of items into other materials/compounds. |
| **4. Gear Modifiers**<br>*(Heavy vs. Stealth)* | **`armory`** | Knight | **Heavy Gear Upgrades:** Anvils and weapon racks that permanently modify, reforge, and upgrade plate armor, shields, and smithed weapons. |
| | **`shadowcraft`** | Assassin | **Stealth Gear Upgrades:** Workbenches and poison cauldrons that permanently modify cloaks, daggers, thrown weapons, and toxic coatings. |

---

## 5. The Class Tree (13 Classes Total)

### 5.1 Tier 0: The Recruit
* **Held Skills (8):** Mining, Forestry, Fishing, Smithing, Crafting, Cooking, Farming, Alchemy.
* **Combat Skill:** None (Cannot fight).
* **Role:** Generalist gatherer, farmer, and foundational crafter.

---

### 5.2 Tier 1: The 4 Basic Classes
*Promoting a Recruit unlocks **1 Combat Skill** and **1 Advanced Skill** (Total: 10 skills).*

| Basic Class | Combat Skill | Primary Advanced Skill | Archetype Identity |
| :--- | :--- | :--- | :--- |
| **Fighter** | `melee` | `construction` | Frontline soldier, bastion defender, and builder of guild infrastructure. |
| **Ranger** | `ranged` | `fletching` | Wilderness scout, master bowman, and maker of precision ammunition. |
| **Wizard** | `magic` | `enchanting` | Arcane researcher channeling elemental spells and imbuing items with runes. |
| **Rogue** | `stealth` | `crime` | Infiltrator moving through shadows, picking locks, and navigating the black market. |

---

### 5.3 Tier 2: The 8 Master Classes
*Promoting from Basic to Master unlocks **1 Cross-Pollinated Advanced Skill** and **1 Unique Master Skill** (Total: 12 skills).*

| Master Class | Parent Class | Combat | Advanced Skills (2) | Master Signature | Archetype Concept |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Paladin** | Fighter | `melee` | `construction`, `enchanting` | **`faith`** | Holy protector blessing sacred monuments and warded bastion armor. |
| **Knight** | Fighter | `melee` | `construction`, `fletching` | **`armory`** | Master of arms commanding siege lines and reforging masterwork plate. |
| **Beastmaster**| Ranger | `ranged` | `fletching`, `enchanting` | **`taming`** | Forest warden infusing companion beasts with primal magic. |
| **Hunter** | Ranger | `ranged` | `fletching`, `crime` | **`trapping`** | Cunning stalker utilizing illicit snares, lethal traps, and target blinds. |
| **Necromancer** | Wizard | `magic` | `enchanting`, `crime` | **`summoning`** | Dark arcanist using forbidden arts to raise and command autonomous thralls. |
| **Scholar** | Wizard | `magic` | `enchanting`, `construction`| **`science`** | Scientific visionary constructing laboratories and high-throughput converters. |
| **Merchant** | Rogue | `stealth` | `crime`, `construction` | **`commerce`** | Guild trade baron constructing market stalls, banks, and trade monopolies. |
| **Assassin** | Rogue | `stealth` | `crime`, `fletching` | **`shadowcraft`** | Lethal shadow craftsman modifying cloaks, daggers, and poisoned blades. |

---

## 6. Advanced Skill Cross-Pollination Grid (50% Symmetry)

Every one of the 4 Advanced Skills is held by **exactly 4 of the 8 Master Classes** (2 parent classes + 2 cross-pollinated classes = 50% coverage):

| Advanced Skill | Primary Parent Classes (2) | Cross-Pollinated Secondary Classes (2) | Total Master Classes Holding It |
| :--- | :--- | :--- | :---: |
| **`construction`** | Paladin, Knight | Scholar, Merchant | **4 / 8** |
| **`fletching`** | Beastmaster, Hunter | Knight, Assassin | **4 / 8** |
| **`enchanting`** | Necromancer, Scholar | Paladin, Beastmaster | **4 / 8** |
| **`crime`** | Merchant, Assassin | Hunter, Necromancer | **4 / 8** |

---

## 7. Comparison: Previous vs. New Architecture

| Dimension | Previous System (v1) | New System (v2) | Key Advantage |
| :--- | :--- | :--- | :--- |
| **Total Skills** | 27 skills | **24 skills** | Streamlined, zero dead skills, perfectly balanced authoring budget. |
| **Total Classes** | 19 classes | **13 classes** | Compact, memorable roster; every class has an unmistakable identity. |
| **Hero Progression** | Skills stripped/swapped (Fixed 6) | **Additive Growth (8 $\rightarrow$ 10 $\rightarrow$ 12)** | Eliminates feel-bad skill loss; rewards early player investment. |
| **Endgame Goal** | Fixed class caps | **Level 99 Mastery** | Unlocks cross-class skill portability for long-term build crafting. |
| **Combat Triangle** | 3 styles (Melee / Ranged / Magic) | **4 styles (+ Stealth)** | Gives Rogue its own dedicated combat engine and evasion mechanics. |
| **Master Skills** | Thematic flavor tags | **4 Concrete Token/Item Pairs** | Every skill directly manipulates the board, tokens, or item economies. |
