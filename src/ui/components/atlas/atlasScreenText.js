// the Atlas screen's own words; the engine's refusals are regionNames.TEXT

export const SCREEN_TEXT = Object.freeze({
    TITLE: 'Atlas',
    TAB_REGIONS: 'Regions',
    TAB_CARTOGRAPHY: 'Cartography',
    CLOSE: 'Close',

    HERE: 'Here',
    TRAVEL: 'Travel',
    ARCHIVE: 'Archive',
    RESTORE: 'Restore',
    ABANDON: 'Abandon',
    RENAME: 'Rename',
    ARCHIVED_HEADING: 'Archive',
    settledDay: (day) => `Settled day ${day}`,
    tokens: (n) => `${n} Token${n === 1 ? '' : 's'}`,
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

/** The guild's day a game time falls on: day 1 is the first 24 hours. */
export function dayOf(gameTimeMs) {
    const ms = Number(gameTimeMs);
    return Math.floor((Number.isFinite(ms) && ms > 0 ? ms : 0) / 86400000) + 1;
}
