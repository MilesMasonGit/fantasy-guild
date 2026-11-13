// The calibration setups: small fixed boards of SHIPPED content, each played in the real engine and
// priced by the progression ledger's rate calculator (`cms/src/engine/ledger/rates.js`).
//
// ⚠️ Unlike the bench scenarios, these read the shipped content on purpose: the point is to check the
// calculator against the engine on the game's own numbers. A content change moves both sides.
//
// Each setup says how to build its board (`build`, run inside the engine through Vite), what the
// calculator is asked (`works`, for `chainRates`), and which items and skills to compare. `hall`
// holds Guild Hall stars: a fixture sky (shipped content has none yet) and the ranks bought.

const STEP = 160;

/** Where the inert stand-in Hall stands: heroes start there and walk out. */
const HALL = { x: 240, y: 240 };

/** A Guild Hall star as `data/hallStars.json` holds one, with a single rank holding one rule. */
function hallStar(id, name, type, value, { category, to } = {}) {
    return {
        id, constellation: 'calibration_mining', name, node: { x: 0.6, y: 0 }, links: ['hall'],
        ranks: [{
            tier: 0, price: [], lines: [],
            rules: [{
                id: `stm_${id}`, keyword: 'provides', reach: 'board', target: null, when: null, upkeep: null, chargeDelta: 0,
                to: to || { mode: 'all', value: '' },
                payload: { type, bucket: 'percentage', value, ...(category ? { category } : {}) }
            }]
        }]
    };
}

/**
 * The fixture sky the `vein-hall` setup holds: Mining XP (+50 %, through the XP floor), Mining work
 * speed (-20 %), and a rest aimed at the Copper Ore Vein (-50 %): the guild-wide and the aimed paths.
 * ⚠️ A fixture, never `data/`: the engine holds it through the dev hook `registerHallSky`.
 */
const HALL_SKY = {
    constellations: { calibration_mining: { id: 'calibration_mining', name: 'Mining', label: { x: 1, y: -0.5 }, skill: 'mining' } },
    stars: Object.fromEntries([
        hallStar('calibration_mining_xp', 'Miner’s Lore', 'XP_BONUS', 0.5, { category: 'mining' }),
        hallStar('calibration_mining_speed', 'Quick Picks', 'WORK_TIME', -0.2, { category: 'mining' }),
        hallStar('calibration_vein_rest', 'Deep Veins', 'GROW_TIME', -0.5, { to: { mode: 'id', value: 'token_copper_ore_vein' } })
    ].map(s => [s.id, s]))
};
const HALL_RANKS = { calibration_mining_xp: 1, calibration_mining_speed: 1, calibration_vein_rest: 1 };

