# Brief 500 — Enemies stand still

*Written 2026-11-05 by the planning agent from the owner's ruling of the same day.*

**The owner's wish.** Enemies no longer wander. They move only to find room for a fight (brief 360 C4), so the
game never needs walk animations for them. Rulings (owner, 2026-11-05): **an enemy the player drags elsewhere
stays where it is dropped**; **when a camp (spawner) is moved, its enemies stay where they were**.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, [brief 360](360_combat_detail.md) C4.

Code to start from (verify): `src/systems/board/EnemyMotion.js` (the potter, the walk back into the ring, the
follow of a moved spawner), `walking.js`, `Hostiles.js` (the camp's watch area reads the tether), `SpawnerSystem.js`
(where a new enemy appears), `src/config/matTuning.js` and the Mat Tuner (Enemy wander, Enemy walk speed),
`src/ui/components/board/AnimatedEnemySprite.jsx`.

## Needs

**360 C4 merged first**: it moves fighters to open space and may share `EnemyMotion.js`. Build on top of it.

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **No more wandering.** An enemy stands where it spawned: no pauses and strolls, no walk back into its camp's ring when dropped outside it, no following a moved spawner. Keep: where a new enemy appears (today's spot around its camp), the tether itself (the camp's ambush watch area and anything else that reads it), C4's step to open space, and the idle animation's occasional turn. Any movement left (C4's step) slides in the idle pose, as today; no walk cycle is added. Mat Tuner controls nothing reads any more go. ⚠️ The camp's watch area stays around the camp, so an enemy dropped far away doesn't ambush there: say if anything else assumed enemies stay near their camp. **Expect WORK CHANGED** (ambushes and fight walks start from different spots): explain it scenario by scenario, and check offline catch-up agrees. | builder |

## Done when

- Gate green (`TESTING.md`); WORK CHANGED explained; ready for the engine bench (the director runs it in a bench
  window; it should be a little cheaper).
- In the running game, named as verified: a camp's enemies stand still for a few minutes; a new spawn appears and
  stays; an enemy dragged away stays where dropped; a moved camp leaves its enemies behind; a hero sent at an
  enemy, an ambush, and a crowded fight (C4 step) all still work.
- GDD updated where it says enemies wander (§ "The mat is a living place" and the enemy section).
- **Eye-check: yes**, one short look.

## Not in this brief

A roaming enemy kind (a wandering boss, a flower golem): it would need its own walk art; a later idea.

## Owner to-do

The eye-check. No CMS work and no new art.
