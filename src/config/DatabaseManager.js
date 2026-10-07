// Fantasy Guild - Centralized Database Manager
// Coordinates all Vite JSON globs for standard game configuration.

export const DatabaseManager = {
    stationFiles: import.meta.glob('/data/stations.json', { eager: true }),

    tokenFilesSingle: import.meta.glob('/data/tokens.json', { eager: true }),
    tokenFilesGlob: import.meta.glob('/data/tokens/**/*.json', { eager: true }),

    mapFilesSingle: import.meta.glob('/data/maps.json', { eager: true }),
    mapFilesGlob: import.meta.glob('/data/maps/**/*.json', { eager: true }),

    // Skill-pooled Token recipes, keyed by skill id.
    recipePoolFilesSingle: import.meta.glob('/data/tokenRecipes.json', { eager: true }),
    recipePoolFilesGlob: import.meta.glob('/data/tokenRecipes/**/*.json', { eager: true }),

    itemFilesSingle: import.meta.glob('/data/items.json', { eager: true }),
    itemFilesGlob: import.meta.glob('/data/items/**/*.json', { eager: true }),

    // ⚠️ The named-effect library. A dead card-era `data/effects.json` (entries keyed "0"-"55",
    // carrying `targetEntityTypes`) must never be restored here.
    effectFilesSingle: import.meta.glob('/data/effects.json', { eager: true }),
    effectFilesGlob: import.meta.glob('/data/effects/**/*.json', { eager: true }),
};

export default DatabaseManager;
