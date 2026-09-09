// Fantasy Guild — the `Deals` verb (Effects Grammar v2, V2)

import { EventBus } from '../core/EventBus.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { mitigateFlatDamage } from '../../utils/CombatFormulas.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';

/**
 * ⭐ **The first rule in the game that does something to a person.**
 *
 * Nine keywords and not one of them acted — `Provides` scales a number, `Grants`
 * drops an item, `Applies` attaches a status. Nothing dealt damage, which is why
 * the owner's Thorns example was unauthorable:
 *
 * > *"Does 1 damage to opponent when a cycle completes targeting this entity."*
 *
 * ## ⭐ Why one Thorns works on a berry bush and on a monster
 * It never learns which it is on. `BoardRunner` (a hero finishes harvesting) and
 * `BoardCombat` (a hero wins a fight) publish **the same event with the same
 * payload**, because one kill is one cycle (D-129) — so `actor` resolves to the
 * hero either way, and this module cannot tell the difference. That was not
 * built for this feature; it was already true, and V1 simply exposed it.
 *
 * ## ⚠️ Damage respects armour, and can be fully stopped by it (G-23)
 * `mitigateFlatDamage` floors at **zero**, where a combat hit floors at one. The
 * difference is deliberate and lives in `CombatFormulas` with its reasoning: a
 * fight must always progress, a thorn need not. A floor of 1 here would make
 * heavy armour worth exactly as much as none against every thorn in the game.
 *
 * An author who wants a thorn that pierces plate says so — `ignoresArmor` is a
 * field on the statement, not a rule this module decides.
 *
 * ## ⚠️ Killing a hero announces; it never resolves the death itself
 * The same discipline `StatusEffectSystem` follows, for the same reason: the
 * whole of what dying costs is implemented once, in `BoardCombat.resolveDefeat`,
 * and this module must not import `BoardCombat` for it — that is a static cycle.
 * So a lethal blow publishes `hero_downed` and `BoardCombat` owns the response.
 * **There must never be a second subscriber that also kills** (CR2-070: that
 * branch was a no-op for months and a poisoned hero worked on at 0 HP).
 */

/** The entity a role points at, as something damage can be applied to. */
function targetOf(role, roles) {
    if (role === ROLE.ACTOR) {
        const heroId = roles?.actor;
        return heroId ? heroTarget(heroId) : null;
    }

    // `self` and `source` are both tiles. Whoever is standing there takes it —
    // the hero if one is present, otherwise the live enemy, which is the same
    // occupant rule `StatusApplication` resolves by.
    const tile = role === ROLE.SOURCE ? roles?.source : roles?.self;
    if (tile == null) return null;

    const heroId = BoardState.heroOnTile(tile);
    if (heroId) return heroTarget(heroId);

    const instance = BoardState.getToken(tile);
    if (!instance || !BoardCombat.isEnemyToken(instance)) return null;
    const fight = BoardCombat.getFight(tile);
    // Only a fight in progress: an enemy nobody has engaged has no HP bar to
    // take damage off, and inventing one would make a hit that lands on nothing.
    if (!fight?.combat?.enemyHp) return null;
    return enemyTarget(fight);
}

function heroTarget(heroId) {
    return {
        kind: 'hero',
        apply(amount, ignoresArmor) {
            const hero = HeroManager.getHero(heroId);
            if (!hero) return 0;

            const dealt = ignoresArmor ? Math.max(0, Math.round(amount)) : mitigateFlatDamage(hero, amount);
            if (dealt <= 0) return 0;

            HeroManager.modifyHeroHp(heroId, -dealt);

            if (hero.hp.current <= 0) {
                // Announced, never resolved here — see the note at the top.
                logger.info('DealDamage', `${hero.name} was downed by an effect`);
                EventBus.publish('hero_downed', { heroId, cause: 'effect' });
            }
            return dealt;
        }
    };
}

function enemyTarget(fight) {
    return {
        kind: 'enemy',
        apply(amount) {
            // ⚠️ No armour on this side, and not by oversight: an enemy has no
            // aggregator to read one from, and `enemy.armor` is never set by
            // anything (`enemyProfile.js` says so outright). Enemies get an
            // aggregator at V7, and this is the line that changes when they do.
            const dealt = Math.max(0, Math.round(amount));
            if (dealt <= 0) return 0;
            const hp = fight.combat.enemyHp;
            hp.current = Math.max(0, hp.current - dealt);
            return dealt;
        }
    };
}

/**
 * Run one `Deals` statement.
 *
 * @param {object} statement the expanded statement
 * @param {{self: number, actor: string|null, source: number|null}} roles
 * @returns {number} damage actually dealt, after mitigation
 */
export function deal(statement, roles) {
    const payload = statement?.payload || {};
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    // ⚠️ A role the moment did not supply reaches nobody — an unstaffed passive
    // generator (D-116) completes cycles with no hero, so a Thorns on one hurts
    // nothing. That is the same honest nothing an unmatched filter returns, not
    // a failure, and `ContentAudit` is what warns about a rule that can NEVER
    // have a target rather than one that merely has none right now.
    const target = targetOf(statement?.target?.role || ROLE.ACTOR, roles);
    if (!target) return 0;

    return target.apply(amount, !!payload.ignoresArmor);
}
