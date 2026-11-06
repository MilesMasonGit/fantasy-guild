import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Demolition from '../systems/board/Demolition.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { neededToolOf, toolItemFor } from '../config/registries/toolKinds.js';
import { marksFor, setHintTarget, hintsOf, hintsShowing, subscribeHints } from '../ui/components/board/dragHints.js';

/**
 * ⭐ The drag hints: while a hero is carried over a Token every hero shows the tool and the skill it
 * needs, each passing or failing by the game's own gates (`WorkCheck.heroReason`), or over an enemy
 * the items in their hands. Worked out once per Token entered.
 */

const hand = (id, extra) => ({ id, name: id, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
registerItems({
    dh_pick: hand('dh_pick', { tool: { kind: 'pickaxe', tier: 1 } }),
    dh_iron_pick: hand('dh_iron_pick', { tool: { kind: 'pickaxe', tier: 2 } }),
    dh_rod: hand('dh_rod', { tool: { kind: 'fishing_rod', tier: 1 } }),
    dh_net: hand('dh_net', { tool: { kind: 'fishing_net', tier: 3 } }),
    dh_sword: hand('dh_sword', { type: 'weapon' }),
    dh_shield: hand('dh_shield', { type: 'armor', offHand: true }),
    dh_greatsword: hand('dh_greatsword', { type: 'weapon', hands: 2 }),
    dh_ring: { id: 'dh_ring', name: 'dh_ring', type: 'armor', equipSlot: 'trinket', stackable: true }
});

const worked = (id, skill, needsTool, skillRequired = 1, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 10, size: 1, sprite: 's_nature',
    ...(needsTool ? { needsTool } : {}),
    config: skill ? { skill, skillRequired, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] } : null,
    ...extra
});
const catches = [{ itemId: 'dh_ring', weight: 1 }];
registerTokenTypes({
    dh_vein: worked('dh_vein', 'mining', { kind: 'pickaxe', minTier: 1 }),
    dh_deep_vein: worked('dh_deep_vein', 'mining', { kind: 'pickaxe', minTier: 2 }),
    dh_gated_vein: worked('dh_gated_vein', 'mining', { kind: 'pickaxe', minTier: 1 }, 20),
    dh_bush: worked('dh_bush', 'foraging', null, 5),
    dh_rock: worked('dh_rock', null, { kind: 'pickaxe', minTier: 1 }),
    dh_water: worked('dh_water', 'fishing', null, 1, {
        catchPools: [{ tool: 'fishing_rod', catches }, { tool: 'fishing_net', catches }]
    }),
    dh_wolf: {
        id: 'dh_wolf', name: 'dh_wolf', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, size: 1,
        sprite: 's_nature', enemy: { level: 2, style: 'melee' }
    }
});

/** A hero holding `equipment` (copies of their own, so every tool counts) with these skills. */
function hero(id, skills, equipment = []) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 1, skills: out, hp: { current: 100, max: 100 },
        equipment, heldCopies: equipment.map(Boolean)
    };
}

let n = 0;
const token = (typeId) => ({ id: `dh_${++n}`, typeId, x: 0, y: 0 });

/** heroReason's verdict, to check the marks against the game's own answer. */
const reason = (heroId, instance) => WorkCheck.heroReason(heroId, getTokenType(instance.typeId).config, instance);

beforeEach(() => {
    GameState.initNew();
    setHintTarget(null);
});

