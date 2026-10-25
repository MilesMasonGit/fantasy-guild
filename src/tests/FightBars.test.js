import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { enemyBarPlace, heroBarPlace, HP_BAR } from '../ui/components/board/healthBar.js';
import { heroBoxAt } from '../ui/components/board/MatHero.jsx';
import { tokenBoxPx } from '../ui/components/board/MatToken.jsx';
import { plateUnit } from '../ui/components/board/workPlate.js';
import { tokenSizeFor, boardScaleAt, boardArtSteps, TOKEN_SURFACE } from '../ui/components/base/TokenSprite.jsx';

/**
 * A fighting hero's health bar and their enemy's must not collide. The hero stands
 * `HeroMotion.standingSpot` beside the enemy; both bars hang the same gap over the top of art of
 * the same size, so they share a row and only the horizontal gap keeps them apart.
 *
 * The number over each bar (`17 · 57%`) may be wider than its bar, and then grows away from the
 * other fighter only (`HealthBar`'s `outward`), so two numbers never meet once the bars clear.
 */
/** The smallest gap, in mat units, that reads as two bars rather than one. */
const MIN_CLEAR_U = 8;

const ENEMY = 'fixture_enemy';
const AT = { x: 800, y: 500 };

/** Both bars' rectangles in mat units, at mat fit `fit`, the hero on `side`. */
function barsAt(fit, side) {
    const u = plateUnit(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, ENEMY, boardScaleAt(fit));
    const boxPx = tokenBoxPx(ENEMY, artPx);
    const e = enemyBarPlace(boxPx, u);
    const enemy = { left: AT.x - boxPx / 2 + e.left, top: AT.y - boxPx / 2 + e.top, width: e.width };

    const heroArtPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(fit));
    const box = heroBoxAt(HeroMotion.standingSpot(ENEMY, AT, side));
    const h = heroBarPlace(heroArtPx, u);
    const hero = { left: box.left + h.left, top: box.top + h.top, width: h.width };
    return { enemy, hero, u };
}

function horizontalGap(a, b) {
    return Math.max(b.left - (a.left + a.width), a.left - (b.left + b.width));
}

function verticalOverlap(a, b, u) {
    return Math.min(a.top, b.top) + HP_BAR.H * u - Math.max(a.top, b.top);
}

// Every fit at which the board draws its art at 2× (the owner's 1920×1080 is about 0.87), and the
// default fit of 1.
const FITS = [1];
for (let f = 0.75; f < 1.25; f += 0.01) if (boardArtSteps(f) === 2) FITS.push(f);

describe('⭐ a fighting hero\'s health bar clears the enemy\'s (T-112)', () => {
    it('the two bars share a row, so the gap between them is all that keeps them apart', () => {
        const { enemy, hero, u } = barsAt(0.87, -1);
        expect(verticalOverlap(enemy, hero, u)).toBeGreaterThan(0);
    });

    it.each([-1, 1])('at every 2× art size, standing on side %i, the bars are at least 8 u apart', (side) => {
        expect(FITS.length).toBeGreaterThan(40);
        for (const fit of FITS) {
            const { enemy, hero } = barsAt(fit, side);
            expect(horizontalGap(enemy, hero), `fit ${fit.toFixed(2)}`).toBeGreaterThanOrEqual(MIN_CLEAR_U);
        }
    });
});
