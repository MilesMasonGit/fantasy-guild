# Asset rename list

- `rename-list.json`: one row per file under `public/assets/` (audio left out) saying where it moves under `docs/reference/ASSET_NAMING.md`, or that it is kept or deleted, with the sprite name before and after, what references it, and `confidence: check` where a word was guessed. A draft for the owner to approve; nothing has been moved.
- `check-list.mjs`: `node tools/asset-rename/check-list.mjs` validates the list against the ruleset and the files on disk (one row per file, prefixes, folder depth, unique names, nothing in use deleted) and prints counts.
