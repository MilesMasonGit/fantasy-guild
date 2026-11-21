# Brief 750 — Audit fixes: Melee, Ranged, Magic and Stealth

*Written 2026-11-21 by the planning agent from the Systems Audit, group 2 (Combat), systems A15 to A18
([Melee](../audit/A15_melee.md), [Ranged](../audit/A16_ranged.md), [Magic](../audit/A17_magic.md),
[Stealth](../audit/A18_stealth.md)), with the draft concept doc
[concept_combat_styles.md](../concept_combat_styles.md). The owner's rulings of 2026-11-20 are in each
ticket row and card; they are locked. Runs after brief 740's engine phases (C1, C2, C6, C7). Most of
the styles' work is content (Fletching, Enchanting, Tailor, weapon traits and levels): this brief
builds the machinery that content needs. Owner answers 2026-11-21 folded in.*

**What the player gets.** A Ranged hero who runs out of arrows leaves the fight and says so ("Needs
Copper Arrow"), instead of shooting on quietly; a mage whose every cast spends a Mote and who casts at half strength without
one; Kunai, thrown Stealth weapons that spend themselves; poisons a Stealth hero takes into a fight
like an elixir, their attacks carrying into later fights; a ceiling of 75% on crit chance, with a crit
still double and Stealth critting more often rather than harder. Fewer texts promising weapons that
don't exist.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (combat, effects, carried
consumables, time away), GDD §4 and §6, [concept_combat_styles.md](../concept_combat_styles.md) (draft:
the identities; the rulings this brief builds are in the tickets), the four cards, and
[the silent moments topic](../audit/topic_silent_moments.md) (how a hero stops and says why). Ticket
rows in `docs/reference/TICKETS.md` carry file:line read at `50cd9b2f`; the code wins.

