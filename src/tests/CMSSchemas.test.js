import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { validateDataDir, validateWorkspace, checkTargets, reportLines, unknownKeySummary, SCHEMA_DIR } from '../../cms/schemaCheck.js';
import { runCli } from '../../cms/cliCommands.mjs';
import { loadGameData } from '../../cms/gameData.js';
import { workspaceFromImport } from '../../cms/src/engine/workspaceSeeds.js';
import { saveWorkspaceFile } from '../../cms/workspaceFile.js';

import { TOOL_KINDS } from '../config/registries/toolKinds.js';
import { DAMAGE_TYPES } from '../config/registries/damageTypes.js';
import { ITEM_TYPES } from '../config/registries/itemRegistry.js';
import { TOKEN_TYPES, TOKEN_RARITIES, FOUNDATION_KINDS, STATION_KINDS, RETIRED_STATION_KINDS, RESPAWN_MODES, OUTPUT_CURRENCIES } from '../config/registries/tokenConstants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { TRIGGER_EVENTS, TRIGGER_SCOPES } from '../config/registries/triggerRegistry.js';
import { REACHES } from '../config/registries/reachRegistry.js';
import { ROLES } from '../config/registries/roleRegistry.js';
import { CHARGE_MOMENTS } from '../config/registries/chargeMomentRegistry.js';
import { TARGET_MODES, MODIFIER_BUCKETS } from '../config/registries/modifierPalette.js';
import { ENEMY_STYLES } from '../config/registries/enemyProfile.js';
import { ENEMY_KINDS } from '../config/registries/enemyKinds.js';
import { STANDS_ON_CHOICES } from '../systems/atlas/TerrainMap.js';
import { TEMPO_NAMES } from '../../cms/src/engine/ledger/tempoBands.js';
import { ATTACK_SPEED_MS } from '../config/FormulaRegistry.js';
import { EQUIPMENT_CATEGORY_DEFS } from '../config/registries/equipmentCategories.js';
import { PLAN_STATUSES } from '../systems/progression/ledger/plan.js';
import { TAG_SIDES } from '../config/hallStars.js';
import { SIM_PURPOSES } from '../../cms/src/utils/simVocabulary.js';

/**
 * The content schemas (`cms/schemas/`) and `npm run cms -- validate`: today's `data/` and a
 * workspace built from it carry no errors, a wrong value is an error, an unlisted key only a
 * warning, and every word list in the schemas is still the game's own list. Reads `data/`;
 * writes only throwaway folders.
 */

const root = path.resolve(__dirname, '../..');
const tmpRoots = [];
afterAll(() => { for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true }); });
const schema = (name) => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
const realData = () => loadGameData({ dataRoot: path.join(root, 'data'), planRoot: path.join(root, 'cms', 'plan') });

describe('today\'s content', () => {
    it('data/ has no schema errors', () => {
        const result = validateDataDir(path.join(root, 'data'));
        expect(result.errors).toEqual([]);
        expect(result.checked).toEqual(expect.arrayContaining(['items.json', 'tokens.json', 'effects.json', 'tokenRecipes.json', 'starterCamp.json', 'skillPerks.json', 'hallStars.json', 'world.json']));
    });

    it('a workspace restored from data/ and the plan has no schema errors either', () => {
        const result = validateWorkspace(workspaceFromImport(realData()));
        expect(result.errors).toEqual([]);
        expect(result.checked).toEqual(expect.arrayContaining(['items', 'tokens', 'effects', 'starterCamp', 'hallStars', 'world']));
    });
});

