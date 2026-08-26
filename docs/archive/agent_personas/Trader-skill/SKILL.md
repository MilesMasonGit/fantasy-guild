---
name: Trader
description: Expert in game economics, balance simulation, progression modeling, and decoupled mathematical calculators.
---

# Trader Skill

Use this skill when developing, refactoring, or auditing the CMS's balance calculators, simulation engines, progression prescriptions, and item-recipe-task relationship graphs.

## When to Use
- When auditing the economy for bottlenecks, orphaned inputs, dead ends, or infinite resource generation loops.
- When adapting or expanding the math models (e.g., EV calculation, XP prescriptions, or labor formulas) in `/cms/src/engine/`.
- When balancing progression curves to ensure an approximate average of 5% return on value, scaling up at higher skill levels.
- When validating that modifications to one calculator do not break or conflict with other tools.

## The 5-Step Balance & Engine Development Protocol

1. **Step 1: Orient & Graph Audit**: Analyze the existing state of the CMS database and registries. Run the `connectivityAuditor.js` to extract structural issues like orphans, dead-ends, or level gaps.
2. **Step 2: Value Reflection & Proposal**: Identify target items, tasks, or recipes that need re-balancing. Draft proposed target EV rates, xp curves, or labor costs, ensuring a net-positive skilling yield that scales with levels. **HALT for user review.**
3. **Step 3: Decoupled Calculator Evolution**: Implement updates to `/cms/src/engine/` logic. Follow a strict decoupled architecture: never directly couple two simulators; instead, interface them through consistent registry data formats.
4. **Step 4: Run Simulations & Verify**: Execute mock simulations (e.g. `runSimulation.js`, `mockBattle.js`, `taskSolver.js`) using the new calculator results. Verify that they yield the targeted average of ~5% return and correct progression times.
5. **Step 5: Export & Documentation**: Save the balanced dataset using the CMS's workspace export/backup options, and log the balance adjustments for the development team.

## Quality Constraints
- **Mathematical Decoupling**: Keep each calculation engine focused on one single responsibility (e.g. EV calculation vs. graph propagation).
- **Loop Prevention**: Validate that no recipe chain outputs a higher expected sell value than the total cost of its raw materials, tools, and labor combined.
- **Progression Scaling**: Higher-level tasks (e.g., mithril/adamantine processing) must offer a higher return on value than tier-1 tasks (e.g., copper mining), while keeping the overall average around ~5%.

## Key References
- [GDD.md](file:///c:/Users/16048/Projects/fantasy_guild_v2/GDD.md)
- [valuePropagator.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/cms/src/engine/valuePropagator.js)
- [evCalculator.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/cms/src/engine/evCalculator.js)
- [connectivityAuditor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/cms/src/engine/connectivityAuditor.js)
