# Concept Plan: Status Effects & Card Effects

This document outlines the conceptual design for two core systems: **Status Effects** (buffs/debuffs on entities) and **Card Effects** (modifiers on loop Cards). We are exploring how these systems function mechanically, and whether they should be unified or kept as distinct parallel pipelines.

## 1. System Architecture: Unified Math, Distinct Targets

While these two systems modify different aspects of the game, they share the same fundamental goal: altering base numbers dynamically. 

**Recommendation:** They should share a **Unified Modifier Engine** under the hood to calculate final values (e.g., `(Base + Flat Buffs) * Multipliers`), but their **Attachment Points** and **Lifecycles** should be strictly separated. 

*   **Status Effects** attach to **Entities** (Heroes, Enemies) and run on a temporal lifecycle (duration, combat cycles, or until cleansed).
*   **Card Effects** attach to **Cards** in the loop and run on a structural lifecycle (adjacency, charges, or permanent passives).

---

## 2. Status Effects (Entity-Bound)

Status effects govern the physical and magical states of the combatants. Based on the 7-Stat combat engine, these effects temporarily manipulate a hero or enemy's capabilities.

**Anatomy of a Status Effect:**
*   **Target:** Hero or Enemy object.
*   **Duration:** Time-based (e.g., 10 seconds), Turn-based (e.g., next 3 attacks), or Permanent (until cleansed).
*   **Stacking Rules:** Does it stack intensity (Poison x3) or refresh duration?
*   **Effect Types:**
    *   **Stat Modifiers:** Altering the core 7 stats (e.g., *Haste*: +50% Speed; *Sunder*: -10 Armor).
    *   **Over-Time (DoT/HoT):** Tick-based damage or healing (e.g., *Poison*, *Regeneration*).
    *   **Behavioral:** Preventing action (*Stunned*), completely nullifying next hit (*Barrier*).
*   **Sources:** Consuming food/potions (Cooking/Alchemy), enemy attacks, Occult global hexes, or stepping on a Hazard card.
*   **Cleansers:** Curative broths and potions.

---

## 3. Card Effects (Card-Bound)

Card effects govern the efficiency, output, and behavior of the auto-battler loop itself. They manipulate the economy, task durations, and loot tables.

**Anatomy of a Card Effect:**
*   **Target:** A specific Card instance on the playmat (Gathering, Processing, Consumption, Combat).
*   **Duration:** Passive (always on if adjacent/equipped), Charge-based (expires after N uses), or One-Shot (mutates the card and vanishes).
*   **Effect Types:**
    *   **Yield Multipliers:** Doubling ore drops (Labor tool).
    *   **Task Haste:** Reducing the cycle time of a card by 15% (Science adjacency).
    *   **Cost Reduction/Preservation:** 30% chance to not consume ingredients (Nature/Forge).
    *   **Loot Table Rollovers:** Swapping the default drop table for a rare one (Crime/Aquatic).
    *   **Transmutation:** Changing the identity of the card itself (Alchemy acid dissolving a rock hazard).
*   **Sources:** Tools equipped by the hero, adjacent Outpost Stations, or direct Mutator action cards.

---

## 4. The Crossover Points (How they Interact)

While distinct, these systems will inevitably intertwine to create deep gameplay synergies.

1.  **Cards applying Statuses (The Hazard Model):** A Poison Swamp card doesn't fight the hero in combat; instead, it applies a *Poison* Status Effect to the hero as they walk over it.
2.  **Statuses affecting Cards (The Exhaustion Model):** A hero carrying an *Exhausted* Status Effect (from a brutal combat encounter) might suffer a -20% Speed penalty. Since the hero's Speed is what fills the progress bar on Gathering/Processing cards, the Status Effect directly impacts the Card's output rate.
3.  **Cross-Area Telemetry (Social/Occult):** A Guild Banner card in Area 1 applies an *Empowered* Status Effect to the Hero in Area 2. Here, a Card Effect acts as a global broadcaster for a Status Effect.

---

## 5. Finalized Design Decisions

Based on our discussions, the following constraints and behaviors have been decided:

1.  **UI for Card Modifiers ("Tokens"):** Cards will display small indicator icons ("Tokens") directly on their face to show they have been modified (e.g., a Haste token or a Yield token). This provides immediate visual feedback without overly cluttering the playmat, and players can likely inspect the card for deeper details.
2.  **Status Effect Ticking & Duration:** While some real-time ticking might exist for specific combat DoTs (for readability), the overarching philosophy is that **time is measured in draws and loops**. Most effects (buffs/debuffs) will not have real-time durations; their lifespans are tied to how many cards are drawn or how many loops are completed.
3.  **Negative Card Effects:** The system **will support negative Card Effects**. Loop Cards can be debuffed directly (e.g., a cursed area increasing task processing time or reducing resource yield). This means negative events are not strictly limited to Hero Status Effects, providing richer environmental and strategic challenges.

