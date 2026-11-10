// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { VitalBar, HP_TONE } from '../ui/components/base/VitalBar.jsx';
import { HealthBar } from '../ui/components/board/HealthBar.jsx';
import { HP_COLOUR } from '../ui/components/board/healthBar.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { useHeroSheetRequests } from '../ui/hooks/useHeroSheetRequests.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { clearEquipBubbles } from '../ui/components/dock/equipBubbles.js';

const h = React.createElement;
const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();

afterEach(() => { cleanup(); clearEquipBubbles(); });

describe('every HP bar is the light red, whatever the health, a hero\'s or an enemy\'s (T-317)', () => {
    it('the hero bar, the drawer, the fight window and its tabs (VitalBar): the light red at any health', () => {
        expect(HP_TONE.fill).toBe(HP_COLOUR);
        for (const value of [90, 40, 10]) {
            const r = render(h(VitalBar, { value, max: 100 }));
            expect(hex(r.container.querySelector('[data-hp-fill]').style.background)).toBe(HP_COLOUR.toUpperCase());
            cleanup();
        }
    });

    it('over the fighters on the mat (HealthBar): a hero and an enemy alike, at any health', () => {
        for (const who of ['hero', 'enemy']) {
            for (const cur of [30, 12, 3]) {
                const r = render(h(HealthBar, { who, cur, max: 30 }));
                expect(hex(r.container.querySelector('[data-health-fill]').style.background)).toBe(HP_COLOUR.toUpperCase());
                cleanup();
            }
        }
    });

    it('no green, amber and red fills are left to pick from', async () => {
        const bar = await import('../ui/components/base/VitalBar.jsx');
        expect(bar.TONE_FILL).toBeUndefined();
        expect(bar.HERO_HP_TONE).toBeUndefined();
    });
});

describe('an item handed from one hero to another keeps the panel where it is', () => {
    const Host = ({ open }) => { useHeroSheetRequests(open); return null; };
    const world = { itemOf: () => ({ name: 'Iron Woodaxe' }), unmetOf: () => null, skillName: id => id, isStack: () => false, bankCount: () => 0 };

    it('a hand-over opens nobody\'s panel; a plain equip still opens the taker\'s', async () => {
        const open = vi.fn();
        render(h(Host, { open }));
        const equipment = {
            equipItem: vi.fn((heroId) => {
                EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot: 0, itemId: 'x', action: 'equip' });
                return { success: true };
            })
        };
        equipOrAnnounce(equipment, 'h2', 'x', null, { fromHeroId: 'h1', fromSlot: 0 }, world);
        await new Promise(r => setTimeout(r, 0));
        expect(open).not.toHaveBeenCalled();
        equipOrAnnounce(equipment, 'h2', 'x', null, null, world);
        await new Promise(r => setTimeout(r, 0));
        expect(open).toHaveBeenCalledWith('h2');
    });

    it('a drop on a hero on the bar asks for their panel only when the item came from the Bank (source)', () => {
        const code = fs.readFileSync(path.resolve(__dirname, '../ui/components/dock/DockHeroFigure.jsx'), 'utf8');
        expect(code).toContain('if (p.fromHeroId == null) EventBus.publish(UI_EVENTS.INSPECT_HERO, { heroId, afterDrop: true });');
    });
});
