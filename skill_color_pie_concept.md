# Skill System & Color Pie Concept: The 22 Mechanical Profiles

This document establishes the **Mechanical Taxonomy, Token Interactions, and Color Pie Profiles** for the 22 skills in *Fantasy Guild Idle*.

---

## 1. Executive Framework & Methodology

### 1.1 The Color Pie Philosophy
In *Fantasy Guild Idle*, a skill is not just a cosmetic timer. A skill's identity is defined by:
1. **Access Profile:** What tokens, recipes, and tiers it unlocks.
2. **Token & Context Requirements:** What station, tool, and context tokens it demands on the 7×7 grid.
3. **Depletion & Lifecycle Dynamics:** Whether its nodes are high-depletion (requiring managers) or unlimited (AFK-friendly).
4. **Economic Throughput & Sinks:** What goods it outputs and which of the 6 core sinks it feeds.
5. **Mechanical Distinctness:** Its distinct advantages (e.g., automated renewal, burst spikes) and unique frictions (e.g., input scarcity, spatial adjacency congestion).
6. **Cross-Skill Ecosystem:** The upstream feeders and downstream consumers in its supply chain.

---

## 2. Master Skill Breakdown (22 Skills)

```
                                [ THE 22 SKILLS ]
                                        │
    ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                ▼                 ▼                  ▼
[ EXTRACTION ]   [ REFINING ]     [ ESOTERIC ]      [ MANAGEMENT ]     [ COMBAT ]
• Mining         • Smithing       • Alchemy         • Nature           • Melee
• Logging        • Crafting       • Runecraft       • Commerce         • Ranged
• Foraging       • Fletching      • Summoning       • Crime            • Magic
• Fishing        • Cooking        • Occult
• Agriculture    • Engineering    • Faith
                                  • Astrology
```

---

### Category 1: Foundation Skills (Starting 6 on Every Recruit)

Every Recruit starts with all 6 Foundation skills (D-200), providing a complete, self-sustaining loop:

#### 1. Mining
*   **Layer & Verb:** Foundation (Gather).
*   **Tokens Used:** Works **Ore Vein**, **Quarry**, and **Geode** Resource Tokens. Demands a **Pickaxe Context Token**.
*   **Depletion & Lifecycle:** High depletion rate. Relies heavily on **Manager Tokens** for auto-replenishing veins.
*   **Outputs:** Copper/Iron/Mithril Ores, Stone/Granite, Coal, and uncut Gems.
*   **Interactions:** Feeds raw metals to **Smithing**, stone/coal to **Engineering**, and gems to **Runecraft** / **Astrology**.

#### 2. Logging
*   **Layer & Verb:** Foundation (Gather).
*   **Tokens Used:** Works **Grove**, **Forest**, and **Ancient Stand** Resource Tokens. Demands an **Axe Context Token**.
*   **Depletion & Lifecycle:** Medium depletion rate. Higher tier trees have high yield per cycle.
*   **Outputs:** Timber, Hardwood Logs, Resin, Sap, and Tree Bark.
*   **Interactions:** Feeds structural lumber to **Crafting**, shaftwood to **Fletching**, charcoal wood to **Smithing**, and resin to **Alchemy**.

#### 3. Fishing
*   **Layer & Verb:** Foundation (Gather).
*   **Tokens Used:** Works **Pond**, **River**, and **Ocean Trench** Resource Tokens. Requires a **Fishing Rod Context Token** and optional **Bait Inputs**.
*   **Depletion & Lifecycle:** **Unlimited Charges.** Water nodes never deplete, providing the premier low-maintenance, AFK gathering process.
*   **Outputs:** Fresh Fish (tier-based), River Kelp, Sunken Salvage/Chests, and Pearl Oysters.
*   **Interactions:** Feeds raw fish to **Cooking**, kelp/oils to **Alchemy**, and salvage lockboxes to **Crime**.

#### 4. Smithing
*   **Layer & Verb:** Foundation/Specialist (Make).
*   **Tokens Used:** Works **Smelter / Forge Stations**. Demands adjacent **Anvil Context Tokens**, **Mould Schematics**, and Coal fuel.
*   **Depletion & Lifecycle:** Stations are permanent; moulds and anvils suffer shared wear (D-126) for each cycle executed.
*   **Outputs:** Refined Metal Bars, Melee Weapons, Heavy Plate Armor, Shields, and Tiered Harvesting Tools (Pickaxes, Axes).
*   **Interactions:** Consumes ore from **Mining**; directly equips **Melee** and supplies tools to **Mining**, **Logging**, and **Agriculture**.

#### 5. Crafting
*   **Layer & Verb:** Foundation (Make).
*   **Tokens Used:** Works **Workbench** and **Tannery Stations**. Uses adjacent **Pattern Schematics**, **Needles**, and **Carving Chisels**.
*   **Depletion & Lifecycle:** Standard item input recipes pulled from the Bank.
*   **Outputs:** Leather Armor, Utility Cloaks, Storage Crates (Bank slot expanders), Basic Bows, Tool Racks, and Furniture context tokens.
*   **Interactions:** Consumes leather from **Nature** and lumber from **Logging**; equips **Ranged** heroes and crafts context tokens for **Smithing** and **Cooking**.

#### 6. Cooking
*   **Layer & Verb:** Foundation (Make).
*   **Tokens Used:** Works **Campfire**, **Kitchen Hearth**, and **Cauldron Stations**. Requires adjacent **Cookware Context Tokens**.
*   **Depletion & Lifecycle:** Moderate cycle times producing high-stack consumable meals and curative broths.
*   **Outputs:** Cooked Fish, Travel Rations, Curative Stews, and Grand Feasts.
*   **Interactions:** Consumes raw fish from **Fishing**, meats from **Nature**, and crops from **Agriculture**; directly sustains all **Combat** heroes and accelerates recovery.

#### 5. Agriculture
*   **Layer & Verb:** Specialist (Gather/Make).
*   **Tokens Used:** Works **Tilled Soil**, **Wheat Field**, and **Vineyard** Tokens. Requires **Hoe Tools**, **Seed Inputs**, and adjacent **Water / Well Tokens**.
*   **Depletion & Lifecycle:** Predictable multi-cycle harvests. Crops grow over sustained cycles and yield in massive bulk quantities before reseeding.
*   **Outputs:** Grains (Wheat, Barley), Vegetables, Grapes, and Animal Fodder.
*   **Advantages & Challenges:** Produces the highest volumetric food yield per hero-cycle in the game, but demands high spatial real estate (multi-tile farms + water).
*   **Interactions:** Feeds bulk grain/produce to **Cooking**, hops/grapes to **Alchemy** (brewing), and fodder to **Nature** (minion maintenance).

---

### Category 2: Processing & Manufacturing (Physical Crafts)

