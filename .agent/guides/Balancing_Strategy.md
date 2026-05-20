# Fantasy Guild Idle: CMS Balancing Strategy

## 1. The Skill-Value Link
EV is directly tied to the **Skill Level Requirement**. 
- Lower-level tasks target a baseline EV (e.g., 1.05).
- Higher-level tasks should yield progressively greater rewards (e.g., Level 50 = 1.25 EV).
- **Goal**: Ensure the player feels more powerful and "richer" as they master a skill.

## 2. Energy as a Global Currency
Energy has a fixed gold value (`energyGpValue`). 
- **Cost**: Expending energy increases a task's `TotalCost`.
- **Value**: Drinks and Food that restore energy derive their `trueCost` from how much gold-value energy they provide.

## 3. The Hierarchy of Prescriptive Levers
When the simulation identifies a "Discrepancy," it should solve in this order:

### Phase 1: The Liquid Buffer (XP)
- **Multi-Skill Synergy**: XP can be split across multiple skills to reach a value target without over-leveling one skill.
- **XP-to-Gold Parity**: All XP is valued at the `xpToGoldRatio`.

### Phase 2: Supply Chain Propagation (Sell Values)
- Increase the **Sell Price** of items further down the supply chain (e.g., a Finished Sword vs. Raw Ore). 
- **The Rule**: Items become less "globally used" and more valuable as they are processed.

### Phase 3: Secondary Input Tuning (Fuel/Consumables)
- Adjust the quantity of secondary inputs (like Coal for Smelting) or change the input type to fine-tune the `TotalCost` of a task.

### Phase 4: Combat Intensity (Health Cost)
- Adjust enemy **Accuracy, Damage, or HP** to control the "Healing Item Consumption Rate."
- If an enemy is too profitable, increase its damage to force higher resource recycling.

### Phase 5: Waste Item Recycling (Last Resort)
- Instead of "Failure," tasks can produce a low-value byproduct. We balance the task by shifting the % weight between the "Primary Output" and the "Byproduct."

## 4. Tool ROI
Tools must provide a **150% - 250% ROI** via speed bonuses. 
- Higher-tier tools (Iron > Bronze) provide greater speed, and their cost should scale to keep the ROI consistent.
