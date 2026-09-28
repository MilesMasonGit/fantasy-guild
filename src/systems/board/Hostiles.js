// Fantasy Guild — hostile enemies attack heroes near their spawner (B7.2, TL-16, TL-24, FB-23)

import { GameState } from '../../state/GameState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isHostileEnemy } from '../../config/registries/enemyProfile.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import * as EnemyMotion from './EnemyMotion.js';
import * as Flags from './Flags.js';
import * as FlagRules from './FlagRules.js';
import * as HeroMotion from './HeroMotion.js';
import * as TimedChanges from './TimedChanges.js';

/**
 * ⭐ **Hostile enemies attack** (B7.2, TL-16, FB-23; owner's "B7 range").
 *
 * An enemy whose Token type is authored `enemy.hostile: true` (in the CMS; see
 * `isHostileEnemy`) attacks a hero who comes **inside the live flag radius**
 * (`Flags.flagRadius()`) **around its spawner** — the spawner it is tethered to
 * (`EnemyMotion.spawnerOf`, B7.1). A hostile enemy with no live spawner (placed
 * by hand, or its spawner gone) watches the radius around itself.
 *
 * Attacking is `Flags.ambush`: the hero drops their work and claims the enemy,
 * so the fight starts the normal way — they walk up to it and
 * `BoardCombat.tickToken` begins it on arrival — and they fight back whatever
 * their rules say (TL-24). A peaceful enemy never comes through here: it fights
 * only when a hero with Fight allowed seeks it, as before B7.2.
 *
 * ## Who is attacked
 * For each hostile enemy on the mat, in arrival order, the **nearest hero to
 * the enemy** whose body stands inside the radius (the earlier-planted flag on
 * a tie). One fight per enemy and one enemy per hero: BoardCombat keys a fight
 * by enemy and allows a hero one fight (G-43), so enemies never gang up —
 * a hero already taken this pass is not offered to the next enemy.
 *
 * Not attacked: heroes with no flag (docked, or walking home — `furl` takes the
 * flag down at once), wounded heroes, heroes who cannot fight (a Recruit holds
 * no combat skill, so no fight could start and they would stand frozen), and
 * heroes already on an enemy (fighting it, or walking up to it).
 *
 * An enemy does not attack while it is already fought or walked up to (a hero
 * holds it), while it is in the player's hand, or while the player has marked
 * it "heroes may not work this" (FP-35) — a forced fight there would be let go
 * on the next pass anyway.
 *
 * ## Clock and cost
 * One look every {@link SCAN_MS} of game time, advanced by the tick's `delta`
 * (so the time bank speeds it up). A look is one pass over the mat's Tokens
 * plus, for each hostile enemy, a squared-distance test per hero on the mat —
 * flat, and publishes nothing unless an attack starts.
 */

/** How often hostile enemies look for heroes, in game ms. */
export const SCAN_MS = 250;

/** `board → ms until the next look`. Runtime only, per board, like EnemyMotion's bodies. */
const clocks = new WeakMap();

/** The point a hostile enemy watches around: its live spawner's centre, else its own. */
export function watchCentreOf(enemy) {
    const spawner = EnemyMotion.spawnerOf(enemy.id);
    return spawner ? { x: spawner.x, y: spawner.y } : { x: enemy.x, y: enemy.y };
}

/** Whether a hero is wounded (read without rehydrating, like `FlagRules.heroRecord`). */
function isWounded(heroId) {
    const hero = FlagRules.heroRecord(heroId);
    return !hero || hero.status === 'wounded' || (hero.hp?.current ?? 1) <= 0;
}

/** Whether `heroId` is on an enemy already: fighting it, walking up to it, or fighting back. */
function onEnemy(heroId) {
    if (Flags.ambusherOf(heroId) || BoardCombat.fightOfHero(heroId)) return true;
    const claim = BoardState.claimOfHero(heroId);
    return !!claim && BoardCombat.isEnemyToken(BoardState.getTokenById(claim.instanceId));
}

/** Heroes a hostile enemy could attack this look, as `[{ heroId, x, y }]`, in planting order. */
function targets() {
    const flags = BoardState.getFlags();
    const order = Object.keys(flags).sort((a, b) => (flags[a].plantedAt ?? 0) - (flags[b].plantedAt ?? 0));
    const out = [];
    for (const heroId of order) {
        if (HeroMotion.isReturning(heroId) || isWounded(heroId)) continue;
        if (!FlagRules.canFight(heroId) || onEnemy(heroId)) continue;
        const at = HeroMotion.heroPointOf(heroId) || BoardState.displayPointOf(heroId);
        if (!at) continue;
        out.push({ heroId, x: at.x, y: at.y });
    }
    return out;
}

/** Whether a hostile enemy is free to attack right now. */
function canAttack(enemy) {
    return !BoardCombat.getFight(enemy.id)
        && !BoardState.heroOfInstance(enemy.id)
        && !TimedChanges.isInHand(enemy.id)
        && !Flags.isDisallowed(enemy);
}

/**
 * One look: every free hostile enemy attacks the nearest hero inside the flag
 * radius of its spawner.
 * @returns {Array<{ enemyId: string, heroId: string }>} the attacks started (tests, probes)
 */
export function scan() {
    let heroes = null;
    const started = [];
    const radius = Flags.flagRadius();
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
            if ((h.x - centre.x) ** 2 + (h.y - centre.y) ** 2 > r2) continue;
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
