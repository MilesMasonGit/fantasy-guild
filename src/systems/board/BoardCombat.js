// Fantasy Guild — Combat on the board (7×7 Playmat rework, Phase 6)

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
import * as Flags from './Flags.js';
import * as LoadoutMoments from './LoadoutMoments.js';
import { momentSupplies } from '../../config/registries/triggerRegistry.js';
import { ROLE, opponentSeekerOf } from '../../config/registries/roleRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';

/**
 * Combat on the board — **a porting job, not a design-and-build job** (D-136).
 *
 * The 7-stat engine, status effects, damage resolution, the Wounded state and
 * passive regen all carry over unchanged. **Only the trigger changes**: a hero
 * used to encounter an enemy card, and now is dropped onto an enemy Token.
 *
 * ## Why this file is an adapter, not an engine
 * `CombatProcessor.processCombat(card, trait, delta)` operates on a rich card
 * instance — `card.combat`, `card.status`, `card.traits`. A Token instance is a
 * deliberately light thing (typeId, charges, elapsed). Rather than
 * fatten every Token to satisfy a signature, this keeps **one ephemeral combat
 * object per fought enemy Token**, held in a runtime-only map keyed by the
 * enemy's **instance id** (Free Playmat slice 1.6b).
 *
 * That is the same bridge the deck loop used between flyweight slots and the
 * execution engines, and it is kept for the same reason: at most a handful exist
 * at once (one per enemy with a hero on it), and none of it needs saving.
 *
 * ## ⭐ A moved enemy keeps its fight (FPP-4)
 * Because a fight is keyed by the enemy Token's instance id, and a move keeps
 * the id, the fight — and so the enemy's HP — simply stays with the Token
 * wherever it is put. Nothing has to carry it across.
 * Combat internals are not persisted — reloading mid-fight restarts the
 * encounter with the enemy at full HP, which is the same outcome as walking away
 * (`G-4`), so nothing is lost by not saving it.
 *
 * ## Production is the idle half; combat is the active half (D-130)
 * Everything else on the board runs unattended and winds down gracefully.
 * Combat is deliberately the opposite: **there is no difficulty warning, no
 * skill gate and no preview** on an enemy Token. The player is expected to watch
 * the first few fights of any new enemy and judge whether their hero can sustain
 * it. Leaving a hero in a fight they cannot win means death, and death costs
 * equipment (D-74).
 *
 * ## Retreat is not a mechanic (`G-3`)
 * It is simply unassigning the hero, which falls out of Phase 2's placement
 * rules. Pull them off and the fight ends immediately — and **the enemy returns
 * to full HP** (`G-4`), consistent with D-131's forfeited cycle. That cost is
 * what gives "watch your first few fights" any weight.
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
 * The card-shaped object the ported engine works on.
 *
 * Only the fields `CombatProcessor`, `CombatAttackProcessor` and
 * `CombatResolutionProcessor` actually read. `traits` is present and empty
 * deliberately: `handleVictory` looks for a `unifiedreward` trait, and a Token's
 * rewards come from its outputs instead.
 *
 * ## `enemy` and `drops` are carried, not looked up
 * Both used to be fetched from `enemyRegistry` by id on every tick. There is no
 * registry now, so the fight holds what it needs: the stat block built from the
 * Token, and the drop list read off the Token's outputs.
 *
 * `enemyId` stays alongside them, and is the **Token's** id. It is what the
 * Bestiary, the kill counts and the discovery notifications key on, so keeping
 * the field named as it was means none of that needed migrating — the ids it
 * receives simply exist now, which they never did before.
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
        /** The enemy Token this fight is against — also the fight's key (FPP-4). */
        instanceId,
        enemyId: enemy.id,
        enemy,
        drops,
        /**
         * ⭐ **What makes an enemy an effect bearer.**
         *
         * The list and the aggregator live on the FIGHT, not on the stat block:
         * `enemyFor` derives a fresh profile every tick on purpose, so an enemy
         * re-authored in the CMS takes effect immediately — anything stored
         * there would be thrown away 100ms later.
         *
         * Living on the fight also gives them exactly the right lifetime. A
         * fight is dropped when the hero leaves, when a different hero arrives,
         * and on teardown, and "the enemy returns whole" (G-4) is already the
         * rule — so a poison cannot survive a monster walking away from it, with
         * nothing extra written to make that true.
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
 * An enemy's own rules, applied to the hero fighting it (Unified Effects P7).
 *
 * ## This is what "enemies scale hero-side numbers" means mechanically
 * An enemy is a Token, and a Token's rules are named library effects. Its
 * combat-axis `Provides` are registered onto the **hero's** aggregator for as
 * long as the fight lasts — so an enemy authored with `Provides Armor -2`
 * genuinely makes its hero softer, using the numbers `CombatFormulas` already
 * reads. Nothing in the combat engine changed to allow it.
 *
 * Registered per fight and removed with it, so the debuff cannot outlive the
 * creature that imposed it — the failure that would be most invisible here.
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
 * ⚠️ `self` is the enemy TOKEN (its instance id), not a person — the opposite
 * of a hero's descriptor, where `self` is `selfHeroId`. `selfFightId` says
 * which of the two this is, so a carried `Deals ... to this entity` on a monster
 * hits the monster rather than whoever is working it.
 */
