# Brief 790 — Telling the player: one way to write it

*Written 2026-11-21 by the planning agent from the Systems Audit, group 8, Telling the player (A42
Notifications, A43 Cards, badges and bars), interviewed by topic 2026-11-19/20:
[time](../audit/topic_time_display.md), [chances](../audit/topic_chances.md),
[effect wording](../audit/topic_effect_wording.md), [wording drift](../audit/topic_wording_drift.md),
[hover vs card](../audit/topic_hover_vs_card.md), [item sources](../audit/topic_item_sources.md).
Its sister brief is [795 Telling the player: messages that wait](795_audit_messages.md) (silent
moments, news told twice). Runs after [710](710_mat_polish.md) and [720](720_animated_ring.md). Owner answers
2026-11-21 folded in.*

**What the player gets.** The game says the same thing the same way everywhere: one spelling for a
time (`4m 57s`, never `4:57` on one screen and `5 min` on the next), one for a chance (`12.5%`,
`0.17%`), effects named on every screen exactly as on their badge (`Speed +5% on Mining Tokens`), with
a plain explanation on hover; a Token's timers worded the same on its hover and its card ("Exhausted ·
respawns in 4m"); one form for a level requirement with the skill's icon; and an Encyclopedia that lists
every way the game really pays out an item, with amounts, while the card shows the bonus drops a
working hero brings.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the content boundary, the
progression ledger, drawing), `docs/reference/TEXT.md` (sentence case, the strings file),
`docs/reference/UI_STYLE.md` "Effect names (owner, 2026-11-11)", and **each phase's topic file**: every
topic has the owner's rule as a table and an Evidence list of today's writers with path:line (read at tag
`audit-build`, 1c04f5f6; check the code, it wins). Words go into `src/i18n/en.json` where a screen
already uses it. No ticket ids in code comments. Never hand-edit `data/`: test fixtures only.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| W1 | T-488 | **One way to write a time.** One shared writer by the owner's rule (topic table): compact `34s`, `4m 57s`, `1h 15m`, `1d 4h`; **countdowns** round up, never `0s` while time is left, keep zero parts while ticking (`5m 0s`); **fixed lengths** (grow, rest, Hall lap, cycle, swing, a speed bonus) drop zero parts and show one decimal under a minute (`2.5s`, `4s`); **counting up** (a fight's length, playtime) rounds down; sentences use the same spelling. Every writer in the topic's "What the game does today" table moves onto it (`formatClock`, `clockText` ×3, `turnCountdownText`, `lapClock`, `formatEta`, `formatDuration`, `spoken`, `cycleText`, `cycleSecondsText`, `secondsText` and `fight.seconds`, `formatPlaytime`, the fight log heading `Defeated Goblin in 42s` per A35), swing times `3s` without the space; **`formatTimeAgo` (the save slot's Last saved) stays in words**. Start from `XpRateTracker.formatDuration` (nearly the rule) and table-test every case in the topic. Grep for any writer the topic missed. Widths: check the work plate, turn ring and card timer cells still fit `1h 15m`. | builder |
| W2 | T-489, T-490, T-491 | **One way to write a chance, and whether bonuses count.** One chance writer: one decimal, trailing `.0` dropped, under 1 % two significant figures (`rareChanceText` becomes it), no space before `%`; crit, accuracy and dodge too (`HeroCombatView.jsx` two decimals). 100 % only in odds lists (drops, catches, rare finds), never in recipes or Makes rows. **Live places** (the Token card, the idle hover) keep counting bonuses; every live chance that has at least one bonus explains itself on hover: base, each bonus with its source, the result (`1% base · Lucky ×1.2 (Ana's ring) · = 1.2%`); a chance with no bonus has no extra hover. **Reference places** (Encyclopedia, recipe list) label their chance `base`. **Lucky** as a percentage reads as a multiplier (`Lucky ×1.2`, `rare find chance ×1.2`) on badges, sentences and the hover (`effectBadgeText.js`, `modifierPalette.js` Lucky reads); a flat Lucky keeps reading in points. Writers: the topic's table. | builder |
| W3 | T-492, T-493, T-494 | **Effects worded as their badges.** (a) A building's Boosts list writes each tag exactly as the badge it causes: name, number, good always plus, chances plain, `×` for a multiplier (`Speed +25%`, `Double Loot 10%`, `Bird Nest 5%`), from one source shared with `effectBadgeText.js` (today `supportTags.js` writes `−25 % work`). (b) Rule lines (perks, Hall stars, gear, building rules, the CMS preview) lead with name and number, then where or when: `Speed +5% on Mining Tokens`, `Lucky ×1.2 on Veins` (`statementText.js`, each effect's `reads` in `modifierPalette.js`; readers in the topic's Evidence, `cms/src/utils/constants.js` included). (c) **Wound Time, Lap Time and Swing Time are renamed Recovery, Lap Speed and Attack Speed**, good reads plus (`+10%` for shorter), the same way Speed already flips Work Time (an inverted axis: the stored value and its sign in `data/` are unchanged, the CMS hint says "a negative value is faster" as Speed's does); add the three to the names table in `UI_STYLE.md`. (d) An effect against the player keeps its name with a minus in red (`Speed −10%`); a bad chance reads plainly in red (`Failure 5%`). **An enemy's own buff reads in the normal colour** with its plain sign (owner 2026-11-21): an enraged Goblin shows `Attack Speed +25%`, not in red; red is only for an effect on the player's side that hurts them. First check T-403 (effect names, still open in TICKETS though the palette labels already say Speed, Growth…): finish what is left of it here and close it with this phase. Words only: the bench must show same work. | builder |
| W4 | T-495, T-499 (and T-639) | **Every effect name explains itself; an item's tooltip lists its effects.** One description per effect, written once (a field beside each effect in `modifierPalette.js` or one table the badge, Boosts list, rule line and Encyclopedia all read), shown on hover wherever the name appears. The **content agent writes the descriptions** (see Owner to-do); build with the `What it does` column of `UI_STYLE.md` as placeholders so the phase does not wait. An item's tooltip (`ItemTip.jsx`) and drawer list the item's effects in W3's rule-line form with these hovers, the same in the Bank, Shop, drop lists and the loadout. T-639 (heroes group, "an item shows its effects before it's worn") is the same change: close it with this phase (brief 780 J2 does not build it). ⚠️ Brief 730 D7 (T-517, T-525) also edits `ItemTip.jsx`: run W4 and D7 in sequence, never side by side. | builder |
| W5 | T-500, T-501 | **Level requirements and capitals.** One form for a level requirement everywhere (gear and item tooltips, why a hero won't work, recipes, combat): `Needs [skill icon] Melee 15`, and where one hero is involved `Needs [icon] Melee 15 (Ana: 12)`; `Lv` retires; a hero's own `25/99` stays (`EquipmentValidator.js`, `Orders.js`, `ItemTip.jsx`, `en.json` lines in the topic). The icon is the skill's existing icon inline in the text; a plain-text-only spot (a native `title` tooltip, a log line) uses the form without the icon. Every typed text in sentence case (`bannerKinds.js` titles, window titles, `en.json`): `Knocked out!`, `New place settled!`, `Special event! Fish Shoal!`; the All caps setting still does capitals. Grep `en.json` and `bannerKinds.js` for Title Case. | builder |
| W6 | T-498, T-502, T-504, T-505 | **One writer for a Token's timer sentences.** One writer, read by both the Token card (`tokenCard.js:324-494`) and the idle hover (`idlePlate.js`): the hover's cell shows the number (`[↻] 4m 57s`), its tooltip the card's sentence. Its words: **Exhausted** for a resting Token (`Exhausted · respawns in 4m`, card, hover, drawer, Encyclopedia; today Resting); **Respawns** the one verb for coming back, naming the result only when it differs (`Respawns as Oak Tree in 8m`; Refills, regrows, grows back retire); an event's live line `Expires in 4m 57s` (planning agent's call 2026-11-21: the same word before and after it goes; T-503's other words are in 795 M3); times by W1. `lifecycleLines` (tests only) becomes this writer or is deleted with its tests. The idle hover then shows **every** timer and stuck reason the card has (demolition, Hall production, spawner full, no room, mat full, asleep, needs items, growth stopped for items), and only those: brief 710 P2 already slimmed the plate to timers and stuck reasons and may have added some of these cells; check what is left after 710 and close T-505 on what this phase adds. A Token-turning line is not needed if A2 has retired turning by then (no content uses it). | builder |
| W7 | T-508, T-509 | **The Encyclopedia lists every real source, with amounts.** Every way the game pays out an item, from the same rules it runs: Guild Hall star production (the Woodpile's Oak Wood, Copper Ore, Stone, Coal) and the Well, events as the source of their Tokens, every catch pool now, whatever the content holds (bait and tool named on the line; planning agent's call 2026-11-21, so the Fishing overhaul changes only the data), bonus drops, the Well and Hall star production **at each rank** (`Well: rank 1 ×1, rank 3 ×2 …`, reference-style with no live state; planning agent's call 2026-11-21), and the second row for an item a Token gives twice (outputs and rare table; `encyclopediaModel.js:136-149` keeps one per `how|via` key today); a spawn with no weight counted as the engine counts it (never picked, `weightedPick.js:13-15`), not as weight 1. Each source line shows its amount as the card does (`Copper Comet ×6`, `Fish Shoal ×4 · 70%`; the ledger has `perCycle`); chances `base` by W2. ⚠️ The ledger (`src/systems/progression/ledger/engine.js`) also feeds the CMS (pricing, Hall stars, the pack gate): keep CMS-side fixes deliberate, list every CMS number that moves in the report, and stop and report rather than change a CMS price rule. | engineer |
| W8 | T-510 | **The card shows a working hero's bonus drops.** A bonus drop from a hero's potion or gear shows under Makes while that hero works the Token, marked bonus with its source: `Bird Nest 25% · bonus (Ana's Birdwatcher)`, with its badge; one line per hero bringing one; gone when the hero stops. Chance by W2, badge words by W3. | builder |

**Every director ticket of the group is in 790 or 795**: 790 holds 17 (above), 795 holds T-496, T-497,
T-503, T-506, T-507.

## Order and parallel work

- **After 710 and 720.** W6 rewrites `idlePlate.js` after 710 P2 has slimmed it; nothing else here
  touches 710's or 720's files (`TokenBubbles.jsx`, the alert marks, the rings).
- **W1 first**: every later phase prints times through it. Then **W2 beside W5** (different files).
- **W3 after W2** (Lucky ×1.2 is W2's; both touch `effectBadgeText.js` and `modifierPalette.js`),
  **W4 after W3** (descriptions hang on the names W3 settles; the item lines use W3's form).
- **W6 after W1 and 710 P2**; it may run beside W3 or W4 (card timers vs effect wording; both touch
  `tokenCard.js`, so pick different halves of the week or run them one after the other if a diff
  overlaps).
- **W7 after W2** (base labels); W7 may run beside W3/W4 (Encyclopedia files vs effect files).
  **W8 after W3**.
- 795's phases interleave: 795 M3 after W1 and W5 (both touch `bannerKinds.js`).
- Two code agents at a time.

**Overlaps with other audit briefs (proposed owners).**

- **Effect renames** (T-494 here; T-536 and T-561 in the combat brief): **790 W3 owns the three
  player-facing renames** (Recovery, Lap Speed, Attack Speed: labels, sentences, the names table) since
  they share one mechanism with Speed. The combat brief keeps T-536's `Attacks every 3s` (weapons and
  enemies, game and CMS) and the code identifiers (`SWING_TIME` → attack speed), and T-561 (Strike,
  Damage, no swing words), **after W3**. T-528 (effects: Recovery shortens running wounds) uses the name
  Recovery: run it after W3 or have it say Recovery itself.
- **Effect hovers** (T-495 here) are reused by T-527 Regen, T-534 Venom, T-550 and T-551 (which cycles an
  effect reaches): W4 builds the hover and its description source; those tickets add their own lines
  (content agent) and should run after W4.
- **T-499 and T-639** are one change: W4 closes both; brief 780 J2 drops T-639. Brief 730 D7 (T-517:
  what a tool unlocks, break chance; T-525: the heal amount) edits the same `ItemTip.jsx`: **W4 and D7
  run in sequence**, the second rebasing on the first, whichever goes first.
- **T-500 before T-520** (brief 730 D8: the hero bar shows the engine's refusal in T-500's form); D8
  uses the form whichever lands first.
- **Brief 735 V1** (Regen on the health hover) gets its hover explanation from W4 (T-495).
- **Brief 795 M2's running-out bubble** says `Needs Coal` (owner 2026-11-21), the same `Needs` word as
  W5's level form; keep the two in one strings family.
- **T-501 and T-559** (combat: Defeated replaces knocked out everywhere) both retype the same banner
  titles: W5 first, then T-559 types `Defeated` in sentence case.

## Done when

- Gate green. Bench work check (`npm run bench -- --compare`): **same work** for every phase (words and
  readers only; W7 changes no engine rule, only what the Encyclopedia reads). One `bench:draw --compare`
  with the eye-check build for the cost log.
- W1 and W2: a table test for each writer covering every row of the topic's rule; a grep shows no
  clock (`m:ss`) left in player text and no `% ` with a space.
- Seen in the running game: a Token card, the idle hover and the drawer on a resting Vein, a growing
  Stump, a Field and an event (same words, `Exhausted · respawns in …`); the work plate and turn ring
  ticking; a fight's log heading; crit, accuracy and dodge in the hero's combat view; a Lucky ring's
  badge (`Lucky ×1.2`) and the rare-find hover breakdown; a building's Boosts list beside the badge it
  causes; a Hall star and a perk's rule lines; an effect name's hover in four places; a ring's tooltip in
  the Bank and the Shop listing its effects; a gear refusal (`Needs [icon] Melee 15 (Ana: 12)`); a banner
  title in sentence case with All caps on and off; the Encyclopedia page for Oak Wood (the Woodpile
  listed), Copper Comet (the event listed, amount shown) and River Salmon (both pools); a hero with the
  Birdwatcher working a tree, showing the bonus line.
- Tickets closed into `docs/archive/tickets_done.md` (T-403 and T-639 too, with W3 and W4).

**Eye-check: yes, one look after W6** (W1 to W6; they change what nearly every screen says, and W2
adds a hover, W4 a hover and tooltip lines, W5 the skill icon inline). W7 and W8 join the next look
(the Encyclopedia's new rows, the card's bonus line). Wording alone would not be an eye-check; the new
hovers and the reworked card and idle hover are.

## Owner to-do

- **Content agent first (before or during W4)**: write one plain description per effect name
  (Speed: "a cycle takes less time", Lucky: "a higher chance on the Token's rare finds", and so on,
  Recovery, Lap Speed and Attack Speed included), as a short list the owner approves; the W4 builder
  places them (they are code-side strings, not `data/`, unless the content agent's list says an effect
  is CMS-authored).
- No CMS Sync.
