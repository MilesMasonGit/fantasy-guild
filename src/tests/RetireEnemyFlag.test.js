import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StatusApplication from '../systems/board/StatusApplication.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECTS, registerEffects, getEffect } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { migrateAppliesTarget, migrateAppliesTargets } from '../systems/effects/effectMigration.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat for the monster to stand on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The `target: 'enemy'` flag is retired** — Effects Grammar V10b.
 *
 * V10a gave `Applies` the enemy role. The one-off flag it replaces (UE-24) is
 * converted on load by the game's registries AND the CMS store — the same pure
 * function in both, so a "Sync to Game" can never write it back — and the
 * runtime, the editor and the sentence no longer read it.
 */

const MONSTER = 16;
const onEngaged = { event: 'COMBAT_ENGAGED', scope: 'self' };

/** An `Applies` exactly as the retired editor saved it: the flag in the payload, no role. */
const flagged = (flag, payload = { statusId: 'poison', stacks: 2, chance: 100 }, extra = {}) => ({
    ...makeStatement(KEYWORD.APPLIES),
    id: `stm_flag_${flag}`,
    when: onEngaged,
    chargeDelta: 0,
    payload: { ...payload, target: flag },
    ...extra
});

function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    hero.effects = [];
    hero.equipment = Array(9).fill(null);
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const hero1 = () => HeroManager.getHero('hero_1');
const hasStatus = (list, id) => (list || []).some(s => s.id === id);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    BoardCombat.clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    LiveEffects.resetClock();
    GameState.state.heroes = [fighter('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    BoardCombat.clearAll();
});

describe('1. the mapping', () => {
    it('"enemy" becomes the enemy role, and the flag is gone', () => {
        const out = migrateAppliesTarget(flagged('enemy'));
        expect(out.target).toEqual({ role: ROLE.OPPONENT });
        expect('target' in out.payload).toBe(false);
        expect(out.payload).toEqual({ statusId: 'poison', stacks: 2, chance: 100 });
    });

    it('"hero" just loses the flag — the default reading is already the hero', () => {
        const out = migrateAppliesTarget(flagged('hero'));
        expect('target' in out.payload).toBe(false);
        expect(out.target).toBeNull();
    });

    it('no flag → the very same object', () => {
        const plain = { ...makeStatement(KEYWORD.APPLIES), payload: { statusId: 'poison', stacks: 1 } };
        expect(migrateAppliesTarget(plain)).toBe(plain);
        const def = { statements: [plain] };
        expect(migrateAppliesTargets(def)).toBe(def);
    });

    it('is idempotent', () => {
        const once = migrateAppliesTarget(flagged('enemy'));
        const twice = migrateAppliesTarget(once);
        expect(twice).toBe(once);
        expect(twice).toEqual(once);
    });

    it('keeps a role already chosen, and leaves a value the flag never had for the audit', () => {
        const both = migrateAppliesTarget(flagged('enemy', undefined, { target: { role: ROLE.OPPONENT } }));
        expect(both.target).toEqual({ role: ROLE.OPPONENT });
        expect('target' in both.payload).toBe(false);

        const odd = flagged('monster');
        expect(migrateAppliesTarget(odd)).toBe(odd);
    });
});