function enemyBearer(instanceId, fight) {
    return {
        target: fight,
        name: fight.enemy?.name || fight.enemyId,
        roles: { self: instanceId, selfFightId: instanceId, selfHeroId: null, actor: null, source: null },
        // A fight in intermission is between enemies (D-103's short rest); its
        // clock keeps running, the same as a hero's does between cycles.
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
 * ⭐ **The fight a hero is in, found by HERO — never by place** (G-43).
 *
 * `the enemy` is looked up here. Where the hero is recorded as standing does
 * not enter into it: under Free Playmat flags (FP-67) a hero's flag and the
 * Token they fight can differ, and a rule aimed at their enemy must not quietly
 * hit whatever stands where their flag is instead.
 *
 * At most one fight names a hero — `tickToken` ends any other on creation.
 */
export function fightOfHero(heroId) {
    if (!heroId) return null;
    for (const fight of fights.values()) {
        if (fight.assignedHeroId === heroId) return fight;
    }
    return null;
}

/** The bearer for the enemy `heroId` is fighting, or null (G-43). */
export function enemyBearerOfHero(heroId) {
    const fight = fightOfHero(heroId);
    return fight ? enemyBearer(fight.instanceId, fight) : null;
}

/**
 * The fight a statement aimed at `the enemy` reaches, or null — what every verb
 * resolves `opponent` through.
 *
 * ⚠️ **Only on a moment that supplies the role** (G-2, G-43). The picker never
 * offers the enemy elsewhere, and this makes the runtime agree: a rule on a
 * cycle moment reaches nobody even if its hero happens to be mid-fight, rather
 * than hitting a creature its sentence could not have meant. With no fight it
 * also reaches nobody — and never falls back to the hero.
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
 * ⭐ **End whatever fight `heroId` is in, now** (FP-43, G-4).
 *
 * Called by `Flags` whenever a hero lets go of an enemy — a recall, a defeat, a
 * re-plant, moving on. It has to be synchronous: waiting for the next tick to
 * notice would leave `fightOfHero` answering for a hero already in the Dock, and
 * a re-plant onto the same enemy would resume a damaged one instead of meeting
 * it whole.
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
    // Hand every fight's borrowed numbers back before dropping them, or a
    // teardown would leave an enemy's debuff on a hero with no fight to explain
    // it — and nothing left that knows to remove it.
    for (const instanceId of fights.keys()) clearEnemyCombatModifiers(instanceId);
    fights.clear();
}

/**
 * Advance combat on one enemy Token.
 *
 * Called from the board runner's tick for every enemy Token on the mat.
 * Enemies are **inert until targeted** (D-14) — they never initiate and never
 * aggro, so an enemy with no hero does nothing at all.
 */
export function tickToken(instance, delta, heroId) {
    const enemy = enemyFor(instance);
    const id = instance?.id;
    if (!enemy || !id) return;

    // No hero: the fight is over before it began. Drop any in-flight state so
    // the enemy is whole again next time (`G-4`).
    if (!heroId) {
        if (fights.has(id)) endFight(id);
        return;
    }

    // ⚠️ **An unpromoted hero cannot fight at all.** Holding a combat skill
    // decides *if*; how high it is never decides *whether*. A Recruit standing
    // on an enemy simply stands there — no fight starts, no damage is dealt or
    // taken, and the enemy stays whole.
    //
    // This is a POSSESSION gate, not a difficulty gate: the game still never
    // tells a player their hero is outmatched, and every fight a hero *can*
    // start remains opt-in and retreatable. `BoardRunner` raises the tile mark.
    if (!canFight(heroId)) {
        if (fights.has(id)) endFight(id);
        return;
    }

    // Keyed by the enemy's instance id, so a Token that was moved — dragged,
    // shoved, anything — finds its own fight here with nothing carried across
    // (FPP-4).
    let fight = fights.get(id);

    // A different hero arrived — start fresh rather than inheriting the last
    // one's attack timers.
    if (fight && fight.assignedHeroId !== heroId) {
        endFight(id);
        fight = null;
    }

    if (!fight) {
        /**
         * ⚠️ **One fight per hero** (G-43). A hero fighting somewhere else is
         * no longer fighting there — end that fight first, which also takes
         * back the numbers its enemy lent the hero. Without this two fights
         * could name one hero and `fightOfHero` would have to guess.
         */
        for (const [otherId, other] of [...fights]) {
            if (otherId !== id && other.assignedHeroId === heroId) endFight(otherId);
        }
        fight = createFight(id, heroId, enemy, enemyDropsOf(getTokenType(instance.typeId)));
        fights.set(id, fight);
        applyEnemyCombatModifiers(id, heroId);
    }

    fight.assignedHeroId = heroId;

    /**
     * ⚠️ The stat block is re-derived every tick and the aggregator is not, so
     * they have to be joined back up here. Without this line `computeHeroDamage`
     * reads a profile with no aggregator on it and an enemy's carried armour is
     * silently zero — which would look exactly like the feature working, since
     * armour of zero is also the correct answer for an enemy carrying nothing.
     */
    enemy.aggregator = fight.aggregator;
    enemy.effects = fight.effects;

    /**
     * An engagement is EVERY engagement, including each one after a kill
     * (UE-15) — and detecting it takes two signals, not one.
     *
     * ⚠️ **The obvious detector does not work.** "A transition into `active`"
     * catches the first engagement and nothing else, because `resolveVictory`
     * below sets `fight.status = 'active'` the instant the kill resolves, so the
     * status is already active all the way through the rest that follows. A run
     * of eight kills fired exactly one engagement.
     *
     * What actually marks a fresh enemy is the **intermission ending**: that is
     * where `CombatProcessor` restores the enemy to full HP (D-103's short rest
     * after every kill). So:
     *
     * * `idle` → `active` is the first engagement, or a return after a retreat;
     * * resting → not resting is the next enemy stepping up.
     *
     * Read before and compared after, rather than published from inside
     * `CombatProcessor`, because that engine is a **port** (D-136) and board
     * events are this adapter's job.
     */
    const resting = () => (fight.combat?.state?.intermissionTimer ?? 0) > 0;
    const wasActive = fight.status === 'active';
    const wasResting = resting();

    processCombat(fight, { enemy }, delta);

    const engaged = (fight.status === 'active' && !wasActive) || (wasResting && !resting());

    if (engaged) {
        EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, {
            instanceId: id,
            typeId: instance.typeId,
            heroId
        });
        LoadoutMoments.fire(id, heroId, 'COMBAT_ENGAGED');
    }

    // The ring tracks the CURRENT FIGHT (D-129) — one kill is one cycle for
    // every board system outside the combat engine, so the same ring means the
    // same thing whether the Token is a Forest or a Bear.
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
 * **One kill counts as one cycle** for every board system outside the combat
 * engine (D-129). That single unit is what connects combat to the rest of the
 * board: nearby Context and Buff Tokens wear per kill exactly as they wear per
 * craft, so a Weapon Rack burns down as it is used.
 *
 * The post-kill rest (D-103) is already handled inside the ported engine —
 * `handleVictory` sets a 2s intermission and `processCombat` restores the enemy
 * to full HP when it expires. **Hero power shortens the fight but not the rest**,
 * so farming trivial content is capped while fighting hard content is not.
 */
function resolveVictory(instance, fight, enemy, heroId) {
    const id = instance.id;

    // Enemy Tokens deplete like any other (D-104) — a Bear is not an infinite
    // resource; spawners replace them (Token Lifecycle, SP-55).
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            instanceId: id,
            delta: -1,
            remaining: instance.usesRemaining,
            typeId: instance.typeId
        });
    }

    // Support Tokens beside the enemy wear per kill (D-129), by instance id.
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
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: supportId, ...spot, typeId: sTypeId || null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: supportId, ...spot, typeId: null });
        TileModifiers.rebuildAround([spot]);
    });

    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        instanceId: id,
        typeId: instance.typeId,
        heroId: heroId || null,
        failed: false
    });
    // ⚠️ `heroId` and `typeId` ride along since Effects Grammar v2 V1. This
    // event carried neither, so a rule reacting to a fight ending could not
    // name the victor or the creature — while `CYCLE_COMPLETE`, published four
    // lines above from the same function, carried both.
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
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: id, ...spot, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, ...spot, typeId: null });
        // The hero's flag chooses again on its next pass.
        if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...spot });
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [spot] });
        return;
    }

    // Let the ported engine run its intermission and respawn the enemy. The
    // deck loop pre-empted this by advancing the slot; the board simply lets it
    // happen, which is exactly D-103's "short rest follows every kill".
    fight.status = 'active';
}

