Status: draft 2026-10-16 (a record of what the owner settled; the owner directs the art and approves this page)

# Art style

The few rules the game's code and tools depend on. The owner draws, recolours
and judges every look; this page only records what was decided, so agents and
tools stay in step. Names and folders: [ASSET_NAMING.md](ASSET_NAMING.md).
Ground and scatter: the "Terrain art guide" in
[`terrain_art_list.md`](../active/research/terrain_art_list.md).

## Sprites (Tokens, items, heroes, enemies)

- **Sizes**: Token, hero and enemy 64 px; big landmark Tokens 128 px; items
  32 px (half a Token); skill and UI icons 16 or 32 px. Every sprite is drawn
  at its game size, one pixel scale, never resized.
- **Outline**: a 1 px black outline. The game draws its own coloured outlines
  around it (white on hover, green while worked, red on a problem) from
  generated copies, so the art's outline stays plain black.
- **Light** comes from the top-left; the ground follows the Tokens.
- **Brightness**: the art carries the Drag look, baked 2026-10-16 (brightness
  1.15, saturation 1.25; colours whose brightest channel is at or below 40,
  the outlines, kept as drawn). New sprites are recoloured by the owner to
  match, using the brightened Studio palettes. The game adds no brightening
  of its own except a gentle hover step (1.06 / 1.08).
- **Rollback**: the git tag `art-before-vibrancy` holds the art before the
  bake.

## Ground and scatter

Per the Terrain art guide (owner, 2026-10-15): 3–5 colours per ground sheet,
low contrast, clusters not speckle, sheets nearly plain with every detail as
scatter, no outlines, no signal colours (UI_STYLE), scatter never looks
workable. Checked against the Tokens after the bake.

## Palettes

The Studio's Material Library was brightened with the same maths as the art
(2026-10-16, once; marker `_brightened` in the file). Palettes added later are
picked against the baked art. Agents deliver palette files only to the drop
folder `cms/palettes-inbox/`; the owner imports them.
