import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { auditSaveContent, reportSaveContent } from '../systems/core/ContentAudit.js';
import { logger } from '../utils/Logger.js';
import { resetMissingContentWarnings } from '../utils/missingContent.js';

// A control item that resolves, so the tests below can prove the audit stays
// quiet about content it recognises. `fixtures/testTokens.js` is deliberately
// NOT imported: this suite audits *authored* content, and the fixture Tokens
// would become part of what it walks. See `fixtures/fixtureItems.js` (CR2-004).
import './fixtures/fixtureItems.js';

/**
 * CR2-120 — the ghosts a save carries after a rename.
 *
 * The boot-time audit (`ContentAudit.test.js`) walks the *authored* content set.
 * It has no way of seeing what a **save** is holding, so a Token that was
 * renamed after a save was written stayed completely invisible: all three of
 * the owner's live slots were carrying five ghost Tokens, and loading one
 * produced a clean console. This is the pass that makes that audible.
 *
 * ## Two things are being locked down here, and the second is the important one
 * 1. That a stale id in a save is named, once, in words the owner can act on.
 * 2. That **nothing is deleted**. The owner explicitly refused the pruning
 *    option (2026-08-26): content is re-authored continuously, so an id that
 *    looks missing this morning may be halfway through a rename, and deleting
 *    the player's Tokens on the strength of the registry being complete is not
 *    a trade worth making. The state must come out of this byte-for-byte
 *    identical to how it went in.
 */

/** A save shaped like the real thing, with only the fields this pass reads. */
function saveWith(board = {}, rest = {}) {
    return {
        board: { tiles: {}, vacancies: {}, tray: [], tokenBank: {}, maps: [], ...board },
        inventory: { items: {} },
        heroes: [],
        ...rest
    };
}

let warn;

/** Only the lines this feature produces. */
function ghostWarnings() {
    return warn.mock.calls.filter(([, text]) =>
        typeof text === 'string' && text.includes('does not exist, so'));
}

beforeEach(() => {
    resetMissingContentWarnings();
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warn.mockRestore();
});

describe('Finding what a save is still holding', () => {
    it('names a Token in the tray that no longer exists', () => {
        const ghosts = auditSaveContent(saveWith({
            tray: [{ typeId: 'token_forest', usesRemaining: 100 }]
        }));

        expect(ghosts).toHaveLength(1);
        expect(ghosts[0]).toMatchObject({ kind: 'Token', id: 'token_forest' });
        expect(ghosts[0].places).toEqual(['in the Token tray']);
    });

    it('says nothing about a Token that does exist', () => {
        const ghosts = auditSaveContent(saveWith({
            tray: [{ typeId: 'token_guild_hall' }],
            tokenBank: { token_oak_forest: [{ usesRemaining: 100 }] }
        }));

        expect(ghosts).toEqual([]);
    });

    it('looks in every place a save can hold a Token', () => {
        const ghosts = auditSaveContent(saveWith({
            tiles: { 3: { typeId: 'token_sawmill' } },
            vacancies: { 7: { typeId: 'token_trout_stream' } },
            tray: [{ typeId: 'token_forest' }],
            tokenBank: { token_oakwood_grove: [{ usesRemaining: 5 }] },
            maps: [{ id: 'map_x', typeId: 'token_stew_pot' }]
        }));

        expect(ghosts.map(g => g.id).sort()).toEqual([
            'token_forest', 'token_oakwood_grove', 'token_sawmill',
            'token_stew_pot', 'token_trout_stream'
        ]);
    });

    it('gathers one id found in two places into a single entry naming both', () => {
        // One rename is one thing to fix. Reporting it twice reads as two
        // problems and buries the count.
        const ghosts = auditSaveContent(saveWith({
            tray: [{ typeId: 'token_forest' }],
            tokenBank: { token_forest: [{ usesRemaining: 1 }] }
        }));

        expect(ghosts).toHaveLength(1);
        expect(ghosts[0].places).toEqual(['in the Token tray', 'in the Token Vault']);
    });

    it('finds a stale ITEM in the Bank and on a hero', () => {
        const ghosts = auditSaveContent(saveWith({}, {
            inventory: { items: { ghost_item: { quantity: 4 } } },
            heroes: [{ name: 'Brannor', equipment: ['ghost_blade', null, 'fixture_control_item'] }]
        }));

        expect(ghosts.map(g => g.id).sort()).toEqual(['ghost_blade', 'ghost_item']);
        const blade = ghosts.find(g => g.id === 'ghost_blade');
        expect(blade.kind).toBe('item');
        expect(blade.places).toEqual(['equipped by Brannor']);
    });

    it('treats an empty slot as empty, not as broken', () => {
        // A tray with holes in it and a hero with bare hands are normal.
        const ghosts = auditSaveContent(saveWith({
            tray: [null, { typeId: '' }, { typeId: null }]
        }, {
            heroes: [{ name: 'Nobody', equipment: [null, null] }]
        }));

        expect(ghosts).toEqual([]);
    });
});