/**
 * The hero lost.
 *
 * **Death costs equipment** (D-74). Item durability was retired (D-118) and
 * then removed outright (owner decision 2026-08-19, CR2-096), so this is the
 * *only* way gear ever leaves a hero — logged as risk 12.
 *
 * ⚠️ **This is the one implementation of dying** (owner decision 11, CR2-070).
 * Poison kills route here too, via `resolveStatusDefeat` below, so `instance`
 * may be null: a hero can be downed by a DoT while sitting in the Dock, with no
 * Token to tidy up.
 */
function resolveDefeat(instance, heroId) {
    endFight(instance?.id);

    const hero = HeroManager.getHero(heroId);
    if (hero && hero.status !== 'wounded') HeroManager.setHeroStatus(heroId, 'wounded');

    // A forced retreat cleanses every status, good or bad.
    StatusEffectSystem.clearAll(heroId);
    const lost = applyDefeatPenalties(heroId) || [];

    // Off the board. Recovery is tracked on the HERO (`woundedRemainingMs`),
    // never on the tile — so the tile is immediately free for someone else,
    // and it simply idles until re-staffed. A defeated hero genuinely LEAVES,
    // unlike one whose Token merely ran dry: they are carried home, and their
    // flag comes down with them (FP-42). `furl` announces the move.
    Flags.furl(heroId, 'defeat');
    if (instance) {
        instance.cycleElapsedMs = 0;
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, {
            instanceId: instance.id, outcome: 'defeat', heroId: heroId || null, typeId: instance.typeId || null
        });
    }
    EventBus.publish('heroes_updated', { source: 'board_combat_defeat' });

    // ⭐ **One notification for the whole defeat** (FP-42): who fell and what it
    // cost. The wound and each lost item used to announce themselves
    // separately, which buried the one message that matters under several.
    NotificationSystem.warning(defeatMessage(hero?.name, lost));
    logger.info('BoardCombat', `Defeat against ${instance?.id ?? 'nothing'}: ${heroId}`);
}

