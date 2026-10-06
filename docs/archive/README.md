# Archive

**Nothing in this folder describes the current or planned design.** These files are kept for history only.

If you are implementing or planning the playmat, the live documents are in the repo root:

| Document | Owns |
| :--- | :--- |
| **`playmat_roadmap_v1.md`** | **The build plan. Start here — its Implementation Status table says what is already done.** |
| **`playmat_gap_analysis.md`** | The codebase audit behind that plan. **Supersedes `playmat_grid_concept.md` §10 wherever they disagree.** |
| `playmat_grid_concept.md` | The board, Tokens and the economy |
| `playmat_ui_concept.md` | Layout, the tile, feedback and interaction |
| `playmat_decisions.md` | The reasoning behind every decision in the above |
| `playmat_hero_concept.md` | What a hero is — ⚠️ **mostly out of scope for the current build** |
| `playmat_skills_concept.md` | What a skill is — ⚠️ **DESIGN-AHEAD, NOT A BUILD TARGET** |

> ⚠️ **`playmat_skills_concept.md` and `playmat_hero_concept.md` are listed for
> reference, not for building.** The current pass ports the existing 15-skill and
> hero systems unchanged; D-66 is *postponed*, not violated. Nothing in the
> skills doc — the six-slot sheet (D-180), the three combat skills (D-196), the
> three-layer list (D-205), D-192…D-214 — ships this pass. See
> `playmat_roadmap_v1.md`, "The skills trap", before touching either area.

---

## What's here, and why it's misleading

### The `playmat_rework_*` files describe the *opposite* rework

Their names read as though they cover the 7×7 grid. They do not. They document the **Area Deck Loop** — the linear, card-based system that *replaced* an earlier spatial playmat, and which the current 7×7 grid rework now replaces in turn.

* `playmat_rework_concept_v1.md` — the Area Deck Loop concept
* `playmat_rework_roadmap.md`, `_v2`, `_v3` — its implementation plans (v2 and v3 are near-identical; v3 was the one used)

Reading these as current design would lead you to build decks, area banners and loop slots — all of which the grid rework deletes.

### `playmat_interaction_brainstorm.md`

The original loose brainstorm for the 7×7 grid, superseded by `playmat_grid_concept.md`. Many of its ideas were changed or reversed during the design pass — notably continuous upkeep, hero reach and the clockwise processing clock, none of which survive. Its decisions live on in the decisions log where they were kept, with reasons recorded where they were not.

### Superseded root docs, moved here 2026-08-06 (roadmap Phase 0 §E)

These sat in the repo root and described the outgoing Area Deck Loop or
already-completed work. Root-level position made them read as current, and at
least one planning session was misled by them.

| File | What it was |
| :--- | :--- |
| `area_deck_rework_concept_v3.md` | The Area Deck Loop concept — the system the 7×7 grid replaces |
| `area_deck_rework_roadmap_v1.md` | Its earlier roadmap; `playmat_rework_roadmap_v3.md` was the one used |
| `deck_loop_task_list.md` | Working task list for that rework; complete |
| `loop_mechanics_concept.md` | Deck-loop mechanics — draws, shuffles, the Prep Phase. All deleted |
| `skill_mapping_concept.md` | Skill/sub-skill mapping for the deck loop. Superseded by `playmat_skills_concept.md`, which is itself design-ahead |
| `hero_dock_concept.md`, `hero_dock_roadmap_v1.md` | The Hero Dock rework; finished and merged (v0.4.0). The Dock itself survives the grid rework unchanged |
| `mutator_roadmap_v1.md` | The card-mutator "Token" system — deleted by the grid rework, which reuses the name for board objects |
| `rework_cleanup_todo.md` | Cleanup list from the deck-loop sweep; complete |

### `PLAYER_FEEDBACK.md`

Pre-existing; unrelated to the playmat work.

---

## Archived 2026-08-26 — documents describing a game that no longer exists

⚠️ **None of the following is current.** Each described the deck-loop / card era,
demolished by the playmat rework. They were moved here because a fresh session
reading them would be briefed off a dead design — which has already happened
three times on this project.

