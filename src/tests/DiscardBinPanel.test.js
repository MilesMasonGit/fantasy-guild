import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as DiscardBin from '../systems/board/DiscardBin.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, tokenName } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { summariseMat } from '../systems/board/MatSummary.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DiscardBinPanel, BIN_DROP_ID, binAccepts, dropIntoBin, refundText } from '../ui/components/board/DiscardBinPanel.jsx';
import { MatCapPopover } from '../ui/components/board/MatCapBadge.jsx';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * B3.2 — **the discard bin's UI**: drag a mat Token in, drag a binned one
 * back out, the nine-slot grid, the refund total and *Discard all (n)*. The
 * engine itself is `DiscardBin.test.js` (B3.1).
 */

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
const PLANK = 'fixture_bp_plank';
const NAIL = 'fixture_bp_nail';
registerItems({ [PLANK]: item(PLANK, 'Fixture Plank'), [NAIL]: item(NAIL, 'Fixture Nail') });

registerTokenTypes({
    fixture_bp_shed: {
        id: 'fixture_bp_shed', name: 'Fixture Bp Shed', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        shop: { price: [{ itemId: PLANK, quantity: 8 }, { itemId: NAIL, quantity: 3 }], section: 'logging' }
    },
    fixture_bp_hut: {
        id: 'fixture_bp_hut', name: 'Fixture Bp Hut', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        shop: { price: [{ itemId: PLANK, quantity: 4 }], section: 'logging' }
    }
});

const h = React.createElement;
const HALL = { x: 900, y: 700 };
let nextX = 200;

function put(typeId, point = null, origin = BoardState.ORIGIN.PLACED) {
    const at = point || { x: (nextX += 160), y: 300 };
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin);
    return BoardState.addToken(instance, at.x, at.y);
}

/** The payload `MatToken` carries for a Token dragged off the mat. */
const matPayload = (t, extra = {}) => ({ kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { instanceId: t.id }, ...extra });

/** Drop it on the bin as the drag system does: the Token is in the hand until the drop is handled. */
function dragIntoBin(t, extra) {
    TimedChanges.setInHand(t.id, true);
    try { return dropIntoBin(matPayload(t, extra)); }
    finally { TimedChanges.setInHand(t.id, false); }
}

const mount = () => render(h(DeckDndProvider, null, h(DiscardBinPanel)));
const bank = (id) => InventoryManager.getItemCount(id);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    nextX = 200;
    GameState.state.inventory.items = {};
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

describe('dragging a mat Token into the bin (FB-34)', () => {
    it('takes only a Token carried off the mat', () => {
        expect(binAccepts({ kind: DRAG_KIND.TOKEN, from: { instanceId: 't1' } })).toBe(true);
        expect(binAccepts({ kind: DRAG_KIND.TOKEN, from: { binnedId: 't1' } })).toBe(false);
        expect(binAccepts({ kind: DRAG_KIND.TOKEN, typeId: 'fixture_bp_shed' })).toBe(false);
        expect(binAccepts({ kind: DRAG_KIND.HERO, heroId: 'h1' })).toBe(false);
    });

    it('bins it even though the Token is still in the hand (fromHand)', () => {
        const shed = put('fixture_bp_shed');
        expect(dragIntoBin(shed)).toBeUndefined();
        expect(BoardState.getTokenById(shed.id)).toBeNull();
        expect(DiscardBin.isBinned(shed.id)).toBe(true);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
    });

    it('a full bin refuses: the Token stays on the mat, the reason is shown, the drop is a miss', () => {
        for (let i = 0; i < DiscardBin.BIN_SIZE; i++) expect(dragIntoBin(put('fixture_bp_hut'))).toBeUndefined();
        const shed = put('fixture_bp_shed');
        expect(dragIntoBin(shed)).toBe(false);
        expect(BoardState.getTokenById(shed.id)).toBe(shed);
        expect(NotificationSystem.warning).toHaveBeenCalledWith(`The bin is full (${DiscardBin.BIN_SIZE} Tokens)`);
    });

    it('the Guild Hall is refused and stays; its own miss message speaks, not a second warning', () => {
        const hall = put('token_guild_hall', HALL);
        expect(dragIntoBin(hall, { onMiss: () => null })).toBe(false);
        expect(BoardState.getTokenById(hall.id)).toBe(hall);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
        // Without an onMiss of its own, the engine's reason is shown.
        expect(dragIntoBin(hall)).toBe(false);
        expect(NotificationSystem.warning).toHaveBeenCalledWith('The Guild Hall cannot be discarded.');
    });
});

describe('dragging a binned Token back out (FB-34)', () => {
    it('unbins the same instance at the drop point', () => {
        const shed = put('fixture_bp_shed');
        dragIntoBin(shed);
        const point = { x: 1200, y: 800 };
        const res = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: shed.typeId, from: { binnedId: shed.id } }, point);
        expect(res?.success).toBe(true);
        expect(DiscardBin.isBinned(shed.id)).toBe(false);
        expect(BoardState.getTokenById(shed.id)).toBe(shed);
        expect({ x: shed.x, y: shed.y }).toEqual(point);
        // No copy was made.
        expect(BoardState.tokens().filter(t => t.typeId === 'fixture_bp_shed')).toHaveLength(1);
    });

    it('a Token no longer in the bin is refused with a reason, and nothing is made', () => {
        const res = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: 'fixture_bp_shed', from: { binnedId: 'nope' } }, { x: 1200, y: 800 });
        expect(res).toMatchObject({ success: false });
        expect(NotificationSystem.warning).toHaveBeenCalledWith('That Token is not in the bin');
        expect(BoardState.tokens().some(t => t.typeId === 'fixture_bp_shed')).toBe(false);
    });
});

