# Fantasy Guild Idle - Game Design Document (Current State)

## 1. Game Overview
**Title:** Fantasy Guild Idle
**Genre:** Idle / Management / RPG
**Core Loop:**
1.  **Work:** Assign heroes to basic **Task Cards** to gather early resources and XP.
2.  **Explore:** Complete an **Explore Card** to find an **Area Card**.
3.  **Expand:** Finding an Area Card spawns new, repeatable Task Cards based on the Area's Biome.
4.  **Build:** Complete the **Project** on the Area Card to gain global bonuses and unlock a new Explore Card.
5.  **Repeat:** The loop continues with higher-tier rewards and new biomes.

**Starting State:**
*   The player begins with:
    *   **1 Recruit Card** (to recruit the first hero).
    *   **1 Explore Card** (to find the first Area).
    *   **Basic Task Cards** (including a **Well** for Water/Energy).

## 2. Core Mechanics

### 2.1. Heroes
Heroes are the primary agents in the game. They perform tasks to generate value.
*   **Generation:** Heroes are procedurally generated with:
    *   **Name:** Randomly selected.
    *   **Class:** Fighter, Ranger, Wizard, Rogue, Paladin, Cleric, Bard, Alchemist, Engineer.
        *   **Effect:** Grants **+10 Starting Levels** and **+10% XP Gain** to a specific set of 3 skills.
    *   **Trait:** Strong, Nimble, Brilliant, Tough, Zealous, Greedy, Curious, Cruel, Disciplined.
        *   **Effect:** Grants **+10 Starting Levels** and **+10% XP Gain** to a specific set of 3 skills.
    *   **Stacking:** Class and Trait bonuses can overlap, resulting in **+20 Starting Levels** and **+20% XP Gain** for specific skills.
    *   **Visuals:** Represented by an emoji sprite (Placeholder for future sprites).
*   **Skills:** Proficiency in specific activities (Base + Class/Trait bonuses). Designed to be extensible.
    *   **Combat:** Melee, Ranged, Magic, Defence.
        *   *Focus: Improving combat capabilities.*
    *   **Gathering:** Industry, Nature, Nautical.
        *   *Focus: Generating raw resources without requiring inputs.*
    *   **Production:** Crafting, Culinary.
        *   *Focus: Consuming raw resources to create new ones.*
    *   **Special:** Crime, Occult, Science.
*   **Energy System:**
    *   **Per-Hero Resource:** Each hero has an Energy pool required to perform tasks.
    *   **Consumption:** Tasks consume Energy per tick. Higher-level/complex tasks consume more Energy.
    *   **Regeneration:** Base rate is **1 point per 5 seconds** for both Energy and Health.
*   **Equipment & Consumables:**
    *   **Slots:** Each Hero has 4 slots:
        *   **Weapon:** Increases Combat capability (has durability).
        *   **Armor:** Increases Defense capability (has durability).
        *   **Food:** Assigned **Food Items** are automatically consumed to heal HP when below **20%**.
        *   **Drink:** Assigned **Drink Items** are automatically consumed to restore Energy when below **20%**.
    *   **Consumption Action:** Consuming an item takes up the Hero's **entire tick** (no work/attack performed).
    *   **Durability:** Weapons and Armor degrade with use (similar to Tools).
    *   **Skill XP Curve:** Uses an **Exponential/Steep Curve** (similar to Runescape).
    *   **Hero Level:** Calculated as `(Total Skill Levels / 11)`.
    *   **Perks System:**
        *   **Milestones:** Heroes gain **1 Perk Point** at levels 10, 20, 30, 40, 50, 60, 70, 80, 90, 100.
        *   **Choice:** At each milestone, the player must choose between the **Class Perk** OR the **Trait Perk** for that tier.
        *   **Progression:** Each Class and Trait has a unique list of 10 perks that get progressively more powerful.
*   **Management:**
    *   **Recruitment:** Via **Recruit Cards**.
    *   **Retirement:** Removes hero and grants **1 Recruit Card**.

### 2.2. Card System (Tasks, Areas, Explore, Recruit, Combat, Invasion, Recipe)
The game is played through a central **Main Panel** which displays active **Cards** in a **vertical list**.
*   **Card Types:**
    *   **Task Cards:** Repeatable activities for Heroes.
    *   **Recipe Cards:** Multi-output production cards with selectable recipes (e.g., Cooking, Crafting).
    *   **Explore Cards:** One-time objectives to find new Areas.
    *   **Area Cards:** Locations for major Projects.
    *   **Recruit Cards:** One-time use cards that offer a choice of **3 Heroes**. Do not expire.
    *   **Combat Cards:** Distinct tasks involving combat with an enemy.
    *   **Invasion Cards:** Special combat events requiring multiple heroes to defeat a horde of enemies.
*   **Card Properties:**
    *   **Biome:** Determines the visuals and the type of Task Cards that spawn.
    *   **Modifier:** Small passive bonus/penalty.
    *   **Inheritance:** Biome and Modifier are traits of the **Area Card**, which are applied to any **Task Cards** spawned from it.
    *   **Rarity:** Task Cards have tiers (**Common, Uncommon, Rare, Epic, Legendary**).
        *   **Generation:** Base probabilities: **70% Common, 30% Uncommon**.
        *   **Unlocks:** Rare and higher tiers are unlocked via **Projects** and global bonuses.
*   **Lifecycle & Management:**
    *   **Persistence:** Task Cards remain until discarded.
    *   **Limits:** Maximum Active Cards limit starts at **10**. Upgradable via Projects.
        *   **Overflow:** New Invasion, Area, or Explore cards can exceed the limit (e.g., 21/20).
        *   **Unique Cards:** Specific "Unique" Task Cards do not count against the limit.
    *   **Discarding:** Players can delete/discard Task Cards to free up space.
    *   **Upgrading:** Players can consume **5 Task Cards** of the same rarity to spawn **1 Task Card** of the next higher rarity.
        *   **Traits:** The new card is randomly generated based on the traits of the 5 consumed cards.
        *   **Restrictions:** Cannot upgrade Unique or Legendary cards. Cannot use Explore, Area, Recruit, Combat, or Invasion cards for upgrades.

### 2.3. Tasks & Combat
**Standard Tasks:**
*   **Source:** Spawned by Area Cards or available as basic starter cards.
*   **Assignment:** Heroes are assigned to specific slots within a task.
    *   **Reassignment:** Dragging an assigned hero to a different task automatically unassigns them from the previous task and assigns to the new one.
