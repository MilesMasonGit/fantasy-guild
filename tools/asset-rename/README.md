# Asset rename list

- `rename-list.json`: one row per file under `public/assets/` (audio left out) saying where it moves under `docs/reference/ASSET_NAMING.md`, or that it is kept or deleted, with the sprite name before and after, what references it, and `confidence: check` where a word was guessed. Approved by the owner 2026-10-16.
- `check-list.mjs`: `node tools/asset-rename/check-list.mjs` validates the list against the ruleset and the files on disk (one row per file, prefixes, folder depth, unique names, nothing in use deleted) and prints counts. It accepts the folder before the moves (every row's `from` on disk) or after them (every kept or moved row's `to`), and fails on a half-applied folder.
