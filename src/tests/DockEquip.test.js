// a refused equip must not look like a success: no equip sound, the drop
// reported as a miss (so the ghost flies back), and a callout where the item was
// let go saying why (never a notification). Full dnd-kit drag simulation is
// unreliable in jsdom (master plan R7: "drag is unreliable to simulate — DnD
// findings need the owner's own hands"), so this tests the shared
// `equipOrAnnounce` helper every dock drop target now calls — exactly the seam
// the three `onDrop`s used to skip.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';

let said;
let toasts;
let offs;

beforeEach(() => {
    said = [];
    toasts = [];
    offs = [
        EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text)),
        EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_ADDED, (n) => toasts.push(n))
    ];
});
afterEach(() => offs.forEach(off => off()));

describe('CR3-405: equipOrAnnounce reports a refused equip instead of hiding it', () => {
    it('a refused equip (success:false) returns false and says the engine\'s reason as a callout', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: false, error: 'No free slot in the loadout' })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_copper_pickaxe');
        expect(ok).toBe(false);
        expect(said).toEqual(['No free slot in the loadout']);
        expect(toasts).toEqual([]);
    });

    it('a mocked {success:false} with no error still says something, rather than silence', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: false })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_x');
        expect(ok).toBe(false);
        expect(said).toEqual(['Could not equip that']);
    });

    it('a successful equip returns true and says nothing', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: true })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_copper_pickaxe');
        expect(ok).toBe(true);
        expect(said).toEqual([]);
    });
});
