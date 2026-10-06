# Status Effects Concept Document: The Unified Buff & Debuff Engine

This document defines the unified conceptual design for **Status Effects** in *Fantasy Guild*. It outlines how status effects originate, how they behave during combat and loop exploration, how they stack and decay, and how players mitigate or cleanse them.

---

## 1. Core Philosophy & Design

Status effects in *Fantasy Guild* act as the dynamic bridge between the real-time auto-battler and the turn-like deck loop system. 

### A. Data-Driven & Registry-Based
Rather than scattering one-off code throughout the gameplay engine, every status effect is defined as data in a central registry. Status effects can target both **Heroes** and **Enemies**, and both categories utilize the same registry schemas and ticking systems. Each status defines:
*   **Trigger Condition:** When does this status execute its logic (e.g., *On Attack*, *On Hit*, *On Tick*, *On Draw*, *On Shuffle*, *On Combat Start*)?
*   **Magnitude:** The numerical power of the effect (e.g., amount of damage, percentage stat modifier).
*   **Duration/Stack Count:** How long the effect lasts or how many ticks remain.
*   **Stacking Rules:** How the engine resolves multiple applications of the same status.

This registry-based approach ensures that the **Simulation Combat Baseline (SCB)** can automatically discover and test any status effect during automated balance audits.

### B. Lightweight Global Tick Cycle
To optimize system performance and keep computations lightweight, status effects are processed on a single, unified global cycle:
*   **5.0-Second Global Clock:** Every active periodic status ticks once every 5.0 seconds of real-world game time, regardless of whether the hero is in combat, resolving a card draw, or working on other outpost tasks.
*   **Seamless Application:** A status can be applied at any point in the cycle. E.g., if `[Poison]` is applied 4 seconds into the global cycle, it will execute its first tick 1 second later when the clock fires.

---

## 2. Sources of Status Effects

Status effects enter the gameplay loop from several distinct origins:

| Source | Target | Application Timing | Examples & Mechanics |
| :--- | :--- | :--- | :--- |
| **Adventure Cards** | Hero | When drawn/executed in the loop | **Salt Circle:** Consumes 1x Salt to apply `[Salt Shield]`. <br>**Cookout:** Grants +10% gathering yield to the next 3 slots. <br>**Pre-emptive Strike:** Grants `[First Strike]` to be consumed on the next combat slot. |
| **Equipment** | Hero | Persistent while equipped | **Insulated Shield:** Grants permanent immunity to `[Burning]`. <br>**Poisonous Dagger:** Adds a percentage chance to apply `[Poison]` to enemies on hit. <br>**Lucky Trinket:** Grants flat `+Crit` chance. |
| **Consumables** | Hero | When consumed in the loop | **Antidote Potion:** Purges `[Poison]`. <br>**Curative Broth:** Purges `[Frozen]` or `[Chilled]`. <br>**Cooked Steak:** Restores HP and grants `[Well Fed]` (+10% Damage) for the next 3 combat rounds. |
| **Enemies** | Hero | Applied during combat | **Spider Bite:** Chance to apply `[Poison]` to the hero on successful hit. <br>**Shield Bash:** Chance to apply `[Stun]` to the hero. |
| **World Hazards** | Hero | When drawn/executed in the loop | **Lava Vent:** Inflicts `[Burning]` on the hero when resolved. <br>**Poison Swamp:** Inflicts `[Poison]` on the hero when resolved. |
| **Outpost Stations** | Hero | Persistent while stationed | **Guard Tower:** Projects passive telemetry to other areas, e.g., granting active heroes a chance to automatically skip hazard/combat slots. |

---

## 3. Status Lifecycle & Transition Rules

A key aspect of status effects is how they transition between the high-intensity combat engine and the steady-paced exploration loop.

### A. Combat-to-Loop Hand-off
Since status ticking is tied directly to the global 5.0-second cycle, the hand-off is seamless:
*   **Persistent Statuses:** Debuffs like `[Poison]` or `[Bleed]` do not clear when combat ends. They continue to tick and decay at the exact same 5-second interval as the hero transitions back to drawing cards and progressing through the deck loop.
*   **Combat-Specific Statuses:** Tactical statuses (like `[Stun]`, `[Silence]`, or temporary speed boosts) are flagged as combat-only and clear immediately upon combat resolution.

### B. Resetting on Retreat/Exit
All active loop buffs (e.g., `[Salt Shield]`, `[Well Fed]`) and lingering adventure debuffs are tied to the active run of the deck loop. 
*   If the hero completes or voluntarily exits Adventure Mode (returning to the Outpost), the deck loop resets, and all temporary loop-wide statuses are cleared.

---

## 4. Stacking, Decay, and Mitigation

