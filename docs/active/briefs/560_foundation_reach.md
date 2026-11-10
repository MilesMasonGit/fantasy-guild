# Brief 560 — One standard reach, floating Foundations, in-range dots

*Written 2026-11-10 by the planning agent. Concept: [concept_foundation_reach.md](../concept_foundation_reach.md): read it
first; the owner's wish there is what counts. Code facts below were checked by a read-only agent and spot-checked by the
planning agent; verify them.*

**Rulings (owner, 2026-11-10).** The one standard reach is **about 240** mat units, between today's camps (280 to 360) and
neighbour rules (164). **Camp Reach upgrades are removed**: reach never changes. **Dots go on every Token inside the
ring** (not heroes, not floating loot).

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the concept,
[concept_progression_ledger.md](../concept_progression_ledger.md).

Code to start from (verify):
- **Camp reach**: per Token in data, `camp: { skill, reach }` (Logging Camp 360, Mining Camp 280, Fishing Hut 280,
  Farmstead 320); `CAMP_REACH_DEFAULT` and `campOf` in `tokenConstants.js`; `Camps.js` (`campOfInstance`, `reaches`,
  `isCampWork`, `campWork`); `TileModifiers.campReachOf`; the `CAMP_REACH` statement in `data/hallStars.json`
  (`star_forestry_camp_reach`, `star_mining_camp_reach`); `CampReachRing.jsx`.
- **Near radius**: one global value, `nearby.js` `nearRadius()` from `matTuning('nearRadius')` (164; a dev-only Mat Tuner
  value). Read by `TileModifiers.applicableStatements`, `Restrictions.nearIds`, `SiteRules.nearMetAt`, `TriggerSystem`'s
  neighbour triggers, `SpawnerSystem`'s `withinReach` planting (oak and fir forests, apple orchard), `MatPlacement`,
  `layoutInputs`, `MatRings.jsx`, `supportLinks.js`.
- **Drawing**: `reachDisplay.js` (`showsNearRing`), `MatRings.jsx`, `MatBoard.jsx` (the camp ring shows on hover only,
  not while carried), `ShopPanel.jsx` (Shop drags are Token drags), `TokenSprite.jsx` and `lootBob.js` (`startBob`; a
  resting Token passes no `hovering`), `MatToken.jsx`.
- **Foundations**: the five with a `foundation` block; building replaces the instance (`Foundations.buildInPlace` →
  `EffectActions.transformInstance`), so the built Token is a new type and rests by itself.

## Needs

Nothing queued. Brief 480 L2's ledger budget runs after R1, so it reads the new reach.

## Phases

| Phase | What | Tier |
|---|---|---|
| R1 | **One reach.** One named constant, about 240, read by camps and by every `nearby` rule, spawner planting and placement check that reads `nearRadius` today. The camp's authored `reach` is no longer read; the CMS's Reach field on camps goes (the value left in `data/` is ignored, never hand-edited). **Camp Reach goes**: `campReachOf` and the `CAMP_REACH` statement are no longer applied, and the CMS audit flags the two Hall stars that carry it so the owner can delete them. The Mat Tuner's Near radius goes, or stays as a dev override of the constant: say which. Other distances (the fight step, nudge, pull, pond, the Hall clearing) are not reach and stay. ⚠️ **Expect WORK CHANGED** in almost every scenario: explain it scenario by scenario (camps working fewer Tokens, support rules and forest planting reaching more). ⚠️ **The ledger**: report every place's budget before and after, the Starter Camp's above all, and that reach still finds everything; stop and report if a place breaks. Hall star count and ring prices change with the two stars gone: say how. | engineer |
| R2 | **Seeing it.** (a) **Floating Foundations**: an unbuilt Foundation's art bobs as floor loot does (`startBob`, whole art pixels, the shadow still on the ground), resting and while carried; the built Token rests. (b) **The ring**: whenever a reach-using Token is dragged (from the Shop or across the mat) or hovered, the one standard ring is drawn round its live position: Foundations, camps (carried too, which today shows none) and anything `showsNearRing` names. (c) **Dots**: during that drag or hover, a dot over every Token inside the ring, decided by the same distance test the engine uses, so a dot never disagrees with what is worked. Show the owner two or three dot looks on one screenshot page first; build only the pick. ⚠️ Work the dots out when the drag point moves to a new spot, not every frame, and draw nothing when no such drag or hover is on. **Ready for the drag bench** and `bench:draw --compare`. | builder |

R1, then R2.

## Done when

- Gate green (`TESTING.md`); R1's WORK CHANGED explained and the ledger report read by the director; R2's benches in
  STATUS.
- In the running game, named as verified: buying each Foundation from the Shop and moving one, ring and dots following;
  a borderline tree just in and just out matching what the built camp then works; a support station's dots matching
  what it boosts; a camp carried; an unbuilt Foundation bobbing, its built Token resting; Hall without the two stars.
- GDD (reach, camps, support rules, Foundations) updated.
- **Eye-check: yes**, the dot pick, then one look after R2.

## Not in this brief

Changing what any building does. New buildings (T-307).

## Owner to-do

The dot pick. After R1: in the CMS delete the Forestry and Mining Camp Reach stars (the audit names them), then Sync on
`main`. The eye-check.
