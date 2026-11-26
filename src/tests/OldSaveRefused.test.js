// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SlotSelectionModal } from '../ui/modals/SlotSelectionModal.jsx';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { GAME_VERSION } from '../state/StateSchema.js';

/**
 * ⭐ Token spacing (owner 2026-11-26): Tokens now stand edges touching, and a save from before
 * holds them closer than that. The owner chose a fresh start over a migration: an older save is
 * refused with a plain message on the slot screen, and its files are left exactly as they were.
 */

const h = React.createElement;
const row = (n) => document.querySelector(`[data-save-slot="${n}"]`);
const REFUSED = 'This save is from a previous version and cannot be loaded. Please start a new game.';

const oldSave = (version = '0.8.1') => JSON.stringify({
    version, savedAt: Date.now() - 60_000,
    state: { heroes: [{ id: 'h0' }], meta: { guildName: 'The Lantern Company', totalPlaytime: 1000, version } }
});

/** Every localStorage key and its text, to prove a refusal wrote nothing. */
const storage = () => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));

beforeEach(() => {
    localStorage.clear();
    NotificationSystem.dismissAll();
});
afterEach(() => cleanup());

describe('⭐ the save version moved for the new spacing', () => {
    it('is 0.8.2: a 0.8.1 save is from before Tokens stood edges touching', () => {
        expect(GAME_VERSION).toBe('0.8.2');
    });
});

describe('⭐ an older save is refused, and left as it was', () => {
    it('its slot reads as an older version', () => {
        localStorage.setItem('tabletop_guild_slot_0', oldSave());
        expect(SaveManager.getSlotInfo(0)).toMatchObject({ slotIndex: 0, outdated: true, version: '0.8.1', guildName: 'The Lantern Company' });
        localStorage.setItem('tabletop_guild_slot_1', oldSave(GAME_VERSION));
        expect(SaveManager.getSlotInfo(1).outdated).toBe(false);
    });

    it('loading it is refused with the plain message; the save and its backup are untouched', async () => {
        localStorage.setItem('tabletop_guild_slot_0', oldSave());
        localStorage.setItem('tabletop_guild_slot_0_backup', oldSave());
        localStorage.setItem('tabletop_guild_last_slot', '0');
        const before = storage();
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(false);
        expect(NotificationSystem.getQueue().map(n => n.message)).toContain(REFUSED);
        expect(storage()).toEqual(before);
    });

    it('starting the slot opens nothing and writes nothing: no new guild is laid over it', async () => {
        localStorage.setItem('tabletop_guild_slot_2', oldSave());
        const before = storage();
        expect(await EngineBootstrap.startSlot(2, { catchUp: false })).toBe(false);
        expect(storage()).toEqual(before);
        expect(SaveManager.currentSlot).not.toBe(2);
    });
});

describe('⭐ the slot screen says so', () => {
    it('an older save shows as one, with its guild, the plain message and no Load', () => {
        localStorage.setItem('tabletop_guild_slot_0', oldSave());
        localStorage.setItem('tabletop_guild_slot_1', oldSave(GAME_VERSION));
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));

        expect(row(1).getAttribute('data-slot-state')).toBe('outdated');
        expect(row(1).textContent).toContain('Slot 1 — older version');
        expect(row(1).textContent).toContain('The Lantern Company');
        expect(row(1).querySelector('[data-slot-refusal]').textContent)
            .toBe('Saved by an older version of the game, so it can’t be opened. Start a new guild in an empty slot, or delete this save to free its slot.');
        expect([...row(1).querySelectorAll('button')].some(b => b.textContent.includes('Load'))).toBe(false);
        expect(row(1).querySelector('[data-slot-delete]')).not.toBeNull();

        // A save of this version is a plain filled slot.
        expect(row(2).getAttribute('data-slot-state')).toBe('filled');
        expect([...row(2).querySelectorAll('button')].some(b => b.textContent.includes('Load'))).toBe(true);
    });

    it('deleting it asks first, then frees the slot for a new guild', () => {
        localStorage.setItem('tabletop_guild_slot_0', oldSave());
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        fireEvent.click(row(1).querySelector('[data-slot-delete]'));
        expect(row(1).textContent).toContain('Delete forever?');
        expect(localStorage.getItem('tabletop_guild_slot_0')).not.toBeNull();
        fireEvent.click([...row(1).querySelectorAll('button')].find(b => b.textContent.includes('Confirm')));
        expect(localStorage.getItem('tabletop_guild_slot_0')).toBeNull();
        expect(row(1).getAttribute('data-slot-state')).toBe('empty');
        expect(row(1).textContent).toContain('New game');
    });
});