describe('2. ⭐ the game loader and the CMS normaliser convert identically', () => {
    const resetStore = () => useEntityStore.setState({
        items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
    });
    beforeEach(resetStore);

    const entry = (id, statement) => ({ id, name: id, statements: [statement] });

    for (const flag of ['enemy', 'hero']) {
        it(`"${flag}": registry load, CMS hydrate and CMS merge all produce the same statement`, () => {
            const id = `fixture_effect_v10b_parity_${flag}`;
            registerEffects({ [id]: entry(id, flagged(flag)) });
            const game = getEffect(id).statements[0];

            useEntityStore.getState().hydrate({ effects: { [id]: entry(id, flagged(flag)) } });
            const hydrated = useEntityStore.getState().effects[id].statements[0];

            const merged = useEntityStore.persist.getOptions()
                .merge({ effects: { [id]: entry(id, flagged(flag)) }, tokens: {}, items: {} }, useEntityStore.getState())
                .effects[id].statements[0];

            const migrated = useEntityStore.persist.getOptions()
                .migrate({ effects: { [id]: entry(id, flagged(flag)) }, tokens: {}, items: {} }, 0)
                .effects[id].statements[0];

            expect('target' in game.payload).toBe(false);
            expect(hydrated).toEqual(game);
            expect(merged).toEqual(game);
            expect(migrated).toEqual(game);
        });
    }

    it('a Token’s inline rule is converted on load too', () => {
        registerTokenTypes({
            fixture_v10b_inline: {
                id: 'fixture_v10b_inline', name: 'Inline Flag', tokenType: 'resource',
                rarity: 'common', theme: 'fixture', uses: 10,
                statements: [flagged('enemy')],
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        const [statement] = getTokenType('fixture_v10b_inline').statements;
        expect(statement.target).toEqual({ role: ROLE.OPPONENT });
        expect('target' in statement.payload).toBe(false);
    });
});

describe('3. the audit', () => {
    it('names a leftover flag that got past the loaders', () => {
        // Written straight into the library, bypassing `registerEffects` —
        // the shape a load path that skipped the conversion would leave.
        EFFECTS.fixture_v10b_leftover = { id: 'fixture_v10b_leftover', name: 'Leftover Flag', statements: [flagged('enemy')] };
        try {
            const lines = auditContent().map(f => `${f.where}: ${f.what}`);
            expect(lines.some(l => l.includes('Leftover Flag') && l.includes('retired "target: enemy"')),
                lines.filter(l => l.includes('Leftover')).join('\n')).toBe(true);
        } finally {
            delete EFFECTS.fixture_v10b_leftover;
        }
    });

    it('names an Applies aimed at the enemy that also carries a filter or a reach — and not the blank defaults', () => {
        const aimed = (extra) => ({ ...makeStatement(KEYWORD.APPLIES), when: onEngaged, target: { role: ROLE.OPPONENT },
            payload: { statusId: 'poison', stacks: 1, chance: 100 }, ...extra });
        registerEffects({
            fixture_v10b_filtered: { id: 'fixture_v10b_filtered', name: 'Filtered Aim', statements: [aimed({ to: { mode: 'tag', value: 'Coast' } })] },
            fixture_v10b_reached: { id: 'fixture_v10b_reached', name: 'Reached Aim', statements: [aimed({ reach: 'board' })] },
            fixture_v10b_clean: { id: 'fixture_v10b_clean', name: 'Clean Aim', statements: [aimed({})] }
        });
        const lines = auditContent().map(f => `${f.where}: ${f.what}`);
        const mine = lines.filter(l => l.includes('Aim"')).join('\n');
        expect(lines.some(l => l.includes('Filtered Aim') && l.includes('a target filter')), mine).toBe(true);
        expect(lines.some(l => l.includes('Reached Aim') && l.includes('a reach')), mine).toBe(true);
        expect(lines.some(l => l.includes('Clean Aim') && l.includes('the role replaces')), mine).toBe(false);
    });
});

describe('4. the runtime ignores a stray flag', () => {
    it('a status carrying target: enemy lands on the hero working it, as any Token rule does', () => {
        place(MONSTER, 'fixture_enemy', 'hero_1');
        run(600);
        const fight = BoardCombat.getFight(idAt(MONSTER));
        expect(fight, 'no fight started').toBeTruthy();

        const landed = StatusApplication.applyAt(idAt(MONSTER), { statusId: 'poison', stacks: 1, chance: 100, target: 'enemy' });
        expect(landed).toBe(true);
        expect(hasStatus(hero1().statuses, 'poison')).toBe(true);
        expect(hasStatus(fight.combat.enemyStatuses, 'poison')).toBe(false);
    });

    it('so does a library effect', () => {
        place(MONSTER, 'fixture_enemy', 'hero_1');
        run(600);
        const fight = BoardCombat.getFight(idAt(MONSTER));
        registerEffects({ fixture_v10b_ward: { id: 'fixture_v10b_ward', name: 'Ward',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_v10b_ward', payload: { type: 'ARMOR', bucket: 'flat', value: 1 } }] } });

        StatusApplication.applyAt(idAt(MONSTER), { effectId: 'fixture_v10b_ward', durationMs: 60000, target: 'enemy' });
        expect(LiveEffects.carries(hero1(), 'fixture_v10b_ward')).toBe(true);
        expect(fight.effects).toHaveLength(0);
    });
});

describe('5. ⭐ the misleading item sentence is fixed', () => {
    it('an item Applies once aimed at the enemy by the flag now reads "to the enemy"', () => {
        const raw = flagged('enemy', { effectId: 'fixture_v10b_venom', durationMs: 30000, chance: 100 });
        const names = { effect: () => 'Venom' };
        // Before conversion the flag is not a word the sentence can say, so it
        // named the heroes on the tiles instead — the reported bug.
        expect(renderStatement(raw, names)).toMatch(/to heroes? /);

        registerEffects({ fixture_v10b_venom_item: { id: 'fixture_v10b_venom_item', name: 'Venom Flask', statements: [raw] } });
        const loaded = getEffect('fixture_v10b_venom_item').statements[0];
        const text = renderStatement(loaded, names);
        expect(text).toContain('applies Venom to the enemy for 30 seconds');
        expect(text).not.toMatch(/hero/);
    });

    it('a stray flag says nothing of its own: it reads exactly like no flag', () => {
        const plain = { ...makeStatement(KEYWORD.APPLIES), id: 'stm_same', payload: { statusId: 'poison', stacks: 2, chance: 100 } };
        const stray = { ...plain, payload: { ...plain.payload, target: 'enemy' } };
        expect(renderStatement(stray)).toBe(renderStatement(plain));
        expect(slotsOf(stray, {}).map(s => s.id)).not.toContain('target');
    });
});

describe('6. end to end: an old-flag item poisons the creature in a real fight', () => {
    it('loads migrated and lands on the enemy, not the hero', () => {
        registerEffects({ fixture_v10b_poison_flask: { id: 'fixture_v10b_poison_flask', name: 'Old Venom',
            statements: [flagged('enemy', { statusId: 'poison', stacks: 3, chance: 100 })] } });
        registerItems({ fixture_v10b_flask: { id: 'fixture_v10b_flask', name: 'Old Venom', effects: [{ effectId: 'fixture_v10b_poison_flask', scale: 1 }] } });
        InventoryManager.addItem('fixture_v10b_flask', 5);
        hero1().equipment[0] = 'fixture_v10b_flask';

        const loaded = getEffect('fixture_v10b_poison_flask').statements[0];
        expect(loaded.target).toEqual({ role: ROLE.OPPONENT });
        expect('target' in loaded.payload).toBe(false);

        place(MONSTER, 'fixture_enemy', 'hero_1');
        run(600);
        const fight = BoardCombat.getFight(idAt(MONSTER));
        expect(fight, 'no fight started').toBeTruthy();
        expect(hasStatus(fight.combat.enemyStatuses, 'poison'), 'the enemy should be poisoned').toBe(true);
        expect(hasStatus(hero1().statuses, 'poison'), 'the hero must not be').toBe(false);
    });
});
