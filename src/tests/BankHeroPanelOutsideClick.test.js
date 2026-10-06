import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

// Which heroes are out on the mat: stood in, so no board has to be booted.
const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));
// The real sheet pulls in a lot of machinery this test doesn't need; stand in
// a small one with a clickable control, so a pointerdown has somewhere to land.
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: ({ heroId }) => React.createElement(
        'div', { 'data-testid': 'hero-sheet', 'data-hero-sheet-for': heroId },
        React.createElement('button', { 'data-testid': 'sheet-edit-btn' }, 'Edit')
    )
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';

const h = React.createElement;

const hero = (id, name, hp = 100) => (
    { id, name, spriteId: 'hero_recruit_0', hp: { current: hp, max: 100 }, status: 'idle', equipment: {} }
);

const engine = {
    GameState,
    EventBus,
    BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: { equipItem: vi.fn() }
};

/**
 * Both `BottomHeroDock` and `BankHeroPanel` are mounted together, as they are
 * on screen with the Bank open: the bottom dock never unmounts just because
 * the Bank drawer is covering it ( finding), so its outside-click listener is
 * live the whole time.
 */
function mount({ onCloseHero } = {}) {
    return render(
        h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null,
                h('div', null,
                    h(BottomHeroDock, { selectedHeroId: 'h1', onCloseHero }),
                    h('div', { 'data-testid': 'bank-panel-wrapper' },
                        h(BankHeroPanel, { selectedHeroId: 'h1', onCloseHero, menuRight: false })),
                    h('div', { 'data-testid': 'playmat' }, 'the playmat')
                )
            )
        )
    );
}

beforeEach(() => {
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric')];
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('CR3-450: the Bank-side hero sheet and the bottom dock\'s outside-click listener', () => {
    it('does NOT close when a pointerdown lands inside the Bank-side panel', () => {
        const onCloseHero = vi.fn();
        const view = mount({ onCloseHero });
        const btn = view.container.querySelector('[data-testid="bank-panel-wrapper"] [data-testid="sheet-edit-btn"]');
        expect(btn).not.toBeNull();
        fireEvent.pointerDown(btn);
        expect(onCloseHero).not.toHaveBeenCalled();
    });

    it('still closes when a pointerdown lands on the playmat (intended, must survive the fix)', () => {
        const onCloseHero = vi.fn();
        const view = mount({ onCloseHero });
        const mat = view.container.querySelector('[data-testid="playmat"]');
        fireEvent.pointerDown(mat);
        expect(onCloseHero).toHaveBeenCalledTimes(1);
    });
});
