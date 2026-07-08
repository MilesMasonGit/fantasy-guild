// Fantasy Guild - Recipe Registry
// Loads and manages all recipes for crafting and stations.

import { logger } from '../../utils/Logger.js';

import { DatabaseManager } from '../DatabaseManager.js';

const jsonRecipeFilesSingle = DatabaseManager.recipeFilesSingle;
const jsonRecipeFilesGlob = DatabaseManager.recipeFilesGlob;

function loadJsonRecipes() {
    const dynamicRecipes = {};

    function processRecipesData(recipesData) {
        const list = Array.isArray(recipesData) ? recipesData : Object.values(recipesData);
        for (const recipe of list) {
            if (!recipe.id) continue;
            dynamicRecipes[recipe.id] = recipe;
        }
    }

    // Process recipes.json if it exists
    for (const [path, module] of Object.entries(jsonRecipeFilesSingle)) {
        try {
            const data = module.default || module;
            processRecipesData(data);
        } catch (error) {
            console.warn(`Error loading recipe JSON from ${path}:`, error);
        }
    }

    // Process other recipe JSONs under recipes/
    for (const [path, module] of Object.entries(jsonRecipeFilesGlob)) {
        try {
            const data = module.default || module;
            processRecipesData(data);
        } catch (error) {
            console.warn(`Error loading recipe JSON from ${path}:`, error);
        }
    }

    return dynamicRecipes;
}

export const RECIPES = Object.freeze(loadJsonRecipes());

/**
 * Get a recipe by ID
 * @param {string} recipeId
 * @returns {Object|null}
 */
export function getRecipe(recipeId) {
    return RECIPES[recipeId] || null;
}

/**
 * Get all recipes
 * @returns {Object}
 */
export function getAllRecipes() {
    return RECIPES;
}

/**
 * Get recipes matching a subskill ID
 * @param {string} subskillId
 * @returns {Object[]}
 */
export function getRecipesBySubskill(subskillId) {
    return Object.values(RECIPES).filter(r => r.subskillId === subskillId);
}

logger.info('RecipeRegistry', `Loaded ${Object.keys(RECIPES).length} recipe(s)`);