describe('what the check reports', () => {
    const tokens = () => JSON.parse(fs.readFileSync(path.join(root, 'data', 'tokens.json'), 'utf8'));

    it('a wrong type or a word outside the game\'s list is an error, with where it is', () => {
        const bad = tokens();
        const [first, second] = Object.keys(bad);
        bad[first] = { ...bad[first], rarity: 'legendary', uses: 'lots' };
        bad[second] = { ...bad[second], standsOn: ['lava'] };
        const { errors } = checkTargets([{ where: 'tokens.json', schema: 'tokens', value: bad }]);
        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: `/${first}/rarity`, message: expect.stringMatching(/one of "common"/) }),
            expect.objectContaining({ path: `/${first}/uses` }),
            expect.objectContaining({ path: `/${second}/standsOn/0` }),
        ]));
    });

    it('a statement with an unknown keyword or moment is an error', () => {
        const effects = { effect_x: { id: 'effect_x', name: 'X', statements: [{ id: 'stm_1', keyword: 'explodes', when: { event: 'ON_SUNDAY' } }] } };
        const { errors } = checkTargets([{ where: 'effects.json', schema: 'effects', value: effects }]);
        expect(errors.map((e) => e.path)).toEqual(expect.arrayContaining(['/effect_x/statements/0/keyword', '/effect_x/statements/0/when/event']));
    });

    it('an unlisted key is a warning folded by place, never an error', () => {
        const value = {
            item_a: { id: 'item_a', name: 'A', sparkle: 1 },
            item_b: { id: 'item_b', name: 'B', sparkle: 2, tool: { kind: 'pickaxe', glow: true } },
        };
        const result = checkTargets([{ where: 'items.json', schema: 'items', value }]);
        expect(result.errors).toEqual([]);
        expect(unknownKeySummary(result.unknown)).toEqual([
            { where: 'items.json', pattern: '*/sparkle', key: 'sparkle', count: 2 },
            { where: 'items.json', pattern: '*/tool/glow', key: 'glow', count: 1 },
        ]);
        expect(reportLines(result)).toEqual([
            '0 errors, 2 unknown keys (warnings).',
            'Unknown keys (no schema lists them; review input, not errors):',
            '- items.json /*/sparkle: 2 records',
            '- items.json /*/tool/glow: 1 record',
        ]);
    });

    it('npm run cms -- validate exits 1 on errors and 0 on warnings alone', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-cms-schema-'));
        tmpRoots.push(dir);
        fs.cpSync(path.join(root, 'data'), path.join(dir, 'data'), { recursive: true });
        const run = async (...argv) => {
            const out = [];
            const code = await runCli([...argv, `--sandbox=${dir}`], { root, load: () => { throw new Error('validate loads no engine'); }, out: (s) => out.push(s), err: (s) => out.push(s) });
            return { code, out: out.join('\n') };
        };
        expect((await run('validate', '--data')).code).toBe(0);

        const items = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'items.json'), 'utf8'));
        const [first] = Object.keys(items);
        items[first].equipSlot = 'tail';
        fs.writeFileSync(path.join(dir, 'data', 'items.json'), JSON.stringify(items));
        const broken = await run('validate', '--data');
        expect(broken.code).toBe(1);
        expect(broken.out).toContain(`items.json /${first}/equipSlot`);

        // The workspace on disk, checked by default.
        saveWorkspaceFile(path.join(dir, 'workspace', 'workspace.json'), workspaceFromImport(realData()), { baseRevision: 0 });
        const ws = await run('validate');
        expect(ws.code).toBe(0);
        expect(ws.out).toMatch(/^Checked .*workspace\.json \(revision 1\)/);
    });
});

