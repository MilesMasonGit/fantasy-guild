// Fantasy Guild - Centralized Database Manager
// Coordinates all Vite JSON globs for standard game configuration.

export const DatabaseManager = {
    // Eagerly evaluated globs for card definitions
    cardFiles: import.meta.glob('/data/cards/**/*.json', { eager: true }),
    workstationFiles: import.meta.glob('/data/workstations.json', { eager: true }),
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