### A. Decay Stacking & Scaled Magnitude
The baseline model for stacking in *Fantasy Guild* is a decrementing tick-count model where the overall magnitude scales with the stack size:
*   **Flexible Magnitude Scales:** Statuses support both flat values (e.g., Poison dealing flat 5 damage per stack) and scaling formula values (e.g., Poison dealing 2% of Max HP per stack, or scaling off the applier's Magic combat skill).
*   **Scaled Magnitude:** The effect's tick value is multiplied by the current stack count (e.g., a status with 3 stacks deals 3x its base magnitude on its tick; at 2 stacks, it deals 2x, and at 1 stack, it deals 1x).
*   **Flexible Decay Triggers:** Statuses decay under different logical circumstances depending on their type:
    *   *Time-based decay:* The stack count is reduced by 1 every global 5.0-second tick interval (e.g., `[Poison]` or `[Bleeding]` ticking down).
    *   *Event-based decay:* The stack count is reduced by specific events rather than time. For example, an `[Armor Shield]` buff grants +1 flat Armor per stack, and decays by 1 stack whenever the hero takes a successful hit.
    *   *Armor Shield Example:* A 10-damage attack hits a hero who has `[Armor Shield]` 5 (+5 Armor). The attack deals 10 - 5 = 5 damage to the hero, and the stack count decays to `[Armor Shield]` 4. The next 10-damage attack deals 10 - 4 = 6 damage. If the hero completely blocks or evades the attack, the shield does not decay.
    *   *Stun Example:* `[Stun]` is an event-based status that triggers when the combatant (Hero or Enemy) attempts an attack (when their combat action timer fills). Stun provides a % chance to fail the attack. Each attempt to attack decays the `[Stun]` stack by 1. Stun has no effect on other parts of the loop outside of combat and does not pause loop progression.
*   **Re-application:** If a status is re-applied while already active, it adds to the stack count (e.g., applying `[Poison]` with 2 stacks to a hero who already has `[Poison]` with 1 stack results in a combined `[Poison]` with 3 stacks).

### B. Buff Stacking and Layering (Independent Lifetimes)
When temporary beneficial buffs (such as gathering yields or combat stats) are re-applied, they stack in magnitude, with each application maintaining its own independent duration tracker (layered durations):
*   **Additive Magnitude:** The magnitudes of all active instances of the same buff are summed together.
*   **Independent Lifetimes:** Each buff instance tracks its remaining duration independently.
*   **Consolidated Presentation:** Although tracked as individual duration layers under the hood, the UI consolidates them into a single status icon displaying the summed active magnitude.
*   *Example:* A `[Cookout]` card grants +10% gathering yield for the next 3 slots.
    1.  **Slot 1:** Hero resolves a `[Cookout]` card (Cookout A: 3 slots remaining). Current bonus: **+10%**.
    2.  **Slot 2:** Hero resolves another `[Cookout]` card (Cookout A: 2 slots remaining; Cookout B: 3 slots remaining). Current bonus: **+20%**.
    3.  **Slot 3:** Cookout A has 1 slot remaining; Cookout B has 2 slots remaining. Current bonus: **+20%**.
    4.  **Slot 4:** Cookout A expires. Cookout B has 1 slot remaining. Current bonus decays to **+10%**.
    5.  **Slot 5:** Cookout B expires. Current bonus: **0%**.

### C. Mitigation Mechanisms
Players manage statuses through three primary mechanical strategies:
1.  **Passive Immunity (Negation):** Prevent the status from ever landing. Enabled by equipment slots or passive upgrades (e.g., *Hazmat Filter* loops). Passive immunity only prevents *new* stacks from being applied; it does not clear existing active stacks that were applied before equipping the item.
2.  **Active Cleansing (Purging):** Clear existing statuses by running cleansing slots in the loop (e.g., slotted *Antidote* or *Curative Broth* cards that consume inventory resources to purge the debuff).
3.  **Failsafe Loop Mechanics:** If a player slots a card that consumes resources to apply a buff (like a *Salt Circle*), but the guild bank is empty of the input resource, the card still consumes its loop time (duration), but the hero continues without receiving the buff.

---

## 5. Flow Control & Queue Mutators

Statuses can interact dynamically with deck execution to alter the loop sequence:

### A. Status-Gated Slots
Specific slots can query the hero's active status effects to modify their execution:
*   **Disabling Gates:** A slot is skipped/bypassed if the hero has a specific status (e.g., `Bypassed if Poisoned` or `Bypassed if Stealthy`).
*   **Enabling Gates:** A slot *only* executes if the hero has a specific status (e.g., `Only executes if Enraged`). If the hero lacks the status, the slot is skipped.

### B. Queue Mutators (Overrides)
Active status effects can mutate or override the behavior of adjacent cards in the loop:
*   *Example:* A `[Smelting Charge]` status overrides the output of the next raw resource slot, transmuting gathered raw ore directly into metal bars.
*   *Example:* A `[Decoy]` status causes the next combat card to be treated as a blank/safe slot.

---

## 6. Outpost & Meta Statuses

When a hero's health is completely depleted (HP drops to 0) during an adventure loop, they undergo a **Forced Retreat** and receive the `[Injured]` meta-status:

*   **Behavior:** The `[Injured]` status sidelines the hero entirely, preventing all assignments. While injured, the hero cannot be sent to run Adventure Mode loops, nor can they be stationed to work at any Outpost crafting or processing stations.
*   **Recovery:** To keep the starter system simple, the `[Injured]` status is removed strictly after a set amount of real-time has elapsed (representing recovery resting).
*   **Forced Retreat Cleansing:** Upon entering the Forced Retreat state (due to HP dropping to 0), the hero's active status effects (both beneficial buffs and negative debuffs) are immediately cleared.

---

## 7. UI & Presentation Conventions

To keep the interface clean and player-friendly:
*   **Placard Icons:** Active status effects are displayed next to the hero's name/vitals on active cards, HUDs, or Outpost panels.
*   **Visual Format:** Displayed as a simple status icon with the status name and stack count (e.g., `[Poison Icon] Poison x3`).
*   **Consolidated Totals:** Layered buffs or debuffs of the same type are visually combined into a single icon showing the total active stack count or magnitude.
