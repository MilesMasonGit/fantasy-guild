// combat on the board

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { enemyProfileOf, enemyDropsOf, isEnemyDef } from '../../config/registries/enemyProfile.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { processCombat } from '../combat/CombatProcessor.js';
import { applyDefeatPenalties } from '../combat/DefeatPenalties.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { statementsOf } from '../effects/statements.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as RecipeResolver from './RecipeResolver.js';
import * as TileModifiers from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import { momentSupplies } from '../../config/registries/triggerRegistry.js';
import { ROLE, opponentSeekerOf } from '../../config/registries/roleRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Combat on the board: an adapter, not an engine. The 7-stat engine, status effects, damage
 * resolution, the Wounded state and passive regen carry over unchanged; only the trigger differs: a
 * hero is dropped onto an enemy Token.
 *
 * `CombatProcessor.processCombat(card, trait, delta)` operates on a rich card instance
 * (`card.combat`, `card.status`, `card.traits`). A Token instance is deliberately light (typeId,
 * charges, elapsed). Rather than fatten every Token to satisfy a signature, this keeps one
 * ephemeral combat object per fought enemy Token, in a runtime-only map keyed by the enemy's
 * instance id. At most a handful exist at once, and none of it needs saving.
 *
 * A moved enemy keeps its fight: a fight is keyed by the enemy Token's instance id, and a move
 * keeps the id, so the fight, and the enemy's HP, stays with the Token wherever it is put. Combat
 * internals are not persisted: reloading mid-fight restarts the encounter with the enemy at full
 * HP, the same outcome as walking away.
 *
 * Production is the idle half; combat is the active half: there is no difficulty warning, no level
 * gate and no preview on an enemy Token. The player is expected to watch the first few fights of
 * any new enemy and judge whether their hero can sustain it. Leaving a hero in a fight they cannot
 * win means death, and death costs equipment.
 *
 * Retreat is not a mechanic: it is simply unassigning the hero. Pull them off and the fight ends
 * immediately, and the enemy returns to full HP, consistent with a forfeited cycle.
 */

/** Ephemeral combat state, one per fought enemy, keyed by its instance id. Never saved. */
const fights = new Map();

/**
 * Whether this hero is able to fight anything at all.
 *
 * Possession of a combat skill, nothing else — an unpromoted Recruit holds
 * none and is refused. Exported so `BoardRunner` can raise the tile mark
 * without duplicating the rule.
 */
export function canFight(heroId) {
    return CombatFormulas.canHeroFight(HeroManager.getHero(heroId));
}

/** Whether a Token is something a hero can fight. */
export function isEnemyToken(instance) {
    return isEnemyDef(getTokenType(instance?.typeId));
}

/**
 * The creature a Token *is*.
 *
 * Built fresh from the Token each call rather than cached. The stat block is
 * five multiplications off one authored number, it is only wanted once per
 * tick per fighting tile, and deriving it live means an enemy re-authored in
 * the CMS is correct on the next tick with nothing to invalidate.
 */
function enemyFor(instance) {
    return enemyProfileOf(getTokenType(instance?.typeId));
}

/**
 * The card-shaped object the ported engine works on: only the fields `CombatProcessor`,
 * `CombatAttackProcessor` and `CombatResolutionProcessor` actually read. `traits` is present and
 * empty deliberately: `handleVictory` looks for a `unifiedreward` trait, and a Token's rewards come
 * from its outputs instead.
 *
 * `enemy` and `drops` are carried, not looked up: the fight holds the stat block built from the
 * Token and the drop list read off the Token's outputs.
 *
 * `enemyId` is the Token's id. It is what the Bestiary, the kill counts and the discovery
 * notifications key on.
 */
function createFight(instanceId, heroId, enemy, drops) {
    const aggregator = new ModifierAggregator(`enemy_${instanceId}`);
    const effects = [];

    // Wired onto the stat block here as well as on every later tick, so that
    // `fight.enemy` is never the one profile in the game without them.
    enemy.aggregator = aggregator;
    enemy.effects = effects;

    return {
        id: `fight_${instanceId}`,
        /** The enemy Token this fight is against, also the fight's key. */
        instanceId,
        enemyId: enemy.id,
        enemy,
        drops,
        /**
         * What makes an enemy an effect bearer.
         *
         * The list and the aggregator live on the FIGHT, not on the stat block: `enemyFor` derives
         * a fresh profile every tick on purpose, so an enemy re-authored in the CMS takes effect
         * immediately, and anything stored there would be thrown away next tick. Living on the
         * fight also gives them the right lifetime: a fight is dropped when the hero leaves, when a
         * different hero arrives, and on teardown, and the enemy returns whole, so a poison cannot
         * survive a monster walking away from it.
         */
        effects,
        aggregator,
        assignedHeroId: heroId,
        status: 'idle',
        traits: [],
        combat: {
            enemyHp: { current: enemy.hp, max: enemy.hp },
            enemyTickProgress: 0,
            heroTickProcesses: {},
            state: { intermissionTimer: 0 },
            stats: {}
        }
    };
}

