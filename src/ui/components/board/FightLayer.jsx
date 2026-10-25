import { memo, useCallback, useLayoutEffect, useState } from 'react';
import { MAT_Z } from './matLayers.js';
import { useMatFit } from './MatFitContext.jsx';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useTokenState } from './tokenEvents.js';
import { WorkPlateView } from './WorkPlateLayer.jsx';
import { platePlace } from './workPlate.js';
import { fightPlateOf, fightPlateCells, fightPlateTip, fightChipPlace, fullHealthText, healthTextWidth, CHIP, CHIP_PX } from './fightPlate.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as FixedTokens from '../../../systems/board/FixedTokens.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { getEnemyProfile } from '../../../config/registries/enemyProfile.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { glyphSrc, GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { toggleFightPanel, useFightPanelState } from '../combat/fightPanelStore.js';
import { t } from '../../../i18n/index.js';

const PLATE_POINTER = Object.freeze({ pointerEvents: 'var(--plate-pointer, auto)' });

/**
 * A fight's plate: the work plate's frame and place on the seam under the two fighters' feet, saying
 * both styles with a divider and the hero's elixirs with the fights each has left. Read only on the
 * events about this fight (its engagement, the hero's drinks, gear and moves). Pressing it grabs the
 * enemy, as pressing a work plate grabs its Token.
 */
const FightPlate = memo(function FightPlate({ tokenId, heroId, x, y, typeId, fit, matH, onPress }) {
    const plate = useTokenState(tokenId, () => fightPlateOf(heroId, tokenId), () => ({
        byId: [BOARD_EVENTS.COMBAT_ENGAGED, BOARD_EVENTS.COMBAT_RESOLVED, BOARD_EVENTS.HERO_MOVED],
        byKey: [
            { event: BOARD_EVENTS.HERO_MOVED, field: 'heroId', key: heroId },
            { event: ENGINE_EVENTS.HERO_CONSUMED, field: 'heroId', key: heroId },
            { event: ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, field: 'heroId', key: heroId },
            { event: ENGINE_EVENTS.HEROES_UPDATED, field: 'heroId', key: heroId }
        ],
        broadcast: [ENGINE_EVENTS.GAME_RESET]
    }));
    const press = useCallback((e) => {
        const instance = BoardState.getTokenById(tokenId);
        if (!instance || FixedTokens.isFixed(instance)) return;
        const art = e.currentTarget.closest('[data-mat-board]')?.querySelector(`[data-token-art][data-token-id="${tokenId}"]`) || null;
        onPress?.(e, { id: tokenId, typeId: instance.typeId, permanent: Placement.isPermanentToken(instance.typeId) }, art);
    }, [tokenId, onPress]);
    const tip = useCallback((cell) => fightPlateTip(cell, heroId, tokenId), [heroId, tokenId]);
    if (!plate || x == null) return null;
    const place = platePlace({ x, y, typeId: plate.typeId || typeId, side: plate.side, fit, matH });
    return (
        <div
            data-fight-plate-slot={tokenId}
            className="absolute flex justify-center pointer-events-none"
            style={{ left: place.left, top: place.top, width: place.width }}
        >
            <WorkPlateView
                cells={fightPlateCells(plate)}
                u={place.unit}
                tip={tip}
                plateProps={{ 'data-fight-plate': tokenId, onPointerDown: press, style: PLATE_POINTER }}
            />
        </div>
    );
});

/**
 * The fight chip: the fight glyph in the chamfer frame at the enemy's outer top corner, beside its
 * health bar and past its number. A click opens (or closes) the fight panel; its hover names the
 * fight. A press never reaches the mat (no drag starts from it).
 */
const FightChip = memo(function FightChip({ tokenId, heroId, x, y, typeId, side, fit, open }) {
    const enemy = getEnemyProfile(typeId);
    const widest = fullHealthText(enemy?.hp);
    // Measured once the bars are drawn (this commit), in their own font: the chip stands past it.
    const [labelW, setLabelW] = useState(null);
    useLayoutEffect(() => { setLabelW(healthTextWidth(widest)); }, [widest, fit]);
    const place = fightChipPlace({ x, y, typeId, side, fit, labelW });
    const u = place.unit;
    const heroName = HeroManager.getHero(heroId)?.name || '';
    const title = t('fight.panel.fightIcon', { hero: heroName, enemy: enemy?.name || tokenName(typeId) });
    const band = CHIP.BAND * u;
    const size = CHIP_PX * u;
    return (
        <div
            data-fight-chip-slot={tokenId}
            className="absolute"
            style={{ left: place.left, top: place.top, width: size, height: size }}
        >
            <Tooltip title={title} lines={[t('fight.panel.openHint')]}>
                <button
                    type="button"
                    data-fight-chip={heroId}
                    data-fight-chip-open={open ? 'true' : undefined}
                    aria-label={title}
                    className="relative block p-0 m-0 border-0 bg-transparent cursor-pointer pointer-events-auto"
                    style={{ width: size, height: size }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        // The chip stands on the enemy's far side from the hero: the panel opens further out.
                        toggleFightPanel(heroId, e.currentTarget.getBoundingClientRect(), -side);
                    }}
                >
                    <span
                        aria-hidden="true"
                        className="ui-frame-shadow-chamfer absolute inset-0 pointer-events-none"
                        style={{ borderWidth: band, borderImageWidth: `${band}px`, transform: `translate(${4 * u}px, ${4 * u}px)` }}
                    />
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
 * Every fight on the mat: its plate in the work plate's place and its chip at the enemy's corner,
 * one layer over the Tokens and the loot (`MAT_Z.FIGHT`). `fights` are `{ tokenId, heroId, typeId,
 * x, y }`. The health bars are the fighters' own (`MatHero`, `TokenBubbles`); the floating numbers
 * are the effect layer's (`fightFloats.js`).
 */
export const FightLayer = memo(function FightLayer({ fights, onPress, platesDrawn = true, yieldToTokens = false }) {
    const fit = useMatFit() || 1;
    const mat = useMatSize();
    const panel = useFightPanelState();
    return (
        <div
            data-fights
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.FIGHT, '--plate-pointer': yieldToTokens ? 'none' : 'auto' }}
        >
            {fights.map(f => (
                <div key={f.tokenId} data-fight={f.tokenId}>
                    {platesDrawn && (
                        <FightPlate
                            tokenId={f.tokenId}
                            heroId={f.heroId}
                            typeId={f.typeId}
                            x={f.x}
                            y={f.y}
                            fit={fit}
                            matH={mat.h}
                            onPress={onPress}
                        />
                    )}
                    <FightChip
                        tokenId={f.tokenId}
                        heroId={f.heroId}
                        typeId={f.typeId}
                        x={f.x}
                        y={f.y}
                        side={BoardState.heroBodyOf(f.heroId)?.side === -1 ? -1 : 1}
                        fit={fit}
                        open={panel?.heroId === f.heroId}
                    />
                </div>
            ))}
        </div>
    );
});

export default FightLayer;
