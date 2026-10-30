// The calibration setups: small fixed boards of SHIPPED content, each played in the real engine and
// priced by the progression ledger's rate calculator (`src/systems/progression/ledger/rates.js`).
//
// ⚠️ Unlike the bench scenarios, these read the shipped content on purpose: the point is to check the
// calculator against the engine on the game's own numbers. A content change moves both sides.
//
// Each setup says how to build its board (`build`, run inside the engine through Vite), what the
// calculator is asked (`works`, for `chainRates`), and which items and skills to compare.

const STEP = 160;

/** Where the inert stand-in Hall stands: heroes start there and walk out. */
const HALL = { x: 240, y: 240 };

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
        works: [{ target: { token: 'token_oak_tree' }, setup: { level: 10, supports: ['token_oak_forest'], family: { members: 5 } } }],
        // Seedlings pay the Forest's spawns and each stump's regrowth; the trees drop more as they are felled.
        bank: { item_oak_seedling: 100 },
        build({ place, hero, order, prefillSpawners }) {
            place('token_oak_forest', 800, 560);
            // One step from the Forest: its saplings land within Near (164 u) of it, so the camp's 360 u reach covers them all.
            const camp = place('token_logging_camp', 800 + STEP, 560);
            prefillSpawners();
            const forester = hero('Forester', { forestry: 10 }, ['item_copper_woodaxe']);
            order(forester, camp);
        }
    }
];

export { HALL };
