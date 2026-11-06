// @vitest-environment jsdom
// The Open Saves Folder button, on the slots and in Game settings: in the desktop build only, where
// saves are files. And the slot screen follows the folder: a save copied in while it is up shows
// once the window regains focus.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { SlotSelectionModal } from '../ui/modals/SlotSelectionModal.jsx';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';

const h = React.createElement;
const folderButton = () => document.querySelector('[data-save-folder]');
const row = (n) => document.querySelector(`[data-save-slot="${n}"]`);
const save = JSON.stringify({ version: '0.8.1', savedAt: 1, state: { heroes: [], meta: { totalPlaytime: 0 } } });

beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    localStorage.clear();
    SettingsManager.resetOptions();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    SaveFiles.useBackend(null);
});

describe('in a browser or a dev build', () => {
    it('neither the slots nor Game settings show the button', () => {
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        expect(row(1)).not.toBeNull();
        expect(folderButton()).toBeNull();
        cleanup();
        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        fireEvent.click(document.querySelector('[data-settings-tab="game"]'));
        expect(folderButton()).toBeNull();
    });
});

describe('in the desktop build', () => {
    let disk;
    beforeEach(async () => {
        disk = fakeSaveDisk();
        SaveFiles.useBackend(disk);
        await SaveManager.loadSaveFiles();
    });

    it('the slots show it, its tip gives the folder, and a click opens the folder', () => {
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        expect(folderButton().textContent).toContain('Open Saves Folder');
        expect(folderButton().title).toContain(disk.folderPath);
        fireEvent.click(folderButton());
        expect(disk.opened).toBe(1);
    });

    it('Game settings show it under Save Now', () => {
        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        expect(folderButton()).toBeNull();
        fireEvent.click(document.querySelector('[data-settings-tab="game"]'));
        fireEvent.click(folderButton());
        expect(disk.opened).toBe(1);
    });

    it('a save copied into the folder shows on its slot once the window regains focus', async () => {
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        expect(row(2).getAttribute('data-slot-state')).toBe('empty');
        disk.files.set('slot2.json', save);
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
            await SaveFiles.flush();
            await new Promise(r => setTimeout(r, 0));
        });
        expect(row(2).getAttribute('data-slot-state')).toBe('filled');
    });
});
