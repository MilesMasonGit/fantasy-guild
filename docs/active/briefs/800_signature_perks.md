# Brief 800 — Signature perks: the new rules and the level-up flash

*Written 2026-11-21 by the planning agent from [concept_milestone_perks.md](../concept_milestone_perks.md)
(approved by the owner 2026-11-21). Runs after the Systems Audit briefs it builds on (730, 735, 740,
750, 760, 770).*

**What the player gets.** Levelling up looks like an event: a gold ring bursts from the hero with a few
sparkles, bigger at the major milestones. And the late perks change how a skill plays: a master miner's
vein never rests, a master forester fells a grove at once, a master angler sometimes lands the next
tier's fish, a master farmer's fields replant themselves, a master crafter works two recipes at once, a
master builder's buildings cost less, and each combat style gets its own trick at 75 and 99.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (effects and the effect
library, the board's work cycle, combat), the concept doc above (the table of signature perks), and
[concept_combat_styles.md](../concept_combat_styles.md). The perk tables themselves (which perk at which
level, the small steps) are the content agent's change pack (T-522); **this brief builds only the rules
those perks need, each as a CMS effect** so a perk (and later a star or gear) can carry it. Shipped
content uses none of them until the pack lands: every phase is **same work** on the bench. Where a
rule's exact behaviour is not settled below, **stop and report** rather than choose.

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| F1 | T-655 | **The level-up flash, look pick.** A screenshot page: the hero levelling up with brief 720's ring bursting out in gold and a few pixel sparkles, a small version (every 5 levels) and a big one (10, 25, 50, 75, 99), in two or three variants (ring size, sparkle count, colour). The owner picks one. No game code. | builder |
| F2 | T-655 | **The flash, as picked.** On every level-up, small or major, beside the float and hero bar alert from brief 735 V3. One-shot (`animateFx` / the ring piece), nothing at rest, none while minimised or under reduced motion, none during a catch-up (levels gained while away are told by the summary). | builder |
| P1 | T-646, T-649 | **Motherlode and Evergreen.** Motherlode: a vein worked by a hero holding it never rests after its charges (it keeps its charges' cycle count, or refills at once: stop and report which reads simpler in the engine). Evergreen: a field harvested by a hero holding it replants the same crop with no seed spent. Both as effects on the hero, read where the rest and the replant are decided. | builder |
| P2 | T-647, T-648 | **Grove Feller and Master Angler.** Grove Feller: when a tree this hero works falls (turns to its Stump), the trees of the same kind beside it (touching, not the whole reach) fall too, each paying one cycle's output and XP. Master Angler: a catch sometimes comes from the next tier's pool of that water (as if the next bait were used; no bait of the next tier spent). Master Angler runs after brief 770 G2 (fish tiers by bait). | builder |
| P3 | T-650 | **Many Hands.** A crafting hero holding it works two recipes at once at a station: the station runs a second chosen recipe beside the first, each with its own cycle and materials. Touches the station's recipe choice, the Token card and the save: an engine change. Stop and report if a station can only ever hold one chosen recipe in the save. | engineer |
| P4 | T-651 | **Salvage and Master Builder.** Salvage: a demolition by a hero holding it returns a share of the Token's build price (the share an effect number). Master Builder: Foundations and building upgrades cost less while a hero holding it is in the guild (a price cut effect, the guild's best holder counts, never stacking below a floor). After brief 760 V4 (a hero clears and demolition pays XP). | builder |
| P5 | T-652, T-653, T-654 | **The combat tricks.** Second Wind: heal a small amount on each kill. Unbreakable: once a fight, a blow that would defeat the hero leaves them at 1 health. Twin Shot and Double Cast (one rule): a chance an attack hits twice, the arrow or Mote spent once. Shadowstep: after a dodge, the hero's next hit is a sure crit. Each named in the fight log. After briefs 740 and 750 (the hit, ammo, the crit ceiling). | builder |

**Order and parallel work.** F1 any time after brief 720 R1; F2 after F1's pick and brief 735 V3. P1, P2
and P4 touch the board's work cycle and may not run beside each other; P5 touches combat and may run
beside one of them. P3 alone. Two code agents at a time.

## Done when

- Gate green; bench work check: **same work** for every phase (no shipped content holds these effects).
- Each rule has a test with a fixture perk (never `data/`), and is seen in the running game with the QA
  panel giving a hero the fixture perk.
- The effects appear in the CMS effect palette with plain descriptions for the content agent.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent is told which rules exist (T-522).

**Eye-check: yes**: the F1 pick, then one look at the flash (F2). The perk rules are checked when the
content agent's perk pack lands.

## Owner to-do

Pick the flash from F1's screenshots. Review and Sync the content agent's perk tables pack (T-522) when
it comes.
