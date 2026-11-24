// Quest Manager
// Hears the game's events and reports progress to Limes's lessons (`LimesLessons.report`). Only the
// reports a lesson step or moment counts are made (`lessonPlan.js`): a step that counts a new kind
// of report adds its subscription here.

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { toolOf } from '../../config/registries/toolKinds.js';
import { categoryOfItem } from '../../config/registries/equipmentConstants.js';
import { isWeapon } from '../../config/registries/weaponStyles.js';
import * as LimesLessons from './LimesLessons.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

let unsubs = [];
let initialized = false;

export const QuestManager = {
    init() {
        if (initialized) return;
        this.setupListeners();
        initialized = true;
    },

    cleanup() {
        unsubs.forEach(unsub => unsub?.());
        unsubs = [];
        initialized = false;
    },

    setupListeners() {
        unsubs.push(
            // ⚠️ One event per player action, and only one. A lesson must hear about an action
            // exactly once, and `Placement` publishes both a semantic event (`TOKEN_PURCHASED`,
            // `hero_deployed`) and a board-lifecycle one (`TILE_CHANGED`, `HERO_MOVED`) for a single
            // action. The lifecycle events exist to redraw the UI, so the semantic event is the
            // signal. Do not add a second source back.
            EventBus.subscribe(ENGINE_EVENTS.TOKEN_PURCHASED, (data) => {
                this.reportProgress('token_purchased', 1, { typeId: data?.typeId });
            }),
            // A Foundation became what it built, or Farmland what was planted (published by `BoardRunner`).
            EventBus.subscribe(BOARD_EVENTS.TOKEN_BUILT, (data) => {
                this.reportProgress('token_built', 1, { typeId: data?.typeId });
            }),
            // A new order, on the Token the hero was sent to.
            EventBus.subscribe(ENGINE_EVENTS.HERO_DEPLOYED, (data) => {
                this.reportProgress('hero_deployed', 1, { typeId: data?.typeId ?? null });
            }),
            // A finished work cycle: gathering, crafting, exploring. A failed cycle counts for
            // nothing, and a kill counts once, as `combat_victory` below. The Token's type and
            // skill, and whether it was gathering (a resource that is not an endgame site) or
            // crafting (a station that is not a Foundation), let a step ask for one kind of work.
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (data) => {
                if (data?.failed || data?.kill) return;
                const def = getTokenType(data?.typeId);
                this.reportProgress('cycle_completed', 1, {
                    typeId: data?.typeId,
                    skill: def?.config?.skill || null,
                    gathered: def?.tokenType === 'resource' && !def.landmark,
                    crafted: def?.tokenType === 'station' && !def.foundation
                });
            }),
            EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, (data) => {
                if (data?.kind === 'item') this.reportProgress('loot_collected', data?.quantity || 1);
            }),
            EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, (data) => {
                // A buy of several ranks at once counts each rank, as that many single buys would.
                this.reportProgress('guild_upgrade_purchased', data?.count || 1, { upgradeId: data?.upgradeId ?? null });
            }),
            // A place of the world map settled.
            EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (data) => {
                if (data?.reason === 'created' && data.cellId) this.reportProgress('place_settled');
            }),
            // ⚠️ `hero_equipped` is NOT an engine event. Equipping is announced as
            // `hero_equipment_changed` with `action: 'equip'`, which feeds the `hero_equipped` report.
            // `toolKind`: which kind of gathering tool was equipped, if any; `category` its loadout
            // category ('food'), `weapon` whether the item is a weapon.
            // ⚠️ A weapon by `isWeapon`, not by its category: a woodaxe sits in the hand category
            // too, and lesson 3's woodaxe would otherwise do lesson 8's weapon step.
            EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (data) => {
                if (data?.action !== 'equip') return;
                const item = getItem(data.itemId);
                this.reportProgress('hero_equipped', 1, {
                    toolKind: toolOf(item)?.kind ?? null,
                    category: categoryOfItem(data.itemId),
                    weapon: isWeapon(item)
                });
            }),
            // `enemyId` is the beaten enemy's Token type, so a step can ask for one foe.
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (data) => {
                this.reportProgress('combat_victory', 1, { enemyId: data?.enemyId ?? null });
            })
        );
    },

    /** Count one report for Limes's lessons. */
    reportProgress(targetType, amount = 1, metadata = {}) {
        LimesLessons.report(targetType, amount, metadata);
    }
};
