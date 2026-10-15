# Brief 85 — Art direction: the tools, then the owner's weekend

**Source of truth:** [`concept_art_direction.md`](../concept_art_direction.md)
(approved 2026-10-15). Also read the "Terrain art guide" in
[`../research/terrain_art_list.md`](../research/terrain_art_list.md).

**Timing (owner, 2026-10-15):** the three tools are built **Friday 16
October**, so the owner can run every art phase over the weekend of 17–18
October on the bench. Friday's remaining ruled tweaks move to the next wave;
P2-7, P2-9, T-145 and P2-10 are unaffected. **Brief 80 is already built**
(T0 to T4 on the director's branches, 2026-10-15) and waits on its checks and
the owner's eye-check; whether it merges this week or parks for the art
weekend is the owner's call with the director. Its scatter already reads the
owner's `playmat/props/`, so the weekend's art can be seen on the real ground
once it merges.

**Focus (owner, 2026-10-15): Friday to Sunday is for this art pass.**
Before Friday, the director may run work that supports it (A1–A3 can start
early). From Friday through Sunday the work centres on brief 85: the tools
first, then supporting the owner's working sessions (fixing a tool that breaks,
small changes the passes ask for). Other phases that are already running
finish and park; nothing new starts that doesn't serve the art pass. This
overrides "stop Saturday evening" and the Sunday buffer for this weekend only.

**Eye-check:** the tools themselves don't change the game. The owner judges
the bake on the bench and in the game during the weekend; that is the look's
check.

## Friday: three tool phases (director)

### A1 — The bench page (builder)

- **Read:** the concept doc's "Decided"; `docs/active/research/terrain_mockup.html`
  (the starting point).
- **Change:** a standalone web page served by the dev server so it loads the
  real PNGs from `public/assets/`, and **never part of the game build**. It
  shows:
  - **presets side by side**, 3–4 at once, on the same sample scene: the Oak,
    Copper and Fishing families, items beside their Tokens, a couple of heroes
    and enemies, loot on the ground; the owner adds sprites to the scene from
    a list (a simple file picker over `public/assets/`);
  - **the ground**: pick any ground sheet (`playmat/terrain/template/ter_*.png`,
    the fine set), scatter (the owner's `playmat/props/prop_*.png`; the owner
    uses the `prop_` prefix) and a tint colour;
  - **the tint's reach**: a toggle between ground and scatter only, and a
    faint grade over the whole scene, Tokens included.
- Previews come from A2's output folder; until A2 lands, the page may apply
  the presets live as CSS filters.
