import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as TokenGroups from '../systems/board/TokenGroups.js';

/**
 * Token Vault tabs (D-242, D-243).
 *
 * ⚠️ **Tabs are system-owned, mirroring the Bank's.** `BankTabStrip` calls them
 * "the fixed, system-owned bank tabs… No player create/rename/delete", and
 * `GuildUpgradeManager._ensureBankTabs` pads the list up to `maxTabs`. So the
 * only thing a player controls is **which tab a Token lives in** — these tests
 * pin that, the padding, and the two failure modes that would be invisible once
 * shipped: a Token filed into a tab that stops existing, and unfiled Tokens
 * losing track of which tab is topmost.
 */

vi.mock('../systems/core/EventBus.js', () => ({
    EventBus: { publish: vi.fn(), subscribe: vi.fn(() => () => {}) }
}));

const rows = (...typeIds) => typeIds.map(typeId => ({ typeId }));

beforeEach(() => {
    GameState.initNew();
    GameState.state.board = { tiles: {}, tokenBank: {}, tray: [], heroTiles: {}, vacancies: {} };
});

describe('The tab strip is padded to the unlocked count', () => {
    it('backfills tabs for a save written before they existed — no migration', () => {
        expect(GameState.state.board.tokenGroups).toBeUndefined();

        const tabs = TokenGroups.list();

        expect(tabs).toHaveLength(TokenGroups.TOKEN_TAB_FREE);
        expect(GameState.state.board.tokenGroups).toBeDefined();
    });

    it('grows the strip when the Guild Hall unlocks more, never past the cap', () => {
        GameState.state.board.tokenTabsUnlocked = 8;
        expect(TokenGroups.list()).toHaveLength(8);

        GameState.state.board.tokenTabsUnlocked = 99;
        expect(TokenGroups.unlockedCount()).toBe(TokenGroups.TOKEN_TAB_CAP);
        expect(TokenGroups.list()).toHaveLength(TokenGroups.TOKEN_TAB_CAP);
    });

    it('never shrinks the strip if the unlock count drops', () => {
        GameState.state.board.tokenTabsUnlocked = 8;
        expect(TokenGroups.list()).toHaveLength(8);

        // A tab holding filed Tokens must not evaporate under them.
        GameState.state.board.tokenTabsUnlocked = 5;
        expect(TokenGroups.list()).toHaveLength(8);
    });
});

describe('Filing — the only thing the player controls', () => {
    /**
     * The item side has no auto-classification: an explicit override, else the
     * topmost tab (`BankTab.jsx`). Tokens must match, or the two banks teach
     * different rules.
     */
    it('puts every unfiled Token in the topmost tab', () => {
        const first = TokenGroups.list()[0].id;

        expect(TokenGroups.groupIdFor('token_forest')).toBe(first);
        expect(TokenGroups.groupIdFor('token_anything_at_all')).toBe(first);
    });

    it('files a type into another tab, and back again', () => {
        GameState.state.board.tokenTabsUnlocked = 3;
        const [first, second] = TokenGroups.list();

        expect(TokenGroups.assign('token_forest', second.id)).toBe(true);
        expect(TokenGroups.groupIdFor('token_forest')).toBe(second.id);

        TokenGroups.assign('token_forest', first.id);
        expect(TokenGroups.groupIdFor('token_forest')).toBe(first.id);
        // Filing back to the default stores no override at all.
        expect(GameState.state.board.tokenGroups.overrides.token_forest).toBeUndefined();
    });

    it('refuses to file into a tab that does not exist', () => {
        expect(TokenGroups.assign('token_forest', 'no-such-tab')).toBe(false);
    });

    it('sorts rows into their tabs, in display order', () => {
        GameState.state.board.tokenTabsUnlocked = 3;
        const [first, second] = TokenGroups.list();
        TokenGroups.assign('token_forest', second.id);

        const out = TokenGroups.grouped(rows('token_forest', 'token_ore_vein'));

        expect(out).toHaveLength(3);
        expect(out[0].id).toBe(first.id);
        expect(out[0].rows.map(r => r.typeId)).toEqual(['token_ore_vein']);
        expect(out[1].rows.map(r => r.typeId)).toEqual(['token_forest']);
        expect(out[2].rows).toEqual([]);
    });
});

describe('Repairing damaged state', () => {
    /**
     * The failure that would strand a Token invisibly: an override pointing at a
     * tab that isn't there. It must fall back to the topmost tab, not disappear
     * into a bucket nothing renders.
     *
     * ⚠️ Note what this test could *not* be written as. Deleting a real tab does
     * not reproduce it — `pad()` immediately recreates it, because tabs are
     * system-owned and the strip never shrinks. **A live tab genuinely cannot
     * vanish under a filed Token**, which is a property worth having rather than
     * a gap. This exercises the remaining route: a save whose override was
     * corrupted, or written against a tab scheme that no longer exists.
     */
    it('returns a Token to the topmost tab when its override points nowhere', () => {
        TokenGroups.ensure();
        const g = GameState.state.board.tokenGroups;
        g.overrides.token_forest = 'a-tab-that-never-existed';

        expect(TokenGroups.groupIdFor('token_forest')).toBe(TokenGroups.list()[0].id);
        expect(TokenGroups.grouped(rows('token_forest'))[0].rows).toHaveLength(1);
        expect(g.overrides.token_forest).toBeUndefined();
    });

    it('rebuilds from an empty group order', () => {
        GameState.state.board.tokenGroups = { groupOrder: [], groupDefs: {}, overrides: {} };
        expect(TokenGroups.list()).toHaveLength(TokenGroups.TOKEN_TAB_FREE);
    });

    it('drops order entries that have no definition', () => {
        TokenGroups.ensure();
        GameState.state.board.tokenGroups.groupOrder.push('ghost-tab');

        const tabs = TokenGroups.list();
        expect(tabs.map(t => t.id)).not.toContain('ghost-tab');
        expect(tabs).toHaveLength(TokenGroups.TOKEN_TAB_FREE);
    });

    it('is stable across repeated reads', () => {
        const once = TokenGroups.list().map(t => t.id);
        const twice = TokenGroups.list().map(t => t.id);
        expect(twice).toEqual(once);
    });
});
