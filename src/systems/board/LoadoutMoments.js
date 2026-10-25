// carried rules firing at a named moment

import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as StatusApplication from './StatusApplication.js';
import * as DealDamage from './DealDamage.js';
import * as EffectActions from './EffectActions.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as RareDrops from './RareDrops.js';
import * as BoardState from './BoardState.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import { workConfigOf } from './StationRecipe.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { categoryOfItem, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { WORK_START, workSkillMatches } from '../core/consumableRule.js';
import { KEYWORD } from '../effects/statements.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * The rules a hero is carrying that asked for this moment.
 *
 * Not routed through `TriggerSystem`: that fires statements against a Token instance, where the
 * cooldown lives and the charge delta is spent. A hero's items have neither; their cost comes out
 * of the inventory stack.
 *
 * Its own module because `BoardRunner` (cycle start) and `BoardCombat` (engaging an enemy, via
 * `init`'s `COMBAT_ENGAGED` subscription) both fire carried rules and `BoardRunner` imports
 * `BoardCombat`; putting this in either would make an import cycle. This file imports neither.
 *
 * Order is check, act, pay: a potion spent on a roll that missed would misreport how often it
 * works.
 *
 * ⚠️ Acted means it changed something: a hit fully stopped by armour, a heal on someone already
 * whole and a cleanse with nothing to remove do nothing, so none of them spends the item.
 *
 * ## A work cycle starting (`CYCLE_START`)
 * Its hero's rules on On Work Start (`WORK_START`) and on `CYCLE_START` fire, those naming a skill
 * only on a cycle of that skill. Before they do, whatever the hero's last cycle left "for the cycle"
 * ends (a cycle left part-way included). Drinks and work potions are drunk from their dose
 * (`ConsumptionSystem.startWorkDoses`) and their work rules fire from it, uncharged, as an
 * elixir's do on a fight. An effect applied "for the cycle" is bound to this Token's cycle and ends
 * with it (`init`'s `CYCLE_COMPLETE` subscription).
 */

/** The moment `BoardRunner` names as a hero's work cycle starts. */
const CYCLE_START = 'CYCLE_START';

/** The skill of the work a Token's cycle is doing: its work config's, a Foundation's build skill. */
function cycleSkillOf(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return '';
    return workConfigOf(getTokenType(instance.typeId), instance)?.skill || '';
}

/**
 * Fire every carried rule waiting on `eventId`.
 * @param {string} instanceId the Token where the moment happened: a grant lands from here, and a
 * status resolves its target from whoever works this Token
 * @param {string} heroId the hero whose loadout is being read
 * @param {string} eventId a `TRIGGER_EVENTS` id, e.g. `CYCLE_START`
 * @returns {number} how many rules actually did something
 */
export function fire(instanceId, heroId, eventId) {
    if (!heroId || instanceId == null) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    // Who a carried rule's roles name. The carrier is `self` and the actor alike; `the enemy` is
    // looked up from that hero by the verb itself, never from the Token.
    const roles = { self: instanceId, selfHeroId: heroId, actor: heroId, source: null };

    let fired = 0;

    // A fight starting counts a fight on every elixir and drinks those that ran out. An elixir's
    // rules work from its dose, not from the Bank: they are fired below without a cost, and kept
    // out of the ordinary pass, which would charge one per fight. A work cycle starting does the
    // same for drinks and work potions.
    const fightStart = eventId === ConsumptionSystem.FIGHT_START;
    const workStart = eventId === CYCLE_START;
    const skill = workStart ? cycleSkillOf(instanceId) : '';
    if (workStart) LiveEffects.endHeroCycleEffects(heroId);

    const doses = fightStart ? ConsumptionSystem.startFightElixirs(heroId)
        : workStart ? ConsumptionSystem.startWorkDoses(heroId, skill) : [];
    const isDoseItem = fightStart ? (id) => isConsumableCategory(categoryOfItem(id))
        : workStart ? ConsumptionSystem.isWorkDose : null;
    const fromDosesOnly = (statement) => !!isDoseItem
        && (statement.sourceItemIds || []).every(isDoseItem);
    const statements = [
        ...HeroEffects.loadoutStatements(hero).filter(s => !fromDosesOnly(s)),
        ...doses.flatMap(id => HeroEffects.itemStatements(id).map(s => ({ ...s, dosed: true })))
    ];
    const waitsHere = (statement) => {
        const event = statement?.when?.event;
        if (!workStart) return event === eventId;
        return (event === eventId || event === WORK_START) && workSkillMatches(statement.when, skill);
    };

    for (const original of statements) {
        if (!waitsHere(original)) continue;
        if (!original.dosed && !HeroEffects.canPayLoadoutCost(original)) continue;

        // "For the cycle" means this Token's cycle, the one starting now.
        const statement = workStart && original.payload?.forCycle
            ? { ...original, payload: { ...original.payload, forCycle: instanceId } }
            : original;
        const payload = statement.payload || {};
        let acted = false;

        if (statement.keyword === KEYWORD.APPLIES) {
            // A role, when set, replaces the Token's occupant reading.
            acted = statement.target?.role
                ? StatusApplication.applyToRole(statement, roles) > 0
                : StatusApplication.applyAt(instanceId, payload);
        } else if (statement.keyword === KEYWORD.DEALS) {
            acted = DealDamage.deal(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.HEALS) {
            acted = EffectActions.heal(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.REMOVES) {
            acted = EffectActions.remove(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.GRANTS && payload.itemId) {
            const chance = payload.chance ?? 100;
            if (chance >= 100 || Math.random() * 100 < chance) {
                RareDrops.noteDrop(SpriteLayer.addSprite('item', payload.itemId, Math.max(1, payload.quantity || 1), instanceId), chance);
                acted = true;
            }
        }

        if (!acted) continue;
        if (!statement.dosed) HeroEffects.payLoadoutCost(statement);
        // A dose says itself once, in the hero's "used" bubble as it is drunk, not on every firing.
        if (!statement.dosed) EffectFeedback.announce(instanceId, statement);
        fired += 1;
    }

    return fired;
}

let unsubscribers = [];

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}

/**
 * Fires carried rules on `COMBAT_ENGAGED`, and ends what a hero carried "for the cycle" when that
 * cycle completes.
 *
 * ⚠️ Must subscribe after everything else on those events (the trigger moments, via
 * `TriggerSystem.init()` inside `BoardRunner.init()`), so `EventBus`'s in-order loop reaches it
 * last: every reader of a finished cycle has seen the effect before it ends. `EngineBootstrap`
 * calls this after `BoardRunner.init()`/`BoardCombat.init()` for that reason.
 */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, ({ instanceId, heroId }) => {
        fire(instanceId, heroId, 'COMBAT_ENGAGED');
    }));
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, ({ instanceId, heroId } = {}) => {
        if (heroId) LiveEffects.endHeroCycleEffects(heroId, instanceId);
    }));
}
