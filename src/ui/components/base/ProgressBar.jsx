import React, { useRef, memo, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';

/**
 * ProgressBar
 * A highly reusable progressive fill bar.
 * Optimized for frequent updates by optionally listening to GameState directly.
 */
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
    cardId = null,
    showSheen = false,
    showGlow = false,
    isGlassy = false,
    showScanlines = false,
    showChroma = false,
    showLiquid = false,
    showBubbles = false,
    showSpeedPulse = false,
    showScribe = false,
    showTwinkle = false,
    showGhost = false,
    showBloom = true,
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
    showBitDrift = true,
    bitDensity = 15,
    bitSize = 6,
    bitSpeed = 3,
    bitOpacity = 0.5,
    bitJitter = 12
}) => {
    // 1. Data Resolution
    const cardProgress = useGameState(
        state => {
            if (!cardId) return null;
            const card = state.getCardById(cardId);
            return card ? {
                progress: card.progress,
                baseTickTime: card.baseTickTime,
                currentTickTime: card.currentTickTime
            } : null;
        },
        ['cards_progress_updated'],
        cardId ? (data) => !data?.cardId || data.cardId === cardId : null
    );

    const current = (cardId && cardProgress) ? cardProgress.progress : propCurrent;
    const max = (cardId && cardProgress) ? cardProgress.baseTickTime : propMax;
    const effectiveTime = (cardId && cardProgress) ? (cardProgress.currentTickTime || cardProgress.baseTickTime) : propMax;


    const effectiveSize = height || size;

    const safeCurrent = Number(current) || 0;
    const safeMax = Number(max) || 100;
    const percentage = (isNaN(safeCurrent) || safeMax <= 0)
        ? 0
        : Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));

    const prevPercentRef = useRef(percentage);
    const isReset = percentage < prevPercentRef.current - 50;
    prevPercentRef.current = percentage;

    const heightClass = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }[effectiveSize] || 'h-2.5';

    const colorMap = {
        primary: 'var(--color-gi-primary, #06b6d4)',
        accent: 'var(--color-gi-accent, #a855f7)',
        secondary: 'var(--color-energy, #f6ad55)',
        success: 'var(--color-gi-success, #10b981)',
        danger: 'var(--color-gi-danger, #ef4444)',
        hp: 'var(--color-hp, #e53e3e)',
        energy: 'var(--color-energy, #f6ad55)',
        xp: 'var(--color-xp, #9f7aea)',
        task: 'var(--color-task, #6090c0)',
        recipe: 'var(--color-recipe, #50a060)',
        explore: 'var(--color-explore, #c09040)',
        combat: 'var(--color-combat, #c05050)',
        area: 'var(--color-area, #509090)',
        // Skill Colors
        industry: 'var(--color-industry)',
        nature: 'var(--color-nature)',
        nautical: 'var(--color-nautical)',
        crafting: 'var(--color-crafting)',
        culinary: 'var(--color-culinary)',
        crime: 'var(--color-crime)',
        occult: 'var(--color-occult)',
        science: 'var(--color-science)'
    };
    const barColor = colorMap[color] || color;

    const styles = {
        width: `${percentage}%`,
        transitionProperty: isReset ? 'none' : 'width',
        transitionDuration: '100ms',
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
                    <span className="text-[10px] text-gray-400 font-pixel uppercase tracking-wider">{label}</span>
                </div>
            )}

            <div className={cn("progress-track w-full relative", heightClass, isGlassy && "progress-track--glass")}>
                <div
                    className={cn(
                        "progress-fill h-full linear relative",
                        pausedClass,
                        !isPaused && "progress-fill--glossy",
                        showScribe && !isPaused && "progress-fill--scribe",
                        showBloom && !isPaused && percentage > 0 && "bloom-steady"
                    )}
                    style={{ ...styles, '--bar-color': barColor }}
                    title={`${Math.round(percentage)}%`}
                >
                    {/* Scribe (Chisel Sparks) */}
                    {showScribe && !isPaused && percentage > 0 && (
                        <div className="absolute right-0 top-0 bottom-0 w-2 overflow-visible pointer-events-none">
                            <div className="scribe-spark" style={{ '--spark-x': '18px', '--spark-y': '-14px', '--spark-duration': '0.5s' }} />
                            <div className="scribe-spark" style={{ '--spark-x': '14px', '--spark-y': '12px', '--spark-duration': '0.7s' }} />
                            <div className="scribe-spark" style={{ '--spark-x': '22px', '--spark-y': '3px', '--spark-duration': '0.4s' }} />
                        </div>
                    )}

                    {/* Clipped Overlays (Sheen & Scanlines) REMOVED for performance */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    </div>

                    {/* Alchemy Bubbles */}
                    {percentage > 5 && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {bubbleElements}
                        </div>
                    )}

                    {/* Liquid Wobble Tip REMOVED for performance */}



                    {/* Comet Tail Trail REMOVED for performance */}

                    {/* Twinkle Dust */}
                    {percentage > 5 && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {twinkleElements}
                        </div>
                    )}
                </div>

                {/* Bit Drift (Revealed Field of Bits) */}
                {percentage > 0 && (
                    <div
                        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
                        style={{ width: `${percentage}%` }}
                    >
                        <div
                            className="absolute inset-y-0 left-0 pointer-events-none"
                            style={{ width: `${100 / (percentage / 100)}%` }}
                        >
                            {bitElements}
                        </div>
                    </div>
                )}
            </div>

            {showText && (
                <span className="text-[9px] text-gray-500 font-mono text-center tracking-tight">
                    {Math.floor(safeCurrent)}/{safeMax}
                </span>
            )}
        </div>
    );
};

export default memo(ProgressBar);
