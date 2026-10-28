# Brief 250 — Token bars: one plate, fewer things on the mat

*Written 2026-10-27 by the planning agent from the owner's interview of the
same day. Concept: [concept_token_bars.md](../concept_token_bars.md) (the
rules, numbered; read it whole). The owner's notes are kept at
[research/issue_doc_2026-10-27.md](../research/issue_doc_2026-10-27.md).*

⚠️ That issue document was written by a recording agent: **the owner's wish
is in the concept doc; the issue doc's file paths, line numbers and code
snippets are guesses** (its proposed enemy check, for one, is untested).
Verify in the code before briefing a subagent.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_token_bars.md](../concept_token_bars.md),
[concept_info_layers.md](../concept_info_layers.md) (the rule it amends),
GDD §14 (the Performance Envelope: nothing may make the reference board cost
more; this brief should make it cheaper).

Code to start from (verify): `src/ui/components/board/TokenBubbles.jsx`
(rest and hover rows, the rings), `workPlate.js` (`workPlateOf`,
`plateCells`, `platePlace`), `WorkPlateLayer.jsx`, `TokenBadges.jsx`
(`StationGearBadge`), `problemMark.js`, `RingBadge.jsx`, `TimerBubble.jsx`,
`flagGeometry.js`, `FlagMark.jsx`, `FlagLayer.jsx`, `flagCloth.js`,
`src/systems/board/FlagColours.js`. Dev page: `src/ui/dev/WorkPlateDemo.jsx`.

## Phases

One eye-check for the whole brief, on one integration branch
(`feat/token-bars`). P1 and P2 touch different files and may run in
parallel; P3 follows P1 (same files).

| Phase | Ticket | What | Tier |
|---|---|---|---|
| P1 | T-261, T-262 | **Small fixes on the Token**: enemies never show a charges count (the hidden use count on enemy Tokens; fix it in the code, not the data). A Token waiting on **your choice** (a Foundation's building, a station's recipe) swaps its yellow '!' for the gear **in the same spot** on hover, the gear drawn at **2× (64 px)**; click opens the picker, its tooltip unchanged. Stations waiting on items or room keep their '!'. ⚠️ the hover row was placed off the marks' row so the mark never slides from under the pointer (comment in `TokenBubbles.jsx`); a swap in place must not flicker as the pointer crosses the mark. Tests. | builder |
| P2 | T-150 | **The pennant flag**: every hero's flag on the mat is the owner's 32 px pennant (`public/assets/ui/u_flag_pennant.png`) drawn at 2× (64 px), the same for every hero. Measure its pole foot and cloth on the art and redo the flag geometry (pinning on standard and small Tokens, the carried flag, the press target, the reach ring's centre). No fade, no colour cue (the owner's later flag rework). Keep `FlagColours.js` and `hero.flagColour` saved as they are: the rework may use them. Where else a hero flag is drawn (the Atlas's Region rows), use the pennant too and list it for the eye-check. Drag bench (flag pickup is drag code). | builder |
| P3 | T-263 | **One plate**: the worked plate loses the output item (rule 4) and shows the skill icon when it has neither charges nor a problem (rule 1); an idle Token on hover gets the same plate **under the Token**, with its charges, respawn/regrow time, quest progress, spawner count and problem as apply (rule 3); the round charges, timer, spawner and quest rings retire from the mat (delete their mat use; keep a component only if something else still uses it). With nothing to say, no plate. Problems stay at rest (rule 2). The Token card is unchanged. ⚠️ Check the Copper vein, a respawning bush, a Stump regrowing, a quest board and a spawner, idle and worked. `bench:draw --compare` before and after: the mat should draw cheaper or the same; a cost-log line. | builder (engineer if the plate's placement for idle Tokens needs layout work) |

## Done when

- Gate green (`TESTING.md`), engine bench work check same work (nothing here
  changes the engine; WORK CHANGED means stop and report).
- In the running game: an idle Copper vein, hovered, shows a plate, not a
  ring; a chopped tree's plate has no Oak Wood icon; a fully-running
  crafting station's plate shows its skill icon; an enemy hovered shows name
  and HP only; a Foundation hovered shows one big gear where its '!' was;
  every hero's flag is the pennant.
- Eye-check file in `docs/active/eyecheck/` covering all three phases, plus
  the owner's stump check below.

## Owner CMS to-do

- In the Token editor, set **Art size: Small** on **Oak Stump** and **Fir
  Stump** (and any later stump), then Sync on `main`. The director then
  checks a stump regrows its sapling and places cleanly at the smaller size,
  and adds it to the eye-check.
