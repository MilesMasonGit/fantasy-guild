import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { auditSaveContent, reportSaveContent } from '../systems/core/ContentAudit.js';
import { logger } from '../utils/Logger.js';
import { resetMissingContentWarnings } from '../utils/missingContent.js';

// A control item that resolves, so the tests below can prove the audit stays
// quiet about content it recognises. `fixtures/testTokens.js` is deliberately
// NOT imported: this suite audits *authored* content, and the fixture Tokens
// would become part of what it walks. See `fixtures/fixtureItems.js`.
import './fixtures/fixtureItems.js';

/**
 * the ghosts a save carries after a rename.
 */

/** A save shaped like the real thing, with only the fields this pass reads. */
function saveWith(board = {}, rest = {}) {
    return {
        board: { tokens: {}, ...board },
        inventory: { items: {} },
        heroes: [],
        ...rest
    };
}

let warn;

/**
 * A mat holding one Token of each type named. (The Token tray and the Token
 * Vault were two more places a save held Tokens until both retired in Token
 * Lifecycle 9.3; these tests used them and now use the mat.)
 */
const mat = (...typeIds) => ({
    tokens: Object.fromEntries(typeIds.map((typeId, i) => [`tok_${i}`, { id: `tok_${i}`, typeId, x: 100 + i * 100, y: 100 }]))
});

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
    it('names a Token on the mat that no longer exists', () => {
        const ghosts = auditSaveContent(saveWith(mat('token_forest')));

        expect(ghosts).toHaveLength(1);
        expect(ghosts[0]).toMatchObject({ kind: 'Token', id: 'token_forest' });
        expect(ghosts[0].places).toEqual(['on the playmat']);
    });

    it('says nothing about a Token that does exist', () => {
        const ghosts = auditSaveContent(saveWith(mat('token_guild_hall', 'token_oak_forest')));

        expect(ghosts).toEqual([]);
    });

    it('looks at every Token on the mat, the one place a save holds them now', () => {
        const ghosts = auditSaveContent(saveWith(mat('token_sawmill', 'token_forest', 'token_oakwood_grove')));

        // `board.maps` (9.1), the Token tray and the Token Vault (9.3) were
        // the other places; `migrateState` drops all three now.
        expect(ghosts.map(g => g.id).sort()).toEqual([
            'token_forest', 'token_oakwood_grove', 'token_sawmill'
        ]);
    });

    it('no longer reads the Token tray or the Token Vault of a pre-9.3 save', () => {
        const ghosts = auditSaveContent(saveWith({
            tray: [{ typeId: 'token_forest' }],
            tokenBank: { token_oakwood_grove: [{ usesRemaining: 5 }] }
        }));
        expect(ghosts).toEqual([]);
    });

    it('gathers one id found in two places into a single entry naming both', () => {
        // One rename is one thing to fix. Reporting it twice reads as two
        // problems and buries the count.
        const ghosts = auditSaveContent(saveWith({}, {
            inventory: { items: { ghost_item: { quantity: 4 } } },
            heroes: [{ name: 'Brannor', equipment: ['ghost_item'] }]
        }));

        expect(ghosts).toHaveLength(1);
        expect(ghosts[0].places).toEqual(['in the Bank', 'equipped by Brannor']);
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
        // A mat entry with no type and a hero with bare hands are normal.
        const ghosts = auditSaveContent(saveWith({
            tokens: { a: null, b: { typeId: '' }, c: { typeId: null } }
        }, {
            heroes: [{ name: 'Nobody', equipment: [null, null] }]
        }));

        expect(ghosts).toEqual([]);
    });
});

describe('Saying it out loud', () => {
    it('reads as a sentence about the game, not as a stack trace', () => {
        reportSaveContent(saveWith(mat('token_forest')));

        const lines = ghostWarnings();
        expect(lines).toHaveLength(1);
        expect(lines[0][0]).toBe('Saved game');

        const text = lines[0][1];
        expect(text).toContain('The Token "token_forest" does not exist');
        expect(text).toContain('on the playmat');
        expect(text).not.toContain('undefined');
    });

    it('promises, in the message itself, that nothing was removed', () => {
        // The owner refused pruning. The report has to say so, or the first
        // reading of it is "what did it just throw away?".
        reportSaveContent(saveWith(mat('token_forest')));
        expect(ghostWarnings()[0][1]).toContain('Nothing has been removed from your saved game');
    });

    it('does NOT send the reader to the boot audit, which cannot see saves', () => {
        // The four runtime call sites end by pointing at the start-up content
        // check. For a save id that check lists nothing, and sending someone to
        // look for it there is worse than saying nothing.
        reportSaveContent(saveWith(mat('token_forest')));
        expect(ghostWarnings()[0][1]).not.toContain('The content check at start-up lists them all');
    });

    it('says it once, however many saves are loaded', () => {
        // Slots 0 and 1 hold the same four ghosts. Loading both should not
        // double the report.
        const save = saveWith(mat('token_forest'));
        reportSaveContent(save);
        reportSaveContent(save);
        reportSaveContent(saveWith(mat('token_forest', 'token_guild_hall')));

        expect(ghostWarnings()).toHaveLength(1);
    });

    it('stays completely silent on a save with nothing wrong', () => {
        reportSaveContent(saveWith(mat('token_guild_hall')));
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('It reports. It never repairs.', () => {
    it('leaves the save byte-for-byte identical', () => {
        const save = saveWith({
            tokens: {
                tok_a: { id: 'tok_a', typeId: 'token_sawmill', x: 544, y: 64, usesRemaining: 12 },
                tok_b: { id: 'tok_b', typeId: 'token_forest', x: 700, y: 64, usesRemaining: 100 }
            }
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