/**
 * The source id under which a fight's enemy lends the hero its numbers.
 *
 * Per enemy Token, so two heroes fighting two enemies never share an entry, and
 * so ending one fight cannot strip the other's.
 */
const fightSource = (instanceId) => `fight:${instanceId}`;

/**
 * An enemy's own rules, applied to the hero fighting it.
 *
 * An enemy is a Token, and a Token's rules are named library effects. Its combat-axis `Provides`
 * are registered onto the hero's aggregator for as long as the fight lasts, so an enemy authored
 * with `Provides Armor -2` makes its hero softer, using numbers `CombatFormulas` already reads.
 * Registered per fight and removed with it, so the debuff cannot outlive the creature that imposed
 * it.
 */
function applyEnemyCombatModifiers(instanceId, heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.aggregator) return;

    const source = fightSource(instanceId);
    hero.aggregator.removeModifiersBySource(source);

    const def = getTokenType(BoardState.getTokenById(instanceId)?.typeId);
    for (const { type, value, category } of HeroEffects.combatContributions(statementsOf(def))) {
        hero.aggregator.addModifier({
            type, value, bucket: 'flat', source,
            ...(category ? { target: { category } } : {})
        });
    }
}

/** Take back whatever the fight against this enemy lent its hero. */
function clearEnemyCombatModifiers(instanceId) {
    const heroId = fights.get(instanceId)?.assignedHeroId;
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    hero?.aggregator?.removeModifiersBySource(fightSource(instanceId));
}

/**
 * The bearer descriptor for a live fight's enemy.
 *
 * ⚠️ `self` is the enemy TOKEN (its instance id), not a person: the opposite of a hero's
 * descriptor, where `self` is `selfHeroId`. `selfFightId` says which of the two this is, so a
 * carried `Deals ... to this entity` on a monster hits the monster rather than whoever is working
 * it.
 */
function enemyBearer(instanceId, fight) {
    return {
        target: fight,
        name: fight.enemy?.name || fight.enemyId,
        roles: { self: instanceId, selfFightId: instanceId, selfHeroId: null, actor: null, source: null },
        // A fight in intermission is between enemies; its clock keeps running, the same as a hero's
        // does between cycles.
        suspended: () => false,
        notify: () => {}
    };
}

/**
 * Hand every live fight to the effects clock.
 *
 * Registered here rather than imported there so `LiveEffects` stays free of the
 * board — the same injection `fire` uses.
 */
LiveEffects.registerBearerSource(
    () => Array.from(fights, ([instanceId, fight]) => enemyBearer(instanceId, fight))
);

/** The bearer for the live fight against enemy Token `instanceId`, if any. */
export function enemyBearerOfToken(instanceId) {
    const fight = instanceId ? fights.get(instanceId) : null;
    return fight ? enemyBearer(instanceId, fight) : null;
}

/**
 * The fight a hero is in, found by HERO, never by place.
 *
 * `the enemy` is looked up here. Where the hero is recorded as standing does not enter into it: a
 * hero's flag and the Token they fight can differ, and a rule aimed at their enemy must not quietly
 * hit whatever stands where their flag is instead.
 *
 * At most one fight names a hero: `tickToken` ends any other on creation.
 */
export function fightOfHero(heroId) {
    if (!heroId) return null;
    for (const fight of fights.values()) {
        if (fight.assignedHeroId === heroId) return fight;
    }
    return null;
}

/** The bearer for the enemy `heroId` is fighting, or null. */
export function enemyBearerOfHero(heroId) {
    const fight = fightOfHero(heroId);
    return fight ? enemyBearer(fight.instanceId, fight) : null;
}

