# Brief 500 — Enemies stand still, and no ambushes

*Written 2026-11-05 by the planning agent from the owner's ruling of the same day.*

**The owner's wish.** Enemies no longer wander. They move only to find room for a fight (brief 360 C4), so the
game never needs walk animations for them. Rulings (owner, 2026-11-05): **an enemy the player drags elsewhere
stays where it is dropped**; **when a camp (spawner) is moved, its enemies stay where they were**. **No ambushes: combat is always started by the player**: camps no longer attack heroes working near them, and no Token spawns an enemy while worked (the owner removes those rules in the CMS). **Enemy camps show no reach ring.**

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, [brief 360](360_combat_detail.md) C4.

Code to start from (verify): `src/systems/board/EnemyMotion.js` (the potter, the walk back into the ring, the
follow of a moved spawner), `walking.js`, `Hostiles.js` (the camp's watch area reads the tether), `SpawnerSystem.js`
(where a new enemy appears), `src/config/matTuning.js` and the Mat Tuner (Enemy wander, Enemy walk speed),
`src/ui/components/board/AnimatedEnemySprite.jsx`. For E2: `Hostiles.js`, `Flags.js` (`ambush`, `ambusherOf`), `TriggerSystem.js` (the ambusher: a rule-spawned enemy beside its bearer, `ambushedFrom`), `enemyProfile.js` (`isHostileEnemy`), `reachDisplay.js` (`showsNearRing`), the CMS enemy editor (the hostile switch) and `ContentAudit.js`.

## Needs

**360 C4 merged first**: it moves fighters to open space and may share `EnemyMotion.js`. Build on top of it.

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **No more wandering.** An enemy stands where it spawned: no pauses and strolls, no walk back into its camp's ring when dropped outside it, no following a moved spawner. Keep: where a new enemy appears (today's spot around its camp), the tether itself (the camp's ambush watch area and anything else that reads it), C4's step to open space, and the idle animation's occasional turn. Any movement left (C4's step) slides in the idle pose, as today; no walk cycle is added. Mat Tuner controls nothing reads any more go. Say if anything assumed enemies stay near their camp. **Expect WORK CHANGED** (ambushes and fight walks start from different spots): explain it scenario by scenario, and check offline catch-up agrees. | builder |
| E2 | **No ambushes, no camp rings.** Remove camp ambushes whole: `Hostiles.js`, `Flags.ambush` and what only it uses, the hostile flag (`isHostileEnemy`, the CMS switch; the field left in `data/` is ignored, never hand-edited), the Camp watch tuner. Remove the ambusher: a Token's rule that spawns an enemy beside it while worked; the CMS audit flags such a rule so the owner can delete it. ⚠️ The same `Spawns` statement may spawn things that are not enemies, and camps spawn their own enemies: those stay; stop and report if they can't be told apart cleanly. A hero now fights only when sent at an enemy; anything about fighting back when attacked goes, and a hero is never pulled off their job. **Spawners show no reach ring** when hovered or dragged (`showsNearRing` false for them). **Expect WORK CHANGED** in any scenario with a hostile camp or an ambusher; explain it. | builder |

## Done when

- Gate green (`TESTING.md`); WORK CHANGED explained; ready for the engine bench (the director runs it in a bench
  window; it should be a little cheaper).
- In the running game, named as verified: a camp's enemies stand still for a few minutes; a new spawn appears and
  stays; an enemy dragged away stays where dropped; a moved camp leaves its enemies behind; a hero sent at an
  enemy and a crowded fight (C4 step) still work; a hero working beside a goblin camp is never attacked; working
  the Iron Ore Vein spawns nothing once its rule is removed; hovering and dragging a camp shows no ring.
- GDD updated where it says enemies wander (§ "The mat is a living place" and the enemy section) and wherever it
  mentions ambushes or hostile camps.
- **Eye-check: yes**, one short look.

## Not in this brief

A roaming enemy kind (a wandering boss, a flower golem): it would need its own walk art; a later idea.

## Owner to-do

After E2: in the CMS, delete the Iron Ore Vein's Fire Elemental Ambush rule (and any other the audit flags), then
Sync on `main`. The eye-check. No new art.