#### 6. Smithing
*   **Layer & Verb:** Foundation/Specialist (Make).
*   **Tokens Used:** Works **Smelter / Forge Crafting Stations**. Requires adjacent **Anvil Context Tokens**, **Mould Schematics**, and Coal fuel.
*   **Depletion & Lifecycle:** Stations are permanent; moulds and anvils suffer shared wear (D-126) for each cycle executed.
*   **Outputs:** Refined Metal Bars, Melee Weapons (Swords, Axes), Heavy Armor (Plate, Helmets, Greaves), Shields, and Tiered Harvesting Tools (Pickaxes, Axes).
*   **Advantages & Challenges:** The backbone of physical progression; equips martial heroes and manufactures tool context tokens, but consumes immense quantities of raw ore and coal.
*   **Interactions:** Upstream from **Mining**; downstream directly equips **Melee** and supplies tools to **Mining**, **Logging**, and **Agriculture**.

#### 7. Crafting
*   **Layer & Verb:** Foundation (Make).
*   **Tokens Used:** Works **Workbench** and **Tannery Crafting Stations**. Uses adjacent **Pattern Schematics**, **Needles**, and **Carving Chisels**.
*   **Depletion & Lifecycle:** High versatility station. Uses standard item input recipes from the Bank.
*   **Outputs:** Leather Armor, Utility Cloaks, Storage Crates (Bank slot expanders), Basic Ranged Weapons (Shortbows), Tool Racks, and Furniture context tokens.
*   **Advantages & Challenges:** Extremely broad utility; crafts non-metal gear and foundational structural tokens, but creates competition for leather and timber.
*   **Interactions:** Consumes leather from **Nature** and lumber from **Logging**; equips **Ranged** heroes and crafts context tokens for **Smithing** and **Cooking**.

#### 8. Fletching
*   **Layer & Verb:** Specialist (Make).
*   **Tokens Used:** Works **Bowyer's Bench** and **Fletching Station Tokens**. Requires **Whittling Knife Context** and feather/sinew schematics.
*   **Depletion & Lifecycle:** Fast-paced production runs producing ammunition in bulk bundles (e.g., 1 wood + 1 feather = 50 arrows).
*   **Outputs:** Specialized Ammunition (Broadhead Arrows, Bodkin Bolts, Elemental Arrows), Recurve Bows, Heavy Crossbows, and Trapper Devices.
*   **Advantages & Challenges:** High continuous consumption sink (every Ranged combat round burns ammunition); keeps lumber and feather economies permanently active.
*   **Interactions:** Upstream from **Logging** (shafts), **Smithing** (tips), and **Foraging** (resins); exclusively supplies ammunition and high-tier weapons to **Ranged** combat.

#### 9. Cooking
*   **Layer & Verb:** Foundation (Make).
*   **Tokens Used:** Works **Campfire**, **Kitchen Hearth**, and **Cauldron Stations**. Requires adjacent **Cookware Context Tokens** (Pans, Spices).
*   **Depletion & Lifecycle:** Moderate cycle times producing high-stack consumable meals and curative broths.
*   **Outputs:** Cooked Steaks, Travel Rations, Curative Stews, and Grand Feasts.
*   **Advantages & Challenges:** Essential lifeblood for combat survivability; food automatically consumes to heal wounded heroes (D-189) and grant temporary HP buffers.
*   **Interactions:** Consumes raw meats/fish from **Fishing** and **Nature**, and crops from **Agriculture**; directly sustains all **Combat** heroes and accelerates recovery.

#### 10. Engineering
*   **Layer & Verb:** Specialist (Make).
*   **Tokens Used:** Works **Machinist's Workshop** and **Assembly Table Stations**. Requires **Gear Schematics**, **Calipers**, and high-precision tools.
*   **Depletion & Lifecycle:** High material cost and longer craft cycles, producing durable infrastructure and mechanical automations.
*   **Outputs:** **Mechanical Minions** (Drill Drones, Steam Smelters), **Manager Tokens** (auto-restockers), Tool Racks, Conveyor Belts, and Clockwork Gizmos.
*   **Advantages & Challenges:** Unlocks board automation and unstaffed production, but recipes require multi-step refined parts (gears, springs, reinforced plates).
*   **Interactions:** Consumes refined metals from **Smithing** and hardwoods from **Logging**; deploys mechanical minions to work **Mining** and **Logging** tiles.

---

### Category 3: Esoteric, Mystical & Divine (Arcane & Spirit Systems)

#### 11. Alchemy
*   **Layer & Verb:** Specialist (Make).
*   **Tokens Used:** Works **Alchemy Lab** and **Distillery Stations**. Requires adjacent **Alembic Context**, **Vials**, and **Reagent Schematics**.
*   **Depletion & Lifecycle:** Bulk batch crafting (1 herb + 1 reagent = 20 potions, D-187). Supplies the high-volume combat and production consumable sink.
*   **Outputs:** Combat Ammunition Potions (Haste, Stoneskin, Berserk, Poison Vials) and Production Elixirs (Cycle Overclocks, Conservation Draughts).
*   **Advantages & Challenges:** Transforms passive combat stats into massive temporary spikes; requires diverse herbal and mineral reagent inputs.
*   **Interactions:** Consumes herbs from **Foraging**, minerals from **Mining**, and fish oils from **Fishing**; supplies combat consumables to **Melee**, **Ranged**, and **Magic**.

#### 12. Occult
*   **Layer & Verb:** Specialist (Make/Gather).
*   **Tokens Used:** Works **Sacrificial Altar**, **Runic Inscriber**, and **Shadow Gate Stations**. Uses **Cursed Grimoires**, **Chisels**, and bone/blood inputs.
*   **Depletion & Lifecycle:** High versatility arcane craft. Crafts inscribed spell runes, tomes, and dangerous dark sacrifices that strip enemy defenses.
*   **Outputs:** Inscribed Spell Runes (Fire, Frost, Void), Pre-combat Armor-stripping Hexes, Enchanted Schematics, and Forbidden Transmutations.
*   **Interactions:** Consumes stone/gems from **Mining** and extracts from **Alchemy**; exclusively powers **Magic** combat, weapon elemental scaling, and dark transmutations.

---

## 3. The Complete 3-Tier Job Tree Progression Architecture

Every hero starts as an unspecialized **Recruit** and follows a branching 2-step promotion path. Per **D-180**, a hero holds exactly **6 skills at all times**, giving up 2 skills at each promotion to gain new combat and specialist capabilities:

```
                                [ RECRUIT ]
               (6 Foundation Skills, 0 Combat — Cannot Fight)
            • Mining • Logging • Fishing • Smithing • Crafting • Cooking
                                     │
      ┌──────────────┬───────────────┼───────────────┬──────────────┬──────────────┐
      ▼              ▼               ▼               ▼              ▼              ▼
 [ FIGHTER ]    [ CLERIC ]      [ RANGER ]      [ ROGUE ]      [ WIZARD ]    [ ALCHEMIST ]
(Melee + Lead) (Melee + Faith) (Ranged + Nature)(Ranged + Crime)(Magic + Ench) (Magic + Alch)
      │              │               │               │              │              │
   ┌──┴──┐        ┌──┴──┐         ┌──┴──┐         ┌──┴──┐        ┌──┴──┐        ┌──┴──┐
   ▼     ▼        ▼     ▼         ▼     ▼         ▼     ▼        ▼     ▼        ▼     ▼
 Knight Warlord Zealot Paladin   Druid  Scout  Merchant Assassin Conjurer Astromancer Scientist Engineer
```

