// Fantasy Guild - Centralized Database Manager
// Coordinates all Vite JSON globs for standard game configuration.

export const DatabaseManager = {
    // Card definitions.
    //
    // ⚠️ The glob is deliberately empty: `data/cards/` moved to
    // `data/archive/cards/` in the playmat rework (Phase 1 §H, decision G-18).
    // Those ~36 entries were authored for draw order and area pools, not
    // adjacency — a Forge with no schematic beside it is a different object —
    // so Map 1's kit is authored clean in Phase 9 rather than converted. The
    // archived files stay as reference for item ids, enemy ids and flavour.
    //
    cardFiles: {},
    stationFiles: import.meta.glob('/data/stations.json', { eager: true }),
    subskillFiles: import.meta.glob('/data/subskills.json', { eager: true }),

    // Tokens and Maps.
    //
    // CMS rework Phase 0 (CMS-82) finally did what the note above promised:
    // Token and Map definitions used to be hand-authored JavaScript object
    // literals inside their registries, which meant the CMS had nothing to
    // write into — CMS-53 ("the CMS writes data/ JSON wholesale") was
    // unbuildable for the two entity types the whole rework exists to author.
    // The definitions now live in data/; the registries are loaders.
    //
    // The single-file + folder-glob pair mirrors items and recipes exactly, so
    // content can later be split across files without touching this.
    tokenFilesSingle: import.meta.glob('/data/tokens.json', { eager: true }),
    tokenFilesGlob: import.meta.glob('/data/tokens/**/*.json', { eager: true }),

    mapFilesSingle: import.meta.glob('/data/maps.json', { eager: true }),
    mapFilesGlob: import.meta.glob('/data/maps/**/*.json', { eager: true }),

    // Skill-pooled Token recipes (CMS-39). Keyed by skill id, NOT the same
    // thing as `recipeFiles*` above — those are the card-era recipe list that
    // `recipeRegistry.js` loads and the Token economy does not use.
    recipePoolFilesSingle: import.meta.glob('/data/tokenRecipes.json', { eager: true }),
    recipePoolFilesGlob: import.meta.glob('/data/tokenRecipes/**/*.json', { eager: true }),

    // Recipes
    recipeFilesSingle: import.meta.glob('/data/recipes.json', { eager: true }),
    recipeFilesGlob: import.meta.glob('/data/recipes/**/*.json', { eager: true }),

    // Quests — retired 2026-08-18. Quests are hardcoded in
    // `systems/quests/tutorialQuests.js`; there is no authored quest content.

    // Items
    itemFilesSingle: import.meta.glob('/data/items.json', { eager: true }),
    itemFilesGlob: import.meta.glob('/data/items/**/*.json', { eager: true }),

    // Enemies
    enemyFilesSingle: import.meta.glob('/data/enemies.json', { eager: true }),
    enemyFilesGlob: import.meta.glob('/data/enemies/**/*.json', { eager: true }),

    // Areas
    areaFilesSingle: import.meta.glob('/data/cards/area/areas.json', { eager: true }),
    areaFilesGlob: import.meta.glob('/data/cards/area/**/*.json', { eager: true })
};

export default DatabaseManager;
