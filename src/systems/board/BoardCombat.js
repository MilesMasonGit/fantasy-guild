// Fantasy Guild — Combat on the board (7×7 Playmat rework, Phase 6)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { processCombat } from '../cards/logic/CombatProcessor.js';
import { applyDefeatPenalties } from '../combat/DefeatPenalties.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as RecipeResolver from './RecipeResolver.js';
import * as TileModifiers from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import { logger } from '../../utils/Logger.js';

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
 * object per fighting tile**, held in a runtime-only map.
 *
 * That is the same bridge the deck loop used between flyweight slots and the
 * execution engines, and it is kept for the same reason: at most a handful exist
 * at once (one per tile with a hero on an enemy), and none of it needs saving.
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

/** Ephemeral combat state, one per fighting tile. Never saved. */
const fights = new Map();

/** Whether a Token is something a hero can fight. */
export function isEnemyToken(instance) {
    const def = getTokenType(instance?.typeId);
    return def?.tokenType === 'enemy' && !!def.enemyId;
}

/** The enemy definition a Token represents. */
function enemyFor(instance) {
    const def = getTokenType(instance?.typeId);
    return def?.enemyId ? getEnemy(def.enemyId) : null;
}

/**
 * The card-shaped object the ported engine works on.
 *
 * Only the fields `CombatProcessor`, `CombatAttackProcessor` and
 * `CombatResolutionProcessor` actually read. `traits` is present and empty
 * deliberately: `handleVictory` looks for a `unifiedreward` trait, and a Token's
 * rewards come from the enemy's drop table instead.
 */
function createFight(tile, heroId, enemy) {
    return {
        id: `fight_${tile}`,
        tile,
        enemyId: enemy.id,
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

/** Drop a tile's fight, so the next engagement starts clean. */
export function endFight(tile) {
    fights.delete(tile);
}

/** Test/debug view of a live fight. */
export function getFight(tile) {
    return fights.get(tile) || null;
}

/** Drop every fight (on teardown, and in tests). */
export function clearAll() {
    fights.clear();
}

/**
 * Advance combat on one enemy tile.
 *
 * Called from the board runner's tick for any enemy Token with a hero on it.
 * Enemies are **inert until targeted** (D-14) — they never initiate and never
 * aggro, so a tile with no hero does nothing at all.
 */
export function tickTile(tile, instance, delta, heroId) {
    const enemy = enemyFor(instance);
    if (!enemy) return;

    // No hero: the fight is over before it began. Drop any in-flight state so
    // the enemy is whole again next time (`G-4`).
    if (!heroId) {
        if (fights.has(tile)) endFight(tile);
        return;
    }

    let fight = fights.get(tile);

    // A different hero arrived — start fresh rather than inheriting the last
    // one's attack timers.
    if (fight && fight.assignedHeroId !== heroId) {
        endFight(tile);
        fight = null;
    }

    if (!fight) {
        fight = createFight(tile, heroId, enemy);
        fights.set(tile, fight);
    }

    fight.assignedHeroId = heroId;
    processCombat(fight, { enemyId: enemy.id }, delta);

    // The ring tracks the CURRENT FIGHT (D-129) — one kill is one cycle for
    // every board system outside the combat engine, so the same ring means the
    // same thing whether the tile is a Forest or a Bear.
    const hp = fight.combat.enemyHp;
    if (hp?.max) {
        EventBus.publish(BOARD_EVENTS.PROGRESS, {
            tile,
            percent: Math.max(0, Math.min(100, (1 - hp.current / hp.max) * 100))
        });
    }

    // Defeat: the attack processor routes 0 HP through `handleHeroWounded`,
    // which sets the hero's status. Detect it and get them off the board.
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded' || (hero.hp?.current ?? 1) <= 0) {
        resolveDefeat(tile, instance, heroId);
        return;
    }

    if (fight.status === 'victory') {
        resolveVictory(tile, instance, fight, enemy, heroId);
    }
}

/**
 * A kill.
 *
 * **One kill counts as one cycle** for every board system outside the combat
 * engine (D-129). That single unit is what connects combat to the rest of the
 * board: adjacent Context and Buff Tokens wear per kill exactly as they wear per
 * craft, so a Weapon Rack burns down as it is used.
 *
 * The post-kill rest (D-103) is already handled inside the ported engine —
 * `handleVictory` sets a 2s intermission and `processCombat` restores the enemy
 * to full HP when it expires. **Hero power shortens the fight but not the rest**,
 * so farming trivial content is capped while fighting hard content is not.
 */
function resolveVictory(tile, instance, fight, enemy, heroId) {
    // Enemy Tokens deplete like any other (D-104) — a Bear is not an infinite
    // resource, and Managers are what refresh them (Phase 7).
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
    }

    RecipeResolver.wearAdjacentSupport(tile, (supportTile) => {
        BoardState.setToken(supportTile, null);
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: supportTile, typeId: null });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: supportTile, typeId: null });
        TileModifiers.rebuildAround(supportTile);
    });

    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        tile,
        typeId: instance.typeId,
        heroId: heroId || null,
        failed: false
    });
    EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { tile, outcome: 'victory' });

    if (instance.usesRemaining != null && instance.usesRemaining <= 0) {
        BoardState.setToken(tile, null);
        // A cleared-out Goblin Camp is owed a restock exactly as a spent Forest
        // is (D-104) — one economic model covers the whole board. Set AFTER
        // setToken, which clears vacancies.
        BoardState.setVacancy(tile, instance.typeId);
        endFight(tile);
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: null });
        // The hero stays standing on the emptied tile (D-60), waiting for the
        // player or for a Manager to restock underneath them (D-151).
        if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile, heroId });
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile });
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
 * **Death costs equipment** (D-74), and with item durability retired (D-118)
 * this is now the *only* way gear ever leaves a hero — logged as risk 12.
 */
function resolveDefeat(tile, instance, heroId) {
    endFight(tile);

    const hero = HeroManager.getHero(heroId);
    if (hero && hero.status !== 'wounded') HeroManager.setHeroStatus(heroId, 'wounded');

    // A forced retreat cleanses every status, good or bad.
    StatusEffectSystem.clearAll(heroId);
    applyDefeatPenalties(heroId);

    // Off the board. Recovery is tracked on the HERO (`woundedRemainingMs`),
    // never on the tile — so the tile is immediately free for someone else,
    // and it simply idles until re-staffed. A defeated hero genuinely LEAVES,
    // unlike one whose Token merely ran dry: they are carried home.
    BoardState.setHeroTile(heroId, null);
    instance.cycleElapsedMs = 0;

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
    EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { tile, outcome: 'defeat' });
    EventBus.publish('heroes_updated', { source: 'board_combat_defeat' });

    NotificationSystem.warning(`${hero?.name || 'Your hero'} was defeated and carried home, injured!`);
    logger.info('BoardCombat', `Defeat on tile ${tile}: ${heroId}`);
}

export function init() {
    // Ending a fight is handled by `tickTile` seeing an empty tile, NOT by an
    // event. `HERO_MOVED` fires with `tile: null` on a recall — it names where
    // the hero WENT (the Dock), not where they came from — so subscribing here
    // would never fire for the tile being vacated. The tick already visits
    // every tile, so it is the reliable place to notice.
    EventBus.subscribe('game_loaded', () => clearAll());
    logger.info('BoardCombat', 'Board combat ready');
}
