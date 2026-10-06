# Combat Mechanics Concept Document: The 7-Stat Auto-Battler

This document defines the core mechanical engine for the combat auto-battler and derives the game's **Combat Skills** directly from these mechanical levers, ensuring form follows function.

---

## 1. The Core Combat Engine (The 7 Stats)

The auto-battler is governed by a tightly scoped set of 7 core stats. This keeps the math clean, the UI readable, and the gear choices impactful.

### Defensive Mechanics
1. **HP (Health Pool):** The universal vital stat. The raw amount of punishment a hero can endure before being ejected from the loop.
2. **Armor (Damage Reduction):** Flat mitigation. Every successful hit taken is reduced by this integer. Essential for surviving rapid, low-damage attacks.
3. **Block (Avoidance):** Percentage chance to completely nullify/dodge an incoming attack. Essential for surviving slow, massive hits.

### Offensive Mechanics
4. **Damage (Attack Power):** The raw base number used to reduce the enemy's HP.
5. **Accuracy (Hit Chance):** The direct counter to Block. Subtracts from the enemy's chance to avoid the attack, ensuring consistent damage delivery.
6. **Crit (Spike Damage):** A percentage chance to multiply the Damage of a successful hit. Essential for breaking through high-Armor targets.

### Neutral Mechanics
7. **Speed (Action Rate):** Governs the frequency of attacks. Determines how fast the character's action timer fills up during the battle sequence.

---

## 2. Derivation of Stats & Combat Skills

To calculate the 7 core stats for the auto-battler, the game relies on a combination of **Equipment** (what the hero is wearing) and **Combat Skills** (the hero's proficiency). 

There are **4 Core Combat Skills**: `Melee`, `Ranged`, `Magic`, and `Defense`. The combat style a hero uses during a fight is entirely determined by the type of weapon they have equipped.

### The Stat Derivation Matrix
The 7 core combat stats are calculated as follows:

*   **HP:** Derived from **[Hero Base Level]** + **[Defense Skill Level]**. 
    *   *The universal vital stat, scaled primarily by the hero's overall experience and fortitude.*
*   **Armor:** Derived entirely from **[Equipment]** (Helmet, Chest, Boots).
    *   *Defense Skill level may provide a small percentage multiplier to equipped armor, but base armor comes from gear.*
*   **Block:** Derived from **[Equipment Base]** (e.g., Shields, Trinkets) + **[Defense Skill Level]**.
    *   *A hero needs protective gear to block effectively, but a high Defense skill increases the success rate.*
*   **Damage:** Derived from **[Weapon Base Power]** + **[Relevant Combat Skill Level]**.
    *   *If holding a Sword, Damage scales off the Melee skill. If holding a Bow, it scales off Ranged.*
*   **Accuracy:** Derived mostly from **[Relevant Combat Skill Level]** + small **[Weapon Bonus]**.
    *   *A hero's proficiency with their equipped weapon type determines their ability to land hits against dodging enemies.*
*   **Speed:** Derived from **[Weapon Base Speed]**.
    *   *A dagger attacks fast; a heavy hammer attacks slowly. This is largely a fixed value to give weapons distinct identities.*
*   **Crit:** Derived from **[Equipment/Buffs]**.
    *   *Critical hit chance is not tied to a specific core skill, but is instead provided by specialized gear or preparation buffs from the Area Deck.*

### The 4 Combat Skills

1. **Melee:** Proficiency in close-quarters combat. Equipping a Melee weapon (Sword, Axe, Mace) automatically switches the hero to the Melee style, causing Damage and Accuracy to scale off this skill.
2. **Ranged:** Proficiency in physical distance combat. Equipping a Ranged weapon (Bow, Crossbow) switches the hero to the Ranged style, scaling Damage and Accuracy from this skill.
3. **Magic:** Proficiency in spellcasting and elemental combat. Equipping a Magic weapon (Staff, Wand, Tome) switches the hero to the Magic style, scaling Damage and Accuracy from this skill.
4. **Defense:** The universal survivability skill. Regardless of the weapon equipped, this skill governs the hero's base HP pool and their proficiency at utilizing Armor and Block chances.

---

## 3. Synergy with the 11 Loop Skills (Preparation)

With the combat engine strictly defined by these 7 stats, we can now map the **11 Non-Combat Skills** to provide buffs or preparation items that directly feed into this ecosystem.

* **Forge:** Crafts heavy plate to boost **Armor** and heavy weapons to boost **Damage** (Fuels *Power*).
* **Crime:** Provides stealth tools to boost **Block** and dirty tricks to boost **Crit** (Fuels *Agility*).
* **Science:** Crafts precise scopes to boost **Accuracy** and engineered boots to boost **Speed** (Fuels *Technique*).
* **Cooking:** Crafts high-tier foods that provide massive temporary **HP** buffers at the start of a fight.
* **Alchemy:** Crafts potions that temporarily double **Speed** or guarantee the next hit is a **Crit**.
* **Occult:** Casts pre-combat hexes that strip away enemy **Armor** or **Block** before the fight begins.