---

## 6. Flow of Play & Loop Integration

When a Hero works through a deck (the Area Loop), they encounter different types of cards that interact with these two systems in unique ways:

### Scenario A: The Hero encounters a Consumable (Status Effect trigger)
*   **The Action:** The Hero draws a card representing a consumable item (e.g., a *Strength Potion* or *Cooked Meal*), or perhaps a camp/rest stop.
*   **The Resolution:** The card is immediately consumed or resolved. The engine applies a **Status Effect** (e.g., +20% Damage) directly to the Hero.
*   **The Duration:** Because it's on the Hero, this buff persists across subsequent cards. If the Hero enters combat two cards later, the extra damage is applied. The expiration can be tied to real-time (e.g., 60 seconds) or charge-based (e.g., next 3 attacks).

### Scenario B: The Hero encounters a Mutator (Card Effect trigger)
*   **The Action:** The Hero draws a card that acts as an environmental trigger or preparation step (e.g., *Chum the Waters* or *Occult Ritual*).
*   **The Resolution:** Instead of buffing the Hero, this card broadcasts a **Card Effect** into the deck. It might attach a "Tokens" modifier (e.g., Yield x2) to specific cards.
*   **Targeting Rules for Deck Modifiers:**
    *   **Future Draws:** The effect applies to the *next X instances* of a specific card type drawn (e.g., the next 3 Fishing tasks yield double).
    *   **Area-Wide (Current Cycle):** The effect modifies all cards of a certain type currently on the playmat for the remainder of the loop cycle.
    *   **Adjacency:** If the card stays on the board (like an Outpost), it constantly applies its modifier to the cards immediately to its left and right.

### The Philosophical Difference
*   **Status Effects travel *with the Hero***. They are excellent for preparing for combat or surviving hazards.
*   **Card Effects alter the *environment***. They are excellent for manipulating the economy, optimizing resource yields, or changing the pacing of the loop itself.

---

## 7. Advanced Macro Concepts (Finalized)

Based on our discussions, we have locked in the following macro-level behaviors:

### Modifiers (Charge & Cycle System)
Card effects and mutators operate on a **Charge + Single Cycle** system. For example, playing "Chum the Waters" applies a "Trawler" token to the next three Fishing tasks drawn. However, this effect is strictly bound to the current cycle—if the deck resets before all charges are used, the remaining charges are cleared.

### Tool Tiering & Gating
Equipment (like a Pickaxe) does not simply apply a passive buff. Instead, it grants a **Tier Effect** (e.g., *Mining 3*). 
*   Tasks have required tiers (e.g., a specific ore might require *Mining 2*).
*   If the Hero's equipped tier is greater than or equal to the task's requirement (*Mining 3* >= *Mining 2*), they succeed. If it is lower, the task fails.
*   These equipment effects are applied at the beginning of the loop and carry through the entire cycle.

### Buff Combination & Intensity
Status effects and buffs **combine additively to increase intensity**. If a Hero drinks four minor `+Damage` potions, they don't overwrite each other or extend a real-time clock. Instead, they combine into a single `+Damage 4` buff. This creates a resource-intensive economy where players can stockpile potions to brute-force a difficult loop or boss.

### Failure State (Time as Punishment)
When a task fails (e.g., lacking the required tool tier), the penalty is a **time delay**. The Hero still has to "work" the card and wait through its entire cycle time, but they receive zero outputs and consume no inputs. This reinforces time as the primary economic currency and punishment.

### Trigger Timing (Working the Card)
Modifiers and consumables only trigger when the Hero reaches them and **works the card** in the Active slot. For example, a "Trawler" mutator card must be worked first to grant the "Yield x2" effect; only then will it apply to the subsequent Fishing cards drawn later in the loop.

### Status Effect Cleansing (Environmental & Consumable)
Debuffs can be cleansed in two ways:
*   **Consumables:** The player can slot curative items (like an Antidote potion) in the deck immediately following a dangerous encounter (like a Poison Spider) to wipe the effect before the rest of the loop.
*   **Environmental Cards:** Reusable cards like a Healing Spring can exist in the loop to wash away accumulated debuffs.

### Mutator Targeting (Tags & Traits)
Card Effects (Mutators) target future draws using a **Tag/Trait system** rather than targeting specific Card IDs or broad categories. A Mutator might apply its effect to any upcoming card with the `[Aquatic]` tag, creating flexible, systemic synergies.
**Specialized Cards:** This system applies with absolute consistency to special interface Cards (like Shops or Guild Banners). However, the tags must match. A "Fish Market" is a `[Social]` task, not a `[Fishing]` task. A Fishing Mutator would be wasted on it, but a Social Mutator (Yield x2) would literally double the items purchased from the shop.