describe('Saying it out loud', () => {
    it('reads as a sentence about the game, not as a stack trace', () => {
        reportSaveContent(saveWith({ tray: [{ typeId: 'token_forest' }] }));

        const lines = ghostWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('Saved game');

        const text = lines[0][1];
        expect(text).toContain('The Token "token_forest" does not exist');
        expect(text).toContain('in the Token tray');
        expect(text).not.toContain('undefined');
    });

    it('promises, in the message itself, that nothing was removed', () => {
        // The owner refused pruning. The report has to say so, or the first
        // reading of it is "what did it just throw away?".
        reportSaveContent(saveWith({ tray: [{ typeId: 'token_forest' }] }));
        expect(ghostWarnings()[0][1]).toContain('Nothing has been removed from your saved game');
    });

    it('does NOT send the reader to the boot audit, which cannot see saves', () => {
        // The four runtime call sites end by pointing at the start-up content
        // check. For a save id that check lists nothing, and sending someone to
        // look for it there is worse than saying nothing.
        reportSaveContent(saveWith({ tray: [{ typeId: 'token_forest' }] }));
        expect(ghostWarnings()[0][1]).not.toContain('The content check at start-up lists them all');
    });

    it('says it once, however many saves are loaded', () => {
        // Slots 0 and 1 hold the same four ghosts. Loading both should not
        // double the report.
        const save = saveWith({ tray: [{ typeId: 'token_forest' }] });
        reportSaveContent(save);
        reportSaveContent(save);
        reportSaveContent(saveWith({ tokenBank: { token_forest: [{}] } }));

        expect(ghostWarnings()).toHaveLength(1);
    });

    it('stays completely silent on a save with nothing wrong', () => {
        reportSaveContent(saveWith({ tray: [{ typeId: 'token_guild_hall' }] }));
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('It reports. It never repairs.', () => {
    it('leaves the save byte-for-byte identical', () => {
        const save = saveWith({
            tiles: { 3: { typeId: 'token_sawmill', usesRemaining: 12 } },
            tray: [{ typeId: 'token_forest', usesRemaining: 100 }],
            tokenBank: { token_oakwood_grove: [{ usesRemaining: 5 }, { usesRemaining: 5 }] }
        }, {
            inventory: { items: { ghost_item: { quantity: 4 } } },
            heroes: [{ name: 'Brannor', equipment: ['ghost_blade'] }]
        });
        const before = JSON.stringify(save);

        reportSaveContent(save);

        expect(JSON.stringify(save)).toBe(before);
    });

    it('never throws, whatever it is handed', () => {
        // This runs on every load. An exception here would break loading a
        // game in order to report on it.
        const warnConsole = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const junk of [undefined, null, {}, { board: null }, { board: { tray: 'nope' } },
            { heroes: 'nope' }, { inventory: { items: null } }]) {
            expect(() => reportSaveContent(junk)).not.toThrow();
        }
        warnConsole.mockRestore();
    });
});
