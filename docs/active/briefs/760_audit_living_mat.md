# Brief 760 — The living mat: spawners, no room, events and demolition

*Written 2026-11-21 by the planning agent from the Systems Audit, group 3 "The living mat" (cards
[A2 Spawners and transforms](../audit/A2_spawners_transforms.md), [A4 Events](../audit/A4_events.md),
[A1 Placing, reach and removal](../audit/A1_placing_reach_removal.md); read each card's "Owner
feedback" and "What it became"). Its sister brief, [765 Regions and time away](765_audit_regions_time_away.md),
carries the group's other two systems (A40, A41); the two share no files except where 765 W4 says.
Runs after briefs [710](710_mat_polish.md) and [720](720_animated_ring.md), and after the Effects
(730) and Combat (740, 750) audit briefs, as the queue orders them. Owner answers 2026-11-21 folded in.*

**What the player gets.** Forests plant full Trees and every wood has a Forest; a spawner counts what
stands in its reach, so a Quarry no longer stalls because of rocks across the mat; nothing is ever
paid for a Token that has nowhere to land, and the game says so once instead of failing silently;
an event says goodbye in its own words, in a banner, when it leaves; clearing an event takes a hero like any
other Token; Demolish is a button on the Token's card as well as the map mode, and it pays a little
Construction XP; a builder stays on to work the building they just finished.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the board's tick, timed
changes, spawners, placement and the mat cap, notifications), the three cards above, and each
phase's ticket row in `docs/reference/TICKETS.md` (file:line there was read at `50cd9b2f`; the code
wins). Where things are today:

- **Spawners**: `SpawnerSystem.js` — `countsOf` (`:178-183`) counts in reach only when the CMS's
  "plants within reach" tick is set (`plantsWithinReach`, `:109-111`; the CMS tick at
  `cms/src/components/editors/LifecycleBlocks.jsx:138-155`), what a camp spawned for a camp, else
  mat-wide (`capOf`, `:294-309`). Only the Quarry is mat-wide in shipped data; **every bench
  spawner fixture is mat-wide** (`bench/fixtures.mjs:68-77`). A spawn pays its upkeep only after
  landing (`:376-404`) and remembers its no-room state in memory (`noRoom`).
- **No room elsewhere**: a station's Token output is room-checked before the cycle pays
  (`BoardRunner.js:160-171`) but a failed landing after that is a log line only (`:179-188`);
  arrival enemies with no room are left out (`world/Arrival.js:204-216`); events retry after
  5 minutes (`events/EventClock.js`); the Shop places before taking anything (`board/Shop.js:110-125`).
- **Turning** (`turns`): `TimedChanges.js:239-277`, the CMS block `LifecycleBlocks.jsx:228-256`,
  `turnedFrom` checks across `src/` and `followRenames.js`.
- **Events leaving**: the banner is withdrawn with nothing said (`notifications/routing.js:169-175`);
  a rich node's hour reports "time up" (`TimedChanges.js:349-358`, `EventTokens.js:42`); the away
  summary's reasons (`core/CatchUp.js:327-328`, `en.json:565-571`).
- **Demolition**: `board/Demolition.js` (an event goes at once with no hero, `:168-175`); map mode
  only (`useMapMode.js:57-65`); no XP on finish (`BoardRunner.js:480-500`).
