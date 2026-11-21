# Brief 765 — Regions and time away

*Written 2026-11-21 by the planning agent from the Systems Audit, group 3 "The living mat" (cards
[A40 Regions](../audit/A40_regions.md) and [A41 Time away and saving](../audit/A41_time_away_saving.md);
read each card's "Owner feedback" and "What it became"). The group's other three systems are in
[760 The living mat](760_audit_living_mat.md); the two briefs share no files except where W4 says.
Runs after the Effects (730) and Combat (740, 750) audit briefs, as the queue orders them; it does not
touch the mat's drawing, so it does not wait on 710 or 720. Owner answers 2026-11-21 folded in.*

**What the player gets.** Each kind of land shapes its own maps: the owner sets in the CMS how much
water, stone and grass a biome brings, and every new place rolls within that, opening the way for
flower meadows, cherry groves, Yellowstone and volcanoes in the world. Time away is the player's
choice: back within a minute, the game is exactly as left; away a minute or more, While you were
away always opens, with Return or Load as I left it. The summary counts each kill once. Unused
machinery (Region rules, abandoning a place, save export) is gone.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the world map and place
generation, saves, the catch-up), the two cards above, and each phase's ticket row in
`docs/reference/TICKETS.md` (file:line there was read at `50cd9b2f`; the code wins). Where things
are today:

- **Biome ground**: `atlas/Budget.js` — `BIOME_GROUND` (`:54-64`), the inland water shapes per biome
  (`BIOME_WATER`, `:69-79`), small water (`:86-94`); stone is a count on each world kit
  (`data/world.json` `kits[].stone`: Highland 5, Woodland 2, Plains 1, Wetland 1, Riverside 2). The
  five kits map one-to-one onto five biomes; the four others (flower meadow, cherry grove,
  Yellowstone, volcano) have ground but no kit. The CMS world pages: `cms/src/components/ledger/LedgerWorld.jsx`.
- **Region rules**: `atlas/RegionRules.js`, `atlas/regionModifiers.js`, read by `GuildModifiers.js`,
  `EngineBootstrap.js`, `StateSchema.js`, the CMS ledger; no place ever gets one. Archive, restore
  and abandon: `atlas/Atlas.js:396-439`, no button. A node's saved biome nothing reads:
  `Cartography.js:122`, `EffectActions.js:419`.
- **Time away**: `core/CatchUp.js` — the live loop's gaps (`onOverflow`, `:175-205`: a sleeping PC, a
  stalled frame, a background tab woken once a minute) and a load both play through `run`; a gap of
  `CATCH_UP.SHOW_GAP_MS` (2 minutes, `config/loopConstants.js:43`) or more shows the bar and the
  summary (`:413`), a shorter one plays silently. Kills are listed twice (`CatchUp.js:294-312`: a
  kill uses up its enemy, so it lands under Tokens used up too).
- **Saving leftovers**: the spawner no-room state lives only in memory (`SpawnerSystem.js:70-74`);
  export and import (`SaveManager.js:405-440`, no button); the dev time-skip (`DevTools.js:83-115`,
  tests only, does not move effect clocks); the desktop side's 16 slots (`src-tauri/src/saves.rs:16`)
  against the 3 used; the 24-hour cap on time away.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| W1 | T-616 | **Region leftovers.** Retire Region rules (the engine files, their readers, the state field and the CMS ledger's model; an old save's field is ignored); retire archive, restore and abandon (a settled place is forever, owner 2026-11-20); drop a node's saved biome that nothing reads (the save field ignored on load). Stands near stays (owner: cheap, for later). | builder-lite |
