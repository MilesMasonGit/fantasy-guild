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
    // Phase 4 replaces this with a `/data/tokens/**/*.json` glob.
    cardFiles: {},
    stationFiles: import.meta.glob('/data/stations.json', { eager: true }),
    subskillFiles: import.meta.glob('/data/subskills.json', { eager: true }),

    // Recipes
    recipeFilesSingle: import.meta.glob('/data/recipes.json', { eager: true }),
    recipeFilesGlob: import.meta.glob('/data/recipes/**/*.json', { eager: true }),

    // Quests
    questFilesSingle: import.meta.glob('/data/quests.json', { eager: true }),
    questFilesGlob: import.meta.glob('/data/quests/**/*.json', { eager: true }),

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