### Hero Buff Capacity (Unlimited)
There is **no hard cap** on the number of distinct Status Effects a Hero can carry at once. A Hero can theoretically stack Poison, Bleed, +Damage, +Armor, and Haste simultaneously. The UI will handle this by scrolling or wrapping the modifier tokens underneath or beside the Hero portrait.

### Engine Parity (Enemies & Statuses)
The Status Effect engine features **Absolute Parity**. Enemies exist in the same systemic space as Heroes—they can be poisoned, stunned, armor-broken, and even buffed by other enemy units. This ensures combat mechanics are universally consistent and allows for deep offensive debuffing strategies (e.g., the Occult skill).

### Loop Persistence & Neutral Ground
Status Effects and Card Effects are strictly bound to the **Active Area Deployment**. If a Hero is recalled to the Guild Hall or finishes a loop and returns home, all buffs, debuffs, and mutators are wiped clean. The Guild Hall serves as a universally safe, neutral ground.

### Negative Synergy (Cross-Pollination)
Status Effects are not strictly limited to combat mechanics. A debuff applied in combat (e.g., *Exhausted*) can negatively synergize with a Card Effect or Card (e.g., doubling the time required to complete a *Fishing* task). This forces the player to consider economy-breaking debuffs and actively cleanse them to maintain loop efficiency.

### Visual Anchoring (Hero Info Panel)
To prevent combat screens and playmats from becoming unreadable, Status Effects applied to the Hero will live exclusively inside the existing **Hero Info Panel**. Players will check this panel to monitor their buff/debuff stacks.

### Global Area Modifiers (Locked Anchor Cards)
Areas do not have "invisible" global penalties. Instead, an Area applies its unique modifiers by placing a **locked Mutator Card at the very start of the deck**. The Hero works this card at the beginning of the loop, broadcasting the Area's effect across the deck using the exact same Mutator engine as everything else, keeping the mechanical language unified.

### Offensive Debuffing (Preparation Cards)
Non-combat skills like Occult apply debuffs through loop-based preparation. The Occult skill will add Action Cards (e.g., "Cast Hex") to the deck. When the Hero works this card, it acts as a Mutator targeting the *next Enemy card drawn*, ensuring that debuffing requires foresight and deck-building rather than just passive RNG.

### Token Stacking (Multipliers & Infinite Scaling)
If a specific card is hit by multiple Mutators of the same type, those **Tokens stack**. For example, if two separate "Yield x2" mutators hit the same Fishing Card, they combine. There is **no hard limit** to token stacking. If a player successfully sequences their deck to drop 50 mutators on a single Card, the engine will process it. The UI will gracefully handle this visual overflow by condensing identical tokens into numeric badges (e.g., a single token with a `x50` badge).

### Diverse Synergies
If a card is targeted by completely different families of Mutators (e.g., a "Yield x2" token and a "Convert Output to Gold" token), they **stack cleanly together**. The Card will yield twice the normal output, and *all* of it will be converted into gold. This lack of restriction allows players to build wild, highly-customized economic supply chains.

### Token Visibility (Anticipation)
Tokens are visible on cards even when they are **face-down in the Upcoming queue**. Because time and loop progression are core mechanics, allowing the player to see a Mutator applied to a future draw gives them the tactical opportunity to plan their equipping or consumable usage ahead of time.

### Status Effect Immunity (Hard Counters)
The system supports **Absolute Immunity**. A Hero can equip specific gear (e.g., a "Poison Ring") that completely nullifies a specific Status Effect. This introduces hard-counter strategies where players must swap loadouts to overcome specific, otherwise-fatal enemy encounters.

### Loop Reset & Wiping
At the end of a cycle, when the deck shuffles or resets for the next loop, **all Mutator Tokens are wiped clean** from the cards. The new cycle is a fresh start. Players must re-work their Mutator setup/preparation cards every cycle to rebuild their combos, cementing the importance of the single-cycle charge system.

### Mutator Conflicts (Order of Operations)
If a single card is targeted by highly contradictory Mutators (e.g., "Yield x2" and a cursed "Yield x0"), the engine does not prioritize positive or negative effects arbitrarily. They combine mathematically based on a standard order of operations.

### Consumable Pacing (Economic Scarcity)
Unlike some games with strict cooldowns or "one potion per fight" rules, a Hero can ingest multiple consumables (food, potions, etc.) in a single Card. The pacing mechanism is strictly **Economic Scarcity**. Consumables require significant time and resources to gather and craft at the Guild Hall, meaning a player who spam-drinks 10 potions to beat a boss will quickly run out of stock and ruin the economic efficiency of their overall loop.

