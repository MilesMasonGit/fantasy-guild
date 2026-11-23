// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

const h = React.createElement;
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerLanguage, setLanguage } from '../i18n/index.js';
import en from '../i18n/en.json';
import { levelNeed, levelNeeds, skillLevel, shiftIcons, heroLevel } from '../systems/core/levelNeed.js';
import { canHeroEquip } from '../systems/equipment/EquipmentValidator.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { equipBubbleOf, clearEquipBubbles } from '../ui/components/dock/equipBubbles.js';
import { createOrderAim } from '../ui/components/board/orderAim.js';
import { SkillIconText } from '../ui/components/base/SkillIconText.jsx';
import { ItemTipContent, levelNeedsOf, needsLine } from '../ui/components/drawer/ItemTip.jsx';
import { RequirementLine } from '../ui/components/encyclopedia/encyclopediaParts.jsx';
import { problemText } from '../ui/components/board/problemMark.js';
import { skipLine } from '../ui/components/board/flagText.js';
import { landmarkLines } from '../ui/components/drawer/landmarkLines.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ One form for a level requirement everywhere: "Needs [icon] Melee 15", and where one hero is
 * involved "Needs [icon] Melee 15 (Ana: 12)". One writer makes it; every place calls it. Each place
 * is checked in a made-up language whose form differs from English, so a place that wrote its own
 * words would still read English and fail.
 */

// A language that words a requirement its own way and puts the icon after the name.
const ODD = {
    ...en,
    levelNeed: {
        needs: 'Wants {list}!',
        level: '{skill}{icon} at {level}',
        levelHero: '{skill}{icon} at {level} [{hero} has {have}]',
        join: ' + '
    }
};
registerLanguage('odd', ODD);

const ANA = { id: 'h_ana', name: 'Ana', status: 'idle', level: 1, skills: { mining: { level: 12, xp: 0 }, melee: { level: 3, xp: 0 } }, hp: { current: 100, max: 100 } };

afterEach(() => {
    setLanguage('en');
    cleanup();
    vi.restoreAllMocks();
});

describe('the writer', () => {
    it('⭐ the plain form: "Needs Melee 15", the icon before the skill', () => {
        expect(levelNeed('melee', 15)).toEqual({
            text: 'Needs Melee 15',
            icons: [{ skill: 'melee', at: 6 }],
            parts: [{ text: 'Needs ' }, { icon: 'melee' }, { text: 'Melee 15' }]
        });
    });

    it('⭐ with one hero: their level follows so the gap shows', () => {
        expect(levelNeed('melee', 15, { hero: 'Ana', have: 12 })).toMatchObject({
            text: 'Needs Melee 15 (Ana: 12)', icons: [{ skill: 'melee', at: 6 }]
        });
        // A hero without a level in it (or a level without a name) is the plain form.
        expect(levelNeed('melee', 15, { hero: 'Ana' }).text).toBe('Needs Melee 15');
        expect(levelNeed('melee', 15, { have: 12 }).text).toBe('Needs Melee 15');
    });

    it('several after one "Needs", each with its icon; none is null', () => {
        const both = levelNeeds([{ skill: 'melee', level: 15 }, { skill: 'mining', level: 10 }]);
        expect(both.text).toBe('Needs Melee 15, Mining 10');
        expect(both.icons).toEqual([{ skill: 'melee', at: 6 }, { skill: 'mining', at: 16 }]);
        expect(levelNeeds([])).toBeNull();
        expect(levelNeeds(null)).toBeNull();
    });

    it('a skill the game no longer has keeps its id as its name', () => {
        expect(levelNeed('cut_skill', 4).text).toBe('Needs cut_skill 4');
    });

    it('a level that is not a requirement (an enemy\'s) has no "Needs" and never says Lv', () => {
        expect(skillLevel('melee', 12)).toMatchObject({ text: 'Melee 12', icons: [{ skill: 'melee', at: 0 }] });
    });

    it('a language puts the icon where its word order wants it', () => {
        setLanguage('odd');
        expect(levelNeed('melee', 15, { hero: 'Ana', have: 12 })).toEqual({
            text: 'Wants Melee at 15 [Ana has 12]!',
            icons: [{ skill: 'melee', at: 'Wants Melee'.length }],
            parts: [{ text: 'Wants Melee' }, { icon: 'melee' }, { text: ' at 15 [Ana has 12]!' }]
        });
    });

    it('icons move along with the words; a hero record gives the hero form', () => {
        expect(shiftIcons([{ skill: 'melee', at: 6 }], 10)).toEqual([{ skill: 'melee', at: 16 }]);
        expect(heroLevel(ANA, 'mining')).toEqual({ hero: 'Ana', have: 12 });
        expect(heroLevel(ANA, 'fishing')).toEqual({});
        expect(heroLevel(null, 'mining')).toEqual({});
    });

    it('draws each icon inline just before its character', () => {
        const words = levelNeed('melee', 15, { hero: 'Ana', have: 12 });
        const { container } = render(h('div', { 'data-t': '' }, h(SkillIconText, { text: words.text, icons: words.icons })));
        const box = container.querySelector('[data-t]');
        expect(box.textContent).toBe('Needs Melee 15 (Ana: 12)');
        expect(box.childNodes[0].textContent).toBe('Needs ');
        expect(box.childNodes[1].dataset.skillIconText).toBe('melee');
        expect(box.childNodes[1].querySelector('img')).not.toBeNull();
        expect(render(h('div', { 'data-p': '' }, h(SkillIconText, { text: 'Plain' }))).container.querySelector('[data-p]').innerHTML).toBe('Plain');
    });
});

