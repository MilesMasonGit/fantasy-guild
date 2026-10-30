> ⚠️ **On hold (owner, 2026-10-29)**: a deeper analysis of the whole system is under way; this brief will be revised from it. Do not start.

# Brief 290 — Progression ledger: every item planned, traced and checked in the CMS

*Written 2026-10-28, **rewritten 2026-10-29** by the planning agent after the
owner moved the plan from a spreadsheet into the CMS. Concept:
[concept_progression_ledger.md](../concept_progression_ledger.md) (read "The
ledger" whole). Builds the CMS side of the approved dependency map
([concept_knowledge.md](../concept_knowledge.md)). The world map
([concept_world_map.md](../concept_world_map.md)) is a draft: build on
**tiers** now; wedge and ring come later.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`,
[concept_progression_ledger.md](../concept_progression_ledger.md),
[concept_progression.md](../concept_progression.md) (stage time budgets),
[concept_basic_content.md](../concept_basic_content.md) ("The world at a
glance", to seed tiers and stubs from), GDD §3 (spawners, growth, maps), §11
(the CMS, the simulator, Tempo bands).

Code to start from (verify): `cms/src/engine/connectivityAuditor.js` (the
Economy Audit), `cms/src/engine/progressionRows.js` and
`cms/src/components/progression/ProgressionPanel.jsx`, the simulator (effort
and XP rates), the CMS stores and Sync (how a new field and a new status
reach `data/` without breaking the game's loader), `src/systems/atlas/mapItems.js`
(what a map writes; shared by game and CMS),
`src/systems/progression/RegistryManager.js` (the game's record of where
items came from, for later).

⚠️ The reach engine must reason over everything that makes a thing appear:
the Starter Camp, the Shop, spawners, growth and regrowth, what each map
writes, Foundations and builds, station kinds, tool kinds and tiers, catch
pools and bait, drops (with their chance: a source under about 5 % with no
sure source is "luck only"), first-kill drops, Passive Production.
⚠️ **Planned** entries must never reach the game: Sync leaves them out (or
the game's loader ignores them); test it.

## Phases

| Phase | What | Tier |
|---|---|---|
| L1 | **The ledger's data and engines.** In the CMS, every entry (item, Token, enemy, recipe) gets a **status** (Planned, Draft, Live, Parked) and every item a **tier set by the owner**; a Planned entry is a stub (name, tier, note). A **reach engine** (earliest tier and path for each entry) and a **tree engine** (each item's full ingredient tree to its origins: total effort from the simulator's rates, skills touched, depth, earliest reach) as one shared module beside `mapItems.js`. Tests on a small fixture world. | engineer |
| L2 | **The item page and the checks.** An item page in the CMS: all sources (wild nodes, drops, side sources, recipes), all uses, the full tree, effort, earliest reach, status, set tier. The **automatic checks**: leak (reachable earlier than its tier), later or never, a tree with later-tier ingredients, luck only, a level gate unreachable in its stage's budget, a tool no recipe makes, produced-but-unused, used-but-never-produced, orphan stubs; Parked silenced. | engineer |
| L3 | **The progression timeline and the economy view.** A timeline of every item by first reach (time and levels), per skill, crowded and empty stretches marked; an **economy hubs** list (items ranked by how many recipes depend on them) beside the **problems** list. | engineer |
| L4 | **The first fill.** An agent-written change pack sets a tier on every live item and adds Planned stubs for the next content (from the concept tables), for the owner to review in the CMS. | builder |
| L5 | **The content fix pack.** Guided by the checks: camp leaks moved to their plane (Beehive, Alchemy Table, Apple Orchard, the bird-nest lavender route, the Goblin Camp in the Shop); plane-2 buildings to about Construction 5–8 with more build XP; copper recipes for the Copper Sickle, Fishing Rod and Trap; a use in its plane for fish, bones, beeswax and grape seed; the Goblin Chief to about level 12. | builder |
| Later | When the world map is approved: **wedge and ring** on origins, and a **World plan** view (wedges by ring). Its own phase in the world map's brief. | — |

## Done when

- Gate green (`TESTING.md`). The game is unchanged until the owner syncs a
  pack; a Planned stub never appears in the game (tested).
- In the CMS: the item page for Iron Ingot shows its tree to Iron Ore and
  Coal with effort and reach; the checks list the audit's known findings on
  today's data (Iron Ore only via the Volcano map; Construction 15
  unreachable in plane 1's budget; Copper Sickle, Fishing Rod and Trap made by
  no recipe; Clay and Quartz unreachable), and after the owner syncs L5 those
  rows clear; the timeline shows plane 2's level-15 wall.
- One CMS eye-check after L2 and one after L3; the owner reviews L4's and
  L5's packs.

## Owner to-do

- Review the tiers and stubs pack (L4) and the content fix pack (L5); Sync on
  `main`.
- From then on, plan new content as Planned stubs in the CMS; the checks say
  where data and plan disagree.