**Standing rules** are brief 740's: tuning numbers as named constants in `FormulaRegistry.js` ready
for T-253 (the crit cap of 75%, the half damage for no Motes and the last Kunai: one number for both); content
only as the content agent's change packs; hover words via T-495.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| S1 | T-583, T-584 | **A ceiling on crit chance; no Crit Damage effect.** T-583: **no Crit Damage effect** (owner 2026-11-21): a crit stays ×2 for everyone (`FormulaRegistry.js:73-74`, `CombatFormulas.js:362`) and Stealth raises **crit chance only**; no new effect type is added. T-583's code part is **closed by owner ruling 2026-11-21: no Crit Damage effect; crit stays double** (Stealth's higher crit chance is content, T-585), and the ticket closes with this phase. T-584: crit chance gets a cap of **75%** (owner 2026-11-21), heroes and enemies alike (`CombatFormulas.js:170-172, 225-228`; the CMS hint, `modifierPalette.js:809-823`, says so), a named tuning number; every source of crit chance still adds in full under it (T-516, brief 730). Red-first tests. | builder-lite |
| S2 | T-573, T-579, T-586 | **One ammo rule: arrows, Motes and Kunai.** One shared piece of code for "a weapon spends one of something a shot", built first for arrows and then reused. **Arrows** (T-573): when the last arrow is shot the hero leaves the fight and says **Needs Copper Arrow** (the arrow's own name; owner 2026-11-21: running out always reads "Needs X"), with brief 795 M2's shared running-out bubble, which clears when the Bank holds the item again; a hero holding a bow with no carried arrow the Bank holds does not start a fight and says the same; the enemy keeps its damage (C6); stops the same way as fishing without bait (`Arrows.js:14-19, 56-62`; the old fight-window tooltip, `en.json:482`, goes). Build the stop (leave the work, keep the enemy's damage) as one helper that the Gathering brief's no bait (T-623) and no seed (T-629) reuse; the words are M2's bubble, not a second message. **Motes** (T-579): a magic weapon names the Mote it burns (a new CMS field on the weapon); every cast spends one, carried in a consumable cell and drawn from the Bank like arrows; with none left the hero keeps casting at half damage in the weapon's element and says **Needs Fire Mote** once a fight (M2's bubble); a magic weapon naming no Mote casts free at full damage, and the content check names it (planning agent's call 2026-11-21). **Kunai** (T-586): a Stealth weapon kind that spends one a throw (a flag on the item the CMS offers); the Kunai in the hero's hand is the one kept, and each throw spends a Kunai from the Bank, like arrows and Motes; when the Bank has none the hero fights with the one in hand at half damage, as with no Motes (the same tuning number), and says **Needs Iron Kunai** (its name) once a fight (planning agent's call 2026-11-21; no count on a worn piece). Daggers need nothing. Preservation keeps working for all three (`CycleSavings.js:23-26, 66-69`). Time away spends them the same way. | engineer |
| S3 | T-587 | **Poisons for Stealth weapons.** An optional consumable that works like an elixir: carried in a consumable cell, taken at the start of a fight when the hero holds a Stealth weapon (ignored with any other), its buff lasting a set number of attacks: a new **for N attacks** length in the CMS beside for the fight and for N fights (`consumableRule.js`, `LiveEffects.js`). Each poison item says what it does (Venom, crit, Sunder and so on) from its effect. Its attacks **carry into later fights**; a new poison is taken only at a fight's start, so one that runs out mid-fight leaves the rest of that fight unpoisoned (owner 2026-11-21). Every attack counts, hit or miss. The attacks left are saved on the hero. Logged in the fight window like an elixir (T-558 leaves that at once). No poison content yet: test fixtures prove it; the content agent's Alchemy pack brings the first. | builder |
| S4 | T-575, T-581, T-570, T-568 (code) | **The styles' leftovers.** Ranged (T-575): the fight log names the arrow shot (the attack event's `arrowId`, `CombatAttackProcessor.js:117, 128`); time away counts arrows spent beside food, elixirs and drops (`CatchUp.js:44, 269-321`; Motes and Kunai the same, from S2); a carried arrow is checked like gear (`Arrows.js:28-37` against `HeroEffects.js:51`); the data parts are the content agent's pack. Magic (T-581): comments on focus orbs, scrolls and runes that don't exist (`weaponStyles.js:18`, `equipmentCategories.js:22`); the world's Arcane category naming Magic (`worldPlaceholder.js:57`): check it does nothing and drop it, or report what it does. Styles (T-570): the two fight-window texts for a hero with no style removed (`en.json:465-466`, `FightPanel.jsx:273`); the CMS weapon style list becomes the four combat skills, not the enemy list (`ItemEditor.jsx:73`); Stealth's skill picture wired when the owner's art lands (`skillRegistry.js:121-125`; until then the slot stays as is). The tier table (T-568): `WEAPON_TIERS` (`FormulaRegistry.js:150-166`) leaves the code, **only once the planning agent has moved the table into CONTENT_PHILOSOPHY**. | builder-lite |

**Not in this brief (waits on concept_combat_styles approval).** **T-569** (each style's text says
what it is about): its words are the four identities in the draft concept doc, written by the planning
agent once the owner approves it; then a builder-lite swaps the hero sheet's texts (`en.json:692-695`)
and retires the registry's (`skillRegistry.js:100-126`), with T-644's five skill lines if they are
ready.

**Order and parallel work.** S1 and S2 may run together (S1: `CombatFormulas.js` and the effect
types; S2: `Arrows.js`, the carried-consumable code and the fight's start and stop). S3 after S2 (both
touch carried consumables and the attack count). S4 last (it touches `Arrows.js`, `CatchUp.js` and
`CombatAttackProcessor.js` after S2). At most two code agents at once.

- **Needs first:** brief 730's **T-516** (every source adds in full, D5) before S1; brief 740's **C6**
  (enemies keep their damage) before S2, and **C1, C2, C7** merged so the fight's maths and loot are
  settled under S2's fingerprint. **S2 after brief 795 M2**: T-573's words are M2's shared running-out
  bubble ("Needs X", keyed by item), as are the Motes' and the Kunai's.
- **Later briefs that build on S2:** the Gathering brief's **T-623** (no bait) and **T-629** (no seed),
  brief 770 G1, reuse S2's stop helper and M2's bubble.

## Done when

- Gate green; the director reads S4's diff whole and runs the gate on S1 to S3.
- **Bench work check**:
  - S1: **same work** (the 75% cap sits above every crit chance shipped; if the fingerprint moves, a
    hero or enemy reached the cap: report it).
  - S2: **WORK CHANGED expected** wherever the bench has a Ranged hero with no arrows (today the bow
    shoots alone; after, the hero leaves). Wands: same work (a weapon naming no Mote casts free at full damage).
    The director names the move in STATUS.
  - S3, S4: **same work**.
- **Seen in the running game** (QA panel: give items, heroes, place an enemy): a hero with a bow and
  three arrows leaving the fight after the third with Needs Copper Arrow; the same hero with none not
  starting; a wand that names a Mote spending them, then casting at half with its one line; a Kunai
  hero with none in the Bank at half damage; a hero at the 75% crit cap (fixture item) critting about three hits in four, each crit double; a poison taken by a dagger hero and
  ignored by a sword hero, its attacks left carried into the next fight (fixture items, QA panel); arrows in the away summary.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent told the Mote field, the Kunai
  flag, the for-N-attacks length and the 75% crit cap exist (and that there is no Crit Damage effect).

**Eye-check: yes**, one short look at S2 (a hero leaving a fight out of arrows and saying so; a mage
at half without Motes; Kunai). S1, S3 and S4 merge on the gate with one line each in STATUS; poisons
are first seen when the Alchemy pack lands.

## Owner to-do

1. **Art**: Stealth's skill picture, whenever ready (T-570).
2. **Change packs** (content agent writes, owner reviews and Syncs on `main`), in this order:
   - Any time: the Ranged data pack (arrows typed as consumables, bows not stackable and given their
     own pictures; T-575) and the Battlefield's Shop section and Stealth icon (T-570). The arrows pack
     before Fletching's.
   - **After S1**: Stealth weapons, low steady and high crit chance (T-585), and the weapon traits
     (T-565), with no Crit Damage on any of them.
   - **After S2**: each magic weapon's Mote (T-579, with the Enchanting build) and the Kunai (T-586).
   - **After S3**: the first poisons (Alchemy, T-587).

## Handled outside this brief

- **T-565** (content agent): every weapon kind carries a small combat trait; the trait per kind is an
  open question of the draft concept doc, so the pack follows its approval (dagger traits after S1).
- **T-566** (content agent): weapons ask a level in their style by metal tier on the new metal ladder
  (copper 1, iron 20, on up; planning agent's call 2026-11-21, not the ticket's iron 15), all four
  styles; a pack, no code.
- **T-567** (content agent): enemy styles spread so every hero style meets good and bad matchups; a pack.
- **T-568** (planning agent first, then content agent): the tier table with levels into
  CONTENT_PHILOSOPHY, every weapon checked against it; the two-hand line waits for the first
  two-handed weapon, no new item now (owner 2026-11-21); the code part is S4.
- **T-571** (planning agent): GDD on the combat styles, after the packs.
- **T-572** (content agent; planning agent: String from Tailor, a Fletcher's Bench; Feathers early from
  a Bird Nest, which breaks into a few Feathers for the Copper Arrow, owner 2026-11-21): build the
  Fletching plan, bows mostly Stab, a few elemental; the Copper and Iron Bow retire, the Bodkin becomes
  the Iron Arrow. Needs no code (the Fletching skill exists); best after S2 so a hero out of arrows
  stops, and after the T-575 arrows data pack.
- **T-574** (content agent): ways to save arrows (ranger gear, a ring, Ranged perks, a Hall star; no
  quiver). Preservation on ammo already works; the perks need brief 730's T-522 tables.
- **T-576** (planning agent): GDD on Ranged, after S2 and T-572.
- **T-577** (content agent; planning agent amends content_enchanting.md first, T-582): build the
  Enchanting plan: wands, staffs and tomes as weapon kinds (no code needed for a new kind); one Wand per
  tier, taking the element of the Mote it burns, and one Tome per tier (owner 2026-11-21); Leylines give
  Motes. **Needs S2's Mote field first.**
- **T-578** (content agent; planning agent: the open links): build the Tailor plan, mage clothes with no
  Magic cut and Stealth clothes trading defence for crit chance and Dodge (no Crit Damage). **Needs T-304
  (the Tailor skill and station, brief 780 J6) and S1 (the crit cap) first.**
- **T-580** (content agent): leather and cloth stop cutting Magic damage; a pack.
- **T-582** (planning agent): GDD on Magic, and content_enchanting.md amended before T-577.
- **T-585** (content agent): Stealth weapons low steady, high crit, the Iron Dagger's level by T-566;
  needs S1 and the tier table (T-568).
- **T-588** (planning agent): GDD on Stealth, content_alchemy.md (poison as an elixir-like buff whose
  leftover attacks carry into later fights) and
  content_smithing.md (Kunai, the Iron Dagger's level) amended, after S1 to S3.
