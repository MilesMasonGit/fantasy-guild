// A refused equip must not look like a success: no equip sound, the drop reported as a miss (so
// the ghost flies back), and a speech bubble over that hero on the hero bar saying why, with the
// numbers (never a notification, never the screen callout). A success says what was equipped.
// Full dnd-kit drag simulation is unreliable in jsdom, so this tests the shared
// `equipOrAnnounce` helper every equip drop target calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { equipOrAnnounce, equipRefusalText, equipSuccessText } from '../ui/components/dock/dockEquip.js';
import {
    equipBubbleOf, clearEquipBubbles, EQUIP_BUBBLE_MS, EQUIP_BUBBLE_FADE_MS
} from '../ui/components/dock/equipBubbles.js';
import { SPEECH_TONE } from '../ui/components/board/speechTone.js';

let callouts;
let toasts;
let offs;

beforeEach(() => {
    callouts = [];
    toasts = [];
    clearEquipBubbles();
    offs = [
        EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => callouts.push(p.text)),
        EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_ADDED, (n) => toasts.push(n))
    ];
});
afterEach(() => {
    offs.forEach(off => off());
    clearEquipBubbles();
    vi.useRealTimers();
});

// A stand-in world for the words: an item, a hero and the Bank's count.
const world = {
    itemOf: (id) => ({
        k1_mythril_scimitar: { name: 'Mythril Scimitar' },
        food_shrimp: { name: 'Shrimp' },
        tool_iron_woodaxe: { name: 'Iron Woodaxe' }
    }[id] || null),
    unmetOf: (heroId, itemId) => (itemId === 'k1_mythril_scimitar' ? { skill: 'melee', level: 40, have: 12 } : null),
    skillName: (id) => ({ melee: 'Melee' }[id] || id),
    isStack: (id) => id === 'food_shrimp',
    bankCount: (id) => (id === 'food_shrimp' ? 4600 : 0)
};

describe('equip bubbles: the words', () => {
    it('a level refusal names the item, the skill and both numbers', () => {
        expect(equipRefusalText('h1', 'k1_mythril_scimitar', 'Needs Melee 40', world))
            .toBe("Can't equip Mythril Scimitar. Melee skill too low. (12/40)");
    });

    it('any other refusal keeps the engine\'s reason, ending in a full stop', () => {
        expect(equipRefusalText('h1', 'tool_iron_woodaxe', 'No free slot in the loadout', world))
            .toBe("Can't equip Iron Woodaxe. No free slot in the loadout.");
        expect(equipRefusalText('h1', 'tool_iron_woodaxe', 'Villagers cannot equip items.', world))
            .toBe("Can't equip Iron Woodaxe. Villagers cannot equip items.");
    });

    it('a success names the item, and a stack linked to the Bank its short count', () => {
        expect(equipSuccessText('tool_iron_woodaxe', world)).toBe('Equipped Iron Woodaxe');
        expect(equipSuccessText('food_shrimp', world)).toBe('Equipped Shrimp x4.6k');
    });
});

describe('equipOrAnnounce speaks over the hero on the bar', () => {
    it('a refused equip returns false and puts the reason in a red bubble over that hero, not a callout', () => {
        const equipment = { equipItem: vi.fn(() => ({ success: false, error: 'No free slot in the loadout' })) };
        const ok = equipOrAnnounce(equipment, 'h1', 'tool_iron_woodaxe', null, null, world);
        expect(ok).toBe(false);
        expect(equipBubbleOf('h1')).toMatchObject({ text: "Can't equip Iron Woodaxe. No free slot in the loadout.", tone: SPEECH_TONE.CANT });
        expect(callouts).toEqual([]);
        expect(toasts).toEqual([]);
    });

    it('a refusal with no reason still says something', () => {
        const equipment = { equipItem: vi.fn(() => ({ success: false })) };
        expect(equipOrAnnounce(equipment, 'h1', 'tool_iron_woodaxe', null, null, world)).toBe(false);
        expect(equipBubbleOf('h1').text).toBe("Can't equip Iron Woodaxe. Could not equip that.");
    });

    it('a successful equip returns true and says so in a plain bubble', () => {
        const equipment = { equipItem: vi.fn(() => ({ success: true })) };
        expect(equipOrAnnounce(equipment, 'h1', 'tool_iron_woodaxe', null, null, world)).toBe(true);
        expect(equipBubbleOf('h1')).toMatchObject({ text: 'Equipped Iron Woodaxe', tone: SPEECH_TONE.PLAIN });
        expect(callouts).toEqual([]);
    });

    it('moving an item between a hero\'s own slots says nothing on success', () => {
        const equipment = { moveItem: vi.fn(() => ({ success: true })), equipItem: vi.fn() };
        const ok = equipOrAnnounce(equipment, 'h1', 'tool_iron_woodaxe', 3, { fromHeroId: 'h1', fromSlot: 0 }, world);
        expect(ok).toBe(true);
        expect(equipment.moveItem).toHaveBeenCalledWith('h1', 'tool_iron_woodaxe', 0, 3);
        expect(equipBubbleOf('h1')).toBeNull();
    });

    it('the bubble fades and is gone after about three seconds; a newer one replaces it', () => {
        vi.useFakeTimers();
        const equipment = { equipItem: vi.fn(() => ({ success: true })) };
        equipOrAnnounce(equipment, 'h1', 'tool_iron_woodaxe', null, null, world);
        equipOrAnnounce(equipment, 'h1', 'food_shrimp', null, null, world);
        expect(equipBubbleOf('h1').text).toBe('Equipped Shrimp x4.6k');
        vi.advanceTimersByTime(EQUIP_BUBBLE_MS - EQUIP_BUBBLE_FADE_MS);
        expect(equipBubbleOf('h1').fading).toBe(true);
        vi.advanceTimersByTime(EQUIP_BUBBLE_FADE_MS);
        expect(equipBubbleOf('h1')).toBeNull();
        expect(EQUIP_BUBBLE_MS).toBe(3000);
    });
});
