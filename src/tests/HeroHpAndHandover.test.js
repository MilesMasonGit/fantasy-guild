// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { useHeroSheetRequests } from '../ui/hooks/useHeroSheetRequests.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { clearEquipBubbles } from '../ui/components/dock/equipBubbles.js';

const h = React.createElement;

afterEach(() => { cleanup(); clearEquipBubbles(); });

describe('an item handed from one hero to another keeps the panel where it is', () => {
    const Host = ({ open }) => { useHeroSheetRequests(open); return null; };
    const world = { itemOf: () => ({ name: 'Iron Woodaxe' }), skillName: id => id, isStack: () => false, bankCount: () => 0 };

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