describe('gear: the item tooltip and the equip refusal', () => {
    const SWORD = { id: 'ln_sword', name: 'Test Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 4, levelRequired: 15 };
    beforeAll(() => registerItems({ ln_sword: SWORD }));

    it('⭐ the item tooltip says it in the writer\'s words, with the icon; a native title the words alone', () => {
        setLanguage('odd');
        expect(levelNeedsOf(SWORD)).toEqual(levelNeeds([{ skill: 'melee', level: 15 }]));
        expect(needsLine(SWORD)).toBe('Wants Melee at 15!');
        const { container } = render(h(ItemTipContent, { item: SWORD }));
        const line = container.querySelector('[data-item-tip-needs]');
        expect(line.textContent).toBe('Wants Melee at 15!');
        expect(line.querySelector('[data-skill-icon-text="melee"]')).not.toBeNull();
    });

    it('⭐ the engine refuses in the writer\'s words, naming the hero; the hero bar draws the icon where the writer put it', () => {
        setLanguage('odd');
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(ANA);
        const refusal = canHeroEquip(ANA.id, 'ln_sword');
        const want = levelNeed('melee', 15, { hero: 'Ana', have: 3 });
        expect(refusal).toMatchObject({ canEquip: false, reason: want.text, need: { skill: 'melee', icons: want.icons } });
        expect(refusal.reason).toBe('Wants Melee at 15 [Ana has 3]!');

        clearEquipBubbles();
        const equipment = { equipItem: () => ({ success: false, error: refusal.reason, need: refusal.need }) };
        expect(equipOrAnnounce(equipment, ANA.id, 'ln_sword')).toBe(false);
        const said = equipBubbleOf(ANA.id);
        expect(said.icon).toEqual({ skill: 'melee', at: said.text.lastIndexOf(refusal.reason) + want.icons[0].at });
        clearEquipBubbles();
    });
});

describe('the Encyclopedia: what a box asks of a hero', () => {
    it('⭐ "Needs [icon] Smithing 15" by the writer; a fight reads the enemy\'s level with no Lv', () => {
        setLanguage('odd');
        const { container } = render(h(RequirementLine, { requirement: { skill: 'smithing', level: 15 }, heroes: [] }));
        const line = container.querySelector('[data-codex-req="smithing"]');
        expect(line.textContent).toBe(levelNeed('smithing', 15).text);
        expect(line.querySelector('[data-skill-icon-text="smithing"]')).not.toBeNull();
        setLanguage('en');
        cleanup();
        const fight = render(h(RequirementLine, { requirement: { skill: 'combat', level: 12 }, heroes: [] }));
        expect(fight.container.textContent).toBe('Combat 12');
    });
});

describe('a landmark\'s inspection', () => {
    it('the skill beside its Needs label is the writer\'s', () => {
        setLanguage('odd');
        const site = { landmark: true, config: { skill: 'forestry', skillRequired: 99 } };
        expect(landmarkLines(site).lines[0]).toMatchObject({ value: skillLevel('forestry', 99).text, icons: skillLevel('forestry', 99).icons });
        expect(landmarkLines(site).lines[0].value).toBe('Forestry at 99');
    });
});

describe('on the mat: why a hero will not work a Token', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.heroes = [{ ...ANA }];
    });

    const gated = () => {
        const instance = BoardState.createTokenInstance('fixture_gated', tokenStartingUses('fixture_gated'));
        Placement.placeTokenAt(instance, { x: 560, y: 520 });
        return instance;
    };
    // fixture_gated asks Mining 25; Ana has 12.
    const want = () => levelNeed('mining', 25, { hero: 'Ana', have: 12 });

    it('⭐ an order refusal (the drop and the carried hero\'s aim) names the hero, with the icon', () => {
        setLanguage('odd');
        const vein = gated();
        expect(Orders.refusalText(ANA.id, vein, ALERT.ACCESS)).toBe(want().text);
        expect(Orders.refusalWords(ANA.id, vein, ALERT.ACCESS)).toEqual(want());
        expect(want().text).toBe('Wants Mining at 25 [Ana has 12]!');
        // The aim carries the icon through to the drag label.
        const aim = createOrderAim(ANA.id, { hit: () => vein, aimAt: () => ({ snap: false, reason: want().text, icons: want().icons }) });
        expect(aim({ x: 1, y: 1 })).toMatchObject({ reason: want().text, icons: want().icons });
    });

    it('⭐ the problem mark\'s hover: the hero working it, else the plain form', () => {
        setLanguage('odd');
        const vein = gated();
        expect(problemText({ kind: ALERT.ACCESS }, vein.id)).toBe(levelNeed('mining', 25).text);
        vi.spyOn(BoardState, 'workerOf').mockReturnValue(ANA.id);
        expect(problemText({ kind: ALERT.ACCESS }, vein.id)).toBe(want().text);
    });

    it('⭐ the flag\'s skipped-Token line says the level in the writer\'s words', () => {
        setLanguage('odd');
        const vein = gated();
        expect(skipLine({ instanceId: vein.id, reason: ALERT.ACCESS, typeId: 'fixture_gated' }, ANA.id))
            .toBe(`Fixture Gated — ${want().text}`);
    });
});
