import { memo } from 'react';
import { MAT_Z } from './matLayers.js';
import { useMatFit } from './MatFitContext.jsx';
import { plateUnit } from './workPlate.js';
import { CHIP, fightButtonPlace } from './healthBar.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { getEnemyProfile } from '../../../config/registries/enemyProfile.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { glyphSrc, GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { toggleFightPanel, useFightPanelState } from '../combat/fightPanelStore.js';
import { t } from '../../../i18n/index.js';

const BUTTON_POINTER = 'var(--plate-pointer, auto)';

/** The screen box around a fight's button and both its bars, read on the click only. */
function fightBox(button, tokenId, heroId) {
    const boxes = [
        button,
        document.querySelector(`[data-health-bar="enemy"][data-health-of="${tokenId}"]`),
        document.querySelector(`[data-health-bar="hero"][data-health-of="${heroId}"]`)
    ].filter(Boolean).map(el => el.getBoundingClientRect());
    return {
        left: Math.min(...boxes.map(b => b.left)),
        top: Math.min(...boxes.map(b => b.top)),
        right: Math.max(...boxes.map(b => b.right)),
        bottom: Math.max(...boxes.map(b => b.bottom))
    };
}

/**
 * The fight button: the fight glyph in the chamfer frame, without the kit's shadow, between the
 * two fighters' health bars. A click opens (or closes) the fight's detail
 * view; its hover names the fight. A press never reaches the mat (no drag starts from it).
 */
const FightButton = memo(function FightButton({ tokenId, heroId, typeId, x, y, hx, hy, fit, open }) {
    const u = plateUnit(fit);
    const artUnit = boardScaleAt(fit);
    const heroArt = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, artUnit);
    const enemyBox = Math.max(artRadiusOf(typeId) * 2, tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, artUnit));
    const place = fightButtonPlace({ heroX: hx, enemyX: x, heroArtTop: hy - heroArt / 2, enemyBoxTop: y - enemyBox / 2, u, fit });
    const enemy = getEnemyProfile(typeId);
    const heroName = HeroManager.getHero(heroId)?.name || '';
    const title = t('fight.panel.fightIcon', { hero: heroName, enemy: enemy?.name || tokenName(typeId) });
    const band = CHIP.BAND * u;
    const size = place.size;
    // The enemy's side, away from the hero: the detail view opens past it.
    const away = hx < x ? 1 : -1;
    return (
        <div
            data-fight-button-slot={tokenId}
            className="absolute"
            style={{ left: place.left, top: place.top, width: size, height: size }}
        >
            <Tooltip title={title} lines={[t('fight.panel.openHint')]}>
                <button
                    type="button"
                    data-fight-chip={heroId}
                    data-fight-chip-open={open ? 'true' : undefined}
                    aria-label={title}
                    className="relative block p-0 m-0 border-0 bg-transparent cursor-pointer"
                    style={{ width: size, height: size, pointerEvents: BUTTON_POINTER }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFightPanel(heroId, fightBox(e.currentTarget, tokenId, heroId), away);
                    }}
                >
                    <span
                        aria-hidden="true"
                        className={`${open ? 'ui-frame-chamfer ui-frame-chamfer-gold' : 'ui-frame-chamfer'} absolute inset-0 pointer-events-none`}
                        style={{ borderWidth: band, borderImageWidth: `${band}px` }}
                    />
                    <img
                        src={glyphSrc('fight', GLYPH_COLOUR.gold)}
                        alt=""
                        draggable={false}
                        className="absolute select-none pointer-events-none"
                        style={{
                            left: (CHIP.PAD + CHIP.BAND) * u,
                            top: (CHIP.PAD + CHIP.BAND) * u,
                            width: CHIP.GLYPH * u,
                            height: CHIP.GLYPH * u,
                            maxWidth: 'none',
                            imageRendering: 'pixelated'
                        }}
                    />
                </button>
            </Tooltip>
        </div>
    );
});

/**
 * Every fight on the mat: its button between the two fighters' health bars, one layer over the
 * Tokens and the loot (`MAT_Z.FIGHT`). `fights` are `{ tokenId, heroId, typeId, x, y, hx, hy }`,
 * the enemy's point and the hero's. The bars are drawn by the fighters (`MatHero`, `TokenBubbles`)
 * into {@link FightBarHost}; the floats are the effect layer's (`fightFloats.js`); a named move or
 * a status landing is said in a bubble over the bar (`CalloutLayer`, `HeroBubbleLayer`).
 */
export const FightLayer = memo(function FightLayer({ fights, yieldToTokens = false }) {
    const fit = useMatFit() || 1;
    const panel = useFightPanelState();
    return (
        <div
            data-fights
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.FIGHT, '--plate-pointer': yieldToTokens ? 'none' : 'auto' }}
        >
            {fights.map(f => {
                const body = f.hx == null ? BoardState.heroBodyOf(f.heroId) : null;
                const hx = f.hx ?? body?.x;
                const hy = f.hy ?? body?.y;
                if (!Number.isFinite(hx) || !Number.isFinite(hy)) return null;
                return (
                    <div key={f.tokenId} data-fight={f.tokenId}>
                        <FightButton
                            tokenId={f.tokenId}
                            heroId={f.heroId}
                            typeId={f.typeId}
                            x={f.x}
                            y={f.y}
                            hx={hx}
                            hy={hy}
                            fit={fit}
                            open={panel?.heroId === f.heroId}
                        />
                    </div>
                );
            })}
        </div>
    );
});

/**
 * Where the fighters' health bars draw while a fight runs: the fight layer's height
 * (`MAT_Z.FIGHT`), over the loot on the floor, so a kill's drops never cover a number. The hero
 * and the enemy still own their bars (their health, their press and click): each portals its bar
 * here, placed in mat units. Always mounted, so a fight that starts finds it already there and
 * its bars move in the same commit as the fight, never a frame late. Outside a fight a bar stays
 * on its fighter.
 */
export const FightBarHost = memo(function FightBarHost({ hostRef, yieldToTokens = false }) {
    return (
        <div
            ref={hostRef}
            data-fight-bars
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.FIGHT, '--plate-pointer': yieldToTokens ? 'none' : 'auto' }}
        />
    );
});

export default FightLayer;