describe('⭐ the bin panel (B3.2)', () => {
    it('is one drop target, with nine slots: an icon per binned Token, dashed circles for the rest', () => {
        const shed = put('fixture_bp_shed');
        const hut = put('fixture_bp_hut');
        dragIntoBin(shed);
        dragIntoBin(hut);
        const { container } = mount();
        const bin = container.querySelector('[data-discard-bin]');
        expect(bin.getAttribute('data-dnd-droppable-id')).toBe(BIN_DROP_ID);
        expect(bin.getAttribute('data-bin-count')).toBe('2');
        expect(container.querySelector('[data-bin-header]').textContent).toBe(`2/${DiscardBin.BIN_SIZE}`);

        const slots = [...container.querySelectorAll('[data-bin-slot]')];
        expect(slots).toHaveLength(DiscardBin.BIN_SIZE);
        const filled = slots.filter(s => s.getAttribute('data-bin-slot'));
        expect(filled.map(s => s.getAttribute('data-bin-slot'))).toEqual([shed.id, hut.id]);
        expect(filled.every(s => s.querySelector('img'))).toBe(true);
        const empty = slots.filter(s => !s.getAttribute('data-bin-slot'));
        expect(empty).toHaveLength(DiscardBin.BIN_SIZE - 2);
        expect(empty.every(s => s.className.includes('border-dashed') && !s.querySelector('img'))).toBe(true);
    });

    it('lists the refund total merged per item, and names it in the button', () => {
        dragIntoBin(put('fixture_bp_shed'));   // ⌊8/2⌋ planks + ⌊3/2⌋ nails = 4 + 1
        dragIntoBin(put('fixture_bp_hut'));    // ⌊4/2⌋ planks = 2
        const { container } = mount();
        const refund = container.querySelector('[data-bin-refund]');
        expect(refund.textContent).toContain('Fixture Plank');
        expect(refund.textContent).toContain('×6');
        expect(refund.textContent).toContain('Fixture Nail');
        expect(refund.textContent).toContain('×1');
        expect(container.querySelector('[data-discard-all]').textContent).toBe('Discard all (2)');
    });

    it('hovering a slot shows the Token\'s name and its own refund', async () => {
        const shed = put('fixture_bp_shed');
        dragIntoBin(shed);
        const { container } = mount();
        await act(async () => { fireEvent.mouseEnter(container.querySelector(`[data-bin-slot="${shed.id}"]`)); });
        const hover = container.querySelector('[data-bin-hover]').textContent;
        expect(hover).toContain(tokenName('fixture_bp_shed'));
        expect(hover).toContain('4× Fixture Plank, 1× Fixture Nail');
    });

    it('⭐ Discard all is the confirm: one press empties the bin and pays', async () => {
        dragIntoBin(put('fixture_bp_shed'));
        dragIntoBin(put('fixture_bp_hut'));
        expect(MatCap.placedCount()).toBe(2);
        const { container } = mount();
        await act(async () => { fireEvent.click(container.querySelector('[data-discard-all]')); });
        expect(DiscardBin.binContents()).toHaveLength(0);
        expect(bank(PLANK)).toBe(6);
        expect(bank(NAIL)).toBe(1);
        expect(MatCap.placedCount()).toBe(0);
        // The panel redraws from the bin's event.
        expect(container.querySelector('[data-bin-count]').getAttribute('data-bin-count')).toBe('0');
        expect(container.querySelector('[data-discard-all]').textContent).toBe('Discard all (0)');
        expect(container.querySelector('[data-bin-refund]').textContent).toContain('Nothing');
    });

    it('with an empty bin the button is harmless and not disabled', async () => {
        const { container } = mount();
        const button = container.querySelector('[data-discard-all]');
        expect(button.disabled).toBe(false);
        await act(async () => { fireEvent.click(button); });
        expect(NotificationSystem.info).not.toHaveBeenCalled();
    });

    it('redraws when a Token goes in', async () => {
        const { container } = mount();
        const shed = put('fixture_bp_shed');
        await act(async () => { dragIntoBin(shed); });
        expect(container.querySelector(`[data-bin-slot="${shed.id}"]`)).not.toBeNull();
    });

    it('refundText says so when nothing comes back', () => {
        expect(refundText([])).toBe('No refund');
    });
});

describe('the mat cap hover explains binned Tokens (B3.2)', () => {
    it('summariseMat counts binned placed Tokens, not spawned ones or the Hall', () => {
        const readers = { nameOf: (id) => id, isGuildHall: (t) => t.typeId === 'hall' };
        const s = summariseMat([{ typeId: 'oak' }], {
            ...readers,
            binned: [{ typeId: 'oak' }, { typeId: 'tree', origin: BoardState.ORIGIN.SPAWNED }, { typeId: 'hall' }]
        });
        expect(s.binned.count).toBe(1);
        expect(summariseMat([], readers).binned.count).toBe(0);
    });

    it('the popover totals mat + bin and adds an "In the bin" line', () => {
        const summary = {
            placed: { count: 3, groups: [{ typeId: 'oak', name: 'Oak', count: 3, blocked: 0, off: 0 }] },
            spawned: { count: 0, groups: [] },
            binned: { count: 2 }
        };
        render(h(MatCapPopover, { anchor: null, summary, cap: 40 }));
        const tip = document.body.querySelector('[data-mat-cap-popover]');
        expect(tip.textContent).toContain('Placed 5 of 40');
        expect(tip.querySelector('[data-mat-cap-binned]').textContent).toContain('In the bin 2 (counted');
    });
});
