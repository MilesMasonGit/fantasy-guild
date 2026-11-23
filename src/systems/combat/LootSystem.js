// Fantasy Guild - Loot System

import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import * as OutputRules from '../board/OutputRules.js';
import * as RareDrops from '../board/RareDrops.js';
import * as RareTables from '../board/RareTables.js';
import * as BoardState from '../board/BoardState.js';
import { getTokenType, rollOutputQuantity } from '../../config/registries/tokenRegistry.js';
import { enemyDropsOf } from '../../config/registries/enemyProfile.js';
import { rareTableOf } from '../../config/registries/rareTables.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Loot rolls. Enemy kills roll each drop line independently.
 */
const LootSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (data) => this.handleCombatVictory(data));
        this.initialized = true;
        logger.info('LootSystem', 'Loot system initialized');
    },

    /**
     * Roll a kill's drops as floating sprites where the enemy stood. With no enemy Token behind the
     * victory there is nowhere for loot to land, so it drops nothing.
     */
    handleCombatVictory(data) {
        const { cardId, heroId, enemyId, enemyName, instanceId } = data || {};

        const typeDef = instanceId != null ? getTokenType(BoardState.getTokenById(instanceId)?.typeId) : null;
        if (!typeDef) {
            EventBus.publish(ENGINE_EVENTS.LOOT_GENERATED, { cardId, heroId, enemyId, enemyName, drops: [] });
            return;
        }
        // Read off the Token at the kill, not when the fight began, so an edit mid-fight pays now.
        const lines = enemyDropsOf(typeDef);

        // A kill is a combat cycle of the enemy Token, so its loot follows the work cycle's output
        // rules in the same order: double loot rolled once, each line's quantity widened by YIELD,
        // then its rare table, then the nearby bonus drops (Double Loot doubles those too), which
        // land even when the enemy drops nothing of its own, as beside a station with no outputs.
        // Giant Harvest is work's alone, and a kill never fails.
        const skill = OutputRules.killLootSkill(heroId ? HeroManager.getHero(heroId) : null, typeDef);
        const doubled = OutputRules.rollDoubleLoot(instanceId, skill);

        // Every drop line rolls on its own `chance`, as a station's outputs do in
        // `BoardRunner`: a Goblin with Bones 100% and Copper Ore 30% drops Bones
        // every kill AND Ore 30% of the time.
        // ...and last, a chance that this one item comes out doubled (a Cleaver and Raw Beef).
        const widen = (quantity, itemId) => OutputRules.doubleItemDrop(instanceId, itemId,
            OutputRules.widenYield(instanceId, skill, quantity) * (doubled ? 2 : 1));
        const generatedDrops = this.rollEachLine(lines, widen);

        // One roll on the enemy's rare table beside its loot (Lucky aimed at the enemy widens it), and
        // on a hit one find by weight, rolled and widened as a line is. No table, no draw.
        const find = rareTableOf(typeDef) ? RareTables.rollRareTable(instanceId, typeDef, skill) : null;
        const rare = find ? this._rollEntryDetails(find.entry) : null;
        if (rare) rare.quantity = widen(rare.quantity, rare.itemId);
        const rareDrop = rare && rare.quantity > 0 ? rare : null;

        // Loot drops as floating sprites where the kill happened and is not banked until collected.
        for (const drop of generatedDrops) {
            const line = lines.find(e => e?.itemId === drop.itemId);
            RareDrops.noteDrop(SpriteLayer.addSprite('item', drop.itemId, drop.quantity, instanceId), line?.chance ?? 100);
        }
        if (rareDrop) RareDrops.noteRareFind(SpriteLayer.addSprite('item', rareDrop.itemId, rareDrop.quantity, instanceId), find.chance);
        const bonus = OutputRules.dropBonusGrants(instanceId, doubled ? 2 : 1);

        // Everything that landed, the bonus drops too: the fight window's Drops line, the time-away
        // tally and the kill's cycle (`BoardCombat`, for On Neighbour Produces) all read this.
        const all = [
            ...generatedDrops,
            ...(rareDrop ? [{ ...rareDrop, rare: true }] : []),
            ...bonus.map(b => ({ ...this._describe(b.itemId), quantity: b.quantity, bonus: true }))
        ];
        EventBus.publish(ENGINE_EVENTS.LOOT_GENERATED, { cardId, heroId, enemyId, enemyName, instanceId, drops: all });
    },

    /**
     * Roll every line independently: each entry lands when its own `chance`
     * (default 100) hits, with its quantity rolled over its authored min–max.
     *
     * @param {Array} entries - `{ itemId, chance, minQty, maxQty }` lines
     * @param {Function} [widen] - `(quantity, itemId)` → the quantity that lands (the kill's output rules)
     * @returns {Array} the drops that landed, possibly empty
     */
    rollEachLine(entries, widen = null) {
        const results = [];
        for (const entry of (Array.isArray(entries) ? entries : [])) {
            if (!entry) continue;
            const chance = entry.chance ?? 100;
            if (chance < 100 && Math.random() * 100 > chance) continue;
            const drop = this._rollEntryDetails(entry);
            if (drop && widen) drop.quantity = widen(drop.quantity, drop.itemId);
            if (drop && drop.quantity > 0) results.push(drop);
        }
        return results;
    },

    /**
     * Rolls one entry's item and quantity
     * @private
     */
    _rollEntryDetails(entry) {
        const itemId = entry.itemId || entry.id;
        const item = getItem(itemId);
        if (!item) {
            // A loot table naming an item that no longer exists would roll, win
            // and pay nothing, indistinguishable from an unlucky roll.
            warnMissingContent('LootSystem', 'item', itemId,
                'this drop pays out nothing at all');
            return null;
        }

        // Rolled as a station rolls its output (`rollOutputQuantity`), an inverted range included:
        // one draw, the same number for an ordinary range.
        const quantity = rollOutputQuantity({
            minQty: entry.minQty ?? entry.min ?? entry.amount,
            maxQty: entry.maxQty ?? entry.max ?? entry.amount,
            quantity: entry.quantity
        });

        return { itemId, quantity, itemName: item.name, itemIcon: item.icon };
    },

    /** An item's id, name and icon, as a rolled drop carries them. */
    _describe(itemId) {
        const item = getItem(itemId);
        return { itemId, itemName: item?.name, itemIcon: item?.icon };
    }
};

export { LootSystem };