---

### The 12 Advanced Jobs (Exact 6-Skill Sheets)

*Structure per hero:*
*   **Recruit (Tier 0):** 6 Foundation Skills, 0 Combat.
*   **1st Promotion (Tier 1 Base Class):** -2 Foundation, +1 Combat Style, +1 Shared Specialist.
*   **2nd Promotion (Tier 2 Advanced Class):** -2 Foundation, +1 Exclusive Unique Signature Skill, +1 Shared Specialist.
*   **Final Sheet (Tier 2):** 2 Foundation + 1 Combat + 2 Shared Specialist + 1 Exclusive Unique = 6 Skills Total.

---

#### 1. Fighter (Combat: `Melee`, Specialist: `Leadership`)
*   **Keeps (4):** `Mining`, `Logging`, `Smithing`, `Crafting` | **Drops (2):** `Fishing`, `Cooking`
*   **Branch 1A: Knight** (Noble Armored Champion & Masterwork Defense)
    *   **Sheet (6):** `Mining`, `Smithing` (Foundation) | `Melee` (Combat) | `Leadership` (Tier 1 Specialist) | **`Armory`** (Tier 2 Unique) | `Faith` (Tier 2 Specialist)
    *   *Drops:* `Logging`, `Crafting`
*   **Branch 1B: Warlord** (Stronghold Expansion & Permanent Architecture)
    *   **Sheet (6):** `Mining`, `Logging` (Foundation) | `Melee` (Combat) | `Leadership` (Tier 1 Specialist) | **`Construction`** (Tier 2 Unique) | `Crime` (Tier 2 Specialist)
    *   *Drops:* `Smithing`, `Crafting`

#### 2. Cleric (Combat: `Melee`, Specialist: `Faith`)
*   **Keeps (4):** `Mining`, `Smithing`, `Crafting`, `Cooking` | **Drops (2):** `Logging`, `Fishing`
*   **Branch 2A: Zealot** (Inquisitorial Rites, Fiend Purging & Sacrificial Power)
    *   **Sheet (6):** `Mining`, `Smithing` (Foundation) | `Melee` (Combat) | `Faith` (Tier 1 Specialist) | **`Occult`** (Tier 2 Unique) | `Leadership` (Tier 2 Specialist)
    *   *Drops:* `Crafting`, `Cooking`
*   **Branch 2B: Paladin** (Liturgical Scripture, Spell Scrolls & Holy Manuscripts)
    *   **Sheet (6):** `Smithing`, `Cooking` (Foundation) | `Melee` (Combat) | `Faith` (Tier 1 Specialist) | **`Inscription`** (Tier 2 Unique) | `Leadership` (Tier 2 Specialist)
    *   *Drops:* `Mining`, `Crafting`

#### 3. Ranger (Combat: `Ranged`, Specialist: `Nature`)
*   **Keeps (4):** `Logging`, `Fishing`, `Crafting`, `Cooking` | **Drops (2):** `Mining`, `Smithing`
*   **Branch 3A: Druid** (The Wild, Animal Husbandry & Living Companions)
    *   **Sheet (6):** `Fishing`, `Cooking` (Foundation) | `Ranged` (Combat) | `Nature` (Tier 1 Specialist) | **`Beastmaster`** (Tier 2 Unique) | `Alchemy` (Tier 2 Specialist)
    *   *Drops:* `Logging`, `Crafting`
*   **Branch 3B: Scout** (Frontier Infrastructure & Specialized Camps)
    *   **Sheet (6):** `Logging`, `Crafting` (Foundation) | `Ranged` (Combat) | `Nature` (Tier 1 Specialist) | **`Survival`** (Tier 2 Unique) | `Leadership` (Tier 2 Specialist)
    *   *Drops:* `Fishing`, `Cooking`

#### 4. Rogue (Combat: `Ranged`, Specialist: `Crime`)
*   **Keeps (4):** `Mining`, `Logging`, `Fishing`, `Crafting` | **Drops (2):** `Smithing`, `Cooking`
*   **Branch 4A: Merchant** (Legitimate Wealth, Markets & Royal Charters)
    *   **Sheet (6):** `Mining`, `Logging` (Foundation) | `Ranged` (Combat) | `Crime` (Tier 1 Specialist) | **`Commerce`** (Tier 2 Unique) | `Leadership` (Tier 2 Specialist)
    *   *Drops:* `Fishing`, `Crafting`
*   **Branch 4B: Assassin** (Lethal Brews, Toxins & Enemy Debuffs)
    *   **Sheet (6):** `Fishing`, `Crafting` (Foundation) | `Ranged` (Combat) | `Crime` (Tier 1 Specialist) | **`Brewing`** (Tier 2 Unique) | `Alchemy` (Tier 2 Specialist)
    *   *Drops:* `Mining`, `Logging`

#### 5. Wizard (Combat: `Magic`, Specialist: `Enchanting`)
*   **Keeps (4):** `Smithing`, `Fishing`, `Crafting`, `Cooking` | **Drops (2):** `Mining`, `Logging`
*   **Branch 5A: Conjurer** (Spirit Pacts & Spectral Minions)
    *   **Sheet (6):** `Smithing`, `Fishing` (Foundation) | `Magic` (Combat) | `Enchanting` (Tier 1 Specialist) | **`Summoning`** (Tier 2 Unique) | `Faith` (Tier 2 Specialist)
    *   *Drops:* `Crafting`, `Cooking`
*   **Branch 5B: Astromancer** (Celestial Sorcery & Starlight Scrying)
    *   **Sheet (6):** `Crafting`, `Cooking` (Foundation) | `Magic` (Combat) | `Enchanting` (Tier 1 Specialist) | **`Astrology`** (Tier 2 Unique) | `Leadership` (Tier 2 Specialist)
    *   *Drops:* `Smithing`, `Fishing`

#### 6. Alchemist (Combat: `Magic`, Specialist: `Alchemy`)
*   **Keeps (4):** `Logging`, `Fishing`, `Crafting`, `Cooking` | **Drops (2):** `Mining`, `Smithing`
*   **Branch 6A: Scientist** (Theory, Infrastructure & Research)
    *   **Sheet (6):** `Fishing`, `Cooking` (Foundation) | `Magic` (Combat) | `Alchemy` (Tier 1 Specialist) | **`Science`** (Tier 2 Unique) | `Enchanting` (Tier 2 Specialist)
    *   *Drops:* `Logging`, `Crafting`
*   **Branch 6B: Engineer** (Industrial Machinery & Automation)
    *   **Sheet (6):** `Logging`, `Crafting` (Foundation) | `Magic` (Combat) | `Alchemy` (Tier 1 Specialist) | **`Engineering`** (Tier 2 Unique) | `Nature` (Tier 2 Specialist)
    *   *Drops:* `Fishing`, `Cooking`

---

## 4. The Interlocking Supply Web & Cross-Skill Ecosystem

No skill in *Fantasy Guild Idle* operates in a vacuum. Every extraction skill feeds multiple processing skills, every crafting skill equips combat or automation layers, and every high-tier profession creates demand for upstream raw materials:

