// the Atlas screen's own words; the engine's refusals are regionNames.TEXT

export const SCREEN_TEXT = Object.freeze({
    TITLE: 'Atlas',
    TAB_REGIONS: 'Regions',
    CLOSE: 'Close',

    HERE: 'The guild is here',
    TRAVEL: 'Travel',
    ARCHIVE: 'Archive',
    RESTORE: 'Restore',
    ABANDON: 'Abandon',
    RENAME: 'Rename',
    ARCHIVED_HEADING: 'Archive',
    showArchive: (n) => `Archive (${n})`,
    HIDE_ARCHIVE: 'Hide archive',
    abandonQuestion: (name) => `Abandon ${name} for good? Everything on it is lost.`,
    KEEP: 'Keep',
    FACT_GROUND: 'Ground',
    FACT_TOKENS: 'Tokens',
    FACT_HEROES: 'Heroes here',
    FACT_LANDMARKS: 'Landmarks',
    PREVIEW_LABEL: 'Preview of the Region'
});
