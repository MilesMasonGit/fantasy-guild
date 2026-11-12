# Brief 590 — Three new effects: Preservation, Refresh, Lucky

*Written 2026-11-11 by the planning agent from the owner's Stars vs Buildings picks and effect names of the same
day. Source: [star_ideas_review.md](../star_ideas_review.md) (the families and the picks) and
[UI_STYLE.md](../../reference/UI_STYLE.md#effect-names-owner-2026-11-11) (the names). Code facts below were checked by
a read-only agent; verify them.*

**What the owner wants.** Three effects that many sources will give, each with one short name:
- **Preservation**: a chance a cycle uses none of its materials. It also covers ammo, Food, drinks and bait.
- **Refresh**: a chance a cycle spends none of the Token's charges.
- **Lucky**: a higher chance on a Token's own rare drop table. A Vein's Gem is the example.

The owner placed all three as **Both**: a small Star version (global, about 1 % a rank) and a big Building version
(the Tokens in its reach). So each one must work from a Hall star and from a building's nearby rule.

This brief builds the engine and the CMS fields only. **No content uses them yet**: the content agent authors the
stars, buildings and rare tables afterwards. So engine work stays **same**.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the star review's "Stars vs Buildings"
section, the Effect names table in `UI_STYLE.md`.

Code to start from (verify):
- **Adding an effect type.** It touches four places:
  - an `EFFECT_TYPES` key (`src/systems/effects/constants.js`);
  - a `PROC` row in `modifierPalette.js`, which makes it appear in the CMS (`paletteForKeyword`);
  - possibly a support tag (`supportTags.js`);
  - the render goldens (`renderCorpus.js` walks the palette).
- **The roll.** `TileModifiers.resolveAxis(instanceId, type, base, category)` sums the tile, guild (Hall star) and
  hero buckets. A star with a `to` is aimed per Token. Categories narrow through `ModifierAggregator._forEachMatching`.
  The pattern to copy is `OutputRules.rollDoubleLoot` and `doubleItemDrop`.
- **Cycle end.** In `BoardRunner.completeCycle`:
  1. INPUT_COST (about :235);
  2. `Charges.planCycle` (:250);
  3. `InputAllocator.consumeInputs` (:256), all or nothing; a Field's owed seed is paid here;
  4. FAIL_CHANCE (:270);
  5. outputs (:299);
  6. `Charges.commitPlan` (:367);
  7. `Fields.harvested` (:373), which spends a Field's harvests.
- **Other things used up.**
  - Bait: `Fishing.catchOf` (:83).
  - Ammo: `Arrows.spendArrow`, from `CombatAttackProcessor`.
  - Food: `ConsumptionSystem.consumeEquipped`, through `tryEat`, in and out of fights.
  - Work drinks and potions: `startWorkDoses`.
  - Fight elixirs: `startFightElixirs`.
- **Drops.** A Token's lines are `config.outputs[]`, each with its own `chance`. There is **no rare table today**:
  `RareDrops.js` only marks a line at or under 10 % for a twinkle. No vein has a gem.
- ⚠️ **Randomness.** Rolls use bare `Math.random`. The bench pins it, and `OutputRules` warns: **make no draw when no
  rule offers the chance**, and keep the draw order. Every new roll follows that rule, so the work check stays same.

## Needs

Nothing queued. It may run beside anything that doesn't touch `BoardRunner.completeCycle`, `Charges.js` or
`ConsumptionSystem.js`.

T-403 renames today's labels; this brief names the three new ones correctly from the start.

## Phases

| Phase | What | Tier |
|---|---|---|
| P1 | **Preservation.** A new proc effect with the CMS label **Preservation**, read as a chance in percent. **(a) Cycles**: rolled once per cycle, before `consumeInputs`. On a hit the cycle uses **none** of its inputs, but it still runs, gives its outputs and spends its charges. The category is a **skill**, as INPUT_COST's is. A Field's owed seed counts as an input, so a hit keeps it unpaid until the next harvest; say if that reads wrongly. **(b) Things a hero carries**: rolled each time **ammo, Food, a work drink or potion, a fight elixir or bait** would be used up. On a hit, that one is not removed. A drink's hit means its next dose starts without taking a new item. The category is an **item or a kind of item**: say how kinds are named (the loadout's Food, Potion, Trinket and Ammo kinds, plus Bait) and use the existing kinds if they exist. ⚠️ Make no draw when no rule offers the chance; a failed cycle draws nothing. Both reaches must work: a Hall star (global or aimed) and a building's nearby rule; for (b), the hero's Token or fight decides "nearby". Say where a fight's position is read. | engineer |
| P2 | **Refresh.** A new proc effect with the CMS label **Refresh**. Rolled once per completed cycle, before `Charges.commitPlan`. On a hit, the Token spends **none** of its charges that cycle. For a Field, the harvest does not count down its load (`Fields.harvested`). A failed cycle still burns its charge, as today, and draws nothing. It is narrowed **by Token** (the rule's `to`: an id or a tag, a star aimed at Ore Veins, say) and optionally by skill. A Token that would rest at 0 rests later, never sooner. ⚠️ The same no-draw rule. Both reaches. | builder |
| P3 | **Lucky and rare tables.** (a) **A rare table** on a Token, authored in the CMS on the Token's page: one chance per cycle (in percent, decimals allowed, such as 0.5) and a list of entries (an item, a weight, a quantity range). On a hit, one entry is picked by weight and dropped like any output, after the normal lines. **The owner's rule (2026-11-11): one rule for every drop, on every kind of Token.** A rare drop is a drop like any other: **Double Loot doubles it** as it doubles every line, **Double Item** works on it as on any item, and a failed cycle rolls nothing, as it gives nothing else. **Enemies have rare tables too**: one roll per kill, on the enemy Token's own table, beside its loot; Lucky aimed at that enemy raises it. Any Token kind with drops can carry a table; no kind is special-cased. If the code makes one of these awkward, stop and report rather than adding an exception. The drop shows the existing rare twinkle. The Token's tooltip and Encyclopedia list the table with its chance, the same way chance lines show today; the badge row brief designs its final look. (b) **Lucky**, a new proc effect with the CMS label **Lucky**: it raises the table's chance, resolved on the table's own chance as base. A percentage rank makes it rarer or less rare in proportion (+10 % turns 1 % into 1.1 %). Allow the flat bucket too, and state which the CMS offers by default. It is narrowed by Token (`to`). A Token with no table ignores Lucky. (c) **The ledger** reads rare tables as it reads chance lines today; check it doesn't call them "luck only" wrongly (T-336), and say what you found. ⚠️ No table, no draw. | engineer |

P1, P2 and P3 touch different code and may run side by side, but not two at once in `BoardRunner.js`. Order: P2,
then P1, then P3.

**Each phase also:**
- a QA fixture: a Hall star and a building carrying the effect, so it can be seen in the running game without
  content;
- the CMS palette row, with a one-line hint in the owner's words: Preservation "a chance a cycle uses none of its
  materials", Refresh "a chance a cycle spends none of the Token's charges", Lucky "a higher chance on the Token's
  rare drop table";
- the rule text (`statementText`) and the hero's reads in plain words;
- the render goldens.

## Done when

- Gate green (`TESTING.md`). Engine work **same** (no content uses the effects).
- **Tests:**
  - each effect at 100 % and 0 %, from a star and from a building, with nothing taken or spent on a hit;
  - nothing drawn when no rule offers the chance, checked with a `Math.random` spy count;
  - a failed cycle;
  - Preservation on ammo, Food, a drink, bait and a recipe input;
  - Refresh on a Field and on a vein that rests;
  - a rare table's weighted pick, on a gathering Token and on an enemy kill;
  - Double Loot doubling a rare drop, and Double Item on a rare item;
  - Lucky raising the table's chance.
- **In the running game, named as verified, with the QA fixtures:**
  - a Bank count that doesn't drop on a Preservation hit;
  - a Token's charges holding on a Refresh hit;
  - a rare drop from a QA rare table, with the twinkle, on a gathering Token and on a QA enemy;
  - each effect's text in the CMS and in the Token's and hero's tooltips.
- GDD (effects) updated with the three names.
- **Eye-check: no.** Nothing changes for a player until content uses the effects; one line in STATUS.

## Not in this brief

- The content: which stars, buildings and rare tables exist, and their sizes. That is the content agent's job, by the
  Stars vs Buildings picks.
- The effect badge row on the Token inspection (the next brief, after its design session).
- Renaming today's effect labels (T-403).
- Retiring the Lore stars, restock and catch weight (T-400 to T-402).

## Owner to-do

Nothing for this brief. Afterwards, the content agent plans the stars, buildings and rare tables with you, as a CMS
pack.
