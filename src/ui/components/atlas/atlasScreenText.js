// the Atlas screen's own words; the engine's refusals are regionNames.TEXT

export const SCREEN_TEXT = Object.freeze({
    TITLE: 'Atlas',
    TAB_REGIONS: 'Regions',
    TAB_CARTOGRAPHY: 'Cartography',
    CLOSE: 'Close',

    HERE: 'The guild is here',
    TRAVEL: 'Travel',
    ARCHIVE: 'Archive',
    RESTORE: 'Restore',
    ABANDON: 'Abandon',
    RENAME: 'Rename',
    ARCHIVED_HEADING: 'Archive',
    MORE: 'More',
    showArchive: (n) => `Archive (${n})`,
    HIDE_ARCHIVE: 'Hide archive',
    abandonQuestion: (name) => `Abandon ${name} for good? Everything on it is lost.`,
    KEEP: 'Keep',

    MAPS_HEADING: 'Maps',
    NO_MAPS: 'No maps yet. Rare enemies and quests drop them.',
    SLOTS_HEADING: 'Slots',
    EMPTY_SLOT: 'Empty slot',
    SLOTS_HINT: 'Click a map or drag it onto a slot.',
    SUMMARY_HEADING: 'Node Summary',
    SUMMARY_EMPTY: 'Slot a map to see what it writes.',
    PREVIEW_HEADING: 'Layout',
    REROLL: 'Reroll',
    CANCEL: 'Cancel',
    SETTLE: 'Settle',
    upcycle: (ratio, name) => `Trade ${ratio.toLocaleString('en-US')} for 1 ${name}`,
    settled: (flavour, practical) => `${flavour} (${practical}) is settled.`,
    TRAVEL_THERE: 'Travel there',
    STAY: 'Stay here'
});