### Status Effect Math (Flat vs Percentage)
The math applied by Status Effects depends heavily on the target stat:
*   **Combat Stats** (e.g., Damage, Armor, HP) receive **Flat Integer** bonuses. This keeps the combat math extremely readable and prevents late-game exponential runaway on raw damage.
*   **Utility/Economy Stats** (e.g., Bonus XP, Task Haste) receive **Percentage** modifiers, allowing them to scale cleanly alongside larger loop yields.

---

## 8. Danger & Economy Checks

### Hazard Presentation (No Burst Damage)
To ensure the game remains readable in an idle context, hazards (even physical ones like Spike Traps) do not deal instant "burst" damage. Instead, they apply a **Damage-over-Time (DoT)** Status Effect. This ensures the player has ample visual opportunity to see the debuff active on their Hero and understand what is draining their health.

### Inventory Overflow (Failure State)
If the player successfully builds an exponential combo (e.g., Yield x4) but their Bank does not have the capacity to store the outputs, the Card triggers a **Failure State**. The Hero will spend the full cycle time working the Card, but no inputs will be consumed, and no outputs will be generated. A clear UI warning system will be necessary to highlight these supply chain bottlenecks.

### Fleeing & Progression Blocks
A player can command their Hero to flee from an upcoming hazard or combat encounter at any time. However, fleeing **resets the current loop cycle**. This acts as a firm gear-check: if a player cannot overcome a hazard placed halfway through a deck, they will never be able to access the lucrative Cards sitting behind it until they adjust their gear or consumables to survive.

### Mid-Loop Abandonment
If a player forcibly closes the game or logs off while a Hero is mid-loop in an Active Area, the loop **resets completely**. When the player logs back in, the Hero will spawn safely at the Guild Hall, and all progress/yields from that incomplete cycle will be lost. This prevents players from force-quitting to dodge a fatal combat encounter they miscalculated.

---

## 9. Area Blueprint (Hybrid Deck Construction)

### The Blueprint Layout
Deck capacity and sequence are not just arbitrary numbers; they are defined by an **Area Blueprint**. Each Area has a hardcoded structural layout of slots. For example, a beginner Area might structurally be: `[Blank] -> [Blank] -> [Locked Combat] -> [Blank]`. 
*   **Forced Cards:** The Area locks specific cards (hazards, combat, global modifiers) into specific anchor points within this blueprint.
*   **Area Modifiers:** Some blueprints force an "Area Modifier" into Slot 1. This anchor card is incredibly powerful: it can cast a global Mutator onto *every subsequent card* in the deck, or apply a permanent Status Effect to the Hero for the duration of the cycle.
*   **Free Slots (Blanks):** The player fills the `[Blank]` slots with their own gathered cards (mining Cards, mutators, outposts) to build their economic engine around the Area's forced challenges.

### Fixed Sequence (No Shuffling)
When a deck resets for a new cycle, the cards are **never randomized**. They draw in the exact sequential order defined by the blueprint. This deterministic order is absolutely critical for the Mutator system, as it allows players to guarantee that their preparation cards will hit the correct subsequent Cards.

### Gear Locking (Full Cycle)
A Hero's equipment (weapons, armor, tools) is **locked for the entirety of the loop cycle**. A player cannot hot-swap gear mid-loop to save a failing task or suddenly counter a boss. Loadouts can only be changed when the deck resets for a new cycle, or when the Hero is resting at the Guild Hall. This heavily reinforces the strategic "preparation" phase of the game.

### Permanence (Hazards vs Bosses)
As the Hero progresses, they can alter the blueprint:
*   **Hazards:** Can be permanently cleared or "subdued". Once a Hero overcomes a specific hazard in the blueprint, it is removed from future loops, making the area a safer, faster farming zone.
*   **Bosses:** Are immutable. Boss cards at the end of a blueprint cannot be permanently removed; they will spawn every single loop cycle forever, acting as a constant gear-tax and ensuring an Area never becomes entirely trivial.

### Status Effect Sorting
Inside the Hero Info Panel, active Status Effects will be **grouped by type**. All positive buffs (green) are clustered together, and all negative debuffs (red) are clustered separately. This allows a player to parse the macro state of their Hero at a glance.

---

## 10. Mutator Tradeoffs & Risk Management

