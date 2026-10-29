# Brief 290 — Progression ledger: when content arrives, checked

*Written 2026-10-28 by the planning agent from the owner's interview of the
same day and an analyst's audit of the data. Concept:
[concept_progression_ledger.md](../concept_progression_ledger.md) (read it
whole). Builds the CMS side of the approved dependency map
([concept_knowledge.md](../concept_knowledge.md), "The CMS dependency map").
**Gating itself is not in this brief** (open, being workshopped).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`,
[concept_progression_ledger.md](../concept_progression_ledger.md),
[concept_progression.md](../concept_progression.md) (stage time budgets),
[concept_basic_content.md](../concept_basic_content.md) ("The world at a
glance": the plan to seed the spreadsheet from), GDD §3 (spawners, growth,
maps), §11 (the CMS, the simulator, Tempo bands).

Code to start from (verify): `cms/src/engine/connectivityAuditor.js` (the
Economy Audit), `cms/src/engine/progressionRows.js` and
`cms/src/components/progression/ProgressionPanel.jsx`, the simulator's XP
rates, `src/systems/atlas/mapItems.js` (what a map writes; shared by game and
CMS), `src/systems/progression/RegistryManager.js` (the game's record of where
items came from, for later).

⚠️ The reach engine must reason over everything that makes a thing appear:
the Starter Camp, the Shop, spawners, growth and regrowth, what each map
writes, Foundations and builds, station kinds, tool kinds and tiers, catch
pools and bait, drops (with their chance: a source under about 5 % with no
sure source is "luck only"), first-kill drops, Passive Production. The
analyst's scratch reasoning found these all matter.

## Phases

| Phase | What | Tier |
|---|---|---|
| L1 | **The spreadsheet and the reach engine.** A spreadsheet file in `docs/` (CSV or XLSX; opens in Excel and Google Sheets): one row per item, Token, enemy and recipe (authored or planned), with its intended stage (Starter Camp, Plane 1, Plane 2, … , Parked), an optional target time, and a note. Stage time budgets in a small header table (camp ~30 min, plane 1 ~1.5 h, plane 2 ~1 day). A **reach engine** as one shared module (beside `mapItems.js`, usable by the CMS and later the game): for each entity, the earliest stage it is actually reachable at and the path. Tests on a small fixture world. | engineer |
| L2 | **The CMS check and views.** The CMS reads the spreadsheet and lists disagreements: a leak (reachable earlier than planned), later or never, luck only, a level gate unreachable in its stage's budget (simulator XP rates), a tool no recipe makes, produced-but-unused and used-but-never-produced, in the plan but not the CMS and the reverse; Parked rows silenced. A **chain view** (stages as columns, filter by skill) and a **pacing strip** per skill. Lives beside the Economy Audit. | engineer |
| L3 | **The first spreadsheet.** An agent drafts it from the concept's tables and today's data (each row's stage as planned; parked rows marked), for the owner to review. The concept docs' "World at a glance" table then points to the spreadsheet. | builder |
| L4 | **The content fix pack.** Guided by L2's red rows, an agent-written CMS change pack for the owner to review: camp leaks moved to their plane (Beehive, Alchemy Table, Apple Orchard, the bird-nest lavender route, the Goblin Camp in the Shop); plane-2 buildings to about Construction 5–8 with more build XP; copper recipes for the Copper Sickle, Fishing Rod and Trap; a use in its plane for fish, bones, beeswax and grape seed; the Goblin Chief to about level 12. The packs go through the scratchpad and `cms/incoming/` as usual. | builder |

## Done when

- Gate green (`TESTING.md`); nothing in the game changes until the owner
  syncs L4's pack (then the engine bench's work change is expected and
  accepted as content).
- In the CMS: the check lists the audit's known findings on today's data
  (Iron Ore only via the Volcano map; Construction 15 unreachable in plane
  1's budget; Copper Sickle, Fishing Rod and Trap made by no recipe; Clay and
  Quartz unreachable), and after the owner syncs L4 those rows clear.
- One CMS eye-check (the check list, the chain view, the pacing strip) after
  L2; the owner reviews L3's spreadsheet and L4's pack.

## Owner to-do

- Review the first spreadsheet (L3): stages and parked rows.
- Review and Sync the content fix pack (L4) on `main`.
- Keep the spreadsheet as the plan from then on; the CMS check says where
  data and plan disagree.