- **Done when:** the page runs from one npm command; screenshot in the report.
- **Built:** `npm run art:bench` opens the bench at `http://localhost:5190/art-bench/`
  (its own small server beside `npm run dev`, which also serves `/art-bench/`).
  Page: `tools/art-bench/index.html`; server and build guard: `scripts/artBench.mjs`.
  It reads A2's previews from `public/_gen/art-bench/<preset id>/<path under
  public/assets>` (ids `unchanged`, `gentle`, `drag`, `bold`, or whatever an
  optional `public/_gen/art-bench/presets.json` lists:
  `[{ id, label, brightness, saturation, threshold }]`) and falls back to a live
  CSS filter per sprite. The build deletes `dist/_gen/art-bench/`.

### A2 — The brightness script with presets (builder)

- **Change:** an npm command that takes brightness, saturation and an
  **outline threshold** (pixels at or below that darkness stay exactly as
  drawn, so black outlines keep their punch) and writes previews to a
  git-ignored scratch folder the bench reads. **Never writes over the art**
  in preview mode.
- **Starting presets:** unchanged (for comparison), gentle 1.08 / 1.12, the
  drag look 1.15 / 1.25, bold 1.22 / 1.4; all with outline protection on.
- **Bake mode**, refused unless: every file under `public/assets/` it would
  touch is committed; the git tag `art-before-vibrancy` exists; a dated zip of
  `public/assets/` exists outside the project. Covers Tokens, items, heroes
  and enemies, not UI icons or the 256 px card and banner art.
- **Done when:** previews for the four presets exist for the sample families;
  the bake refuses without its backups (a test); report "ready for the owner".
- **Built** (`scripts/artBrighten.mjs`, tests in `src/tests/ArtBrighten.test.js`):
  - `npm run art:brighten` writes all four presets (same as `--all-presets`);
    `-- --preset drag` one of them; `-- --brightness 1.15 --saturation 1.25
    --outline 40` a custom setting, into `custom_b1.15_s1.25_o40`;
    `--outline N` also changes the presets' threshold (default 40);
    `--only tokens/nature/tree,items/ore` limits a run to some folders.
  - Previews go to `public/_gen/art-bench/<preset>/<path under public/assets>`
    (git-ignored), with `public/_gen/art-bench/presets.json` (`[{ id, label,
    brightness, saturation, threshold }]`, the shape A1's bench reads) listing the presets'
    settings. The full set (about 675 files × 4 presets) takes
    about 30 s.
  - The transform is the browser's own `brightness() saturate()` filter (the
    drag look's maths) per pixel; clear pixels and pixels whose brightest
    channel is at or below the threshold stay exactly as drawn; no resizing.
  - Covers `tokens/`, `items/`, `heroes/`, `enemies/` and the loose PNGs at
    the top of `public/assets/` (gear); skips `waste/` folders, `ui/`,
    `icon/`, `skills/`, `backgrounds/`, `playmat/` and `audio/`.
  - Bake: `npm run art:brighten -- --preset <winner> --bake --backup
    <path outside the project>/assets_YYYY-MM-DD.zip` (today's date in the
    name). Refused, writing nothing, unless every covered file is committed,
    the tag `art-before-vibrancy` exists and the zip is there.

### A3 — The Studio split and palette import (T-179 plus import, builder)

- **Change:** T-179 as written (`npm run studio`, Recolor and Animation
  tabs). Plus **a palette drop folder outside `data/`** and an **Import**
  button in the Recolor tab that lists the files there and, on the owner's
  click, adds one to the palettes through the server's existing path (the
  owner then saves as usual). Agents write only the drop folder.
- **Done when:** a sample palette file appears in the Studio and imports with
  one click; the CMS no longer shows the Recolor and Animation tabs.
- **Built** (2026-10-15, `crunch/art-a3`): `npm run studio` opens the Studio on
  port 5175; the drop folder is `cms/palettes-inbox/` (its README has the file
  formats and a sample); Import adds a file to the Material Library through the
  library's own files, asking before replacing a palette of the same name.

## The weekend: working sessions (owner + one agent)

The owner opens a fresh session for these (the agent runs the tools, writes
palette files and records decisions; it doesn't build code). Each decision is
recorded in the concept doc as it's made.

1. **Brightness passes** on the bench until a preset wins, then the bake.
   The bake is committed on `main` as art only.
2. **ART_STYLE.md** written from what the passes settled (the planning agent
   writes it; the owner approves).
3. **Art planning**: confirm the ground sheets and scatter against the style.
4. **Palettes** for all three biomes into the drop folder: ground palettes,
   scatter ramps, tint swatches.
5. **Recolour and trim** (the owner) in the Studio.
6. **Tint experiments** on the bench, including whether the ground's code
   filter still earns its place.

## After the weekend (director, next wave)

- **A4 (builder-lite):** remove the drag filter's brightness and saturation
  (`DndKit.jsx`; the lift and shadow stay), since the art now carries it.
  Changes the look slightly: one line in STATUS.
- **T-180's material palettes**: the Studio action that gives the Recolor
  material palettes the same transform, run by the owner.
- **Brief 80's ground** takes the final art and tints (the concept's phase 10).

## Owner to-do

- Friday evening: start the bench from its npm command and look.
- Weekend: the sessions above, in order.