/** "X was defeated and carried home, injured. Lost: A, B." (FP-42) */
export function defeatMessage(heroName, lost = []) {
    const who = heroName || 'Your hero';
    const what = lost.length ? `Lost: ${lost.join(', ')}.` : 'Nothing was lost.';
    return `${who} was defeated and carried home, injured. ${what}`;
}

/**
 * A hero dropped to 0 HP away from a fight — a damage-over-time effect killed
 * them (CR2-070; owner decision 11, 2026-08-19: *"one rule for dying however it
 * happens, so it cannot be dodged by dying to a damage-over-time effect"*).
 *
 * Deliberately **not** a second death path. All it does is work out which
 * Token the hero was working and hand them to `resolveDefeat`, the same
 * function an enemy Token uses — so the wound, the cleanse, the gear roll and
 * the trip home stay written once. A hero downed while off the board passes a
 * null Token, which `resolveDefeat` tolerates.
 *
 * Guarded against re-entry: an already-`wounded` hero is ignored, so a second
 * status tick in the same frame cannot roll their gear twice.
 */
export function resolveStatusDefeat(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded') return;

    resolveDefeat(BoardState.getTokenById(BoardState.workTokenOf(heroId)), heroId);
}

export function init() {
    // Ending a fight is handled by `tickToken` seeing no hero, and by `Flags`
    // calling `endFightOfHero` when a hero lets go — NOT by an event.
    // `HERO_MOVED` on a recall names where the hero WENT (the Dock), not the
    // Token they left.
    EventBus.subscribe('game_loaded', () => clearAll());

    // The status clock cannot call us directly — `StatusEffectSystem` is
    // imported by this file, so importing it back would be a static cycle. It
    // announces the death instead and this is the single subscriber that acts
    // on it (CR2-070).
    EventBus.subscribe('hero_downed', ({ heroId }) => resolveStatusDefeat(heroId));

    logger.info('BoardCombat', 'Board combat ready');
}