| File | Why it is here |
| :--- | :--- |
| `GDD.md` | Titled *"Game Design Document (Current State)"* and was not. Booster packs, Task/Combat/Quest/Blueprint cards, playsets, map fragments, a World Map — all retired. **No replacement GDD exists yet.** |
| `Fantasy_Guild_Granular_Implementation_Plan.md` | A 44-phase card-era plan, untouched since 2025-12-19. |
| `architecture_reference.md` | Dated March 2026, described the pre-rework architecture (`RecruitSystem.js`, a `cards/` layer, `CURRENCY (gold, influence)`). Its own header told agents to read it first, which is what made it dangerous. |
| `vertical_slice_roadmap.md` | Same era, same problem. |
| `agent_personas/` | Seven agent personas and their skills — Architect, Auditor, Designer, Handler, Muse, Stylist, Trader. All named `GDD.md` as the specification to match, and several linked to a scratch folder outside this project. **Retired by the owner 2026-08-26: only the Artist persona is in use.** |

**What to read instead**: `CLAUDE.md` for ground rules, `code_review_v3_findings.md`
for the current backlog (round 2 and its owner decisions: `archive/docs/code_review_v2_findings.md`), and the concept /
roadmap pair for whichever feature you are working on.


### Archived 2026-10-05 (Crunch Prep Triage)

- Balancing_Strategy.md
- CMS_Architecture.md
- CMS_Design_Document.md
- PERFORMANCE.md
- TILESYSTEM.md
- audio_system_documentation.md
- chaos_system_architecture.md
- codex_system_technical_overview.md
- effect_modifier_engine_overview.md
- food_and_drink_technical_documentation.md
- hero_equipment_technical_guide.md
- notification_system_architecture.md
- save_system_architecture.md
- skill_system_technical_documentation.md
- tool_durability_technical_documentation.md
- handoff_hero_dock_food_equip.md
- react_guidelines.md
- add-area.md
- add-art.md
- add-background.md
- add-item.md
- add-playmat.md
- add-project.md
- add-quest.md
- add-tile.md
- bg-gen.md
- enemy-gen.md
- item-gen.md
- optimize.md
- PROJECT_HISTORY.md
- SCB_concept.md
- director_cms_economy.md
- director_cms_effects.md
- art_generation_plan.md
- balance_targets_concept.md
- bank_drawer_intent.md
- buff_diversification_orientation.md
- cms_rework_v2_decisions.md
- cms_rework_v2_roadmap.md
- cms_solver_plan_review_v2.md
- cms_solver_plan_v2.md
- combat_formula_spec.md
- combat_mechanics_concept.md
- concept_audit.md
- TECHNICAL_PIPELINE.md
- concept_dynamic_playmat_terrain.md
- concept_effects_grammar_v2.md
- concept_free_playmat.md
- concept_recipe_and_charges_rework.md
- concept_rules_line_editor.md
- concept_unified_effects.md
- dynamic_terrain_roadmap_v1.md
- economic_simulator_director_kickoff.md
- economic_simulator_implementation_kickoff.md
- economic_simulator_kickoff.md
- economic_simulator_plan_v1.md
- economic_simulator_problem_space.md
- economic_simulator_reference.md
- economic_simulator_roadmap_v1.md
- editor_ux_pass_kickoff.md
- effects_grammar_v2_roadmap.md
- effects_robustness_roadmap_v1.md
- progression_screen_plan_v1.md
- promotes_rule_roadmap.md
- recipe_and_charges_roadmap_v1.md
- recipe_schema_proposal_v1.md
- rules_line_editor_roadmap.md
- unified_effects_roadmap_v1.md
- effect_authoring_redesign.md
- effect_system_map.md
- game_refinement_and_alignment_plan.md
- playmat_balance_report_v1.md
- playmat_decisions.md
- playmat_gap_analysis.md
- playmat_grid_concept.md
- playmat_hero_concept.md
- playmat_refinement_briefs.md
- playmat_roadmap_v1.md
- playmat_skills_concept.md
- playmat_ui_concept.md
- quest_system_concept.md
- skill_class_rework_roadmap_v1.md
- skill_color_pie_concept.md
- solver_levers_brief.md
- status_effects_concept.md
- status_effects_plan.md
- token_content_notes.md
- token_object_brief.md
- token_object_intent.md
- tooling_baseline.md
- tray_loose_objects_intent.md
- ui_bugfix_tracker.md
- ui_overhaul_spec.md
- crafting_cards_documentation.md
- add-card.md
- card_retirement_plan.md
- CARD_SCHEMA.md
