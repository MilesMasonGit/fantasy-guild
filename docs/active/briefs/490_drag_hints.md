# Brief 490 — Drag hints: who can work this Token

*Written 2026-11-05 by the planning agent from the owner's interview of the same day.
Concept: [concept_drag_hints.md](../concept_drag_hints.md): read it first; the owner's wish there is what counts.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the concept.

Code to start from (verify; comments here are hypotheses): the gates in `src/systems/board/WorkCheck.js`
(`heroReason`: level, then tool), `src/systems/equipment/HeroTools.js` (`holdsToolFor`, `toolsOfHero`,
`catchToolOf`), `src/config/registries/toolKinds.js` (`neededToolOf`, water's `kinds`), `SkillSystem`'s
`requirementFailure`; the drag in `src/ui/dnd/DndKit.jsx`, `DragGhost.jsx` and
`src/ui/components/dock/useDragSettleHover.js`; heroes on the mat in
`src/ui/components/board/AnimatedHeroSprite.jsx`; hero bar cards in `src/ui/components/dock/DockHeroFigure.jsx`
and `heroBarBubbles.js`; the floating item's size in `src/ui/utils/lootFlight.js` and `SpriteLayerView.jsx`;
`src/ui/components/base/SkillIcon.jsx`.

## Phases

| Phase | What | Tier |
|---|---|---|
| H1 | **The marks.** While a dragged hero is over a Token, every hero shows marks over their sprite on the mat, on their hero bar card, and on the carried hero; they go when the drag leaves that Token or ends. **Tool mark** when the Token needs a tool: the hero's own fitting tool if they hold one, else the needed kind at the lowest tier that will do. **Skill mark** when the Token names a skill: `SkillIcon` with the hero's level in that skill on it. **Green outline when the hero passes, red outline and drawn darker when not**, both read from the game's own checks (`heroReason`'s level and tool gates, water's any-kind rule), never a second copy of them. A Token with no tool need shows the skill mark only; one with neither shows nothing. **Enemies**: each hero's hand items instead (a two-handed weapon once), no outline; bare hands show nothing. **Size**: a floating mat item's, a 32 px sprite at 2×, on the mat and on the cards; if a card has no room, send the owner a screenshot before shrinking. Alert bubbles step aside during the drag and come back after. ⚠️ Work the marks out **once on entering a Token**, not on every pointer move, and draw nothing while no hero is dragged: the drag must stay as smooth as today. | builder |

## Done when

- Gate green (`TESTING.md`). Engine work **same** (nothing here changes what heroes do). Tests for the pass/fail
  reading: right tool and level, no tool, tool too weak, level too low, water with each kind, a no-tool Token,
  a Token needing nothing, an enemy with one-handed, two-handed and bare hands.
- **Ready for the drag bench** (drag code changes; the director runs it in a bench window, TESTING).
- In the running game, named as verified: drag a hero from the mat and from the hero bar over a tree, an iron
  vein with a copper pickaxe hero, a level-gated Token, water, a Redberry Bush and an enemy; a hero off-screen
  still shows on the bar; the marks leave on moving off and on dropping; bubbles return. Screenshots of each.
- GDD's hero-drag section mentions the marks.
- **Eye-check: yes**, one look.

## Not in this brief

Who would be *best* at a Token (speed, yield, weapon strength). Dragging anything but a hero.

## Owner to-do

The eye-check. No CMS work and no new art (the marks use today's item and skill sprites).
