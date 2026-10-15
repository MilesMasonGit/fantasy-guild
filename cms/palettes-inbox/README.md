# Palette drop folder

Agents write palette files **here**, never into `data/palettes/` (the CMS owns
that). In the Studio (`npm run studio`, port 5175), the Recolor tab's
**Import** button lists the files in this folder; clicking a file's Import adds
it to the Material Library (`data/palettes/custom_palettes.json`, plus its group
in `palette_groups.json`). A palette of the same name asks before replacing.
The file stays here after importing; delete it when you are done with it.

Everything in this folder except this README is git-ignored.

## File formats

Only files directly in this folder, ending `.json` or `.hex`, are listed.

**`.json`**: one palette per file. `group` is optional and files it under that
heading in the library.

```json
{
  "name": "sample_forest_ground",
  "group": "Forest",
  "colors": ["#1f2a14", "#2f4220", "#46602c", "#6a8a3c", "#9cb85a"]
}
```

**`.hex`**: one hex colour per line (the format Lospec downloads); the file name
is the palette name, so `swamp_scatter.hex` becomes `swamp_scatter`.

```
1b2a22
35503f
5e7d55
```

To try it: save the JSON above as `sample_forest_ground.json` in this folder,
open the Studio, and click Import.