export const SETUPS = [
    {
        id: 'vein',
        name: 'One hero on a Copper Ore Vein',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_copper_ore'], skills: ['mining'] },
        works: [{ target: { token: 'token_copper_ore_vein' }, setup: { level: 10 } }],
        build({ place, hero, order }) {
            const vein = place('token_copper_ore_vein', 800, 560);
            const miner = hero('Miner', { mining: 10 }, ['item_copper_pickaxe']);
            order(miner, vein);
        }
    },
    {
        id: 'mine-smelt',
        name: 'Mine plus smelt: a vein with a Minecart and a Copper Mine in reach, a Furnace on Copper Ingots',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_copper_ore', 'item_copper_ingot'], skills: ['mining', 'smithing'] },
        works: [
            { target: { token: 'token_copper_ore_vein' }, setup: { level: 10, supports: ['token_copper_ore_minecart', 'token_copper_mine'] } },
            { target: { token: 'token_furnace', recipe: 'recipe_copper_ingot' }, setup: { level: 10 } }
        ],
        // Coal is not mined here: the Bank holds plenty, as the calculator takes an input no work in the setup makes.
        bank: { item_coal: 5000 },
        build({ place, hero, order, selectRecipe }) {
            const vein = place('token_copper_ore_vein', 800, 560);
            place('token_copper_ore_minecart', 800 + STEP, 560);
            place('token_copper_mine', 800 - STEP, 560);
            const furnace = place('token_furnace', 800, 560 + 2 * STEP);
            selectRecipe(furnace, 'recipe_copper_ingot');
            const miner = hero('Miner', { mining: 10 }, ['item_copper_pickaxe']);
            const smith = hero('Smith', { smithing: 10 }, []);
            order(miner, vein);
            order(smith, furnace);
        }
    },
    {
        id: 'forest',
        name: 'A spawner forest: an Oak Forest worked from a Logging Camp by one forester',
        warmupMs: 30 * 60_000,
        compare: { items: ['item_oak_wood', 'item_oak_seedling', 'item_bird_nest'], skills: ['forestry'] },
        works: [{ target: { token: 'token_oak_tree' }, setup: { level: 10, supports: ['token_oak_forest'], family: { spawner: 'token_oak_forest' } } }],
        // Seedlings pay the Forest's spawns and each stump's regrowth; the trees drop more as they are felled.
        bank: { item_oak_seedling: 100 },
        build({ place, hero, order, prefillSpawners }) {
            place('token_oak_forest', 800, 560);
            // 120 u from the Forest: its saplings land in a ring about 84 u around it, so the camp's standard 240 u reach covers them all (one step, 160 u, strands the far side).
            const camp = place('token_logging_camp', 920, 560);
            prefillSpawners();
            const forester = hero('Forester', { forestry: 10 }, ['item_copper_woodaxe']);
            order(forester, camp);
        }
    },
    {
        id: 'vein-hall',
        name: 'The vein again, the Guild Hall holding Mining XP +50 %, Mining work speed -20 % and a vein rest -50 % (fixture stars)',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_copper_ore'], skills: ['mining'] },
        hall: { sky: HALL_SKY, ranks: HALL_RANKS },
        works: [{ target: { token: 'token_copper_ore_vein' }, setup: { level: 10, hallRanks: HALL_RANKS } }],
        build({ place, hero, order }) {
            const vein = place('token_copper_ore_vein', 800, 560);
            const miner = hero('Miner', { mining: 10 }, ['item_copper_pickaxe']);
            order(miner, vein);
        }
    },
    {
        id: 'vein-beer',
        name: 'The vein again, the miner drinking Beer (+10 % XP, on the XP floor)',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_copper_ore'], skills: ['mining'], spent: ['item_beer'] },
        works: [{ target: { token: 'token_copper_ore_vein' }, setup: { level: 10, consumables: ['item_beer'] } }],
        bank: { item_beer: 1000 },
        build({ place, hero, order }) {
            const vein = place('token_copper_ore_vein', 800, 560);
            const miner = hero('Miner', { mining: 10 }, ['item_copper_pickaxe', 'item_beer']);
            order(miner, vein);
        }
    },
    {
        id: 'forest-potions',
        name: 'The forest again, the forester on Lemonade (+10 % Forestry yield) and Birdwatcher potions (25 % Bird Nest)',
        warmupMs: 30 * 60_000,
        compare: { items: ['item_oak_wood', 'item_oak_seedling', 'item_bird_nest'], skills: ['forestry'], spent: ['item_lemonade', 'item_birdwatcher'] },
        works: [{ target: { token: 'token_oak_tree' }, setup: { level: 10, supports: ['token_oak_forest'], family: { spawner: 'token_oak_forest' }, consumables: ['item_lemonade', 'item_birdwatcher'] } }],
        bank: { item_oak_seedling: 100, item_lemonade: 1000, item_birdwatcher: 10000 },
        build({ place, hero, order, prefillSpawners }) {
            place('token_oak_forest', 800, 560);
            const camp = place('token_logging_camp', 920, 560);
            prefillSpawners();
            const forester = hero('Forester', { forestry: 10 }, ['item_copper_woodaxe', 'item_lemonade', 'item_birdwatcher']);
            order(forester, camp);
        }
    },
    {
        id: 'mining-camp',
        name: 'A Mining Camp with three Copper Ore Veins in its reach, one miner working them in turn',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_copper_ore'], skills: ['mining'] },
        works: [{ target: { token: 'token_copper_ore_vein' }, setup: { level: 10, camp: { id: 'token_mining_camp', members: 3 } } }],
        build({ place, hero, order }) {
            const camp = place('token_mining_camp', 800, 560);
            // Within the camp's 280 u reach and not within Near of each other's rules (veins have none).
            place('token_copper_ore_vein', 800 + STEP, 560);
            place('token_copper_ore_vein', 800 - STEP, 560);
            place('token_copper_ore_vein', 800, 560 + STEP);
            const miner = hero('Miner', { mining: 10 }, ['item_copper_pickaxe']);
            order(miner, camp);
        }
    },
    {
        id: 'coast',
        name: 'Water: one fisher on the Coast with a Fishing Rod and no bait',
        warmupMs: 10 * 60_000,
        compare: { items: ['item_tropical_fish', 'item_salmon', 'item_swordfish'], skills: ['fishing'] },
        works: [{ target: { token: 'token_coast', pool: 'fishing_rod|' }, setup: { level: 10 } }],
        build({ place, hero, order }) {
            const coast = place('token_coast', 800, 560);
            const fisher = hero('Fisher', { fishing: 10 }, ['item_fishing_rod']);
            order(fisher, coast);
        }
    },
    {
        id: 'field',
        name: 'A Field: one farmer on a Wild Wheat Patch, harvesting its load and waiting out each regrowth',
        // An hour and a half in, the patch is part-way through a regrowth, as it is at any time after.
        warmupMs: 90 * 60_000,
        compare: { items: ['item_wheat', 'item_wheat_seed', 'item_worm'], skills: ['farming'] },
        works: [{ target: { token: 'token_wild_wheat_patch', recipe: 'recipe_wheat' }, setup: { level: 10 } }],
        bank: { item_wheat_seed: 100 },
        build({ place, hero, order }) {
            const patch = place('token_wild_wheat_patch', 800, 560);
            const farmer = hero('Farmer', { farming: 10 }, ['item_copper_sickle']);
            order(farmer, patch);
        }
    }
];

export { HALL };
