import React, { memo, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { TICK_INTERVAL_MS, PROGRESS_UI_UPDATE_INTERVAL } from '../../../config/constants.js';

const UPDATE_INTERVAL_MS = (TICK_INTERVAL_MS || 100) * (PROGRESS_UI_UPDATE_INTERVAL || 5);

/**
 * ProgressBar — a prop-driven fill bar.
 *
 * (CR-045) This used to carry a second, "zero re-render" path that read
 * GameState directly on a `cards_progress_updated` event. Nothing has
 * published that event since the deck-loop rework, so the whole branch —
 * plus its cardId/heroId/targetType props — was dead weight and was
 * removed. The live high-frequency bar is banner/RefProgressBar.jsx, which
 * subscribes to `area:progress` and writes style.width on a ref.
 */
const PRESETS = {
    clean: {
        showBloom: false,
        showBitDrift: false
    },
    standard: {
        showSheen: true,
        showBloom: true,
        showBitDrift: true
    },
    liquid: {
        showLiquid: true,
        liquidIntensity: 0.4,
        liquidSpeed: 0.8,
        showBloom: true,
        showBitDrift: true
    },
    arcane: {
        showChroma: true,
        chromaSpeed: 4,
        showTwinkle: true,
        twinkleDensity: 4,
        showBloom: true,
        showBitDrift: true
    },
    hazard: {
        showScanlines: true,
        showSheen: true,
        showBloom: true,
        showBitDrift: true
    }
};

const ProgressBar = ({
    current: propCurrent = 0,
    max: propMax = 100,
    color = 'primary',
    label = '',
    showText = false,
    isPaused = false,
    size = 'md',
    height = null,
    className = "",
    preset = 'standard',
    showSheen: propShowSheen = null,
    showGlow: propShowGlow = null,
    isGlassy: propIsGlassy = null,
    showScanlines: propShowScanlines = null,
    showChroma: propShowChroma = null,
    showLiquid: propShowLiquid = null,
    showBubbles: propShowBubbles = null,
    showSpeedPulse: propShowSpeedPulse = null,
    showScribe: propShowScribe = null,
    showTwinkle: propShowTwinkle = null,
    showGhost: propShowGhost = null,
    showBloom: propShowBloom = null,
    glowBlur = 4,
    glowOpacity = 1,
    glowScale = 0.1,
    chromaSpeed = 4,
    liquidIntensity = 0.4,
    liquidSpeed = 0.8,
    twinkleDensity = 4,
    twinkleSpeed = 1.5,
    bloomBlur = 24,
    bloomSpread = 2,
    bloomSpeed = 2.0,
    bloomOpacity = 0.9,
    glowSpeed = 2.0,
    glowBrightness = 2.5,
    chromaSaturation = 1,
    chromaOpacity = 1,
    liquidOpacity = 1,
    liquidWidth = 32,
    twinkleSize = 2,
    twinkleMinOpacity = 0,
    twinkleXRange = 90,
    twinkleYRange = 80,
    bubbleDensity = 3,
    bubbleSize = 4,
    bubbleSpeed = 2,
    bubbleOpacity = 0.6,
    bubbleDrift = 10,
    showBitDrift: propShowBitDrift = null,
    bitDensity = 15,
    bitSize = 6,
    bitSpeed = 3,
    bitOpacity = 0.5,
    bitJitter = 12,
    innerLabel = ""
}) => {
    const activePreset = PRESETS[preset] || PRESETS.standard;
    const showSheen = propShowSheen !== null ? propShowSheen : (activePreset.showSheen ?? false);
    const showGlow = propShowGlow !== null ? propShowGlow : (activePreset.showGlow ?? false);
    const isGlassy = propIsGlassy !== null ? propIsGlassy : (activePreset.isGlassy ?? false);
    const showScanlines = propShowScanlines !== null ? propShowScanlines : (activePreset.showScanlines ?? false);
    const showChroma = propShowChroma !== null ? propShowChroma : (activePreset.showChroma ?? false);
    const showLiquid = propShowLiquid !== null ? propShowLiquid : (activePreset.showLiquid ?? false);
    const showBubbles = propShowBubbles !== null ? propShowBubbles : (activePreset.showBubbles ?? false);
    const showSpeedPulse = propShowSpeedPulse !== null ? propShowSpeedPulse : (activePreset.showSpeedPulse ?? false);
    const showScribe = propShowScribe !== null ? propShowScribe : (activePreset.showScribe ?? false);
    const showTwinkle = propShowTwinkle !== null ? propShowTwinkle : (activePreset.showTwinkle ?? false);
    const showGhost = propShowGhost !== null ? propShowGhost : (activePreset.showGhost ?? false);
    const showBloom = propShowBloom !== null ? propShowBloom : (activePreset.showBloom ?? true);
    const showBitDrift = propShowBitDrift !== null ? propShowBitDrift : (activePreset.showBitDrift ?? true);
    const safeCurrent = Number(propCurrent) || 0;
    const safeMax = Number(propMax) || 100;
    const propPercentage = (isNaN(safeCurrent) || safeMax <= 0)
        ? 0
        : Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));

    const paintPercentage = Number.isFinite(propPercentage) ? propPercentage : 0;

    const heightClass = { sm: 'h-1.5', md: 'h-3', lg: 'h-5' }[size] || 'h-3';

    const colorMap = {
        primary: 'var(--color-gi-primary)',
        accent: 'var(--color-gi-accent)',
        secondary: 'var(--color-gi-warning)', // Mapped secondary action color
        success: 'var(--color-gi-success)',
        danger: 'var(--color-gi-danger)',
        hp: 'var(--color-gi-hp)',
        energy: 'var(--color-gi-warning)',
        xp: 'var(--color-gi-intent-artifact)', // Mapped XP to artifact purple
        task: 'var(--color-gi-intent-task)',
        recipe: 'var(--color-gi-intent-project)',
        explore: 'var(--color-gi-intent-area)',
        combat: 'var(--color-gi-intent-combat)',
        area: 'var(--color-gi-intent-area)',
        // Skill Colors (15-skill system; new skills reuse the closest legacy CSS variable)
        labor: 'var(--color-industry)',
        forge: 'var(--color-crafting)',
        aquatic: 'var(--color-nautical)',
        nature: 'var(--color-nature)',
        cooking: 'var(--color-culinary)',
        alchemy: 'var(--color-science)',
        science: 'var(--color-science)',
        occult: 'var(--color-occult)',
        crime: 'var(--color-crime)',
        social: 'var(--color-social, var(--color-gi-primary))',
        // 'explore' already maps to the area intent color above
        // Legacy skill ids (pre-15-skill content)
        industry: 'var(--color-industry)',
        nautical: 'var(--color-nautical)',
        crafting: 'var(--color-crafting)',
        culinary: 'var(--color-culinary)'
    };
    const barColor = colorMap[color] || color;

    const styles = {
        width: `${Number.isFinite(paintPercentage) ? paintPercentage : 0}%`,
        transitionProperty: 'width',
        transitionDuration: `${UPDATE_INTERVAL_MS}ms`,
        transitionTimingFunction: 'linear'
    };

    if (showChroma) {
        styles['--chroma-duration'] = `${chromaSpeed}s`;
        styles['--chroma-saturation'] = chromaSaturation;
        styles['--chroma-opacity'] = chromaOpacity;
    }

    if (showLiquid) {
        styles['--liquid-intensity'] = liquidIntensity;
        styles['--liquid-speed'] = `${liquidSpeed}s`;
        styles['--liquid-opacity'] = liquidOpacity;
        styles['--liquid-width'] = `${liquidWidth}px`;
    }

    if (showTwinkle) {
        styles['--twinkle-duration'] = `${twinkleSpeed}s`;
        styles['--twinkle-size'] = `${twinkleSize}px`;
        styles['--twinkle-min-opacity'] = twinkleMinOpacity;
    }

    if (showBloom) {
        styles['--bloom-blur'] = `${bloomBlur}px`;
        styles['--bloom-spread'] = `${bloomSpread}px`;
        styles['--bloom-speed'] = `${bloomSpeed}s`;
        styles['--bloom-opacity'] = bloomOpacity;
    }

    if (showGlow) {
        styles['--glow-blur'] = `${glowBlur}px`;
        styles['--glow-opacity'] = glowOpacity;
        styles['--glow-scale'] = glowScale;
        styles['--glow-speed'] = `${glowSpeed}s`;
        styles['--glow-brightness'] = glowBrightness;
    }

    if (showBubbles) {
        styles['--bubble-speed'] = `${bubbleSpeed}s`;
        styles['--bubble-size'] = `${bubbleSize}px`;
        styles['--bubble-opacity'] = bubbleOpacity;
        styles['--bubble-drift'] = `${bubbleDrift}px`;
    }

    if (showBitDrift) {
        styles['--bit-speed'] = `${bitSpeed}s`;
        styles['--bit-size'] = `${bitSize}px`;
        styles['--bit-opacity'] = bitOpacity;
        styles['--bit-jitter'] = `${bitJitter}px`;
    }

    if (!isPaused) styles.background = barColor;

    const pausedClass = isPaused
        ? 'animate-pulse-red bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
        : '';

    // 3. Memoized Particles
    const bubbleElements = useMemo(() => {
        if (!showBubbles || isPaused) return null;
        return [...Array(bubbleDensity)].map((_, i) => (
            <div
                key={i}
                className="bubble"
                style={{
                    '--bubble-left': `${(i * 31) % 80 + 10}%`,
                    '--bubble-speed': `${bubbleSpeed * (0.8 + (i * 0.4) % 1)}s`,
                    '--bubble-size': `${bubbleSize * (0.6 + (i * 0.8) % 0.8)}px`,
                    '--bubble-drift': `${bubbleDrift * (i % 2 === 0 ? 1 : -1)}px`,
                    animationDelay: `${i * 0.5}s`
                }}
            />
        ));
    }, [showBubbles, isPaused, bubbleDensity, bubbleSpeed, bubbleSize, bubbleDrift]);

    const twinkleElements = useMemo(() => {
        if (!showTwinkle || isPaused) return null;
        return [...Array(twinkleDensity)].map((_, i) => (
            <div
                key={i}
                className="twinkle-dot w-0.5 h-0.5"
                style={{
                    top: `${(i * 37) % twinkleYRange + (100 - twinkleYRange) / 2}%`,
                    left: `${(i * 13) % twinkleXRange + (100 - twinkleXRange) / 2}%`,
                    '--twinkle-duration': `${twinkleSpeed * (0.8 + (i * 0.2) % 1)}s`
                }}
            />
        ));
    }, [showTwinkle, isPaused, twinkleDensity, twinkleYRange, twinkleXRange, twinkleSpeed]);

    const bitElements = useMemo(() => {
        if (!showBitDrift || isPaused) return null;
        return [...Array(bitDensity)].map((_, i) => (
            <div
                key={i}
                className="bit"
                style={{
                    '--bit-left': `${(i * 17) % 95}%`,
                    '--bit-top': `${(i * 41) % 80 + 10}%`,
                    '--bit-speed': `${bitSpeed * (0.8 + (i * 0.4) % 1.5)}s`,
                    '--bit-size': `${bitSize * (0.7 + (i * 0.3) % 0.6)}px`,
                    '--bit-drift-x': `${bitJitter * ((i * 13) % 20 - 10) / 5}px`,
                    '--bit-drift-y': `${-bitJitter * ((i * 7) % 10) / 2}px`,
                    '--bit-drift-y2': `${-bitJitter * ((i * 11) % 15) / 1.5}px`,
                    animationDelay: `${i * -0.7}s`
                }}
            />
        ));
    }, [showBitDrift, isPaused, bitDensity, bitSpeed, bitSize, bitJitter]);

    return (
        <div className={cn("flex flex-col gap-1 w-full", className)}>
            {label && (
                <div className="flex justify-between items-center px-0.5">
                    <span className="text-[10px] text-gi-muted font-pixel uppercase tracking-wider">{label}</span>
                </div>
            )}

            <div className="relative w-full">
            <div className={cn("progress-track w-full relative overflow-hidden", heightClass, isGlassy && "progress-track--glass")}>
                <div
                    className={cn(
                        "progress-fill h-full linear relative overflow-hidden z-10",
                        pausedClass,
                        !isPaused && "progress-fill--glossy",
                        showScribe && !isPaused && "progress-fill--scribe",
                        showBloom && !isPaused && paintPercentage > 0 && "bloom-steady"
                    )}
                    style={{ ...styles, '--bar-color': barColor }}
                    title={`${Math.round(paintPercentage)}%`}
                >
                    {/* Scribe (Chisel Sparks) */}
                    {showScribe && !isPaused && paintPercentage > 0 && (
                        <div className="absolute right-0 top-0 bottom-0 w-2 overflow-visible pointer-events-none">
                            <div className="scribe-spark" style={{ '--spark-x': '18px', '--spark-y': '-14px', '--spark-duration': '0.5s' }} />
                            <div className="scribe-spark" style={{ '--spark-x': '14px', '--spark-y': '12px', '--spark-duration': '0.7s' }} />
                            <div className="scribe-spark" style={{ '--spark-x': '22px', '--spark-y': '3px', '--spark-duration': '0.4s' }} />
                        </div>
                    )}

                    {/* Alchemy Bubbles */}
                    {showBubbles && !isPaused && paintPercentage > 5 && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {bubbleElements}
                        </div>
                    )}

                    {/* Twinkle Dust */}
                    {showTwinkle && !isPaused && paintPercentage > 5 && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {twinkleElements}
                        </div>
                    )}
                </div>

                {/* Bit Drift (Revealed Field of Bits) */}
                {paintPercentage > 0 && (
                    <div
                        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none z-20"
                        style={{ width: `${Number.isFinite(paintPercentage) ? paintPercentage : 0}%` }}
                    >
                        <div
                            className="absolute inset-y-0 left-0 pointer-events-none"
                            style={{ width: `${100 / ((paintPercentage / 100) || 0.01)}%` }}
                        >
                            {bitElements}
                        </div>
                    </div>
                )}
            </div>

            {/* Static centered time/label — a single copy floated over the track
                (owner design 2026-07-14: bigger and brighter than the old dual
                label, never clipped by the fill, allowed to overflow the slim
                track, and it never moves). */}
            {innerLabel && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <span
                        className="text-sm font-black font-pixel text-white whitespace-nowrap gi-outline-2"
                    >
                        {innerLabel}
                    </span>
                </div>
            )}
            </div>

            {showText && (
                <span className="text-[9px] text-gi-muted font-mono text-center tracking-tight">
                    {Math.floor(safeCurrent)}/{safeMax}
                </span>
            )}
        </div>
    );
};

export default memo(ProgressBar);