describe('the schemas\' word lists are the game\'s', () => {
    const at = (name, pointer) => pointer.split('/').reduce((node, key) => node[key], schema(name));
    // A game list holds words, or records with an id.
    const words = (list) => [...list].map((w) => (w && typeof w === 'object' ? w.id : w));
    const same = (actual, expected) => expect([...actual].sort()).toEqual(words(expected).sort());

    it('items', () => {
        same(at('items', '$defs/item/properties/type/enum'), Object.values(ITEM_TYPES));
        same(at('items', '$defs/item/properties/equipSlot/enum'), ['', ...EQUIPMENT_CATEGORY_DEFS.map((d) => d.id)]);
        same(at('items', '$defs/item/properties/tool/properties/kind/enum'), TOOL_KINDS);
        same(at('items', '$defs/item/properties/damageType/enum'), DAMAGE_TYPES);
        same(at('items', '$defs/item/properties/arrow/properties/damageType/enum'), DAMAGE_TYPES);
        same(at('items', '$defs/item/properties/speed/enum'), Object.keys(ATTACK_SPEED_MS));
        same(at('items', '$defs/item/properties/styles/items/enum'), ENEMY_STYLES);
    });

    it('tokens', () => {
        const token = '$defs/token/properties';
        same(at('tokens', `${token}/tokenType/enum`), TOKEN_TYPES);
        same(at('tokens', `${token}/rarity/enum`), TOKEN_RARITIES);
        same(at('tokens', `${token}/needsTool/properties/kind/enum`), TOOL_KINDS);
        same(at('tokens', `${token}/catchPools/items/properties/tool/enum`), TOOL_KINDS);
        same(at('tokens', `${token}/respawn/properties/mode/enum`), RESPAWN_MODES);
        same(at('tokens', `${token}/foundation/properties/kind/enum`), FOUNDATION_KINDS);
        same(at('tokens', `${token}/standsOn/items/enum`), STANDS_ON_CHOICES.map((c) => c.id));
        same(at('tokens', `${token}/enemy/properties/style/enum`), ENEMY_STYLES);
        same(at('tokens', `${token}/enemy/properties/kinds/items/enum`), ENEMY_KINDS);
        same(at('tokens', `${token}/enemy/properties/moves/items/properties/damageType/enum`), DAMAGE_TYPES);
        same(at('tokens', `${token}/enemy/properties/speed/enum`), Object.keys(ATTACK_SPEED_MS));
    });

    it('recipes', () => {
        // The retired kinds stay valid words, so content still carrying one passes until it is cleared.
        same(at('tokenRecipes', '$defs/recipe/properties/stationKinds/items/enum'), [...STATION_KINDS, ...RETIRED_STATION_KINDS]);
        same(at('tokenRecipes', '$defs/recipe/properties/foundationKinds/items/enum'), FOUNDATION_KINDS);
    });

    it('statements, outputs, the plan, the sim intent and the sky', () => {
        const statement = '$defs/statement/properties';
        same(at('common', `${statement}/keyword/enum`), Object.values(KEYWORD));
        same(at('common', `${statement}/when/properties/event/enum`), TRIGGER_EVENTS.map((e) => (typeof e === 'string' ? e : e.id ?? e.event)));
        same(at('common', `${statement}/when/properties/scope/enum`), Object.values(TRIGGER_SCOPES));
        // The older names the game still reads, and null for nearby.
        same(at('common', `${statement}/reach/enum`), [...REACHES, 'adjacent', 'self_and_adjacent', null]);
        same(at('common', `${statement}/target/properties/role/enum`), ROLES);
        same(at('common', `${statement}/chargeWhen/enum`), CHARGE_MOMENTS);
        // tokenType is retired from the editor but still read.
        same(at('common', `${statement}/to/properties/mode/enum`), [...TARGET_MODES.map((m) => m.mode), 'tokenType']);
        same(at('common', '$defs/payload/properties/bucket/enum'), MODIFIER_BUCKETS);
        same(at('common', '$defs/output/properties/currency/enum'), OUTPUT_CURRENCIES);
        same(at('common', '$defs/plan/properties/status/enum'), PLAN_STATUSES);
        same(at('common', '$defs/sim/properties/tempo/enum'), TEMPO_NAMES);
        same(at('common', '$defs/sim/properties/purpose/enum'), SIM_PURPOSES.map((p) => p.id));
        same(at('hallStars', '$defs/star/properties/tag/enum'), TAG_SIDES);
    });
});