```
[ RAW EXTRACTION ]        [ REFINING / BASE MAKE ]      [ HIGH-TIER SPECIALISTS ]      [ GUILD / COMBAT SINKS ]
 Mining (Ore/Stone) ───►  Smithing (Ingots/Tools) ──►  Armory (Plate/Barding) ────►  Melee Combat (Armor)
                          │                            Engineering (Machines/Drills)►  Board Automation (Managers)
                          │                            Construction (Stone Vaults)──►  Bank & Hall Upgrades
                          ▼
 Logging (Timber)   ───►  Crafting (Wood/Leather)  ──► Inscription (Scrolls/Books) ─►  Combat Magic (Spell Scrolls)
                          │                            Survival (Camps/Towers) ─────►  Gathering/Combat Auras
                          │                            Leadership (Banners/Flags) ──►  Directional Buffs
                          ▼
 Fishing (Raw Fish) ───►  Cooking (Meals/Broths)   ──► Sustains Heroes ─────────────►  Passive HP Regen (No Deaths)
                          ▲
 Nature (Herbs/Meat)─────┼──► Alchemy (Stat Potions) ────────────────────────────────►  Hero Stat Ammunition
                          ├──► Brewing (Poisons/Acids) ──────────────────────────────►  Enemy Debuff Coatings
                          └──► Beastmaster (Tamed Companions) ───────────────────────►  Biological Labor & Mounts
                          
 Crime (Contraband) ────► Commerce (Marketplaces) ──────────────────────────────────►  Gold / Map Expansions
 Enchanting (Dust/Gems) ─► Imbues Weapons & Tools / Powers Science & Summoning ──────►  Masterwork Progression
 Occult (Fiend Bones)  ──► Powers Summoning (Minions) & Purification (Hexes) ─────────►  Zero-Risk Auto-Farming
```

---

## 5. Master Color Pie Matrix: Roles, Inputs, Outputs & Prohibitions

### A. Foundation Skills (Tier 0 — Universal Baseline)