*   **Duration:** Each task takes a fixed amount of time (seconds) to complete.
*   **Requirements:** Tasks may require minimum Skill levels to perform.
*   **Slots:**
    *   **Hero Slot:** Requires a hero.
    *   **Item Slots:** Requires specific input items (consumed on completion). **Can have multiple slots** (e.g., Ore + Coal).
    *   **Tool Slot:** Requires a tool.
        *   **Durability:** Tools lose **1 Durability per Tick** when used.
        *   **Auto-Replace:** If a tool breaks (0 durability) during a tick, the next tool in the stack is automatically used.
*   **Rewards:** Resources, XP, Drops.
*   **Fail Safe:** A **Well** Task Card is always available to produce **Water** (Drink) for 0 Energy.

**Explore Cards:**
*   **Mechanics:** Function similarly to Projects.
    *   **Cost:** Require **Resources** (e.g., Rations, Torches) and **Time**.
    *   **Progress:** Heroes generate progress points per tick while consuming resources.
    *   **Completion:** Unlocks an Area Card.

**Combat Cards:**
*   **Mechanics:**
    *   **Fully Automated:** Once assigned, combat proceeds automatically.
    *   **Simultaneous Ticks:** Hero and Enemy tick cycles run simultaneously.
    *   **Combat Rounds:** Upon tick completion, Hero and Enemy deal damage to each other.
    *   **XP:** Combat XP awarded on attack; **Defence XP** awarded on Enemy tick completion.
    *   **Hit Chance:** `50 + (AttackerSkill - DefenderSkill) * 2` (%).
    *   **Damage:** Defined by the **Weapon** (can provide bonus to Hit Chance or Damage).
    *   **Consumables:** Food (HP) and Drinks (Energy) are automatically consumed when < 20%. **Consuming takes 1 Tick** (no attack).
    *   **Retreat:** Unassigning the Hero immediately ends combat (Retreat).
    *   **Victory:** Enemy HP = 0. Drops loot.
    *   **Defeat:** Hero HP = 0. Hero enters **Wounded State**.

**Invasion Cards:**
*   **Mechanics:**
    *   **Horde:** Requires defeating a set number of enemies (e.g., 100 Chickens).
    *   **Multi-Hero:** Supports multiple heroes assigned simultaneously.
    *   **Escalation:** A meter fills over time (**Game Time**, only while running). Reaching milestones applies global **Debuffs** (e.g., -10% production).
    *   **Completion:** Removing the card removes debuffs and grants a reward (e.g., a special Combat Task Card).

### 2.4. Inventory System
A complex inventory management system to handle the guild's resources.
*   **Global Limits:**
    *   **Inventory Slots:** Determines the number of *unique* item types the guild can hold.
    *   **Max Stack:** Determines the maximum count for any single item type.
    *   **Expansion:** Completing specific Projects (e.g., "Warehouse") increases Slots and Max Stack limits.
*   **Inventory Groups (UI):**
    *   **Function:** Purely for organization. Players can create, rename, delete, collapse, and expand groups.
    *   **Interaction:** Items can be dragged and dropped between groups.
    *   **Default:** New items appear in a default "Loot" group.
*   **Management:**
    *   Move items between groups.
    *   Discard items.

