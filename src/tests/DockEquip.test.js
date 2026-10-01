// CR3-405 — a refused equip must not look like a success: no equip sound,
// the drop reported as a miss (so the ghost flies back), and a short
// notification saying why. Full dnd-kit drag simulation is unreliable in
// jsdom (master plan R7: "drag is unreliable to simulate — DnD findings need
// the owner's own hands"), so this tests the shared `equipOrAnnounce` helper
// every dock drop target now calls — exactly the seam the three `onDrop`s
// used to skip.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(),
    success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('CR3-405: equipOrAnnounce reports a refused equip instead of hiding it', () => {
    it('a refused equip (success:false) returns false and announces the engine\'s reason', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: false, error: 'No free slot in the loadout' })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_copper_pickaxe');
        expect(ok).toBe(false);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
        expect(NotificationSystem.warning).toHaveBeenCalledWith('No free slot in the loadout');
    });

    it('a mocked {success:false} with no error still announces something, rather than silence', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: false })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_x');
        expect(ok).toBe(false);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
    });

    it('a successful equip returns true and announces nothing', () => {
        const engine = { EquipmentManager: { equipItem: vi.fn(() => ({ success: true })) } };
        const ok = equipOrAnnounce(engine, 'h1', 'item_copper_pickaxe');
        expect(ok).toBe(true);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
    });
});