### The Roguelike Puzzle (Managing Downsides)
While Status Effects (Hero buffs) are pure power boosts, **Card Mutators fundamentally carry Tradeoffs**. A Mutator that drastically increases a card's output will also carry a proportionate downside, turning deck construction into a roguelike puzzle where the player must actively mitigate penalties.
For example, applying a "Trawler" mutator to a Fishing Card might double the fish output, but simultaneously double the Bait consumed or double the time required to complete the task.

### Mitigating the Risk
The gameplay loop revolves around organizing the deck and the Hero's loadout so these downsides are minimized. A player might intentionally stack massive Time Penalty mutators on a Card, but offset that penalty by having the Hero drink a massive Haste potion (Status Effect) right before reaching it.

### Deterministic Tradeoffs (No RNG)
The "roguelike" element of deck building stems from arrangement and resource management, not random generation. Mutators have **Fixed/Deterministic** downsides. For example, a specific Mutator card will *always* grant Yield x2 and Bait Cost x2. The puzzle is purely how the player sequences the deck to afford and survive those fixed penalties.

### Penalty of Failure (Wasted Tokens)
If a Mutator drastically increases a card's resource cost (e.g., requires 4 Bait), and the Hero reaches the card with only 2 Bait, the task triggers a Failure State. Crucially, **the Mutator Token is still consumed and wasted**. The player receives no output, loses time, and loses the Mutator. This harshly punishes greedy combos that lack the supply chain to support them.

### Hard Floors (No Absolute Mitigation)
While players can use Status Effects to mitigate Mutator downsides (e.g., using Haste to counter a Time Penalty), there is a **Hard Floor** to prevent breaking the engine. Tasks can never take less than a minimum threshold (e.g., 1 second), and resource costs can never drop below 1 unit. Absolute zero mitigation is not permitted.

### Purifying Cards
If a Card is afflicted with a highly negative Mutator (e.g., an enemy cursed an upcoming Fishing Card with "Yield x0"), the player can cleanse the card itself. By applying a specific "Purify" mutator to that Card, all negative tokens are stripped from it, allowing the player to salvage their deck structure without having to flee and reset.

---

## 11. Combat Rules & Math Resolution

### Two-Bucket Math Formula
When a card is targeted by multiple mutators of different types (e.g., flat bonuses and multipliers), the engine uses a **Two-Bucket** system to resolve the math cleanly:
1.  **Additive Bucket:** All flat bonuses are summed together (e.g., +2 Yield and +3 Yield = 5).
2.  **Multiplier Bucket:** All multipliers are summed together (e.g., three x2 Mutators = x6 multiplier).
3.  **Resolution:** The final result is simply `Additive Bucket * Multiplier Bucket` (e.g., 5 * 6 = 30). This ensures the math remains completely predictable regardless of the chronological order the tokens were applied.

### Boss Engagement (No Bypassing)
Bosses act as ultimate gear-checks within an Area Blueprint. They are **immutable and cannot be bypassed**. A player cannot pay a toll to skip them, nor can they use stealth mutators to sneak past them. If a player cannot defeat the boss, they must flee (resetting the cycle) and return with better preparation.

### Infinite Combat (Softlocking)
There are no arbitrary "Time Limits" or "Enrage Timers" in combat. If a player builds a heavy armor turtle deck that cannot output enough damage to kill the Boss, but the Boss cannot kill the Hero, the fight will go on forever. The player has effectively soft-locked themselves and must recognize the stalemate, manually flee to reset the cycle, and return with a more aggressive build.

### Simultaneous Death (Tick Resolution)
Because the combat engine and Status Effects run in real-time, it is possible for an enemy's DoT (e.g., Poison) to trigger its fatal tick at the exact millisecond the Boss lands a fatal blow on the Hero. In this event, **Simultaneous Death** occurs. The Hero dies, causing the cycle to end in failure, but the Boss is also considered defeated, and its specific Boss Loot is still awarded to the player as a silver lining.

### On-Hit Procs (Status Effects)
While Status Effects can be applied via Consumables or Action Cards, they can also be triggered dynamically in combat. Specific weapons or enemy types possess **Inherent Proc Chances** (e.g., a "Poison Dagger" has a 10% chance to apply Poison on a successful hit). This allows for gear-driven debuff builds to be viable alongside preparation-heavy deck builds.

### Combat Accessibility (No Tier Checks)
Unlike gathering or processing tasks, **combat Cards do not have Skill Tier checks**. A Hero will never "fail to engage" an enemy because they lack a specific tool or tier (e.g., 'Magic 2'). The player can always initiate the fight; whether or not the Hero survives depends entirely on the raw stats provided by their gear, consumables, and Status Effects.

### Debuff Mechanics (No Pauses)
To maintain the flow of time and the economy, Status Effects like "Stun" or "Frozen" do not pause the loop timer or physically freeze the Hero. Instead, they apply a mechanical penalty during execution. For example, being Stunned might grant a 50% chance for the Hero to completely miss their attacks during that Card, effectively wasting the cycle without breaking the game's clock.