describe('a worked Token: the tool and the skill, each pass or fail', () => {
    it('the right tool and the level: both green, the hero\'s own tool shown', () => {
        GameState.state.heroes = [hero('a', { mining: 5 }, ['dh_pick'])];
        const vein = token('dh_vein');
        expect(marksFor('a', vein)).toEqual({
            kind: 'work',
            tool: { itemId: 'dh_pick', pass: true },
            skill: { skillId: 'mining', level: 5, pass: true }
        });
        expect(reason('a', vein)).toBeNull();
    });

    it('no tool: the lowest tier that will do, red; the skill still green', () => {
        GameState.state.heroes = [hero('a', { mining: 5 }, [])];
        const vein = token('dh_vein');
        const m = marksFor('a', vein);
        expect(m.tool).toEqual({ itemId: toolItemFor(neededToolOf(getTokenType('dh_vein')), getAllItems()), pass: false });
        expect(m.skill.pass).toBe(true);
        expect(reason('a', vein)).toBe(ALERT.NO_TOOL);
    });

    it('a tool too weak (a copper pickaxe on an iron vein): red, showing the tier that will do', () => {
        GameState.state.heroes = [hero('a', { mining: 5 }, ['dh_pick'])];
        const deep = token('dh_deep_vein');
        const m = marksFor('a', deep);
        expect(m.tool.pass).toBe(false);
        expect(m.tool.itemId).not.toBe('dh_pick');
        expect(getAllItems()[m.tool.itemId].tool.tier).toBe(2);
        expect(reason('a', deep)).toBe(ALERT.NO_TOOL);

        GameState.state.heroes = [hero('b', { mining: 5 }, ['dh_pick', 'dh_iron_pick'])];
        expect(marksFor('b', deep).tool).toEqual({ itemId: 'dh_iron_pick', pass: true });
    });

    it('the level too low: the skill red with the hero\'s own level, the tool read apart', () => {
        GameState.state.heroes = [hero('a', { mining: 3 }, ['dh_pick'])];
        const gated = token('dh_gated_vein');
        const m = marksFor('a', gated);
        expect(m.skill).toEqual({ skillId: 'mining', level: 3, pass: false });
        expect(m.tool).toEqual({ itemId: 'dh_pick', pass: true });
        expect(reason('a', gated)).toBe(ALERT.ACCESS);
    });

    it('the skill mark passes exactly when the level gate of heroReason does, the level shown its own', () => {
        GameState.state.heroes = [hero('lo', { mining: 19 }, ['dh_pick']), hero('hi', { mining: 20 }, ['dh_pick'])];
        const gated = token('dh_gated_vein');
        expect(marksFor('lo', gated).skill).toEqual({ skillId: 'mining', level: 19, pass: false });
        expect(marksFor('hi', gated).skill).toEqual({ skillId: 'mining', level: 20, pass: true });
        expect(reason('lo', gated)).toBe(ALERT.ACCESS);
        expect(reason('hi', gated)).toBeNull();
    });

    it('water takes any of its kinds at any tier, the hero\'s own shown; none held shows its first kind, red', () => {
        const water = token('dh_water');
        GameState.state.heroes = [
            hero('rod', { fishing: 1 }, ['dh_rod']),
            hero('net', { fishing: 1 }, ['dh_net']),
            hero('both', { fishing: 1 }, ['dh_net', 'dh_rod']),
            hero('none', { fishing: 1 }, ['dh_pick'])
        ];
        expect(marksFor('rod', water).tool).toEqual({ itemId: 'dh_rod', pass: true });
        expect(marksFor('net', water).tool).toEqual({ itemId: 'dh_net', pass: true });
        expect(marksFor('both', water).tool).toEqual({ itemId: 'dh_net', pass: true });
        const none = marksFor('none', water).tool;
        expect(none.pass).toBe(false);
        expect(getAllItems()[none.itemId].tool.kind).toBe('fishing_rod');
        for (const id of ['rod', 'net', 'both']) expect(reason(id, water)).toBeNull();
        expect(reason('none', water)).toBe(ALERT.NO_TOOL);
    });

    it('a Token with no tool need: the skill mark only', () => {
        GameState.state.heroes = [hero('a', { foraging: 9 }), hero('b', { foraging: 2 })];
        const bush = token('dh_bush');
        expect(marksFor('a', bush)).toEqual({ kind: 'work', tool: null, skill: { skillId: 'foraging', level: 9, pass: true } });
        expect(marksFor('b', bush).skill.pass).toBe(false);
    });

    it('a Token needing nothing (no skill named) shows nothing, as heroReason gates nobody there', () => {
        GameState.state.heroes = [hero('a', { mining: 9 })];
        const rock = token('dh_rock');
        expect(marksFor('a', rock)).toBeNull();
        expect(WorkCheck.heroReason('a', getTokenType('dh_rock').config, rock)).toBeNull();
    });

    it('a Token marked for demolition asks Construction and no tool', () => {
        GameState.state.heroes = [hero('a', { mining: 9 }, [])];
        const vein = token('dh_vein');
        expect(WorkCheck.toolNeedOf(vein)).toEqual({ kind: 'pickaxe', minTier: 1 });
        vein.demolish = true;
        expect(Demolition.isMarked(vein)).toBe(true);
        const m = marksFor('a', vein);
        expect(m.tool).toBeNull();
        expect(m.skill.skillId).toBe(Demolition.DEMOLITION_CONFIG.skill);
        expect(WorkCheck.toolNeedOf(vein)).toBeNull();
    });
});

describe('an enemy: the hand items, no pass or fail', () => {
    const wolf = () => token('dh_wolf');

    it('one-handed items one each, in grid order; nothing else worn', () => {
        GameState.state.heroes = [hero('a', { melee: 1 }, ['dh_ring', 'dh_sword', 'dh_shield'])];
        expect(marksFor('a', wolf())).toEqual({ kind: 'hands', items: ['dh_sword', 'dh_shield'] });
    });

    it('a two-handed weapon once', () => {
        GameState.state.heroes = [hero('a', { melee: 1 }, ['dh_greatsword'])];
        expect(marksFor('a', wolf())).toEqual({ kind: 'hands', items: ['dh_greatsword'] });
    });

    it('bare hands show nothing', () => {
        GameState.state.heroes = [hero('a', { melee: 1 }, ['dh_ring'])];
        expect(marksFor('a', wolf())).toBeNull();
    });
});

describe('worked out once per Token entered', () => {
    it('every hero gets marks as the aim enters a Token, the same objects while it stays, none after', () => {
        GameState.state.heroes = [hero('a', { mining: 5 }, ['dh_pick']), hero('b', { mining: 1 }, [])];
        let emits = 0;
        const off = subscribeHints(() => { emits++; });
        try {
            expect(hintsShowing()).toBe(false);
            const vein = token('dh_vein');
            setHintTarget(vein);
            expect(emits).toBe(1);
            const a = hintsOf('a');
            expect(a.tool.pass).toBe(true);
            expect(hintsOf('b').tool.pass).toBe(false);

            setHintTarget(vein);
            expect(emits).toBe(1);
            expect(hintsOf('a')).toBe(a);

            setHintTarget(null);
            expect(emits).toBe(2);
            expect(hintsOf('a')).toBeNull();
            expect(hintsShowing()).toBe(false);

            // Off a Token with nothing to show, and off again: nothing to redraw.
            setHintTarget(token('dh_rock'));
            setHintTarget(null);
            expect(emits).toBe(2);
        } finally { off(); }
    });
});