| W2 | T-613 | **Each biome sets its terrain ranges, in the CMS.** A biome table on the CMS world page (all nine biomes), its shape (planning agent's call 2026-11-21): per biome, the water shapes it can roll as today, a min–max for the water's size, a min–max number of stone patches; grass is what is left. Loaded into `data/world.json` (new `biomes` key) by the CMS's Sync; the generator reads it in place of `BIOME_WATER` and the kits' `stone`, and kits stop setting stone (the CMS stops offering it on a kit). **The table ships filled with today's values** (each kit's stone as its biome's min = max; today's water lists) and, with min = max, the generator must make exactly today's places from the same seed (same random draws in the same order): the atlas layout tests stay green unchanged. A range wider than one value draws once from the place's own seed. The content audit warns on a biome with no row. | builder |
| W3 | T-618, T-619 | **Time away: under a minute resumes as left; from a minute the summary always opens; kills once.** Owner 2026-11-20: away under a minute (a load), the game resumes as saved and no time passes; a minute or more always plays the catch-up and opens While you were away with Return and Load as I left it. The "no time passes" rule is **for loads only** (planning agent's call 2026-11-21): a running game's gap under a minute still plays silently as today, so a minimised or stalled window loses no time; a live gap of a minute or more, a sleeping PC, opens the summary. `SHOW_GAP_MS` becomes one minute and the under-a-minute load path skips the catch-up. **This phase owns the time-away threshold**: brief 795 M3's T-506 only does "told once" and leaves `SHOW_GAP_MS` to W3. Kills (T-619): an enemy used up by a kill is listed under kills only, never under Tokens used up. | builder |
| W4 | T-620 | **Saving leftovers.** Work the spawner no-room state out again on load (the first tick's check, so the "!" and the hover's stuck reason come back after a reload); retire save export and import (the saves-folder button covers it); retire the dev time-skip (`DevTools.advanceTime`, tests only) and its tests; the desktop side's slot limit to 3 (`saves.rs:16`, with whatever test pins it); the 24-hour cap a named constant beside the others, or on the tuning page if T-253 has been built. | builder-lite |

**Order and parallel work.** Two lanes, at most two code agents at once (count 760's agents too when
the two briefs overlap):

- **Lane 1 (world):** W1 → W2 (both touch the CMS ledger's world page).
- **Lane 2 (time and saves):** W3 → W4 (both touch the catch-up and saving tests). **W4 after brief
  760 V2**, which reworks the spawner no-room state W4 restores on load.

**Other briefs.** T-506 (brief 795 M3, telling the player): the 2-minute line moves here (W3); M3
keeps only "told once" and should land beside W3. T-560 (brief 740 C10: the summary leads with
defeats) edits `CatchUpOverlay.jsx`, W3 edits `CatchUp.js`: no clash, but if both are open at once,
merge one before starting the other. T-619 (kills once, here) and T-560 read 795 M3's summary writer
when M3 has landed. T-545 (combat: every enemy has one use) makes
the double listing happen every kill; W3's test covers it either way. T-253 (the tuning page, open,
not yet briefed) takes the 24-hour cap when it exists.

## Done when

- Gate green for every phase (W4: `npm run build` and the desktop build's Rust check, `cargo check`
  in `src-tauri`, for the slot limit).
- Bench work check (`npm run bench -- --compare`, the director, in a window): **same work** for W1,
  W3, W4; **W2 same work** (the bench plays a fixed mat and generates no place; a move means the
  generator leaked into the tick: stop and explain). The catch-up bench (`bench/catchup`) for W3:
  same work.
- W2: the atlas layout tests unchanged and green with the table at today's values; a test that a
  wider range moves only the drawn number.
- Seen in the running game: a load after 30 s resumes exactly as saved (no summary, nothing moved); a
  minimised window for 30 s keeps earning with no summary; a
  load after 90 s opens the summary, Return and Load as I left it both work; with a kill during the
  time away, the enemy listed once, under kills; after a reload, a full spawner's "!" back at once;
  a new place rolled in each of the five kits looks as before. In the CMS: the biome table shows
  today's numbers; a changed range (on a scratch branch, never Synced) moves the next new place.
- Tickets closed into `docs/archive/tickets_done.md`; the content agent told the biome table exists
  and kits no longer set stone.

**Eye-check: yes**, one short look at W3 (back within a minute, back after a minute). W1, W2 and W4
merge on the gate with a line in STATUS; the owner sees W2's table when reviewing the biome pack.

## Owner to-do

- **Review and Sync the biome pack** (content agent, T-613 content): each biome's ranges of water,
  stone and grass. **W2 first** (the table exists, at today's values), then the pack.
- Then the **events-by-biome pack** (T-614) and the **four new biomes pack** (T-615: flower meadow,
  cherry grove, Yellowstone and volcano as world kits with fitting camps and nodes), both content
  agent, both after W2 (the new kits need their biome rows).

## Handled outside this brief

- **Content agent:** T-614 (events lean on biome), T-615 (the four unused biomes come into the
  world), the content half of T-613 (named in Owner to-do).
- **Planning agent (docs, after the phases land):** T-617 (GDD on Regions), T-621 (GDD §10 Time and
  saving, with the 1.0 migration note for the release plan).
