// hostile enemies attack heroes near their spawner

import { GameState } from '../../state/GameState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isHostileEnemy } from '../../config/registries/enemyProfile.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import * as EnemyMotion from './EnemyMotion.js';
import * as Flags from './Flags.js';
import * as HeroMotion from './HeroMotion.js';
import * as Hand from './Hand.js';
import { matTuning } from '../../config/matTuning.js';

/**
 * An enemy authored `enemy.hostile: true` (see `isHostileEnemy`) attacks a hero whose order stands
 * inside the camp's watch ({@link watchRadius}, the Mat Tuner's Camp watch) around its spawner
 * (`EnemyMotion.spawnerOf`), or around the node it ambushed from; with neither it watches round
 * itself.
 *
 * ⚠️ The watch measures the hero's ORDER (the Token they are sent to), never where the hero stands:
 * a hero merely walking past, or waiting at the Guild Hall, is not attacked, and a hero ordered onto
 * a Token inside is attacked at once, wherever they are, and walks up. They fight back, then go
 * back to their job. A hero sent to a spot on open ground is never attacked (owner, 2026-10-28):
 * only work near a camp draws its goblins.
 *
 * Attacking is `Flags.ambush`: the hero drops their work and claims the enemy, walks up, and
 * `BoardCombat.tickToken` begins the fight on arrival; they fight back whatever their order says. A
 * peaceful enemy never comes through here: it fights only when a hero is sent to it.
 *
 * Who is attacked: for each hostile enemy in arrival order, of the heroes whose order is inside the
 * watch, the one standing nearest the enemy (the earlier order on a tie). One fight per
 * enemy and one enemy per hero, so enemies never gang up.
 *
 * Not attacked: heroes with no order (at the Guild Hall), heroes on a spot order, wounded heroes, heroes who cannot fight and heroes already
 * on an enemy. Everyone fights, a hero with nothing in their hands barehanded. An enemy does not
 * attack while a hero holds it, while it is in the player's hand, or while the player has marked it
 * as not for heroes to work: a forced fight there would be let go on the next pass.
 *
 * One look every {@link SCAN_MS} of game time, advanced by the tick's `delta` (so a catch-up
 * speeds it up).
 */

/** How often hostile enemies look for heroes, in game ms. */
export const SCAN_MS = 250;

/** How far round its camp a hostile enemy watches, in mat units (the Mat Tuner's Camp watch). */
export function watchRadius() {
    return matTuning('watchRadius');
}

/** `board → ms until the next look`. Runtime only, per board, like EnemyMotion's bodies. */
const clocks = new WeakMap();

/**
 * The point a hostile enemy watches around: its live spawner's centre; else the Token it is
 * tethered to, while that is on the mat (an ambusher's node, tethered by `TriggerSystem`); else its
 * own.
 */
export function watchCentreOf(enemy) {
    const home = EnemyMotion.spawnerOf(enemy.id) || BoardState.getTokenById(EnemyMotion.tetherOf(enemy.id));
    return home ? { x: home.x, y: home.y } : { x: enemy.x, y: enemy.y };
}

/** Whether a hero is wounded (read without rehydrating, like `Flags.heroRecord`). */
function isWounded(heroId) {
    const hero = Flags.heroRecord(heroId);
    return !hero || hero.status === 'wounded' || (hero.hp?.current ?? 1) <= 0;
}

/** Whether `heroId` is on an enemy already: fighting it, walking up to it, or fighting back. */
function onEnemy(heroId) {
    if (Flags.ambusherOf(heroId) || BoardCombat.fightOfHero(heroId)) return true;
    const claim = BoardState.claimOfHero(heroId);
    return !!claim && BoardCombat.isEnemyToken(BoardState.getTokenById(claim.instanceId));
}

/**
 * Heroes a hostile enemy could attack this look, in planting order: `[{ heroId, x, y, flagX, flagY }]`,
 * where they stand and where their flag stands.
 */
function targets() {
    const flags = BoardState.getFlags();
    const order = Object.keys(flags).sort((a, b) => (flags[a].plantedAt ?? 0) - (flags[b].plantedAt ?? 0));
    const out = [];
    for (const heroId of order) {
        if (HeroMotion.isReturning(heroId) || isWounded(heroId)) continue;
        if (!Flags.canFight(heroId) || onEnemy(heroId)) continue;
        const flag = flags[heroId];
        // Idling on open ground draws no attack: only a hero sent to work a Token does.
        if (Flags.isSpot(flag)) continue;
        const at = HeroMotion.heroPointOf(heroId) || BoardState.displayPointOf(heroId);
        if (!at || !Number.isFinite(flag?.x) || !Number.isFinite(flag?.y)) continue;
        out.push({ heroId, x: at.x, y: at.y, flagX: flag.x, flagY: flag.y });
    }
    return out;
}

/** Whether a hostile enemy is free to attack right now. */
function canAttack(enemy) {
    return !BoardCombat.getFight(enemy.id)
        && !BoardState.heroOfInstance(enemy.id)
        && !Hand.isInHand(enemy.id)
        && !Flags.isDisallowed(enemy);
}

/**
 * One look: every free hostile enemy attacks the nearest hero whose order is
 * inside its camp's watch.
 * @returns {Array<{ enemyId: string, heroId: string }>} the attacks started (tests, probes)
 */
export function scan() {
    let heroes = null;
    const started = [];
    const radius = watchRadius();
    const r2 = radius * radius;

    for (const enemy of BoardState.tokens()) {
        if (!isHostileEnemy(getTokenType(enemy.typeId)) || !canAttack(enemy)) continue;
        heroes ??= targets();
        if (!heroes.length) break;

        const centre = watchCentreOf(enemy);
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i];
            if ((h.flagX - centre.x) ** 2 + (h.flagY - centre.y) ** 2 > r2) continue;
            const d = (h.x - enemy.x) ** 2 + (h.y - enemy.y) ** 2;
            if (d < bestD) { best = i; bestD = d; }
        }
        if (best < 0) continue;

        const { heroId } = heroes[best];
        if (Flags.ambush(heroId, enemy.id)) {
            started.push({ enemyId: enemy.id, heroId });
            heroes.splice(best, 1);
        }
    }
    return started;
}

/**
 * Advance the look clock `delta` game ms and look when it runs out. Run once
 * per engine tick, after `EnemyMotion.tick` (enemies have taken this tick's
 * steps) and before any Token ticks (so a hero who needs no walk fights now).
 */
export function tick(delta = 0) {
    const board = GameState.state?.board;
    if (!board) return;
    const left = (clocks.get(board) ?? 0) - Math.max(0, delta);
    if (left > 0) {
        clocks.set(board, left);
        return;
    }
    clocks.set(board, SCAN_MS);
    scan();
}
