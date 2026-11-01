// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import { handleVictory } from '../systems/combat/CombatResolutionProcessor.js';
import { RegistryManager } from '../systems/progression/RegistryManager.js';
import { collectedOf, noteRecipeMade } from '../systems/progression/collectionLog.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EncyclopediaScreen } from '../ui/components/encyclopedia/EncyclopediaScreen.jsx';
import { encyclopedia, KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { lookUp, takeLookUp } from '../ui/components/encyclopedia/encyclopediaLink.js';

/**
 * ⭐ The collection log (brief 300 E2): the Encyclopedia ticks what this run has had, made and
 * beaten, from the run's own state, silently; a new game starts with nothing carried over, and an
 * older save loads with the new records empty.
 */

beforeEach(() => {
    GameState.initNew();
});

afterEach(() => {
    cleanup();
    takeLookUp();
});

describe('what is recorded', () => {
    it('a Token type once one stands on the mat, and still after it is gone', () => {
        const oak = BoardState.createTokenInstance('token_oak_forest');
        BoardState.addToken(oak, 400, 400);
        expect(GameState.state.collection.tokensHad).toMatchObject({ token_oak_forest: true });
        BoardState.removeToken(oak.id);
        expect(collectedOf().tokens.has('token_oak_forest')).toBe(true);
    });

    it('a Token standing on another Region counts too', () => {
        GameState.state.atlas.regions = { region_9: { board: { tokens: { a: { id: 'a', typeId: 'token_iron_ore_vein' } } } } };
        expect(collectedOf().tokens.has('token_iron_ore_vein')).toBe(true);
    });

    it('an enemy once beaten (the kill count) or paid its first-kill drops', () => {
        const fight = { id: 'f1', combat: { state: {} }, instanceId: null, drops: [] };
        handleVictory(fight, { id: 'h1' }, { id: 'token_goblin', name: 'Goblin' }, 'h1', []);
        expect(GameState.state.collection.enemyKillCounts.token_goblin).toBe(1);
        expect(collectedOf().enemies.has('token_goblin')).toBe(true);
        GameState.state.collection.firstKillDrops = { token_wolf: true };
        expect(collectedOf().enemies.has('token_wolf')).toBe(true);
    });

    it('an item once banked, and a recipe once made', () => {
        RegistryManager.recordItemGain('item_copper_ore', 1);
        noteRecipeMade('recipe_copper_ingot');
        const got = collectedOf();
        expect(got.items.has('item_copper_ore')).toBe(true);
        expect(got.recipes.has('recipe_copper_ingot')).toBe(true);
    });

    it('announces nothing new of its own: no event for a Token stood or a recipe made', () => {
        const heard = [];
        const offs = Object.values(ENGINE_EVENTS).map(name => EventBus.subscribe(name, () => heard.push(name)));
        noteRecipeMade('recipe_copper_ingot');
        const before = heard.length;
        BoardState.addToken(BoardState.createTokenInstance('token_birch_tree'), 300, 300);
        offs.forEach(off => off());
        expect(before).toBe(0);
        // Placing a Token announces what placing always did (the board's own events), nothing about the log.
        expect(heard.filter(n => /discover|registry/i.test(n))).toEqual([]);
    });
});

describe('the save', () => {
    it('a new game starts with the records empty', () => {
        expect(INITIAL_STATE.collection.tokensHad).toEqual({});
        expect(INITIAL_STATE.collection.recipesMade).toEqual({});
        const fresh = JSON.parse(JSON.stringify(INITIAL_STATE));
        const got = collectedOf(fresh);
        expect([got.items.size, got.tokens.size, got.enemies.size, got.recipes.size]).toEqual([0, 0, 0, 0]);
    });

    it('an older save without the records loads with them empty, keeping what it had', () => {
        const old = JSON.parse(JSON.stringify(INITIAL_STATE));
        delete old.collection.tokensHad;
        delete old.collection.recipesMade;
        old.collection.discoveredItems = { item_coal: true };
        const migrated = migrateState(old, GAME_VERSION);
        expect(migrated.collection.tokensHad).toEqual({});
        expect(migrated.collection.recipesMade).toEqual({});
        expect(migrated.collection.discoveredItems).toEqual({ item_coal: true });
    });
});

describe('the screen', () => {
    it('ticks what is collected and counts each kind', () => {
        RegistryManager.recordItemGain('item_iron_ore', 1);
        lookUp('item:item_iron_ore');
        const { container } = render(React.createElement(EncyclopediaScreen, { onClose: () => {} }));
        const total = encyclopedia().byKind[KIND.ITEM].length;
        const have = Object.keys(GameState.state.collection.discoveredItems).filter(id => encyclopedia().entryOf(`item:${id}`)).length;
        expect(container.querySelector('[data-codex-progress="items"]').textContent).toBe(`${have}/${total}`);
        expect(container.querySelector('[data-codex-row="item:item_iron_ore"] [data-codex-tick]')).not.toBeNull();
        expect(container.querySelector('[data-codex-row="item:item_iron_ingot"] [data-codex-tick]')).toBeNull();
        expect(container.querySelector('[data-codex-entry] h3 [data-codex-tick]')).not.toBeNull();
    });
});