| Skill | Verb | Core Role & Output | Input Dependencies (Upstream) | Output Deliverables (Downstream) | Strict Prohibitions (Cannot Do) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Mining`** | Gather | Extracts raw ores, stone, gems from veins | Requires Pickaxes from **Smithing** | Supplies **Smithing**, **Construction**, **Enchanting** | Cannot refine ingots or build structures |
| **`Logging`** | Gather | Harvests timber, hardwood, sap from trees | Requires Axes from **Smithing** | Supplies **Crafting**, **Construction**, **Survival**, **Leadership** | Cannot assemble furniture, bows, or camps |
| **`Fishing`** | Gather | Catches raw fish, sunken salvage from water | Requires Fishing Rods from **Crafting** | Supplies **Cooking**, **Commerce** (pearls), **Alchemy** (oils) | Cannot cook meals or produce land meat |
| **`Smithing`** | Make | Smelts ingots, crafts harvest tools & weapons | Consumes Ores from **Mining**, Wood from **Logging** | Supplies tools to all Gatherers, basic weapons to **Melee** | Cannot work leather/cloth or craft full plate |
| **`Crafting`** | Make | Wood/leather assembly, light bows, containers | Consumes Timber from **Logging**, Hides from **Nature** | Supplies Light Bows to **Ranged**, Rods to **Fishing**, Boxes to **Bank** | Cannot smelt high-temp ores or craft plate |
| **`Cooking`** | Make | Sustenance meals, HP recovery broths, rations | Consumes Fish from **Fishing**, Meat/Crops from **Nature** | Consumed by all **Combat** heroes to heal and prevent wounds | Cannot brew combat stat potions or poisons |

---

### B. Combat Styles (Tier 1)

| Combat Style | Primary Domain | Core Strengths | Mechanical Vulnerabilities | Strict Prohibitions |
| :--- | :--- | :--- | :--- | :--- |
| **`Melee`** | Frontline Physical Clash | High Armor mitigation, heavy single-target strike damage, Shield Block | Vulnerable to armor-piercing magic; short range | Cannot attack flying/ranged foes without taking damage |
| **`Ranged`** | Distance Precision | High Attack Speed, evasion bypass (Accuracy), high Critical Strike chance | Low physical armor; fragile if breached | Cannot absorb heavy sustained frontline hits |
| **`Magic`** | Elemental Spellcraft | Armor-ignoring Elemental Damage, AoE bursts, burns/freezes | Slower cast timers; zero physical Armor/Block | Fragile in melee range without protective shields |

---

### C. The 6 Shared Specialist Skills (T1 Base & T2 Synergies)

| Skill | Verb | Core Role & Output | Input Dependencies | Output Deliverables | Strict Prohibitions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Leadership`** | Make/Buff | Directional Banners, Standards, Training Drills | Cloth from **Crafting**, Ingots from **Smithing** | Projects directional +Armor/+Speed auras to adjacent heroes | Cannot heal wounds or craft consumable potions |
| **`Faith`** | Make/Buff | Holy Water, Anti-wound blessings, Shrines | Holy Water, Tithes, Silver from **Mining** | Shrines that heal heroes & prevent wound downtime | Cannot liquidate goods for Gold or cast dark curses |
| **`Nature`** | Gather/Make | Wild herbs, animal hides, basic livestock crops | Free wilderness nodes or Seeds/Water | Supplies **Alchemy** (herbs), **Crafting** (hides), **Cooking** (crops) | Cannot forge metal tools or assemble clockwork |
| **`Crime`** | Gather | Lockpicking chests, contraband vaults, stealth | Lockpicks from **Smithing** / **Crafting** | Unearths rare uncut gems, illegal relics, black market loot | Cannot build stable automated gathering chains |
| **`Enchanting`** | Make | Weapon imbuing, Tool fortune/unbreaking, Crystals | Arcane Dust, Gems from **Mining** | Enchants gear from **Smithing**/**Armory**, empowers **Science** | Cannot forge baseline weapons/armor from raw metal |
| **`Alchemy`** | Make | Hero buff potions (Haste, Stoneskin, Regeneration)| Herbs from **Nature**, Glass Vials from **Crafting** | Consumed by **Combat** heroes for temporary massive stat spikes | Cannot craft enemy debuff weapon oils or poisons |

---

### D. The 12 Exclusive Unique Skills (Tier 2 Capstones — 100% Unique)

| Unique Skill | Exclusive Class | What It Exclusively Crafts / Manipulates | Inputs Consumed | Downstream Payoff | Strict Prohibitions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Armory`** | **Knight** | Upgrades starter gear (Oxidized Blades), Masterwork Full Plate, Barding, Armory Racks | Existing Gear, Heavy Steel, Leather | Upgrades obsolete weapons; grants 0% defeat gear loss | Cannot forge baseline tools or weapons from scratch |
| **`Construction`** | **Warlord** | Permanent Stone Vaults, Paved Road Tiles, Guild Hall Upgrades | Stone, Bricks, Beams, Iron Nails | Expands Bank caps; speeds up paved stations by +20% | Cannot craft mobile gear, tools, or temporary camps |
| **`Occult`** | **Zealot** | Dark Inquisitorial Rites, Fiend Sacrifices, Defense-Shred Hexes | Monster Bones, Cursed Relics, Charcoal | Strips enemy Armor/Block to 0; powers dark transformations | Cannot bless friendly production nodes or heal allies |
| **`Inscription`** | **Paladin** | One-Use Combat Spell Scrolls (Smite, Heal), Station Manuscripts | Scrap Pulp/Parchment, Inks, Wax, Gold Leaf | Emergency high-impact combat spells; station efficiency | Cannot cast permanent weapon enchantments |
| **`Beastmaster`** | **Druid** | Living Animal Companions (Pack Mules, Falcons, War Wolves) | Outscaled Meats (Raw Beef), Fish, Grains | Minions that double haul capacity or boost combat accuracy | Cannot craft undead/spectral constructs or machines |
| **`Survival`** | **Scout** | Forward Support Camps (Watchtowers, Logging Camps, Outposts) | Timber, Scrap Wire, Canvas Tarps | Placeable camps that supercharge adjacent gathering/combat | Cannot build permanent stone buildings or vaults |
| **`Commerce`** | **Merchant** | Marketplaces, Trade Charters, Gold Liquidation & Map Discounts | Surplus items from all production chains | Converts physical surplus into **Gold**; discounts Maps | Cannot create physical items from nothing |
| **`Brewing`** | **Assassin** | Enemy Debuff Potions, Paralytic Weapon Oils, Corrosive Acids | Venom Sacs, Animal Fats, Toxic Herbs | Paralyzes enemy combat timers; melts monster armor | Cannot brew drinkable beneficial hero potions |
| **`Summoning`** | **Conjurer** | Disposable Combat Minions (Skeletons, Wraiths, Familiars) | Bones, Soul Urns, Ash from **Pyres** | Standalone minions that farm low-tier monsters with 0 HP risk | Minions cannot heal, wear gear, or work stations |
| **`Astrology`** | **Astromancer** | Celestial Drop Beacons, Star-Charts, Cartographer Silhouettes | Reflective Slag, Quartz, Star-Parchment | Multiplies rare drop chances across biomes; reveals Maps | Cannot gather physical resources or fight directly |
| **`Science`** | **Scientist** | Research Desks, Blueprint Optimizations, Laboratory Catalysts | Alchemy Extracts, Precipitate Sludge, Paper | Permanently optimizes station recipes across the entire guild | Cannot build physical automation hardware/drills |
| **`Engineering`** | **Engineer** | Manager Tokens, Copper Wire, Mechanical Drill Drones | Copper Ingots, Gears, Springs, Hardwood | Automates node restocking, tool repairs, and mechanical mining | Cannot cast magic spells, brew potions, or tame beasts |

---

## 6. Evergreen Resource Utility & Anti-Obsolescence Sinks

In *Fantasy Guild Idle*, **early-game resources never become useless waste**. As the guild advances into Tier 2, low-tier raw materials and outscaled starter gear become the vital fuel for high-tier automation, specialized gear evolution, and esoteric crafting:

```
[ EARLY-GAME COMMODITY ]          [ HIGH-TIER TRANSFORMATION SKILL ]          [ ADVANCED LATE-GAME SINK ]
 • Copper Ingots          ───►    Engineering (Wire Drawing)       ───►  Copper Wire (Powers all Manager Automation)
 • Obsolete Copper Sword  ───►    Armory (Corrosion Tempering)     ───►  Oxidized Blade (Powerful Armor-Piercing Weapon)
 • Raw Beef & Small Fish  ───►    Beastmaster (Taming Bait)        ───►  Tamed War Wolves & Hunting Falcons
 • Monster Bones & Horns  ───►    Occult (Fiend Pyres)             ───►  Dark Essences & Defense-Shredding Hexes
 • Scrap Pulp & Sawdust   ───►    Inscription (Pulp Pressing)      ───►  Liturgical Vellum & Combat Spell Scrolls
 • Glass Shards & Slag    ───►    Astrology (Optical Grinding)     ───►  Prismatic Lenses & Drop-Multiplier Beacons
 • Waste Ash & Sludge     ───►    Science & Alchemy (Catalysis)    ───►  Alchemical Solvents & Universal Catalysts
 • Raw Stone & Gravel     ───►    Construction (Road Paving)       ───►  Cobblestone Pavers (+20% Station Speed Tiles)
```

### Detailed Anti-Obsolescence Profiles:

1. **Copper & Bronze Metals (Early Extraction ➔ Industrial Automation & Upgrading):**
   *   **`Engineering` (Copper Wire):** Copper ingots are drawn into fine *Copper Wire*, an essential sub-component required for every Manager Token (auto-restockers) and Clockwork Relay on the 7×7 board.
   *   **`Armory` (Gear Evolution):** Early starter weapons are not discarded. An obsolete *Copper Sword* can be tempered into an **`Oxidized Blade`** (granting corrosive damage that melts enemy armor), and a basic *Iron Buckler* is forged into a **`Reinforced Pavise`**.

2. **Low-Tier Meats & Fish (Early Sustenance ➔ High-Tier Animal Taming):**
   *   **`Beastmaster` (Taming Bait & Loyalty Feed):** When higher-tier gourmet meals outscale basic *Raw Beef* and *River Perch*, these raw items become the specialized **Taming Bait** needed to capture and maintain high-tier *War Wolves*, *Hunting Falcons*, and *Pack Mules*.

3. **Monster Bones, Carcasses & Skulls (Early Combat Loot ➔ Occult Hexcraft & Minions):**
   *   **`Occult` (Fiend Pyres):** Zealots burn stockpiles of early monster bones and fiend remains on Sacrificial Pyres to extract *Dark Essences* and cast pre-combat defense-stripping hexes.
   *   **`Summoning` (Minion Frameworks):** Skeletons and bone constructs require steady supplies of common monster bones to replenish their disposable charges.

4. **Wood Pulp, Sawdust & Scrap Parchment (Early Logging ➔ Sacred Scripture & Maps):**
   *   **`Inscription` (Liturgical Vellum):** Sawdust and scrap wood pulp are pressed into high-grade parchment used to scribe powerful one-use combat spell scrolls (*Scroll of Holy Smite*) and station manuals.

5. **Mineral Slag, Ash & Broken Glass (Processing Waste ➔ Optics & Catalysis):**
   *   **`Astrology` (Lenses & Star Beacons):** Glass fragments and quartz byproduct are precision-ground into *Optical Lenses* and *Prisms* that power celestial drop-multiplier beacons.
   *   **`Science` & `Alchemy` (Chemical Catalysts):** Smelting slag and charcoal ashes are distilled into *Reagent Sludge*, serving as the universal catalyst for advanced blueprint research.

6. **Raw Stone & Gravel (Early Quarrying ➔ Municipal Paved Roads):**
   *   **`Construction` (Paved Infrastructure):** Surplus raw stone and gravel are crushed into *Cobblestone Pavers*, permanently transforming dirt tiles into high-speed paved roads (+20% station speed).

---

## 7. Deep Skill Intersections & Input/Output Catalog

This section details the exact drops, input dependencies, and downstream consumers for every skill in *Fantasy Guild Idle*, establishing an interconnected web of supply and demand across all phases of the game.

---

### 1. Mining (Foundation — Gather)

*   **Core Role:** Primary extractor of inorganic earth minerals, ores, gems, architectural stone, chemical combustibles, and ancient fossils.
*   **Station & Tools:** Works *Ore Vein*, *Quarry*, *Geode*, and *Bedrock Trench* resource tokens. Requires a **Pickaxe Context Token** (supplied by **Smithing**).

#### **A. Downstream Deliverables (What Mining Drops Feed Into):**
1.  **Ores & Base Metals (Copper, Tin, Iron, Silver, Gold, Mithril):**
    *   **`Smithing`:** Primary consumer. Smelts raw ores into ingots; forges all harvesting tools (Pickaxes, Axes, Knives), standard weapons, nails, and mail armor.
    *   **`Engineering`:** Draws Copper Ingots into **`Copper Wire`** (mandatory for all Manager Tokens and automation circuits).
    *   **`Armory` (Knight):** Consumes high-grade Steel & Mithril for Masterwork Full Plate and Warhorse Barding; tempers starter copper swords into *Oxidized Blades*.
    *   **`Faith` & `Occult`:** Uses raw **Silver** for sacred relics, holy water fonts, and anti-demon weapon coatings.
2.  **Gems & Resonating Crystals (Rubies, Sapphires, Emeralds, Quartz, Geodes):**
    *   **`Crafting`:** Sockets gems into **Jewelry Accessories** (Rings, Amulets) and crafts **Gem-Tipped Crossbow Bolts**.
    *   **`Enchanting` (Wizard):** Crushes raw gems into **`Arcane Dust`** or binds elemental gems into weapons/armor (Ruby ➔ Fire Damage, Sapphire ➔ Frost Slow, Emerald ➔ Poison Ward).
    *   **`Astrology` (Astromancer):** Precision-grinds **Quartz Shards** and clear crystals into **`Optical Lenses & Prisms`** to power celestial drop-rate multiplier beacons.
    *   **`Commerce` (Merchant):** Fences uncut diamonds and precious geodes for massive Gold bursts.
3.  **Stone & Architectural Minerals (Raw Stone, Granite Blocks, Marble, Slate, Clay/Sand):**
    *   **`Construction` (Warlord):** Consumes raw stone and granite to build **`Stone Vaults`** (expanding Bank capacity) and crafts **`Cobblestone Pavers`** (+20% station speed road tiles).
    *   **`Survival` (Scout):** Uses field stones to anchor foundations for **`Watchtowers`** and **`Prospector Outposts`**.
    *   **`Crafting`:** Refines silica sand and clay into casting moulds, ceramic crucibles, and potion vials.
4.  **Combustibles & Chemical Minerals (Coal, Sulfur, Rock Salt, Nitre, Chalk):**
    *   **`Cooking`:** Uses **`Rock Salt`** mined from salt seams to cure meats, pickle fish, and craft high-tier sustain rations.
    *   **`Alchemy`:** Consumes **Sulfur** and **Nitre** as reactive mineral reagents to brew defensive stat potions (Stoneskin Elixirs, Fire Ward Flasks).
    *   **`Brewing` (Assassin):** Combines sulfur with animal toxins to create **Corrosive Acid Flasks** that dissolve enemy armor.
    *   **`Inscription` (Paladin):** Uses soft chalk and refined charcoal to mix liturgical inks and scribing pigments.
    *   **`Smithing`:** Consumes **Coal / Coke** as essential furnace fuel for high-temperature smelting.
5.  **Fossils & Primordial Sediments (Petrified Bones, Prehistoric Teeth, Amber Geodes):**
    *   **`Occult` (Zealot):** Burns petrified fossils on Sacrificial Pyres to extract ancient essences for defense-shredding hexes.
    *   **`Summoning` (Conjurer):** Uses fossilized bone dust as the durable framework for crafting Skeleton and Wraith minions.
    *   **`Beastmaster` (Druid):** Uses primordial mineral salt-licks as exotic bait to lure rare wild beasts.

#### **B. Upstream Dependencies (How Other Skills Support Mining):**
*   **`Smithing`:** Crafts tiered **Pickaxes** (Copper ➔ Iron ➔ Steel ➔ Mithril) required to mine harder ore tiers without tool breakage.
*   **`Survival` (Scout):** Builds **`Prospector's Outposts`** adjacent to Ore Veins, permanently boosting raw ore yield per cycle and increasing rare gem discovery rates.
*   **`Engineering` (Engineer):** Crafts **`Manager Tokens`** to automatically pull replacement Ore Veins from the Bank when nodes exhaust, and **`Mechanical Drill Drones`** for rapid automated mining.
*   **`Enchanting` (Wizard):** Imbues pickaxes with **`Fortune`** (chance for double drop) and **`Unbreaking`** (3× durability).

---

### 2. Logging (Foundation — Gather)

*   **Core Role:** Primary extractor of organic forestry lumber, structural timber, resin binders, fibrous bark, seeds, and ancient roots.
*   **Station & Tools:** Works *Grove*, *Forest*, *Dense Stand*, and *Ironwood Copse* resource tokens. Requires an **Axe Context Token** (supplied by **Smithing**).

#### **A. Downstream Deliverables (What Logging Drops Feed Into):**
1.  **Structural Lumber & Timber (Pine, Oak, Ashwood, Ironwood, Ancient Heartwood):**
    *   **`Crafting`:** Primary consumer. Assembles tool handles, light bows, storage chests, and basic wooden shields.
    *   **`Construction` (Warlord):** Consumes heavy structural timber beams and scaffolding for building **`Stone Vaults`** and central Guild Hall expansions.
    *   **`Survival` (Scout):** Consumes log poles and timber to erect **`Watchtowers`**, **`Logging Camps`**, **`Fishing Piers`**, and **`Hunting Blinds`**.
    *   **`Smithing`:** Burns scrap timber into **Charcoal** for blast furnaces; uses ashwood for tool hafts (Pickaxes, Axes, Hammers).
    *   **`Leadership` (Fighter):** Crafts hardwood standard poles for **`Vanguard Standards & Guild Banners`**.
    *   **`Engineering` (Engineer):** Uses seasoned hardwood for clockwork machine bases and Manager Token casings.
2.  **Resins, Saps & Gums (Pine Pitch, Amber Resin, Sweet Sap, Hardening Gums):**
    *   **`Alchemy` (Alchemist):** Uses amber resins as stabilizing binders and thickening agents for long-duration stat elixirs.
    *   **`Brewing` (Assassin):** Consumes sticky pine pitch as an adhesive base for **Weapon Poison Coatings** (allowing blade poisons to stick for multiple hits).
    *   **`Crafting`:** Refines tree pitch into waterproof glue for bow lamination and leather quiver sealing.
    *   **`Cooking`:** Refines sweet tree saps into syrups and concentrated energy rations.
3.  **Bark & Bast Fibers (Oak Bark, Birch Bark, Inner Bast, Cork):**
    *   **`Inscription` (Paladin):** Presses birch bark and bast wood pulp into **`Liturgical Vellum & Parchment`** for scribing combat spell scrolls.
    *   **`Crafting`:** Extracts **Bark Tannins** to cure raw hides from Nature into flexible leather; cuts cork for potion bottle stoppers.
    *   **`Survival` (Scout):** Shreds fibrous bark for fire tinder and water filtration layers.
4.  **Nuts, Seeds & Forest Fungi (Acorns, Pine Nuts, Tree Tinder Conks, Seed Cones):**
    *   **`Cooking`:** Roasts wild pine nuts, grinds acorns into flour, and sautés tree conk mushrooms.
    *   **`Beastmaster` (Druid):** Uses wild acorns and pine nuts as specialized **Taming Bait** for forest creatures (Pack Monkeys, Squirrels, Wild Boars).
    *   **`Nature` / `Survival`:** Gathers rare tree seed cones to plant in **`Sapling Nurseries`** to permanently regenerate depleted groves (D-165).
5.  **Ancient Heartwood & Living Roots (Petrified Burls, Ironwood Boughs, Druidic Mistletoe):**
    *   **`Enchanting` (Wizard):** Carves ancient heartwood burls into magical **Spell Staves, Wands, and Focus Rods**.
    *   **`Armory` (Knight):** Uses unyielding ironwood boughs to reinforce heavy **Tower Shields** and jousting lances.
    *   **`Occult` (Zealot):** Burns petrified root burls on pyres to invoke ancient nature spirits and strip enemy armor.

#### **B. Upstream Dependencies (How Other Skills Support Logging):**
*   **`Smithing`:** Forges the tiered **Woodcutter’s Axes** (Copper ➔ Iron ➔ Steel ➔ Mithril) required to fell denser hardwood and ironwood stands without breakage.
*   **`Survival` (Scout):** Builds **`Logging Camps`** adjacent to Forests, speeding up chop timers by +25% and reducing Axe tool wear.
*   **`Beastmaster` (Druid):** Tames **`Pack Mules & Work Oxen`** that attach to the lumberjack to double timber haul yield per cycle.
*   **`Enchanting` (Wizard):** Imbues axes with **`Fortune`** (chance for bonus rare heartwood) and **`Unbreaking`** (3× durability).
*   **`Engineering` (Engineer):** Crafts **`Manager Tokens`** to auto-replant forest stands from the Bank when depleted.

---

### 3. Fishing (Foundation — Gather)

*   **Core Role:** Primary extractor of aquatic proteins, deep-sea monster scales, pearls, fish oils, and sunken shipwreck salvage.
*   **Station & Tools:** Works *Pond*, *Stream*, *River*, and *Ocean Trench* resource tokens. **Holds Unlimited Charges (never depletes).** Requires a **Fishing Rod Context Token** (supplied by **Crafting**).

#### **A. Downstream Deliverables (What Fishing Drops Feed Into):**
1.  **Common & River Fish (Trout, Perch, Salmon, Catfish, Eels):**
    *   **`Cooking`:** Primary food staple! Smoked fillets, hearty fish stews, and grilled salmon (providing combat heroes with vital HP recovery and wound prevention).
    *   **`Beastmaster` (Druid):** Raw river fish serve as specialized **Taming Bait** for aquatic and avian companions (Hunting Otters, River Falcons, Osprey).
    *   **`Nature`:** Composts fish bones and offal into organic fertilizer to accelerate high-tier crop growth.
2.  **Deep Ocean & Monster Fish (Giant Tuna, Abyssal Anglers, Leviathan Scales, Kraken Tendrils):**
    *   **`Armory` (Knight):** Crafts tough Leviathan scales into **Abyssal Scale Armor** and water-resistant mount barding.
    *   **`Crafting`:** Cures tough sharkskin and fish-leather into non-slip weapon grips and reinforced quivers.
    *   **`Occult` (Zealot):** Burns abyssal angler lures and sea-beast bones at Sacrificial Pyres to cast oceanic ward hexes.
    *   **`Cooking`:** Prepares Grand Maritime Feasts that grant guild-wide party combat buffs.
3.  **Shellfish, Oysters & Pearls (River Clams, Giant Oysters, Black Pearls, Iridescent Nacre):**
    *   **`Crafting`:** Sockets **Lustrous Pearls** into magical jewelry (Amulets of the Sea, Rings of Clarity).
    *   **`Commerce` (Merchant):** Fences rare black pearls and giant conch shells for massive Gold payouts.
    *   **`Inscription` (Paladin):** Crushes iridescent mother-of-pearl nacre into luminous inks for scribing illuminated scrolls.
4.  **Aquatic Oils, Blubber & Algae (Fish Oil, Whale Blubber, Seaweed/Kelp, Bioluminescent Spores):**
    *   **`Alchemy` (Alchemist):** Refines fish oils into **Agility & Haste Elixirs**; distills kelp into water-breathing potions.
    *   **`Brewing` (Assassin):** Extracts toxic pufferfish venom and jellyfish stingers to brew **Paralytic Blade Oils**.
    *   **`Smithing`:** Uses refined fish oil as high-performance quenching liquid for tempering high-carbon steel blades.
    *   **`Faith` (Cleric):** Purifies whale oil into clean-burning holy lamp oil for Temple Altars and Shrines.
5.  **Sunken Salvage & Shipwreck Relics (Waterlogged Chests, Iron Anchors, Barnacle Coins, Bottled Maps):**
    *   **`Crime` (Rogue):** Cracks open barnacle-encrusted locked salvage chests to loot ancient coin caches.
    *   **`Astrology` / Cartographer:** Decodes waterlogged bottled maps to reveal hidden oceanic island nodes on Map cards.
    *   **`Smithing` / `Construction`:** Smelts down scrap iron anchors and ballast stone for recycled metal and paving mortar.

#### **B. Upstream Dependencies (How Other Skills Support Fishing):**
*   **`Crafting`:** Crafts tiered **Fishing Rods** (Bamboo ➔ Ashwood ➔ Reinforced Bone ➔ Mithril-Spun Wire).
*   **`Nature` / `Butchery`:** Supplies **Earthworms, Grubs, Meat Scraps, and Chum Bait** to accelerate catch timers by +50%.
*   **`Survival` (Scout):** Builds **`Fisherman's Piers`** adjacent to water tiles, granting a **25% chance for double fish catches** and boosting shipwreck salvage discovery.
*   **`Enchanting` (Wizard):** Imbues fishing rods with **`Lure`** (faster bite cycle speed) and **`Luck of the Sea`** (increased rare pearl/salvage rates).
*   **`Beastmaster` (Druid):** Tames **`Hunting Otters & Pelicans`** that assist in retrieving fish automatically.

---

### 4. Smithing (Foundation — Make)

*   **Core Role:** The foundational metal refinery and hardware fabrication workshop. Smelts raw ores into refined ingots, forges all tiered harvesting tools, standard melee weapons, metal ammunition, and chain/scale armor.
*   **Station & Tools:** Works *Smelting Furnace*, *Blacksmith Anvil*, *Forge Hearth*. Requires adjacent **Anvil / Tool Rack Context Tokens**.

#### **A. Downstream Deliverables (What Smithing Makes & Feeds Into):**
1.  **Tiered Harvesting Tools (Gating Extraction):**
    *   *Pickaxes:* Supplies **`Mining`** (Copper ➔ Iron ➔ Steel ➔ Mithril).
    *   *Woodcutter’s Axes:* Supplies **`Logging`** (Copper ➔ Iron ➔ Steel ➔ Mithril).
    *   *Skinning & Whittling Knives:* Supplies **`Nature`**, **`Crafting`**, and **`Butchery`**.
2.  **Refined Metal Ingots (The Backbone of Automation & Architecture):**
    *   *Copper Ingots:* Feeds **`Engineering`** (drawn into **Copper Wire** for all Manager Tokens).
    *   *Steel & Mithril Ingots:* Feeds **`Armory`** (Knight’s Masterwork Full Plate, Greatshields & Barding).
    *   *Silver & Gold Ingots:* Feeds **`Faith`**, **`Occult`**, and **`Commerce`** (Sacred Relics, Tithes, Luxury Trade).
    *   *Nails, Brackets & Rebar:* Feeds **`Construction`** (Stone Vaults, Guild Hall structural upgrades).
3.  **Standard Weapons & Metal Ammunition:**
    *   *Shortswords, Broadswords, Warhammers, Maces:* Equips all **`Melee`** combat heroes.
    *   *Metal Arrowheads, Bodkin Crossbow Bolts, Throwing Knives:* Equips all **`Ranged`** combat heroes.
    *   *Stilettos & Daggers:* Equips **`Assassin`** for precision venom application.
4.  **Medium Metal Armor & Shields:**
    *   *Chainmail Shirts, Scale Hauberks, Iron Bucklers, Steel Heaumes:* Provides baseline physical Armor and Shield Block to combat heroes.
5.  **Mechanical Machine Hardware:**
    *   *Gears, Springs, Screws, Iron Plates:* Feeds **`Engineering`** for assembling Manager Tokens and Drill Drones.

#### **B. Upstream Dependencies (How Other Skills Support Smithing):**
*   **`Mining`:** Primary supplier. Delivers raw ores (Copper, Iron, Silver, Gold, Mithril) and **Coal / Coke** furnace fuel.
*   **`Logging`:** Delivers hardwood ashwood for tool hafts and scrap logs for **Charcoal**.
*   **`Fishing`:** Supplies **Fish Oil** as high-performance quenching liquid for blade tempering.
*   **`Enchanting` (Wizard):** Imbues blacksmith anvils with **`Efficient Strike`** (reducing metal ingot consumption per craft).

---

### 5. Crafting (Foundation — Make)

*   **Core Role:** The foundational assembly workshop for non-metallic organic materials (wood, leather, fibers, bone, glass). Crafts light wooden bows, quivers, tool handles, leather armor, storage containers, fishing rods, and gem jewelry.
*   **Station & Tools:** Works *Workbench*, *Tanner’s Bench*, *Lapidary Wheel*. Requires an adjacent **Whittling Knife Context Token**.

#### **A. Downstream Deliverables (What Crafting Makes & Feeds Into):**
1.  **Tool Handles, Containers & Utilities:**
    *   *Fishing Rods:* Supplies **`Fishing`** (Bamboo ➔ Ashwood ➔ Reinforced Bone ➔ Mithril-Spun).
    *   *Storage Crates & Tool Racks:* Supplies **`Engineering`** and Bank slot expansions.
    *   *Glass Vials & Flasks:* Supplies **`Alchemy`** and **`Brewing`** with containers for potions and poisons.
    *   *Ceramic Crucibles & Casting Moulds:* Supplies **`Smithing`** and **`Armory`**.
2.  **Ranged Wooden Weapons & Ammunition Components:**
    *   *Shortbows, Recurve Longbows, Light Crossbows:* Equips all **`Ranged`** combat heroes.
    *   *Wooden Arrow Shafts, Fletching Feathers, Leather Quivers:* Supplies ammunition capacity to **`Scout`**, **`Druid`**, **`Merchant`**, and **`Assassin`**.
3.  **Light Leather & Agility Armor:**
    *   *Padded Leather Tunics, Scout Boots, Archer Bracers, Bandit Hoods:* Equips high-agility heroes with Evasion/Block.
4.  **Jewelry & Accessory Trinkets:**
    *   *Gem-Socketed Rings, Pearl Amulets, Bone Talismans:* Fills the accessory equipment grid slots for all heroes across the guild.
5.  **Banners, Canvas & Scribing Sheets:**
    *   *Canvas Tarps:* Supplies **`Survival`** (Watchtowers, Logging Camps, Tent outposts).
    *   *Woven Cloth:* Supplies **`Leadership`** (Vanguard Standards & Guild Banners).

#### **B. Upstream Dependencies (How Other Skills Support Crafting):**
*   **`Logging`:** Supplies structural lumber, hardwood boards, sap glue, and bast fibers.
*   **`Nature`:** Supplies raw animal pelts, cured hides, feathers, and sinew.
*   **`Mining`:** Supplies uncut gems, silica sand (for glass vials), and clay.
*   **`Fishing`:** Supplies oyster pearls, sharkskin grips, and fish scales.

---

### 6. Cooking (Foundation — Make)

*   **Core Role:** The essential biological lifeblood of the guild. Prepares sustaining meals, curative broths, HP buffer feasts, and animal feed that keep heroes working at peak speed and prevent death/wound downtime.
*   **Station & Tools:** Works *Campfire*, *Kitchen Hearth*, *Cauldron Station*. Requires adjacent **Cookware Context Tokens** (Pans, Spices).

#### **A. Downstream Deliverables (What Cooking Makes & Feeds Into):**
1.  **Sustenance Meals & Daily Rations (Work Sustain):**
    *   *Smoked Salmon, Roasted Steaks, Hearty Bread:* Consumed by working heroes on the board to eliminate stamina exhaustion and maintain 100% work speed.
2.  **Curative Broths & Restorative Stews (Anti-Attrition):**
    *   *Healing Broths, Bone Broths, Herbal Teas:* Automatically consumed when combat heroes drop below 50% HP, restoring health and **preventing the Wounded state** (D-189).
3.  **Grand Feasts (Guild-Wide Temporary Buffs):**
    *   *Maritime Seafood Boil, Dragon-Rib Roast, Harvest Feast:* Placed on the board to grant global combat stats (+15% Damage, +20% HP Buffer) across all heroes for 10 minutes.
4.  **Taming Bait & Animal Feed:**
    *   *Cured Meats, Grain Porridge, Chum Buckets:* Supplies **`Beastmaster`** (Druid) with the loyalty feed required to tame and maintain living combat companions.

#### **B. Upstream Dependencies (How Other Skills Support Cooking):**
*   **`Fishing`:** Supplies raw river fish, shellfish, and deep-sea monster fish.
*   **`Nature`:** Supplies raw meats (beef, fowl, venison), wild herbs, berries, grains, and livestock milk.
*   **`Mining`:** Supplies **Rock Salt** for meat preservation and seasoning.
*   **`Logging`:** Supplies sweet tree saps (maple/syrups), wild forest mushrooms, and firewood.
