# Brief 700 — Deep read: faults waiting for content

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md)). The owner ruled on 2026-11-17 to fix
the engine now rather than warn in the CMS. Runs last of the deep-read briefs.*

**What the player gets.** Nothing visible today: no shipped content reaches these shapes. What the
owner gets: the CMS fields and rule shapes they can author already work the day they are used, so a new
elixir with a strength, a timed buff, a kill drop with an odd shape or a fifth Shop price line behaves as
written instead of failing silently.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (effects, the board's rules,
combat and loot, the content boundary), and each phase's finding (search the CR4 id in
`docs/active/review/D1` to `D4`): each lists its items, how the shape can arrive (a CMS field, AI
Generate, a change pack) and which items come first. **For every item, write the failing test from the
shape first** (a test fixture, never `data/`), then fix. Where an item's fix would need a design call
(what a shape *should* do), **stop and report** it for the owner rather than choosing.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| L1 | T-427 (CR4-124) | **Thirteen mat rule shapes.** The items in the finding, 1, 4 and 6 first. | engineer |
| L2 | T-440 (CR4-141) | **A strength on an "Applies" effect.** The bearer's strength sets the applied effect's strength (an "Elixir of Brambles" applying Thorns 3 gives Thorns at 3), for every item and perk; a status still lands one stack a hit (owner, 2026-11-17). Two items applying one effect add up as the effect's own stacking rule says. Scale 1 (everything shipped) unchanged. The content rule that goes with it (no tier ladders of one consumable) is in `CONTENT_PHILOSOPHY.md`. | builder |
| L3 | T-441 (CR4-142) | **Loot shapes that differ on a station and a kill.** The four items, item 1 first (a kill's loot axes resolved with the fighter's combat style, as `killXp` does). Keep the order and count of random draws for today's content. | engineer |
| L4 | T-442 (CR4-143) | **Hero, gear and fight shapes.** The finding's items, 2 and 7 first; item 3 needs only an audit rule in `ContentAudit.js`. | engineer |
| L5 | T-077 (CR3-252, CR4-140) | **Timed effects on a hero.** Re-sync each hero's live effects on load (`LiveEffects.syncAggregator` beside `recalculateEquipmentModifiers`, after the fight-bound effects are stripped); store a timed effect's remaining game time rather than a wall-clock end, so "Load as I left it" and a reload keep it. For-the-fight and for-the-cycle instances unchanged. | builder |
| L6 | T-460 (CR4-167), T-480 (CR4-197) | **Four small shapes.** A lesson whose target gains content (fix with the code change that sets the scrap heap's target, or guard it so no game is stranded); a rule with a cooldown; a Shop price of more than four lines; a second Lap Time rule. | builder |

**Order and parallel work.** L1 (board rules) and L3 (loot) may run together; L2 and L4 both touch the
effects code: one after the other; L5 and L6 fill gaps. Two code agents at a time.

## Done when

- Gate green; bench work check: **same work** for every phase (shipped content does not reach these
  shapes; a moved fingerprint means a shipped shape was touched: stop and report).
- Every item has a test that failed before and passes after.
- Each phase's report lists any item stopped for a design call; the director parks those for the owner.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent is told which shapes now work.

**Eye-check: no.** One line in STATUS: "rule shapes the CMS offers now work as written."

## Owner to-do

None.