---

## 12. UI Feedback & Tooltips

### Tooltip Tracing
When a player hovers over a Mutator Token on a card, the tooltip will display both the **Mathematical Effect** and the **Source**. (e.g., `+2 Yield from 'Trawler'`). This is crucial for allowing players to reverse-engineer and trace exactly where their massive combo stacks are coming from.

### Visualizing Failure States
If a card triggers a Failure State (due to lack of resources/tier), a bold **"Failed!" stamp** will overlay the card art, and the progress bar will turn a dull grey. Furthermore, the game's **Area Overview Mode** will highlight these failed Cards across the entire layout, allowing the player to diagnose supply-chain bottlenecks at a glance.

### Status Effect VFX & SFX
To prevent the game from becoming a noisy, annoying cacophony during idle play, Damage-over-Time effects (like Poison) drain HP silently with no continuous flashing or ticking sounds. However, the exact moment a Status Effect is **applied** to the Hero or Enemy, a distinct Sound Effect (SFX) will play to draw the player's attention to the new affliction.

---

## 13. JSON Data Schemas

To ensure the engine remains flexible, heavily data-driven JSON schemas will be used rather than hardcoded logic.

### Mutator Targeting Schema
Mutators use a `target_tags` array to determine which upcoming cards they apply to. This allows infinite new synergies without writing new C# or JS logic.
```json
{
  "mutator_id": "trawler_net",
  "name": "Trawler",
  "target_tags": ["Fishing", "Aquatic"],
  "additive_yield": 0,
  "multiplier_yield": 2,
  "additive_cost": 0,
  "multiplier_cost": 2
}
```

### Status Effect UI Schema
Status Effects explicitly declare if they are buffs or debuffs to guarantee bulletproof UI sorting in the Hero Info panel.
```json
{
  "status_id": "haste_potion_buff",
  "name": "Haste",
  "is_buff": true,
  "duration_cards": 5,
  "additive_time": -2
}
```

### Absolute Immunity Schema
Gear enforces "Absolute Immunity" by utilizing an `immune_to` array. The engine checks this array before allowing any Status Effect to apply to the Hero.
```json
{
  "item_id": "ring_of_purity",
  "name": "Poison Ring",
  "slot": "Accessory",
  "immune_to": ["poison_dot", "venom_slow"]
}
```

---

## 14. Initial Effect Catalog (Terminology & Concepts)

To ensure interoperability, we use the strict lexicon defined in §16. Below is
the initial catalog of effects to implement first, written in final terms.

### Status Effects: Buffs (Green)
*   **Haste:** "Reduces *Work Time* by 20%. Minimum 1 second." (Percentage reduction).
*   **Sharpened:** "Grants +5 *Base Damage* to the Hero's next 3 Attacks." (Charge-based flat additive).
*   **Regeneration:** "*End of Work*: restores 2 HP." (Trigger-based flat recovery).
*   **Venom Coating:** "*On Hit*: 20% chance to apply Poisoned to the target." (Proc enabler).

### Status Effects: Debuffs (Red)
*   **Poisoned:** "Deals 1 Damage per real-time second. *Ignores Armor*." (DoT, True Damage).
*   **Stunned:** "Hero has a 50% chance to *Miss* on their next Attack." (Charge-based mechanical penalty).
*   **Exhausted:** "Hero cannot work `[Gathering]` cards. The card automatically *Fails*." (Hard lockout — deferred, see §15.9).

### Card Mutators: Tokens
*   **Abundance Token:** "Target `[Gathering]` card. *Base Yield* +2. *Input Cost* +1." (Additive tradeoff).
*   **Trawler Token:** "Target `[Aquatic]` card. *Yield Multiplier* x2. *Time Cost* x2." (Multiplier tradeoff).
*   **Hex Token:** "Target `[Combat]` Card. Applies *Poisoned* to the enemy On Draw." (Combat axis — §15.13).
*   ~~**Midas Token:**~~ "Converts all *Yield* into Gold." **Cut from v1** — see §15.8.
*   **Cursed Token:** "Target `[Any]` card. *Yield Multiplier* -2." (Negative multiplier, requires a matching counter).
*   **Dam Token:** "Target `[Any]` card. Removes the *Rapid River* token." (Targeted counter — see §15.6).

---

## 15. Implementation Prep — Resolved Decisions (2026-07-19)

Locked during the pre-implementation design pass. **Where this section
conflicts with anything above, this section wins** — superseded lines are
called out explicitly.

### 15.1 Reconciliation with already-shipped code