/**
 * The fight a statement aimed at `the enemy` reaches, or null: what every verb resolves `opponent`
 * through.
 *
 * ⚠️ Only on a moment that supplies the role. The picker never offers the enemy elsewhere, and this
 * makes the runtime agree: a rule on a cycle moment reaches nobody even if its hero happens to be
 * mid-fight, rather than hitting a creature its sentence could not have meant. With no fight it
 * also reaches nobody, and never falls back to the hero.
 */
export function opponentFightOf(statement, roles) {
    if (!momentSupplies(statement?.when?.event, ROLE.OPPONENT)) return null;
    return fightOfHero(opponentSeekerOf(roles));
}

/** The same, as a `LiveEffects` bearer. */
export function opponentBearerOf(statement, roles) {
    const fight = opponentFightOf(statement, roles);
    return fight ? enemyBearer(fight.instanceId, fight) : null;
}

/** Drop the fight against enemy Token `instanceId`, so the next engagement starts clean. */
export function endFight(instanceId) {
    if (!instanceId) return;
    clearEnemyCombatModifiers(instanceId);
    fights.delete(instanceId);
}

/**
 * End whatever fight `heroId` is in, now.
 *
 * Called by `Flags` whenever a hero lets go of an enemy (a recall, a defeat, a re-plant, moving
 * on). It has to be synchronous: waiting for the next tick would leave `fightOfHero` answering for
 * a hero already in the Dock, and a re-plant onto the same enemy would resume a damaged one instead
 * of meeting it whole.
 *
 * @returns {boolean} whether there was a fight to end
 */
export function endFightOfHero(heroId) {
    const fight = fightOfHero(heroId);
    if (!fight) return false;
    endFight(fight.instanceId);
    return true;
}

/** The live fight against enemy Token `instanceId`, or null. */
export function getFight(instanceId) {
    return (instanceId && fights.get(instanceId)) || null;
}

/** Drop every fight (on teardown, and in tests). */
export function clearAll() {
    // Hand every fight's borrowed numbers back before dropping them, or a teardown would leave an
    // enemy's debuff on a hero with no fight to explain it.
    for (const instanceId of fights.keys()) clearEnemyCombatModifiers(instanceId);
    fights.clear();
}

/**
 * Advance combat on one enemy Token. Called from the board runner's tick for every enemy Token on
 * the mat.
 *
 * An enemy never starts a fight by itself here: with no hero on it, it does nothing at all. A
 * hostile enemy gets a hero onto it through `Hostiles` and `Flags.ambush`, not in this function.
 */
