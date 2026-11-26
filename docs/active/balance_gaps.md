# Gaps for content

*The balancer's hand-back list (owner, 2026-11-25; [concept_balancer_agent.md](concept_balancer_agent.md)).
An empty stretch is a run of levels in a skill with nothing new to make or gather, where the old task
slows into a wall and the rules can't smooth it. The balancer adds a gap here; `/content` reads this
page at session start, fills a gap by adding or moving an unlock, and strikes it (~~like this~~) with
the date and what filled it. The balancer removes struck gaps on its next run once the solver agrees.*

## Open

| Skill | Levels | What's missing | Suggestion | Added |
|---|---|---|---|---|

## Checked, no gaps

- **Cooking** and **Smithing** (balancer, 2026-11-25): something new at least every 5 levels from 1 to 99.

## Unreviewed: the solver's raw list (2026-11-25)

*Printed by `node .claude/skills/balancer/balance_solver.cjs` on the catalogue as it stands. Not yet
checked by the balancer: some are by design (gathering tiers leave gaps), and Construction's
buildings may not all count as training. Combat is left off (out of scope). The balancer's week-2
run moves the real ones into "Open" and drops the rest with a reason. Alchemy 2-7 and Fletching's
short stretches came back on 2026-11-25: an unlock may no longer move below an ingredient from
another skill, so Elixir of Ironskin stays at 8 with its Clay (week 2: check whether Clay follows its Deposit to 6) and the arrows stay with their
arrowheads.*

| Skill | Empty stretches |
|---|---|
| Alchemy | 2-7, 51-59, 81-89, 91-98 |
| Construction | 2-9, 11-19, 21-39, 41-47, 49-59, 61-79, 86-98 |
| Crafting | 87-98 |
| Farming | 81-86, 88-98 |
| Fishing | 2-11, 13-21, 31-47, 49-82, 84-98 |
| Fletching | 9-19, 32-39, 42-47, 49-59, 62-67, 69-79, 86-98 |
| Forestry | 14-19, 41-49, 51-59, 61-79, 81-98 |
| Mining | 21-29, 31-39, 51-59, 61-69, 71-79, 91-98 |
| Tailor | 92-98 |