This plan was written as if greenfield, but three systems already exist and
must be reconciled rather than rebuilt from nothing:

| Existing | Location | Disposition |
|---|---|---|
| 7-status registry + engine | `src/config/registries/statusRegistry.js`, `src/systems/effects/StatusEffectSystem.js` | Keep; retrofit onto the unified engine in a **later** phase |
| `ModifierAggregator` (`Base × (1 + Σmods)`) | `src/systems/effects/ModifierAggregator.js` | **Convert to Two-Bucket** — attaches to heroes, cards *and* areas, so gear/station/trait buff numbers all need re-verification |
| Per-area aggregators | `src/systems/loop/AreaModifiers.js` | Keep as the attachment point for area-wide mutators |

There is no `mutator` entry in `CARD_TYPES` (`src/config/registries/cardConstants.js`) and no `tags` field on cards. Both are new.

### 15.2 Duration model
**Card-based, with a DoT exception.** Buffs and debuffs count down in Cards
worked. Damage-over-time effects (poison, burn, bleed) keep the existing 5s
real-time tick so HP drain stays readable during long combats.
*Supersedes §2's time-based durations and §6's "60 seconds" example.*

### 15.3 Math model — Two-Bucket everywhere
`Final = (Base + Σ additive) × (Σ multipliers)`, applied to **positive and
negative** modifiers alike, for statuses, mutators, gear, stations and areas.
- Base sits **inside** the additive bucket.
- Multiplier bucket defaults to **×1** when no multiplier tokens are present.
- Multipliers **sum**, they do not compound: three ×2 tokens give ×6, not ×8.
- **Curses use negative multiplier values** (Cursed is `-2`, not `x0`), so
  they genuinely subtract from a stacked Card. Final multiplier bucket is
  **clamped at 0** — yield never goes negative.
  *Supersedes §14's "Yield Multiplier x0" Cursed Token.*
- Status stack intensity (Poison 4 > Poison 1) stays where it is today, in
  `stackModel`/`valuePerStack` — it is *not* an aggregator concern.

### 15.4 Tagging
Cards gain an explicit `tags: []` array, **auto-seeded from each card's
existing skill/subskill** so the catalog doesn't need hand-auditing, with
flavor tags (`[Aquatic]`, `[Hazard]`, `[Social]`) hand-added where they
matter. The existing single-valued `TARGET_CATEGORIES` is insufficient
because a card must be able to carry several tags at once.

### 15.5 Mutator targeting — stamp immediately
When a Mutator card is worked, the engine walks the remaining queue and
**stamps tokens onto the first N matching cards right then**. Charges with no
available target are **wasted**. This is what makes tokens visible on
face-down Upcoming cards (§12) possible, and it is fully deterministic given
the fixed deck order (§9). Surplus charges never carry to the next cycle.