export function tickToken(instance, delta, heroId) {
    const enemy = enemyFor(instance);
    const id = instance?.id;
    if (!enemy || !id) return;

    // No hero: the fight is over before it began. Drop any in-flight state so the enemy is whole
    // again next time.
    if (!heroId) {
        if (fights.has(id)) endFight(id);
        return;
    }

    // ⚠️ An unpromoted hero cannot fight at all. Holding a combat skill decides if; how high it is
    // never decides whether. A Recruit standing on an enemy simply stands there: no fight starts,
    // no damage is dealt or taken, and the enemy stays whole. This is a possession gate, not a
    // difficulty gate. `BoardRunner` raises the tile mark.
    if (!canFight(heroId)) {
        if (fights.has(id)) endFight(id);
        return;
    }

    // Keyed by the enemy's instance id, so a Token that was moved finds its own fight here with
    // nothing carried across.
    let fight = fights.get(id);

    // A different hero arrived — start fresh rather than inheriting the last
    // one's attack timers.
    if (fight && fight.assignedHeroId !== heroId) {
        endFight(id);
        fight = null;
    }

    if (!fight) {
        // ⚠️ One fight per hero. A hero fighting somewhere else is no longer fighting there: end
        // that fight first, which also takes back the numbers its enemy lent the hero. Without this
        // two fights could name one hero and `fightOfHero` would have to guess.
        for (const [otherId, other] of [...fights]) {
            if (otherId !== id && other.assignedHeroId === heroId) endFight(otherId);
        }
        fight = createFight(id, heroId, enemy, enemyDropsOf(getTokenType(instance.typeId)));
        fights.set(id, fight);
        applyEnemyCombatModifiers(id, heroId);
    }

    fight.assignedHeroId = heroId;

    // ⚠️ The stat block is re-derived every tick and the aggregator is not, so they have to be
    // joined back up here. Without this line `computeHeroDamage` reads a profile with no aggregator
    // and an enemy's carried armour is silently zero, which looks exactly like the feature working.
    enemy.aggregator = fight.aggregator;
    enemy.effects = fight.effects;

    // An engagement is EVERY engagement, including each one after a kill, and detecting it takes
    // two signals, not one.
    // ⚠️ The obvious detector does not work: a transition into `active` catches only the first
    // engagement, because `resolveVictory` below sets `fight.status = 'active'` the instant the
    // kill resolves. What marks a fresh enemy is the intermission ending: that is where
    // `CombatProcessor` restores the enemy to full HP. So `idle` to `active` is the first
    // engagement (or a return after a retreat), and resting to not resting is the next enemy
    // stepping up.
    // Read before and compared after, rather than published from inside `CombatProcessor`, because
    // that engine is a port and board events are this adapter's job.
    const resting = () => (fight.combat?.state?.intermissionTimer ?? 0) > 0;
    const wasActive = fight.status === 'active';
    const wasResting = resting();

    processCombat(fight, { enemy }, delta);

    const engaged = (fight.status === 'active' && !wasActive) || (wasResting && !resting());

    if (engaged) {
        // `LoadoutMoments.init` subscribes to `COMBAT_ENGAGED` and fires carried rules itself; it
        // is registered in EngineBootstrap after `TriggerSystem.init` so it still runs last.
        EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, {
            instanceId: id,
            typeId: instance.typeId,
            heroId
        });
    }

    // The ring tracks the CURRENT FIGHT: one kill is one cycle for every board system outside the
    // combat engine, so the same ring means the same thing whether the Token is a Forest or a Bear.
    const hp = fight.combat.enemyHp;
    if (hp?.max) {
        EventBus.publish(BOARD_EVENTS.PROGRESS, {
            instanceId: id,
            percent: Math.max(0, Math.min(100, (1 - hp.current / hp.max) * 100)),
            combat: true,
            enemyHp: hp.current,
            enemyMaxHp: hp.max
        });
    }

    // Defeat: the attack processor routes 0 HP through `handleHeroWounded`,
    // which sets the hero's status. Detect it and get them off the board.
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded' || (hero.hp?.current ?? 1) <= 0) {
        resolveDefeat(instance, heroId);
        return;
    }

    if (fight.status === 'victory') {
        resolveVictory(instance, fight, enemy, heroId);
    }
}

/** A Token's centre as a mat point, for payloads about a Token that has just left. */
const pointOf = (instance) => ({ x: instance.x, y: instance.y });

/**
 * A kill.
 *
 * One kill counts as one cycle for every board system outside the combat engine. That single unit
 * is what connects combat to the rest of the board: nearby Context and Buff Tokens wear per kill
 * exactly as they wear per craft, so a Weapon Rack burns down as it is used.
 *
 * The post-kill rest is handled inside the ported engine: `handleVictory` sets a short intermission
 * and `processCombat` restores the enemy to full HP when it expires. Hero power shortens the fight
 * but not the rest, so farming trivial content is capped while fighting hard content is not.
 */
function resolveVictory(instance, fight, enemy, heroId) {
    const id = instance.id;

    // Enemy Tokens deplete like any other: a Bear is not an infinite resource; spawners replace
    // them.
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            instanceId: id,
            delta: -1,
            remaining: instance.usesRemaining,
            typeId: instance.typeId
        });
    }

    // Support Tokens beside the enemy wear per kill, by instance id.
    RecipeResolver.wearNearbySupport(id, (supportId, supportInstance) => {
        const support = supportInstance || BoardState.getTokenById(supportId);
        const sTypeId = support?.typeId;
        const sName = getTokenType(sTypeId)?.name || sTypeId || 'Support';
        const spot = support ? pointOf(support) : null;
        BoardState.removeToken(supportId);
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            instanceId: supportId,
            ...spot,
            severity: 'red',
            type: 'token_exhausted',
            name: sName,
            message: `Token Exhausted: ${sName}`
        });
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: supportId, ...spot, typeId: sTypeId || null, exhaustedBy: heroId || null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: supportId, ...spot, typeId: null });
        TileModifiers.rebuildAround([spot]);
    });

    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        instanceId: id,
        typeId: instance.typeId,
        heroId: heroId || null,
        failed: false
    });
    // `heroId` and `typeId` ride along so a rule reacting to a fight ending can name the victor and
    // the creature, as `CYCLE_COMPLETE` (published just above from the same function) can.
    EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, {
        instanceId: id, outcome: 'victory', heroId: heroId || null, typeId: instance.typeId
    });

    if (instance.usesRemaining != null && instance.usesRemaining <= 0) {
        const spot = pointOf(instance);
        BoardState.removeToken(id);
        endFight(id);
        const eName = getTokenType(instance.typeId)?.name || instance.typeId;
        EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
            instanceId: id,
            ...spot,
            severity: 'red',
            type: 'token_exhausted',
            name: eName,
            message: `Token Exhausted: ${eName}`
        });
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: id, ...spot, typeId: instance.typeId, exhaustedBy: heroId || null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, ...spot, typeId: null });
        // The hero's flag chooses again on its next pass.
        if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...spot });
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [spot] });
        return;
    }

    // Let the ported engine run its intermission and respawn the enemy: the board simply lets it
    // happen.
    fight.status = 'active';
}