### 2.5. Areas & Projects (Area Cards)
*   **Discovery:** Found by completing an **Explore Card**.
    *   **Explore Card:** Offers 3 options for the type of Area to find. Once chosen, it is removed and provides:
        *   1 **Area Card**.
        *   2 Repeatable **Task Cards** (linked to the Area's Biome).
*   **Projects:** Each Area Card presents **3 Project Options**. The player selects one to build (permanent choice).
    *   **Variety:** Projects can be Buildings, Rituals, Machines, or Artifacts.
    *   **Effect:** All Projects provide a permanent global bonus to the Guild.
*   **Contribution Mechanics:**
    *   **Assignment:** Only **one hero** can be assigned to a Project at a time.
    *   **Progress:** Requires **Progress Points** and **Input Items**.
    *   **Tick Cycle:** Every tick, the hero adds progress and consumes resources.
    *   **State:** Progress is saved permanently.
*   **Completion:**
    *   The Area Card is removed from the Main Panel.
    *   The Project moves to a **"Completed" Tab** (passive bonuses remain active).
    *   **Completed Tab:** Shows a summary of all completed Areas/Projects and their active bonuses.
    *   **Rewards:**
        *   1 New Repeatable **Task Card**.
        *   1 New **Explore Card** (to restart the loop).
        *   Unlocks higher-tier Projects for future Areas.

### 2.6. Resources & Economy
*   **Materials & Items (Examples):**
    *   **Raw Materials:** Wood, Stone, Coal, Copper Ore, Iron Ore, Herbs.
    *   **Processed Materials:** Copper Ingot, Iron Ingot.
    *   **Tools:** Copper Pickaxe, Iron Pickaxe (assigned to Tasks, have durability).
    *   **Equipment:** Swords, Shields, Leather Armor (assigned to Heroes, have durability).
    *   **Consumables:**
        *   **Drinks:** Restore Energy (e.g., Water).
        *   **Food:** Restore HP (e.g., Bread).
    *   *Note: The specific items listed above are placeholders and subject to change as the game design evolves.*

### 2.7. User Interface (UI)
The game uses a **3-Column Dashboard Layout** with a **Top Bar**.
*   **Top Bar:**
    *   Contains global controls: **Save**, **Options**, **Pause/Resume**.
    *   Displays global resources (Gold) if applicable.
*   **Left Panel (The Guild):**
    *   **Hero Roster:** Vertical list of all heroes.
    *   **Hero Cards:** Display Name, Class, HP/Energy Bars, and Status (Idle/Working/Wounded).
    *   **Interaction:** Heroes are dragged from here to Task Cards.
*   **Center Panel (The Board):**
    *   **Card Stack:** Vertical list of active cards (Tasks, Explore, Areas).
    *   **Tabs:** Switch between **Active Cards** and **Completed Projects**.
*   **Right Panel (The Warehouse):**
    *   **Inventory:** Collapsible groups (Loot, Materials, Consumables).
*   **Feedback Systems:**
    *   **Floating Notifications:** Small "toast" messages float up from the bottom-middle of the screen for events (e.g., "+1 Wood", "Hero Leveled Up").
    *   **Popups:** Modal windows for detailed interactions (e.g., Selecting a Project, Viewing Hero Details, Game Options).

### 2.8. Card Anatomy
Detailed layout for each card type.

**1. Task Card (The Standard)**
*   **Header:** Card Name, Rarity Border, **Parent Area Name**.
*   **Subheader:** Skill Used, Skill Requirement, Base Tick Time, XP Awarded.
*   **Body:**
    *   **Hero Slot:** Drop zone + Current Energy bar.
    *   **Tool Slot:** Icon, Durability Gauge, Inventory Count.
    *   **Input Slots:** Item Icons, Inventory Count, Quantity used per tick.
    *   **Output Slot:** Shows production. Clicking opens a **Drop Table Popup**.
    *   **Controls:** Small "Clear Slot" button for assigned items/heroes.
*   **Footer:**
    *   **Progress:** Counter (e.g., "20/100 Points").
*   **Completion State:**
    *   Slots disappear.

**2. Explore Card (The Discovery)**
*   **Header:** "Explore [Biome Hint]".
*   **Body:**
    *   **Hero Slot:** Drop zone.
    *   **Input Slots:** Rations, Torches, etc.
*   **Footer:**
    *   **Progress:** Counter.
*   **Completion State:**
    *   **Selection:** Shows 3 Area Options (revealing **only** Biome OR Modifier, e.g., "Windy..." or "...Forest").
    *   **Action:** "Confirm" button to spawn the chosen Area Card.

**3. Combat Card (The Battle)**
*   **Header:** Enemy Name, Level.
*   **Body:**
    *   **Visual:** Enemy Sprite/Image.
    *   **Stats:** Enemy HP Bar, Attack/Defence values.
    *   **Hero Slot:** Drop zone.
*   **Footer:**
    *   **Loot:** Potential drops listed.

**4. Area Card (The Hub)**
*   **Header:** Area Name.
*   **Body:**
    *   **Selection State:** 3 Project Options with "Select" buttons + "Confirm".
    *   **Active State:** Visual of Building/Ritual, Hero Slot, Input Slots (Massive resources).
*   **Footer:**
    *   **Global Bonus:** Text description.
    *   **Progress:** Project Points Bar (e.g., "500/1000"). Turns into **"Complete" Button** when finished.

**5. Recruit Card (The Choice)**
*   **Header:** "Recruit Hero".
*   **Body:**
    *   **Options:** 3 Heroes showing Name + **(Class OR Trait)** (e.g., "Sophie, Brilliant..." or "Mouse, ...Paladin").
    *   **Action:** "Select" button for each.
*   **Footer:** "Confirm" button.

**6. Invasion Card (The Event)**
*   **Header:** Event Name, Timer/Escalation Meter.
*   **Body:**
    *   **Horde:** "Enemies Remaining: 50/50".
    *   **Slots:** Multiple Hero Slots.
*   **Footer:**
    *   **Threat Bar:** Increases with Game Time. Milestones trigger global debuffs.
    *   **Completion:** Bar turns to **"Complete" Button** when enemies are defeated.

**7. Recipe Card (The Workshop)**
*   **Header:** Card Name (e.g., "Kitchen", "Forge"), Rarity Border, **Parent Area Name**.
*   **Subheader:** Skill Used (e.g., Culinary, Crafting), Skill Requirement, Base Tick Time.
*   **Body:**
    *   **Recipe Dropdown:** Select from available recipes. Changing the recipe updates Input/Output slots.
    *   **Hero Slot:** Drop zone + Current Energy bar.
    *   **Tool Slot:** Icon, Durability Gauge, Inventory Count.
    *   **Input Slots:** Dynamically updated based on selected recipe. Shows Item Icons, Inventory Count, Quantity used per tick.
    *   **Output Slot:** Shows the product of the selected recipe. Clicking opens a **Drop Table Popup**.
    *   **Controls:** Small "Clear Slot" button for assigned items/heroes.
*   **Footer:**
    *   **Progress:** Counter (e.g., "20/100 Points").
*   **Recipe Selection:**
    *   Recipes are unlocked via Projects, Skill Level, or default availability.
    *   The dropdown only shows recipes the player can currently produce (has required skill level).
    *   Changing recipes mid-task resets progress to 0.

### 2.9. Class Perks
Each Class has a unique list of 10 perks available at Hero Levels 10, 20, 30, 40, 50, 60, 70, 80, 90, 100.

**Fighter (Melee, Defence, Industry)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Heavy Lifter** | Reduces Energy cost of [Industry] tasks by 1 (Minimum 1). |
| 20 | **Brawler** | Increases Melee Damage by +[Hero Level * 0.5]. |
| 30 | **Iron Skin** | Reduces Incoming Damage by [Hero Level * 0.2] (Minimum 1). |
| 40 | **Industrialist** | Reduces Tick Time of [Industry] tasks by 10%. |
| 50 | **Steel Grip** | 20% chance to not consume Tool Durability on any task. |
| 60 | **Veteran** | Increases Defence Skill effectiveness by +10% (Higher Block Chance). |
| 70 | **Workhorse** | Hero continues working at 50% speed even when Energy is 0. |
| 80 | **Shatter** | Melee attacks have a 10% chance to deal Double Damage. |
| 90 | **Foreman** | All *other* heroes working in [Industry] tasks have -5% Tick Time. |
| 100 | **Warlord** | Melee attacks now hit **2 Enemies** simultaneously (if available). |

**Ranger (Ranged, Nature, Nautical)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Forager** | Reduces Energy cost of [Nature] tasks by 1 (Minimum 1). |
| 20 | **Marksman** | Increases Ranged Damage by +[Hero Level * 0.5]. |
| 30 | **Sailor** | Reduces Energy cost of [Nautical] tasks by 1 (Minimum 1). |
| 40 | **Naturalist** | Reduces Tick Time of [Nature] tasks by 10%. |
| 50 | **Navigator** | Reduces Tick Time of [Nautical] tasks by 10%. |
| 60 | **Scout** | Explore Cards completed by this hero offer **4 Options** instead of 3. |
| 70 | **Sniper** | Increases Hit Chance by +20% in Combat. |
| 80 | **Forest Guide** | All heroes in [Forest] Biome have -5% Tick Time. |
| 90 | **Sea Captain** | All heroes in [Ocean] Biome have -5% Tick Time. |
| 100 | **Deadeye** | Ranged attacks have a 50% chance to ignore Enemy Defence. |

**Wizard (Magic, Occult, Science)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Scholar** | Reduces Energy cost of [Science] tasks by 1 (Minimum 1). |
| 20 | **Arcanist** | Increases Magic Damage by +[Hero Level * 0.5]. |
| 30 | **Cultist** | Reduces Energy cost of [Occult] tasks by 1 (Minimum 1). |
| 40 | **Researcher** | Reduces Tick Time of [Science] tasks by 10%. |
| 50 | **Ritualist** | Reduces Tick Time of [Occult] tasks by 10%. |
| 60 | **Mana Flow** | Regenerate +1 Energy per 5s (Total 2/5s). |
| 70 | **Conservation** | 10% chance to save 1 Input Item in [Occult] or [Science] tasks. |
| 80 | **Omen** | Invasion Meters fill 20% slower while this hero is active. |
| 90 | **Archmage** | Magic attacks deal +10% Damage for every *other* Wizard in the guild. |
| 100 | **Time Warp** | Reduces Tick Time of **ALL** tasks this hero performs by 50%. |

**Rogue (Melee, Crime, Nautical)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Pickpocket** | Reduces Energy cost of [Crime] tasks by 1 (Minimum 1). |
| 20 | **Backstab** | First attack in combat deals **Double Damage**. |
| 30 | **Smuggler** | Reduces Energy cost of [Nautical] tasks by 1 (Minimum 1). |
| 40 | **Criminal** | Reduces Tick Time of [Crime] tasks by 10%. |
| 50 | **Privateer** | Reduces Tick Time of [Nautical] tasks by 10%. |
| 60 | **Looting** | Enemies defeated by this hero have a +20% chance to drop items. |
| 70 | **Evasion** | +10% chance to completely avoid incoming damage. |
| 80 | **Fence** | Selling items (if implemented) or completing [Crime] tasks yields +20% Gold. |
| 90 | **Shadow** | This hero generates **0 Threat** towards Invasion Meters. |
| 100 | **Assassinate** | 5% chance on hit to instantly kill a Non-Boss enemy. |

**Paladin (Melee, Defence, Crafting)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Squire** | Reduces Energy cost of [Crafting] tasks by 1 (Minimum 1). |
| 20 | **Defender** | Reduces Incoming Damage by [Hero Level * 0.2] (Minimum 1). |
| 30 | **Crusader** | Increases Melee Damage by +[Hero Level * 0.5]. |
| 40 | **Smith** | Reduces Tick Time of [Crafting] tasks by 10%. |
| 50 | **Guardian** | When in an Invasion, all *other* heroes take 10% less damage. |
| 60 | **Maintenance** | 20% chance to not consume Tool Durability on [Crafting] tasks. |
| 70 | **Holy Light** | Heals the lowest HP hero in the same Area for [Hero Level * 0.1] HP per tick. |
| 80 | **Thorns** | Reflects 10% of incoming damage back to the attacker. |
| 90 | **Bastion** | All *other* heroes in the Guild gain +[Hero Level * 0.1] Defence. |
| 100 | **Divine Intervention** | If HP drops to 0, heal to 100% HP instead of Wounded (1 Hour Cooldown). |

**Cleric (Magic, Defence, Culinary)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Acolyte** | Reduces Energy cost of [Culinary] tasks by 1 (Minimum 1). |
| 20 | **Healer** | Food items consumed by this hero restore +25% more HP. |
| 30 | **Protector** | Increases Defence Skill effectiveness by +10%. |
| 40 | **Chef** | Reduces Tick Time of [Culinary] tasks by 10%. |
| 50 | **Medic** | Heals the lowest HP hero in the same Area for [Hero Level * 0.1] HP per tick. |
| 60 | **Purify** | Drink items consumed by this hero restore +25% more Energy. |
| 70 | **Smite** | Increases Magic Damage by +[Hero Level * 0.5]. |
| 80 | **Blessing** | All *other* heroes in the same Area regenerate +1 HP per 5s. |
| 90 | **Feast** | [Culinary] tasks have a 20% chance to produce **Double Output**. |
| 100 | **Resurrection** | Reduces the "Wounded" state duration for ALL heroes by 50%. |

**Bard (Ranged, Nature, Culinary)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Wanderer** | Reduces Energy cost of [Nature] tasks by 1 (Minimum 1). |
| 20 | **Performer** | Reduces Energy cost of [Culinary] tasks by 1 (Minimum 1). |
| 30 | **Archer** | Increases Ranged Damage by +[Hero Level * 0.5]. |
| 40 | **Gatherer** | Reduces Tick Time of [Nature] tasks by 10%. |
| 50 | **Innkeeper** | Reduces Tick Time of [Culinary] tasks by 10%. |
| 60 | **Muse** | While this hero is Active, all *other* heroes regenerate +0.5 Energy per 5s. |
| 70 | **Ballad** | All *other* heroes in the same Combat deal +5% Damage. |
| 80 | **Negotiator** | Retiring this hero grants **2 Recruit Cards**. |
| 90 | **Anthem** | All *other* heroes in the Guild gain +5 Effective Skill Level to [Social] (Faith). |
| 100 | **Encore** | 10% chance for *any* Task completed by this hero to trigger twice instantly. |

**Alchemist (Magic, Science, Culinary)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Student** | Reduces Energy cost of [Science] tasks by 1 (Minimum 1). |
| 20 | **Brewer** | Reduces Energy cost of [Culinary] tasks by 1 (Minimum 1). |
| 30 | **Mage** | Increases Magic Damage by +[Hero Level * 0.5]. |
| 40 | **Scientist** | Reduces Tick Time of [Science] tasks by 10%. |
| 50 | **Distiller** | Reduces Tick Time of [Culinary] tasks by 10%. |
| 60 | **Transmute** | 10% chance to save 1 Input Item in [Science] or [Culinary] tasks. |
| 70 | **Potion Master** | Drink items consumed by this hero provide a temporary +10% Speed buff for 1 minute. |
| 80 | **Catalyst** | [Science] tasks have a 20% chance to produce **Double Output**. |
| 90 | **Philosopher** | Increases Global Inventory Max Stack for [Potions/Drinks] by +20. |
| 100 | **Elixir of Life** | This hero never enters the "Wounded" state (HP stops at 1). |

**Engineer (Ranged, Industry, Crafting)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Apprentice** | Reduces Energy cost of [Industry] tasks by 1 (Minimum 1). |
| 20 | **Tinker** | Reduces Energy cost of [Crafting] tasks by 1 (Minimum 1). |
| 30 | **Gunner** | Increases Ranged Damage by +[Hero Level * 0.5]. |
| 40 | **Mechanic** | Reduces Tick Time of [Industry] tasks by 10%. |
| 50 | **Builder** | +1 Progress Point to Building Projects per tick. |
| 60 | **Artisan** | Reduces Tick Time of [Crafting] tasks by 10%. |
| 70 | **Reinforced** | 50% chance to not consume Tool Durability. |
| 80 | **Efficiency** | 10% chance to save 1 Input Item in [Industry] or [Crafting] tasks. |
| 90 | **Automation** | Hero works at 80% speed even when Energy is 0. |
| 100 | **Master Builder** | +5 Progress Points to Building Projects per tick. |

### 2.10. Trait Perks
Each Trait has a unique list of 10 perks available at Hero Levels 10, 20, 30, 40, 50, 60, 70, 80, 90, 100.

**Strong (Melee, Industry, Crafting)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Laborer** | Reduces Energy cost of [Industry] tasks by 1 (Minimum 1). |
| 20 | **Heavy Hitter** | Increases Melee Damage by +[Hero Level * 0.5]. |
| 30 | **Smithy** | Reduces Energy cost of [Crafting] tasks by 1 (Minimum 1). |
| 40 | **Power Lifter** | Reduces Tick Time of [Industry] tasks by 10%. |
| 50 | **Forgemaster** | Reduces Tick Time of [Crafting] tasks by 10%. |
| 60 | **Pack Mule** | Increases this Hero's Inventory Carry Capacity (if applicable) or Global Stack +5. |
| 70 | **Crush** | Melee attacks have a 10% chance to Stun the enemy for 1 tick. |
| 80 | **Mass Production** | [Industry] tasks have a 20% chance to produce **Double Output**. |
| 90 | **Union Leader** | All *other* heroes in [Industry] tasks gain +5 Effective Skill Level. |
| 100 | **Titan** | Increases Melee Damage by +100% but Attack Speed is 10% slower. |

**Nimble (Ranged, Crime, Nature)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Gatherer** | Reduces Energy cost of [Nature] tasks by 1 (Minimum 1). |
| 20 | **Quick Shot** | Increases Ranged Damage by +[Hero Level * 0.5]. |
| 30 | **Thief** | Reduces Energy cost of [Crime] tasks by 1 (Minimum 1). |
| 40 | **Sprinter** | Reduces Tick Time of [Nature] tasks by 10%. |
| 50 | **Burglar** | Reduces Tick Time of [Crime] tasks by 10%. |
| 60 | **Dodgy** | +10% chance to completely avoid incoming damage. |
| 70 | **Trickshot** | Ranged attacks have +20% Hit Chance. |
| 80 | **Kleptomaniac** | [Crime] tasks yield +20% more Gold/Resources. |
| 90 | **One with Nature** | All *other* heroes in [Nature] tasks have -5% Tick Time. |
| 100 | **Rapid Fire** | Ranged attacks hit **2 times** per combat round. |

**Brilliant (Magic, Science, Occult)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Student** | Reduces Energy cost of [Science] tasks by 1 (Minimum 1). |
| 20 | **Spark** | Increases Magic Damage by +[Hero Level * 0.5]. |
| 30 | **Adept** | Reduces Energy cost of [Occult] tasks by 1 (Minimum 1). |
| 40 | **Genius** | Reduces Tick Time of [Science] tasks by 10%. |
| 50 | **Warlock** | Reduces Tick Time of [Occult] tasks by 10%. |
| 60 | **Efficiency** | 20% chance to not consume Input Items in [Science] tasks. |
| 70 | **Focus** | Increases Magic Hit Chance by +20%. |
| 80 | **Breakthrough** | [Science] tasks have a 20% chance to produce **Double Output**. |
| 90 | **Mastermind** | All *other* heroes in [Science] tasks have -5% Tick Time. |
| 100 | **Overload** | Magic attacks deal **Triple Damage** but cost 10% HP to cast. |

**Tough (Defence, Crafting, Culinary)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Apprentice** | Reduces Energy cost of [Crafting] tasks by 1 (Minimum 1). |
| 20 | **Thick Skin** | Reduces Incoming Damage by [Hero Level * 0.2] (Minimum 1). |
| 30 | **Cook** | Reduces Energy cost of [Culinary] tasks by 1 (Minimum 1). |
| 40 | **Blacksmith** | Reduces Tick Time of [Crafting] tasks by 10%. |
| 50 | **Chef** | Reduces Tick Time of [Culinary] tasks by 10%. |
| 60 | **Regeneration** | Regenerate +1 HP per 5s (Total 2/5s). |
| 70 | **Shield Wall** | Increases Defence Skill effectiveness by +10%. |
| 80 | **Hardened** | 50% chance to not consume Tool Durability. |
| 90 | **Protector** | All *other* heroes in the Guild gain +[Hero Level * 0.1] Defence. |
| 100 | **Juggernaut** | Incoming Damage is capped at **10 per hit** (after mitigation). |

**Zealous (Melee, Occult, Nature)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Believer** | Reduces Energy cost of [Occult] tasks by 1 (Minimum 1). |
| 20 | **Crusader** | Increases Melee Damage by +[Hero Level * 0.5]. |
| 30 | **Pilgrim** | Reduces Energy cost of [Nature] tasks by 1 (Minimum 1). |
| 40 | **Fanatic** | Reduces Tick Time of [Occult] tasks by 10%. |
| 50 | **Hermit** | Reduces Tick Time of [Nature] tasks by 10%. |
| 60 | **Prayer** | Invasion Meters fill 10% slower while this hero is active. |
| 70 | **Vampirism** | Heals HP equal to 5% of damage dealt. |
| 80 | **Miracle** | [Occult] tasks have a 20% chance to produce **Double Output**. |
| 90 | **High Priest** | All *other* heroes in [Occult] tasks have -5% Tick Time. |
| 100 | **Martyr** | If this hero dies (Wounded), all *other* heroes are Healed to Full HP. |

**Greedy (Crime, Industry, Nautical)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Cutpurse** | Reduces Energy cost of [Crime] tasks by 1 (Minimum 1). |
| 20 | **Merchant** | Selling items (if implemented) yields +10% Gold. |
| 30 | **Investor** | Reduces Energy cost of [Industry] tasks by 1 (Minimum 1). |
| 40 | **Criminal** | Reduces Tick Time of [Crime] tasks by 10%. |
| 50 | **Tycoon** | Reduces Tick Time of [Industry] tasks by 10%. |
| 60 | **Smuggler** | Reduces Energy cost of [Nautical] tasks by 1 (Minimum 1). |
| 70 | **Privateer** | Reduces Tick Time of [Nautical] tasks by 10%. |
| 80 | **Lucky** | 10% chance for **Double Loot** drops in Combat. |
| 90 | **Monopoly** | Increases Global Inventory Max Stack by +20. |
| 100 | **Bribe** | Retiring this hero grants **3 Recruit Cards**. |

**Curious (Science, Nautical, Nature)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Observer** | Reduces Energy cost of [Science] tasks by 1 (Minimum 1). |
| 20 | **Sailor** | Reduces Energy cost of [Nautical] tasks by 1 (Minimum 1). |
| 30 | **Explorer** | Reduces Energy cost of [Nature] tasks by 1 (Minimum 1). |
| 40 | **Experimenter** | Reduces Tick Time of [Science] tasks by 10%. |
| 50 | **Navigator** | Reduces Tick Time of [Nautical] tasks by 10%. |
| 60 | **Cartographer** | Explore Cards completed by this hero offer **5 Options**. |
| 70 | **Botanist** | Reduces Tick Time of [Nature] tasks by 10%. |
| 80 | **Clairvoyance** | Reveals the Biome/Modifier of Areas on Explore Cards before selection. |
| 90 | **Pioneer** | All *other* heroes in [Nautical] tasks have -5% Tick Time. |
| 100 | **Eureka** | [Science] tasks have a 50% chance to produce **Double Output**. |

**Cruel (Melee, Crime, Occult)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Thug** | Reduces Energy cost of [Crime] tasks by 1 (Minimum 1). |
| 20 | **Sadist** | Increases Melee Damage by +[Hero Level * 0.5]. |
| 30 | **Cultist** | Reduces Energy cost of [Occult] tasks by 1 (Minimum 1). |
| 40 | **Enforcer** | Reduces Tick Time of [Crime] tasks by 10%. |
| 50 | **Ritualist** | Reduces Tick Time of [Occult] tasks by 10%. |
| 60 | **Intimidate** | Enemies deal -10% Damage to this hero. |
| 70 | **Lacerate** | Melee attacks cause a "Bleed" (DoT) dealing 10% damage per tick for 3 ticks. |
| 80 | **Kingpin** | [Crime] tasks have a 20% chance to produce **Double Output**. |
| 90 | **Fear Aura** | All *other* heroes in the same Combat deal +10% Damage. |
| 100 | **Executioner** | Attacks against enemies below 20% HP deal **Triple Damage**. |

**Disciplined (Defence, Crafting, Science)**
| Level | Perk Name | Description |
| :--- | :--- | :--- |
| 10 | **Sentry** | Reduces Energy cost of [Crafting] tasks by 1 (Minimum 1). |
| 20 | **Guard** | Increases Defence Skill effectiveness by +10%. |
| 30 | **Student** | Reduces Energy cost of [Science] tasks by 1 (Minimum 1). |
| 40 | **Smith** | Reduces Tick Time of [Crafting] tasks by 10%. |
| 50 | **Researcher** | Reduces Tick Time of [Science] tasks by 10%. |
| 60 | **Iron Will** | 50% chance to not consume Tool Durability. |
| 70 | **Workaholic** | Hero continues working at 50% speed even when Energy is 0. |
| 80 | **Perfectionist** | [Crafting] tasks have a 20% chance to produce **Double Output**. |
| 90 | **Instructor** | All *other* heroes in [Crafting] tasks have -5% Tick Time. |
| 100 | **Immovable** | Hero cannot be Stunned or Debuffed. +50% Defence. |

### 2.11. Biomes & Modifiers
Biomes and Modifiers provide global passive bonuses to the Guild. These effects are small but cumulative.

**Biomes (40)**
| Biome | Passive Bonus |
| :--- | :--- |
| **Plains** | +1% XP for [Nature] Tasks. |
| **Forest** | -1% Tick Time for [Nature] Tasks. |
| **Mountain** | +1% XP for [Industry] Tasks. |
| **Swamp** | +1% Output Chance for [Nature] Tasks. |
| **Desert** | +1% XP for [Science] Tasks. |
| **Tundra** | +1% XP for [Defence] Skill. |
| **Jungle** | +1% XP for [Nature] Tasks. |
| **Badlands** | +1% XP for [Industry] Tasks. |
| **Savanna** | +1% XP for [Ranged] Skill. |
| **Taiga** | +1% Output Chance for [Nature] Tasks. |
| **Volcanic** | +1% XP for [Crafting] Tasks. |
| **Glacier** | +1% XP for [Magic] Skill. |
| **Canyon** | +1% XP for [Ranged] Skill. |
| **Oasis** | +1% HP/Energy Regeneration Rate. |
| **Steppe** | -1% Tick Time for [Nature] Tasks. |
| **Rainforest** | +1% Output Chance for [Nature] Tasks. |
| **Bamboo Forest** | -1% Tick Time for [Nature] Tasks. |
| **Mushroom Forest** | +1% XP for [Culinary] Tasks. |
| **Salt Flats** | +1% Output Chance for [Culinary] Tasks. |
| **Tar Pits** | +1% Output Chance for [Industry] Tasks. |
| **Ash Wastes** | +1% XP for [Occult] Tasks. |
| **High Peaks** | -1% Tick Time for [Magic] Skill. |
| **Geyser Field** | +1% XP for [Science] Tasks. |
| **Cave** | -1% Tick Time for [Industry] Tasks. |
| **Ocean** | +1% XP for [Nautical] Tasks. |
| **Coast** | +1% Output Chance for [Nautical] Tasks. |
| **Reef** | +1% XP for [Science] Tasks. |
| **Island** | +1% XP for [Nautical] Tasks. |
| **Fjord** | -1% Tick Time for [Nautical] Tasks. |
| **Deep Ocean** | +1% Output Chance for [Nautical] Tasks. |
| **Lake** | +1% XP for [Nautical] Tasks. |
| **River** | -1% Tick Time for [Industry] Tasks. |
| **Ruins** | +1% XP for [Occult] Tasks. |
| **Farmland** | +1% Output Chance for [Culinary] Tasks. |
| **Graveyard** | +1% XP for [Occult] Tasks. |
| **Ancient Battlefield** | +1% XP for [Combat] Skills. |
| **Crystal Caverns** | +1% XP for [Magic] Skill. |
| **Floating Isles** | -1% Tick Time for [Magic] Skill. |
| **Corrupted Land** | +1% XP for [Occult] Tasks. |
| **Arcane Wasteland** | +1% Output Chance for [Magic] Skill. |

**Biome Modifiers (60)**
| Modifier | Passive Bonus |
| :--- | :--- |
| **Windy** | -1% Tick Time for [Nautical] Tasks. |
| **Rainy** | +1% Output Chance for [Nature] Tasks. |
| **Stormy** | +1% XP for [Magic] Skill. |
| **Foggy** | +1% XP for [Crime] Tasks. |
| **Sunny** | +1% Output Chance for [Nature] Tasks. |
| **Frozen** | +1% XP for [Defence] Skill. |
| **Burning** | +1% XP for [Crafting] Tasks. |
| **Humid** | +1% Output Chance for [Nature] Tasks. |
| **Arid** | +1% XP for [Defence] Skill. |
| **Frigid** | +1% XP for [Magic] Skill. |
| **Thunderous** | +1% XP for [Magic] Skill. |
| **Cloudy** | +1% XP for [Ranged] Skill. |
| **Icy** | +1% XP for [Magic] Skill. |
| **Dusty** | +1% XP for [Industry] Tasks. |
| **Holy** | +1% XP for [Defence] Skill. |
| **Cursed** | +1% XP for [Occult] Tasks. |
| **Magical** | +1% XP for [Magic] Skill. |
| **Ethereal** | -1% Tick Time for [Magic] Skill. |
| **Haunted** | +1% XP for [Occult] Tasks. |
| **Enchanted** | +1% Output Chance for [Magic] Skill. |
| **Arcane** | -1% Tick Time for [Magic] Skill. |
| **Divine** | +1% Healing Effectiveness. |
| **Demonic** | +1% Damage. |
| **Mystic** | +1% XP for [Science] Tasks. |
| **Spectral** | +1% Dodge Chance. |
| **Shadowy** | +1% XP for [Crime] Tasks. |
| **Radiant** | +1% XP for [Defence] Skill. |
| **Dark** | +1% XP for [Crime] Tasks. |
| **Overgrown** | +1% Output Chance for [Nature] Tasks. |
| **Barren** | +1% XP for [Industry] Tasks. |
| **Infested** | +1% XP for [Combat] Skills. |
| **Peaceful** | +1% HP/Energy Regeneration Rate. |
| **Toxic** | +1% XP for [Science] Tasks. |
| **Flooded** | +1% XP for [Nautical] Tasks. |
| **Ruined** | +1% XP for [Occult] Tasks. |
| **Pristine** | +1% XP for [Nature] Tasks. |
| **Wild** | +1% Damage. |
| **Dangerous** | +1% XP for [Combat] Skills. |
| **Safe** | +1% HP/Energy Regeneration Rate. |
| **Chaotic** | +1% Crit Chance. |
| **Volatile** | +1% XP for [Science] Tasks. |
| **Silent** | +1% XP for [Crime] Tasks. |
| **Savage** | +1% Damage. |
| **Rich** | +1% Output Chance for [Gathering] Tasks. |
| **Ancient** | +1% XP for [Magic] Skill. |
| **Abundant** | +1% Output Chance for [Gathering] Tasks. |
| **Scarce** | +1% XP for [Defence] Skill. |
| **Fertile** | +1% Output Chance for [Nature] Tasks. |
| **Lush** | +1% XP for [Nature] Tasks. |
| **Rocky** | +1% XP for [Industry] Tasks. |
| **Muddy** | +1% XP for [Nature] Tasks. |
| **Golden** | +1% Gold Gain. |
| **Gloomy** | +1% XP for [Occult] Tasks. |
| **Vibrant** | +1% XP for [Magic] Skill. |
| **Pale** | +1% XP for [Occult] Tasks. |
| **Crystal** | +1% Output Chance for [Industry] Tasks. |
| **Spiky** | +1% Thorns Damage. |
| **Slimy** | +1% XP for [Science] Tasks. |
| **Mossy** | +1% XP for [Nature] Tasks. |
| **Fungal** | +1% XP for [Culinary] Tasks. |
### 2.12. Invasion Mechanics
Invasions are dangerous events that escalate over time. As the **Threat Meter** fills, global debuffs are applied to the Guild. These debuffs stack (e.g., 2 Stacks of "Industrial Decay" = +20% Tick Time).

**Threat Mechanics (30)**
| Debuff Name | Effect (Per Stack) |
| :--- | :--- |
| **Industrial Decay** | +10% Tick Time for [Industry] Tasks. |
| **Nature's Wrath** | +10% Tick Time for [Nature] Tasks. |
| **Clumsiness** | +10% Tick Time for [Crafting] Tasks. |
| **Spoilage** | +10% Tick Time for [Culinary] Tasks. |
| **Darkness** | +10% Tick Time for [Occult] Tasks. |
| **Ignorance** | +10% Tick Time for [Science] Tasks. |
| **Rough Seas** | +10% Tick Time for [Nautical] Tasks. |
| **Lawlessness** | +10% Tick Time for [Crime] Tasks. |
| **Plunder** | 10% Chance to **lose Output Item** on [Gathering] Tasks. |
| **Theft** | 10% Chance to **lose Output Item** on [Production] Tasks. |
| **Heavy Burden** | +1 Energy Cost for [Industry] Tasks. |
| **Thorns** | +1 Energy Cost for [Nature] Tasks. |
| **Complication** | +1 Energy Cost for [Crafting] Tasks. |
| **Burned** | +1 Energy Cost for [Culinary] Tasks. |
| **Drain** | +1 Energy Cost for [Occult] Tasks. |
| **Confusion** | +1 Energy Cost for [Science] Tasks. |
| **Headwind** | +1 Energy Cost for [Nautical] Tasks. |
| **Bribes** | +1 Energy Cost for [Crime] Tasks. |
| **Stagnation** | -10% XP Gain for [Gathering] Skills. |
| **Boredom** | -10% XP Gain for [Production] Skills. |
| **Doubt** | -10% XP Gain for [Special] Skills. |
| **Sabotage** | 10% Chance for Building Projects to **gain 0 Progress** this tick. |
| **Lost** | 10% Chance for Explore Cards to **gain 0 Progress** this tick. |
| **Tainted Water** | Drink items restore -10% Energy. |
| **Rotten Food** | Food items restore -10% HP. |
| **Embargo** | Global Inventory Max Stack reduced by -10%. |
| **Blockade** | Global Inventory Slots reduced by -1. |
| **Rust** | Tools have a +10% chance to consume Durability (if not 100%). |
| **Fear** | Heroes regenerate HP/Energy -10% slower (Base rate only). |
| **Despair** | Retiring a Hero grants **0 Recruit Cards**. |

### 2.13. Area Projects
Projects are major undertakings found in Areas. Completing them provides permanent global bonuses.

**Medieval / Civil**
| Project Name | Global Bonus |
| :--- | :--- |
| **Warehouse** | +5 Global Inventory Slots. |
| **Silo** | +50 Global Max Stack. |
| **Barracks** | +5% XP for [Combat] Skills. |
| **Library** | +5% XP for [Science] Skills. |
| **Temple** | +5% XP for [Social] Skills. |
| **Market** | +10% Gold Gain. |
| **Smithy** | -5% Tick Time for [Crafting] Tasks. |
| **Kitchen** | -5% Tick Time for [Culinary] Tasks. |
| **Stables** | Reduces Explore Card duration by 10%. |
| **Watchtower** | Reduces Invasion Threat gain by 10%. |
| **Wall** | Heroes take -5% Damage. |
| **Hospital** | +10% HP Regeneration Rate. |
| **Tavern** | +10% Energy Regeneration Rate. |
| **Guild Hall** | +1 Max Active Cards. |
| **Mine Shaft** | -5% Tick Time for [Industry] Tasks. |
| **Quarry** | +5% Output Chance for [Industry] Tasks. |
| **Farm** | +5% Output Chance for [Culinary] Tasks. |
| **Fishery** | -5% Tick Time for [Nautical] Tasks. |

**Magic / Occult**
| Project Name | Global Bonus |
| :--- | :--- |
| **Mana Crystal** | +5% XP for [Magic] Skill. |
| **Blood Altar** | +5% XP for [Occult] Tasks. |
| **Fey Grove** | -5% Tick Time for [Nature] Tasks. |
| **Spider Ritual** | +5% Output Chance for [Crime] Tasks. |
| **Summoning Circle** | +5% Output Chance for [Occult] Tasks. |
| **Ley Line Node** | -5% Tick Time for [Magic] Tasks. |
| **Enchanted Spring** | +20% HP Regeneration Rate. |
| **Scrying Pool** | +10% Chance to reveal Biome on Explore Cards. |
| **Golem Workshop** | +5% Output Chance for [Industry] Tasks. |
| **Arcane Tower** | +1 Max Active Cards. |
| **Portal** | Reduces Explore Card duration by 20%. |
| **Void Rift** | +2% Global Output Chance (All Tasks). |
| **Necropolis** | +10% XP for [Occult], -5% HP Regen. |
| **Alchemist's Lab** | +10% Potion Duration/Effectiveness. |

**Steampunk / Tech**
| Project Name | Global Bonus |
| :--- | :--- |
| **Steam Engine** | -5% Tick Time for [Industry] Tasks. |
| **Lightning Rod** | +10% Energy Regeneration Rate. |
| **Automaton Factory** | +5% Output Chance for [Crafting] Tasks. |
| **Telescope** | +5% XP for [Nautical] and [Science]. |
| **Printing Press** | +2% XP for **ALL** Skills. |
| **Airship Dock** | Reduces Explore Card duration by 15%. |
| **Gearworks** | -5% Tick Time for [Crafting] Tasks. |
| **Boiler Room** | +5% XP for [Industry] Tasks. |

**RPG Items / Artifacts**
| Project Name | Global Bonus |
| :--- | :--- |
| **Bag of Holding** | +20 Global Inventory Slots. |
| **Chest of Plenty** | +200 Global Max Stack. |
| **Ancient Tome** | +5% XP for [Magic] Skill. |
| **Philosopher's Stone** | +10% Output Chance for [Science] Tasks. |
| **Holy Grail** | +50% HP Regeneration Rate. |
| **Dragon Egg** | +5% Damage for all Heroes. |
| **Phoenix Feather** | Reduces Wounded duration by 20%. |
| **Midas Touch** | +20% Gold Gain. |
| **Skeleton Key** | +5% Output Chance for [Crime] Tasks. |
| **Map of the World** | Reduces Explore Card duration by 10%. |

### 2.14. Resources & Items
A list of basic items available in the game.

**Tiered Metals (10)**
| Tier | Ore Item | Bar Item |
| :--- | :--- | :--- |
| **1** | **Copper Ore** | **Copper Bar** |
| **2** | **Iron Ore** | **Iron Bar** |
| **3** | **Mithril Ore** | **Mithril Bar** |
| **4** | **Adamantine Ore** | **Adamantine Bar** |
| **5** | **Abyssal Ore** | **Abyssal Bar** |

**Raw Materials (10)**
*   **Wood** (Generic)
*   **Stone** (Generic)
*   **Coal** (Fuel)
*   **Clay**
*   **Sand**
*   **Leather**
*   **Wool**
*   **Cotton**
*   **Herb**
*   **Berry**

**Processed Materials (5)**
*   **Plank** (From Wood)
*   **Brick** (From Clay/Stone)
*   **Glass** (From Sand)
*   **Cloth** (From Wool/Cotton)
*   **Rope** (From Fiber)

**Consumables (10)**
*   **Water** (Energy)
*   **Milk** (Energy)
*   **Ale** (Energy)
*   **Wine** (Energy)
*   **Bread** (HP)
*   **Cooked Meat** (HP)
*   **Cooked Fish** (HP)
*   **Stew** (HP)
*   **Health Potion** (HP)
*   **Energy Potion** (Energy)

**Monster Drops (10)**
*   **Bone**
*   **Slime**
*   **Spider Silk**
*   **Bat Wing**
*   **Wolf Pelt**
*   **Goblin Ear**
*   **Dragon Scale**
*   **Ectoplasm**
*   **Magic Dust**
*   **Soul Shard**

**Special / Currency (5)**
*   **Ancient Coin**
*   **Rune Stone**
*   **Gem** (Generic)
*   **Pearl**
*   **Artifact Fragment**

### 2.15. Enemies
Enemies appear in Combat Cards and Invasions. They are linked to Biomes and Tiers.

**1. Plains**
*   **Tier 1:** Giant Rat
*   **Tier 2:** Wolf
*   **Tier 3:** Wild Boar
*   **Tier 4:** Lion
*   **Tier 5:** Behemoth

**2. Forest**
*   **Tier 1:** Spider
*   **Tier 2:** Brown Bear
*   **Tier 3:** Treant
*   **Tier 4:** Giant Spider
*   **Tier 5:** Ancient Guardian

**3. Mountain**
*   **Tier 1:** Bat
*   **Tier 2:** Rock Golem
*   **Tier 3:** Harpy
*   **Tier 4:** Wyvern
*   **Tier 5:** Mountain Giant

**4. Swamp**
*   **Tier 1:** Slime
*   **Tier 2:** Crocodile
*   **Tier 3:** Hag
*   **Tier 4:** Hydra
*   **Tier 5:** Swamp Dragon

**5. Cave**
*   **Tier 1:** Goblin
*   **Tier 2:** Orc
*   **Tier 3:** Troll
*   **Tier 4:** Basilisk
*   **Tier 5:** Balrog

## 3. Technical Architecture (Current)
*   **State Management:** `GameState` class (Singleton) manages all data.
*   **Loop:** `GameLoop` handles the tick cycle (delta time).
*   **UI:** `ViewManager` handles DOM updates and event listeners.
*   **Persistence:** `localStorage` saves inventory, heroes, and progress.
*   **Data Driven & Extensible:** The architecture is designed for progressive development.
    *   **Registries:** Classes, Traits, Attributes, Skills, Tasks, Areas, Items, and Tools are defined in easily updatable libraries/registries.
    *   **Flexibility:** New content can be added or modified frequently without requiring major code refactors.

## 4. Future Goals / Missing Features

*   **Combat Depth:** Currently simple task-based combat.
*   **Equipment:** Heroes currently don't equip items (tools are assigned to tasks, not heroes).
*   **Visuals:** Currently using emoji sprites. Simple sprites will be implemented later in development.
