# Brief 450 — Detail pass: settings, the title screen, save files and a new game

*Written 2026-11-04 by the planning agent from the owner's walkthrough of 3 and 4 November.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "11. Settings and the start screen": read its
list first; the item numbers below are that list's, and the owner's wish is what counts. Sound on by
default and panel hotkeys: offered, not taken.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (the icon rule, frames), GDD §1, §8, §9 and
§10, [concept_world_map.md](../concept_world_map.md), [concept_quests_tutorial.md](../concept_quests_tutorial.md).

Code to start from (verify): `src/ui/modals/SettingsModal.jsx`, `SlotSelectionModal.jsx`, `HeroEditModal.jsx`,
`src/ui/ReactRoot.jsx`, `src/systems/core/SaveManager.js`, `SaveSlotHelper.js`, `SaveMigration.js`,
`SettingsManager.js`, `EngineBootstrap.js`, `CatchUp.js`, `src/systems/world/World.js`, `generate.js`,
`src/ui/components/atlas/WorldPage.jsx`, `regionBanner.js`, `src/systems/quests/tutorialQuests.js`,
`tutorialText.js`, `src-tauri/` (`lib.rs`, `Cargo.toml`, `tauri.conf.json`, capabilities).

## Needs

- Brief 440 A2 also changes the save slots: whichever runs second keeps the other's work.
- S4 only drops the tutorial's first step: the new tutorial is a separate draft.

## Phases

| Phase | What | Tier |
|---|---|---|
| S1 | **The settings window** (items 1, 3). The five "coming soon" controls go, with anything only they read. **Three tabs**: Display (typography, font, all caps, menu side, background, flying items, item stubs), Game (auto-save, Save Now, the save folder from S3 when it lands), Audio. Dev Tools stays in dev builds only. "1 Minute" auto-save moves to dev builds. A player's existing settings keep working. | builder-lite |
| S2 | **The title screen** (item 2, and T-293's start screen half). The game's name in the display font over a banner picture (show two or three banners, the owner picks), the three slots beneath in our pixel kit, emoji stats as Lucide. Built so the owner's logo and painting replace them by swapping files. Load, delete and its confirm, and the slot messages keep working. | builder |
| S3 | **Saves become files** (item 4). In the desktop build a save is a real file in a saves folder, read at load, so a copied or edited one works. A button opens that folder, on the slots and in Game settings. ⚠️ **A file save must never be lost.** **Today's saves don't carry over** (owner, 2026-11-05: old saves aren't protected until 1.0, so everyone starts fresh here, the owner included; warn the owner before it merges). ⚠️ Keep what today's saves promise, and test each: the backup slot and damaged-save recovery; the save on closing the window (file writes may be slow to finish as the window closes, so don't assume); a catch-up leaving the file untouched until its one save at the end; "Load as I left it". ⚠️ **An edited or broken file** must give the existing damaged-save message, never a crash, and the slot's other saves stay safe. A file from an older version is refused with the existing message. Write safely, so a crash mid-write can't destroy the last good save. Browser and dev builds keep `localStorage`, and the button doesn't show there. New Tauri plugins and permissions only as needed; say which. Settings stay where they are. Test on a built desktop app, on copies, never on the owner's own saves. Stop and report if autosave's timing or the catch-up's guarantees look unable to hold. | engineer |
| S4 | **A new game** (items 5, 6, 7). Picking an empty slot opens one screen before play. **Name the Guild**: one name, shown on the slot, renameable later (say where). **The world**: rings 1 to 3 of the hex map with a **Reroll** (owner, 2026-11-05: what lies past ring 3 stays a surprise, as in play); the kept seed goes in the save. Use `previewWorld`; every world generation must still pass its checks (ledger check F), so a reroll can't give a bad world. **The first hero**: name, appearance and flag colour, from the hero edit window's own controls; leave a place for recolouring (T-302). **Later heroes** from Bunk Beds arrive auto-named as today, editable by the quill (owner, 2026-11-05). ⚠️ **The tutorial's first step goes**: today it's "buy Bunk Beds, the first hero is free", and the hero now exists at the start. Check how the Bunk Beds star, the roster cap and the Starter Camp read this. Drop that step only: the owner is replacing the whole tutorial later ([brief 480](480_early_game_slurm.md)), so write nothing new for it. Reroll must not cost anything or freeze the screen on a slow machine; report how long one takes. **Expect WORK CHANGED** only if a new-game scenario starts differently; explain it. | builder |

S1 and S2 in order on one branch; S3 alone, not beside any other save or catch-up work (briefs 430, 440); S4 after S2.

## Done when

- Gate green (`TESTING.md`). Engine work **same** except as explained for S4.
- In the running game, named as verified: **S1** each tab and an old settings file. **S2** the screen at 1366 and 1920, with
  empty, filled and damaged slots. **S3**, in a built desktop app: a new save written and loaded; the button opening the
  folder; a copied file restored; an edited file, a broken file and an old-version file; closing the window mid-play;
  a catch-up cut off part-way; Load as I left it; autosave's cost, compared with today's. **S4** a full new game: name, several
  rerolls, a hero, the Guild's name on the slot; the kept world on returning; the world map matching the preview;
  the tutorial's first steps.
- `bench:draw --compare` once for the eye-check batch; the engine bench's work check on each merge.
- GDD §1, §8, §9 and §10, `UI_STYLE.md` and `concept_quests_tutorial.md` updated; T-293 closes.
- **Eye-checks**: one after S1 and S2; a short one after S3 (open the folder, copy a save); one after S4.

## Not in this brief

The recolour system (T-302). The new tutorial ([concept_tutorial_npc.md](../concept_tutorial_npc.md)). The owner's logo and title painting.

## Owner to-do

The eye-checks; pick a title banner. Draw a logo and title painting when ready (`owner_art_list.md`). No CMS work.