### 15.6 Purify — targeted counters, not generic cleanse
**Supersedes §10 "Purifying Cards" and §14's Purify Token.** Purify effects do
not strip "all negative tokens". Each curative declares the specific
token/status IDs it removes, exactly mirroring the `immune_to` array in §13:
an Antidote removes Poison; a Dam mutator removes a Rapid River token. This
makes cleansing a knowledge-and-preparation play rather than a universal
panic button, and removes the ambiguity of classifying tradeoff tokens
(Trawler's "Yield ×2, Time ×2") as positive or negative.

### 15.7 Mutator acquisition — mixed model
- **Basic mutators:** permanent library cards, reusable every cycle.
- **Powerful mutators:** crafted at the Guild Hall, held in the bank,
  **consumed when worked**, subject to the Economic Scarcity pacing of §7.

The UI must make the distinction unmistakable at slotting time.

### 15.8 v1 effect axes
Yield (output quantity), Time (Work Time), Input Cost (resources consumed),
and Combat (§15.13). Hard floors per §10 apply: time never below the minimum
threshold, cost never below 1 unit.

**Output conversion (Midas) is cut from v1** [DECISION 2026-07-19]. It rewrites
a loot table rather than scaling a number, so it needs its own resolution step
after the buckets. Revisit as a later addition.

### 15.12 Stat layering — one shared bucket pair
Hero Status Effects, Card Tokens, gear and station buffs **all pour into the
same additive and multiplier buckets** for a given axis. There is no separate
hero stage and card stage.

Accepted consequence: a strong enough Haste can fully cancel a Trawler's Time
×2 before the hard floor applies. This is intentional — §10's "drink Haste to
offset a Time penalty" is meant to work as one clean sum.

### 15.13 Combat axis — tokens apply Status Effects to enemies
Mutators **can** target Combat cards. A combat-targeting token (Occult's "Cast
Hex") sits on the combat slot and, when that card materializes, applies real
**Status Effects to the spawned enemy** through the existing
`StatusEffectSystem` — the same path a weapon proc uses.

This reuses shipped, tested machinery rather than building a parallel way to
weaken an enemy, and it means enemy debuffs always surface as status placards
regardless of where they came from. It also depends on the Absolute Parity
already built into the status engine (§7).

### 15.14 Targeting modes — both charges and area-wide
Mutators declare **either**:
*   **Charges** — stamp the next N matching slots (§15.5), or
*   **Area-wide** — stamp every matching slot remaining in the Cycle.

Both are forward-looking only; neither ever affects a slot already worked this
Cycle. Area-wide is what makes the §7 **Area Anchor** work, which is in v1 as
the proving ground for the mode.

### 15.15 Mutators cost Work Time
A Mutator occupies a deck slot **and** takes normal Work Time to work. Combos
cost real cycle time, consistent with §7's "time as the primary economic
currency". Mechanically a Mutator is just another Card, so `LoopRunner` needs
no special-casing for it.

### 15.16 Card type — ACTION
One new `CARD_TYPES.ACTION` covers any Card worked for an immediate effect
rather than a Yield: Mutators that stamp Tokens, and consumables that apply
Status Effects. The card's **traits** decide which — consistent with the
`applystatus` trait that already ships in `WorkProcessor`.

### 15.9 Failure states in scope
- Missing input resources → full cycle time spent, no inputs consumed, no
  output, **mutator token still wasted**.
- Bank capacity overflow → the Card fails (requires wiring the bank slot-capacity
  check into Card resolution).
- Failure UI: "Failed!" stamp, grey progress bar, Area Overview highlighting.

**Not in this slice:** Exhausted-style hard status lockouts.

### 15.10 Deferred to later phases
- **Tool Tiering & Gating** (§7). Build the failure-state plumbing now so
  tiering plugs into it later; do not build tiering itself.
- **Flat-vs-percentage combat stats** (§7). Flat-for-combat is the standing
  rule for all *new* effects; converting the existing `damage_pct` statuses
  happens in the status-rework phase, not here, to avoid rebalancing combat
  and landing a new mutator engine in the same change.

### 15.11 Build order
**Card Mutators first**, then retrofit Status Effects onto the shared engine.
Rationale: statuses already half-exist and mostly work; mutators are the
genuinely new system and the one the deck loop was built to showcase.

---

## 16. Lexicon (Locked 2026-07-19)

These are the canonical terms. All token text, status descriptions, tooltips
and UI strings use them. **"Node" is retired** — it appears nowhere
player-facing. Sections §1–§14 of this document were reworked on 2026-07-19 to
use "Card" throughout; the only remaining mentions of "Node" are in this
sentence and the table below.

### Core nouns

| Term | Meaning | Notes |
|---|---|---|
| **Card** | The thing a Hero works. | Replaces "Node" everywhere. Matches the existing UI ("Next Card", "Nearby Card"). |
| **Slot** | A position in the deck a Card occupies. | Already used in the UI ("Empty Slot"). |
| **Cycle** | One full pass through the deck. | The reset boundary: all Tokens wiped, all charges cleared. "Loop" is reserved for the Area Deck Loop *system*, not one pass through it. |
| **Mutator** | A Card that stamps Tokens onto other Cards. | The source. |
| **Token** | The marker a Mutator stamps onto a target Card. | The effect. Strictly distinct from Mutator: *"Working the Trawler mutator applies a Trawler token to the next 3 `[Aquatic]` cards."* |
| **Yield** | What a Card produces. | Not "output". "Base Yield", "Yield Multiplier". Pairs with **Input Cost**. |
| **Status Effect** | A buff or debuff on a Hero or Enemy. | Term used in docs and code. The Hero Info Panel labels the two groups plainly as **Buffs** and **Debuffs**. |

### Verbs

**Work** is the player-facing verb: *the Hero works a Card*. `resolve` stays
as the internal code term, so engine language and player language don't
collide.

### Triggers

| Trigger | Fires when |
|---|---|
| **On Draw** | A Card enters the Upcoming queue |
| **On Work** | The Hero begins working a Card |
| **End of Work** | A Card finishes — **including on failure** |
| **On Hit** | Per combat swing |

### Lifespans

**Charges** and **Duration** are deliberately distinct, because they decay on
different triggers:

*   **Charges** are consumed by **use** — a Token is spent when its Card is
    worked; *Sharpened* burns a charge per attack.
*   **Duration** is consumed by **Cards passing** — *Haste* ticks down as the
    Hero works through the deck regardless of what those Cards are.

Note this renames the §13 schema field `duration_nodes` → `duration_cards`.
