# Brief 890 — Token spacing, one Token size, a new starting area

*Written 2026-11-26 by the planning agent from the owner's interview the same day
([concept_token_spacing.md](../concept_token_spacing.md)). Closes T-718. Boost balancing waits on
it (the balancer, T-716 point 6).*

**What the player gets.** Tokens no longer overlap: the board has room to breathe, and at most 12
Tokens can stand within reach of any one, so where a building goes is a real choice. Every Token is
the same size. A new guild starts in a fresh starting area with a clump of each kind of resource.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the save, drawing, the
mat), the concept whole. Code read 2026-11-26 (the code wins): `src/config/matTuning.js`
(`hitboxPct` default 90, `overlapPct` 30, `RETIRED_DEFAULTS`), `src/config/matGeometry.js` (art
radius by size, `TOKEN_ART_SIZE`, small Tokens), `src/config/registries/reachRegistry.js`
(`STANDARD_REACH_U` 240), `src/config/registries/starterCampRegistry.js` and
`src/config/starterCampShape.js`, the save's version check, and the CMS Token editor's Token Size
control. Brief 830 D6 set `overlapPct` to 30; this replaces that number. Every phase may **stop and
report rather than guess**.

## Phases

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| S1 | T-721 | **Spacing** (concept 1, 2, 4). Shipped defaults: hitbox 100 %, overlap 0 %, so two standard Tokens stand at least 128 u apart (edges touching); a 2x2 follows from the same rule. Add 90 and 30 to `RETIRED_DEFAULTS`. Reach stays 240 u: check that camps, spawners (Forest and Orchard tree landing, Fishing Spot landing) and every "stands near" rule use `STANDARD_REACH_U`, and report any other radius found rather than changing it. Spawners and drops that find no free place at the new spacing fail as they do on a full mat. **Old saves are refused** with a plain message and a new guild started (bump the save version; no migration). A test: filling the mat at random never puts 13 Tokens within reach of one. | builder | — |
| S2 | T-722 | **One Token size** (concept 3). The game draws and spaces every Token as standard, whatever `artSize` says; a Token whose art is 32 px is drawn at double size until the owner's 64 px art lands (nothing to do when it does). The CMS Token editor loses its Token Size control and stops writing the field. List the 14 Tokens in the report. | builder | — |
| S3 | T-723 | **The new starting area** (concept 5). The director lays out a Starter Camp at the new spacing through the game's own Starter Camp save path (never by hand in `data/`; a data-only commit): the camp in the middle, and one clump per gathering skill around it (Copper and Stone veins; Oak trees; Berry bushes and a Field; a Fishing Spot by water), with free places beside each clump for the first buildings. Every Token type used must exist today. | director (or builder) | S1 |

**Order.** S1 → S3; S2 any time.

## Done when

- The gate passes; the work check moves (spacing and the new Starter Camp): say which scenarios and
  why, and re-stamp the baseline.
- In the running game: a new guild opens on the new starting area; no two Tokens overlap; dragging a
  Token next to another stops at edges touching; a reach ring around a crowded node holds at most 12;
  an old save is refused with the message; the former small Tokens draw at standard size.
- **Eye-check: yes**, after S3, in the week-end eye-check (the owner chose build-then-look).

## Owner to-dos

- Draw 64 px art for the 14 former small Tokens (any time; the 32 px art stands in meanwhile).
- Start a new guild after S1 (old saves stop loading).