/**
 * The hero lost.
 *
 * Death costs equipment: this is the only way gear ever leaves a hero.
 *
 * ⚠️ This is the one implementation of dying. Poison kills route here too, via
 * `resolveStatusDefeat` below, so `instance` may be null: a hero can be downed by a DoT while
 * sitting in the Dock, with no Token to tidy up.
 */
function resolveDefeat(instance, heroId) {
    endFight(instance?.id);

    const hero = HeroManager.getHero(heroId);
    if (hero && hero.status !== 'wounded') HeroManager.setHeroStatus(heroId, 'wounded');

    // A forced retreat cleanses every status, good or bad.
    StatusEffectSystem.clearAll(heroId);
    const lost = applyDefeatPenalties(heroId) || [];

    // Off the board. Recovery is tracked on the HERO (`woundedRemainingMs`), never on the tile, so
    // the tile is immediately free for someone else and simply idles until re-staffed. A defeated
    // hero genuinely LEAVES, unlike one whose Token merely ran dry: they are carried home, and
    // their flag comes down with them.
    // `Flags.init` subscribes to the defeat event and furls the hero's flag; `EventBus.publish` is
    // synchronous, so the furl happens here, before the `TILE_CHANGED` / `COMBAT_RESOLVED`
    // publishes below.
    EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId });
    if (instance) {
        instance.cycleElapsedMs = 0;
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, {
            instanceId: instance.id, outcome: 'defeat', heroId: heroId || null, typeId: instance.typeId || null
        });
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'board_combat_defeat' });

    // One notification for the whole defeat: who fell and what it cost.
    NotificationSystem.warning(defeatMessage(hero?.name, lost));
    logger.info('BoardCombat', `Defeat against ${instance?.id ?? 'nothing'}: ${heroId}`);
}

/** "X was defeated and carried home, injured. Lost: A, B." */
export function defeatMessage(heroName, lost = []) {
    const who = heroName || 'Your hero';
    const what = lost.length ? `Lost: ${lost.join(', ')}.` : 'Nothing was lost.';
    return `${who} was defeated and carried home, injured. ${what}`;
}

/**
 * A hero dropped to 0 HP away from a fight: a damage-over-time effect killed them. One rule for
 * dying however it happens, so it cannot be dodged by dying to a DoT.
 *
 * Deliberately not a second death path. All it does is work out which Token the hero was working
 * and hand them to `resolveDefeat`, the same function an enemy Token uses, so the wound, the
 * cleanse, the gear roll and the trip home stay written once. A hero downed while off the board
 * passes a null Token, which `resolveDefeat` tolerates.
 *
 * Guarded against re-entry: an already-`wounded` hero is ignored, so a second status tick in the
 * same frame cannot roll their gear twice.
 */
export function resolveStatusDefeat(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded') return;

    resolveDefeat(BoardState.getTokenById(BoardState.workTokenOf(heroId)), heroId);
}

export function init() {
    // Ending a fight is handled by `tickToken` seeing no hero, and by `Flags` calling
    // `endFightOfHero` when a hero lets go, NOT by an event: `HERO_MOVED` on a recall names where
    // the hero WENT (the Dock), not the Token they left.
    EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => clearAll());

    // The status clock cannot call us directly: `StatusEffectSystem` is imported by this file, so
    // importing it back would be a static cycle. It announces the death instead and this is the
    // single subscriber that acts on it.
    EventBus.subscribe(ENGINE_EVENTS.HERO_DOWNED, ({ heroId }) => resolveStatusDefeat(heroId));

    logger.info('BoardCombat', 'Board combat ready');
}