- **After a transform**: `Flags.followTransform` (`board/Flags.js:757-768`) lets go on a build.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| V1 | T-599, T-600 (code) | **Spawner limits in reach; turning retired.** Every spawner except an enemy camp counts its family within its own reach (the standard reach) against its allowance; a camp keeps counting what it spawned; the mat-wide count (`capOf`, the family-cap census path) retires. Every non-camp spawner also **lands within its reach**, and the CMS's "plants within reach" tick retires (planning agent's call 2026-11-21): one rule, as the Forests do today; a Quarry hemmed in waits and says so (V2). Retire random turning: the `turns` timed change, its CMS block, every `turnedFrom` check and the save field's reader (an old save's field is ignored, not an error). Delete the stale comments named in T-600. Rule spawns of enemies stay refused (owner: fine as is). | builder-lite |
| V2 | T-598, T-609 | **One rule for no room: wait, pay nothing, say so** (owner 2026-11-20). Nothing is paid or lost until a Token lands; it waits and retries; the player is told once (owner 2026-11-21): **one banner the first time**, "No room beside the Smithy.", and the waiting spawner or station keeps its "!" (as brief 710 P3 places it) with **No room** on its hover until it lands; arrivals and events, which have no Token to mark yet, get the banner only Per source: **spawners** as today (pay after landing), plus the telling; **stations**: room is still checked before the cycle pays; if the finished Token still cannot land, it waits in the station (saved), the station starts no new cycle, and it lands when room appears; **arrival enemies** that find no room wait (saved with the arrival) and land as room appears, the arrival not counting as cleared while any wait; **events** keep the 5-minute retry and say so once; **the Shop** already refuses before paying, and says why. Bounties are cut (T-637): leave their code alone. **Arrival enemies stand outside the mat cap** (T-609), as event Tokens do (`MatCap.js:31-35`), so they never block building. Tests first: each source with a full mat. | builder |
| V3 | T-596 (code) | **No Saplings, after the owner's forestry pack Sync.** With the pack in (Forests and the Orchard plant full Trees, a seedling each; Stumps grow straight into their Tree with their Forest in reach), update what still assumes a Sapling: the family walk's comment and any Sapling-specific branch (`SpawnerSystem.js:205-234`), the room note (`MatPlacement.js:94-99`, `EffectActions.js:218-226`: a Stump still takes its Tree's room, so keep the rule, reword it), the "Waiting for … Sapling" texts, `tokenConstants.js:250, 322` doc lines, and every test or fixture that names a Sapling id (`src/tests/fixtures/ledgerWorld.js:64-65` and the tests `grep -rl _sapling src/tests` lists). The Sapling sprites stay in the manifest (art is the owner's). **A saved Sapling loads as its full Tree** (planning agent's call 2026-11-21): a change pack cannot write the CMS rename list (content agent, 2026-11-21), so this phase maps each deleted Sapling id to its Tree in the load path (the same place the rename list is followed), or adds a rename entry kind to change packs if that is smaller; test that an old save with a Sapling mid-growth loads a Tree. If the pack has not landed, stop: this phase only follows it. | builder-lite |
| V4 | T-603, T-610 | **Clearing an event takes a hero; demolition pays a little XP.** An event Token marked for demolition is cleared like any Token (a Construction hero, the usual time, nothing back); the next event waits until it is gone (`EventClock.js:338-345` already waits on a standing event: check the marked one counts). A finished demolition gives Construction XP to the hero who cleared it: a flat **5 Construction XP** per finished demolition (planning agent's call 2026-11-21), a named constant beside the cap and the reach, or on the tuning page if T-253 has been built. | builder-lite |
| V5 | T-607 | **Demolish on the Token's card.** A Demolish button on the card (and Cancel demolition on a marked one), through `Demolition.mark` / its cancel, beside the map mode which stays for clearing many; where a Token cannot be demolished the card says why, in `canMark`'s own reason. Fixed Tokens, the Guild Hall and anything `canMark` refuses show the reason, never a dead button. | builder-lite |
| V6 | T-608, T-611 | **A builder stays; placing leftovers.** One rule for every Token that becomes another: the hero stays when the new Token is work they can do (`stillTheJob`), the build included (drop the `cause === 'build'` early return in `followTransform`); otherwise they need a job, as today. Leftovers (T-611): retire One Mythic at a time (`Placement.js:82-88` and its refusal text); the unused `bench` Foundation kind (`tokenConstants.js:118`); the free drop route (`dropOnMat.js:122-125`); the world layout's own 240 (`atlas/Layout.js:133`) reads the standard reach; `builtFrom`, kept for a refund that does not exist (`Foundations.js:53-84`; a save's field is ignored); the stale comments named. | builder-lite |
| V7 | T-602, T-605 | **An event says goodbye; event leftovers.** Every leaving (time up, worked out, never worked, demolished) withdraws the event's banner and pushes **one banner** with that event's own goodbye line, from a new text field on the CMS Events page (a fallback "{event} has gone." where empty). **Banner only** (owner 2026-11-21): no marker on the mat for an event (T-497's event part is dropped from brief 795 M2). The banner's heading says **Expired** for every way an event goes by itself and **Demolished** for the player's act (T-503's words, 795 M3); the away summary says Expired / Demolished / still here (795 M3), and the unused "left unworked" label retires (planning agent's call 2026-11-21), in the banner path and the summary's reasons. Leftovers (T-605): the event banner's second line says what it gives (a buff's minutes, "for 10 min"; a rich node "leaves in 1 h if unworked"); the QA panel's event buttons refuse while an event stands, as the clock does; the 45 to 75 minute wait, the 5-minute retry and the rich node's hour become named constants together, or tuning-page entries if T-253 has been built. | builder-lite |

**Order and parallel work.** Two lanes, at most two code agents at once:

- **Lane 1 (board engine):** V1 → V2 (both `SpawnerSystem.js`) → V6 (`Placement.js` after V2) → V3
  (after V1 and the owner's forestry pack Sync; V3 may wait while lane 2 runs).
- **Lane 2 (demolition and events):** V4 → V5 (the card needs V4's event demolition) → V7 (both V4
  and V7 touch `EventClock.js`).

**How it fits briefs 710 and 720 (both run first).** V2's "told once" uses the alert "!" as 710 P3
leaves it (above the Token, worked Tokens too): a spawner or station waiting for room shows that
"!" with its reason, and 710 P2's slimmer idle hover keeps the stuck reason ("No room"). V4 and V5's
marked Tokens show their demolition timer in that hover (T-505, telling-the-player group, builds on
710 P2). V6's builder who stays keeps their flag, which 720 R2 draws in the Token's middle on hover:
check the flag moves to the new building. V1's in-reach counting is the same reach 720 R1 draws, so
the reach dots show exactly what a spawner counts. Nothing here draws a ring, flag or "!" of its own.

**Other briefs.** T-253 (the tuning page, open, not yet briefed): V4 and V7 put their numbers on it
if it exists, else as named constants, and T-253's row keeps them listed. Brief 765 W4 re-derives a
spawner's no-room state on load, so it runs after V2. The telling-the-player group's T-505 (hover
timers, 790 W6) builds on V4. **V7 and brief 795 M3** share the words Expired and Demolished (T-503):
whichever lands second uses the first's strings, one writer; T-497 (795 M2) has no event marker, so
nothing in M2 waits on V7. T-604 (the Fish Shoal) is brief 770 G2's, not this brief's.

## Done when

- Gate green for every phase.
- Bench work check (`npm run bench -- --compare`, the director, in a window):
  - **V1: WORK CHANGED expected.** Every bench spawner fixture is mat-wide today and will count and
    land in its reach. The director confirms the change is only
    that, then re-baselines (`bench/README.md`); a change in the camps' numbers is not expected.
  - V2: same work expected (the bench's cap scenarios already wait for room); a move means a
    station or spawner behaves differently with room: stop and explain.
  - V3: same work on the branch against `main` once both carry the pack (the pack's own change of
    work lands with the owner's Sync on `main`; note it in STATUS).
  - V4, V5, V6, V7: same work.
- One `bench:draw --compare` with the eye-check build, for the cost log. No drag bench (no drag code).
- Seen in the running game: a full mat with a Smithy making a Token, a Forest and an arrival (QA panel)
  each waiting, told once, and landing when room is made, nothing lost; a Quarry and a Forest
  counting only what is in their reach (hover the reach ring); a Forest planting a Tree and a felled
  Tree's Stump growing back into a Tree with its Forest in reach (after the pack); an event marked,
  cleared by a Construction hero, XP gained, the next event held until it went; Demolish and Cancel
  on a card, and a refused Token's reason; a builder finishing a Smithy and staying to work it; an
  event leaving with its goodbye banner and no mark on the mat (QA panel), and a rich node left
  unworked saying Expired; an old save with a Sapling loading a Tree.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent told the CMS no longer offers
  turning or the "plants within reach" tick.

**Eye-check: yes**, one look after V2, V5, V6 and V7 (the no-room telling, Demolish on the card, the
builder staying, the goodbye banner), and one short look after V3 (Forests planting Trees, Stumps
growing back). V1 and V4 merge on the gate with a line in STATUS.

## Owner to-do

- **Review and Sync the forestry pack** (content agent, T-596 content and T-597): Saplings go; Oak,
  Fir, Birch, Maple, Mahogany, Ebony and Cedar Forests all plant full Trees in their reach, a seedling
  each; every Stump grows into its Tree with its Forest in reach, its wait today's two waits added (Oak
  5 min, Fir 8 min, the rest 10 min) unless the Forestry plan (T-624) sets them; each Sapling id goes
  into the rename list as its Tree; the big rest-and-refill Forest nodes
  retire; the Apple Orchard plants Apple Trees. It may ride with the Gathering group's Mining and
  Forestry plan (T-624). **Pack first, then V3.** After the Sync, the director greps `src/` and
  `cms/src/` for the old Sapling ids (CLAUDE.md, renames and deletes).
- **Review and Sync the leftovers pack** (T-600 content): the Wheat Sprout and the Fire Elemental
  ambush effect go. Any time; independent of V1.
- **Review and Sync the goodbye lines pack** (T-602 content): the content agent writes the twelve
  events' lines. **V7 first** (it adds the CMS field), then the pack.

## Not in this brief

- **T-604** (the Fish Shoal): placed in brief 770 G2, with the Fishing overhaul. The Shoal runs out
  like a rich node, a big charge pool, with better catches than plain water (owner 2026-11-21); the
  code part (a water with catch pools that also has charges spends one a catch) and the content
  agent's part (the Shoal's pools, many charges, better fish) are 770's.

## Handled outside this brief

- **Content agent:** T-597 (a Forest for every wood: the forestry pack above); the content halves of
  T-596, T-600 and T-602 (named in Owner to-do).
- **Planning agent (docs, after the phases land):** T-601 (GDD §3 Spawners and Transforms), T-606
  (GDD §3 Events), T-612 (GDD §3 The mat, Foundations and Demolition).
