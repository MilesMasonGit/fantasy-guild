import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { enemyBarPlace, heroBarPlace, HEALTH_BAR_H_U } from '../ui/components/board/healthBar.js';
import { heroBoxAt } from '../ui/components/board/MatHero.jsx';
import { tokenBoxPx } from '../ui/components/board/MatToken.jsx';
import { tokenSizeFor, boardScaleAt, boardArtSteps, TOKEN_SURFACE } from '../ui/components/base/TokenSprite.jsx';

/**
 * A fighting hero's health bar and their enemy's must not collide. The hero stands
 * `HeroMotion.standingSpot` beside the enemy; both bars hang the same gap over the top of art of
 * the same size, so they share a row and only the horizontal gap keeps them apart.
 *
 * The hero's bar is 44 u wide, but its number is not clipped: the widest a hero's can be is
 * "3,750/3,750" (both skills at 99), 70 u in the game's 9 px pixel font, measured in the running
 * game. The enemy's number fits inside its own, wider bar.
 */
const HERO_TEXT_MAX_U = 70;
/** The smallest gap, in mat units, that reads as two bars rather than one. */
const MIN_CLEAR_U = 8;

const ENEMY = 'fixture_enemy';
const AT = { x: 800, y: 500 };

/** Both bars' rectangles in mat units, at mat fit `fit`, the hero on `side`. */
function barsAt(fit, side) {
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, ENEMY, boardScaleAt(fit));
    const boxPx = tokenBoxPx(ENEMY, artPx);
    const e = enemyBarPlace(boxPx);
    const enemy = { left: AT.x - boxPx / 2 + e.left, top: AT.y - boxPx / 2 + e.top, width: e.width };

    const heroArtPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(fit));
    const box = heroBoxAt(HeroMotion.standingSpot(ENEMY, AT, side));
    const h = heroBarPlace(heroArtPx);
    const heroCentre = box.left + h.left + h.width / 2;
    const heroWidth = Math.max(h.width, HERO_TEXT_MAX_U);
    const hero = { left: heroCentre - heroWidth / 2, top: box.top + h.top, width: heroWidth };
    return { enemy, hero };
}

function horizontalGap(a, b) {
    return Math.max(b.left - (a.left + a.width), a.left - (b.left + b.width));
}

function verticalOverlap(a, b) {
    return Math.min(a.top, b.top) + HEALTH_BAR_H_U - Math.max(a.top, b.top);
}

// Every fit at which the board draws its art at 2× (the owner's 1920×1080 is about 0.87), and the
// default fit of 1.
const FITS = [1];
for (let f = 0.75; f < 1.25; f += 0.01) if (boardArtSteps(f) === 2) FITS.push(f);

describe('⭐ a fighting hero\'s health bar clears the enemy\'s (T-112)', () => {
    it('the two bars share a row, so the gap between them is all that keeps them apart', () => {
        const { enemy, hero } = barsAt(0.87, -1);
        expect(verticalOverlap(enemy, hero)).toBeGreaterThan(0);
    });

    it.each([-1, 1])('at every 2× art size, standing on side %i, the bars are at least 8 u apart', (side) => {
        expect(FITS.length).toBeGreaterThan(40);
        for (const fit of FITS) {
            const { enemy, hero } = barsAt(fit, side);
            expect(horizontalGap(enemy, hero), `fit ${fit.toFixed(2)}`).toBeGreaterThanOrEqual(MIN_CLEAR_U);
        }
    });
});
