# Fantasy Guild CMS

The content editor for Fantasy Guild: the **only** place Tokens, items,
recipes, Maps and effects are authored. A separate local React app, never
shipped with the game.

- **Run it**: `npm --prefix cms run dev` (port 5174), or `preview_start` with
  name `cms` (see `docs/reference/TESTING.md`).
- **Sync to Game** overwrites `data/items.json`, `tokens.json`, `maps.json`,
  `tokenRecipes.json` and `effects.json` from the CMS's own store (browser
  localStorage), then commits `data/` onto whatever branch is checked out.
  Anything written into those files by hand is lost on the next sync.
- **Recalculate** runs the economic simulator (`src/engine/sim/`).
- The file API lives in `vite-plugin-cms-api.js`. Backups are in `backups/`;
  `npm run cms:restore` (from the repo root) rebuilds a workspace from `data/`.
- Tests for the CMS live with the game's tests (`src/tests/CMS*.test.js`).
- ⚠️ Never verify changes on the real workspace; use a throwaway route (see
  TESTING.md, "The CMS").
