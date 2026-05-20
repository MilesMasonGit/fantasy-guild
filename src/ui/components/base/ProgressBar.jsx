import React, { useRef, memo, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameTick } from '../../hooks/useGameTick.js';
import { getCard } from '../../../config/registries/cardRegistry.js';

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
    bitJitter = 12,
    innerLabel = ""
}) => {
    // 1. O(1) Data Resolution via useGameTick
    const fillRef = useRef(null);
    const textRef = useRef(null);
    const innerLabelRef = useRef(null);
    const innerLabelFillRef = useRef(null);
    const bitContainerRef = useRef(null);
    
    const percentageRef = useRef(0);
    const isResetRef = useRef(false);

    // Initial state calculation (for SSR or first paint)
    let initialCurrent = propCurrent;
    let initialMax = propMax;

    useGameTick((GameState) => {
        if (!cardId) return; // Prop-driven updates handle themselves via React re-renders

        const card = GameState.getCardById ? GameState.getCardById(cardId) : (GameState.cards?.active?.find(c => c.id === cardId));
        if (!card) return;
        
        const template = getCard(card.templateId) || {};
        const pCurrent = card.progress || 0;
        const pBaseTickTime = card.baseTickTime || template.baseTickTime || 10000;
        
        const safeMax = Number(pBaseTickTime) || 100;
        const rawPct = (pCurrent / safeMax) * 100;
        const newPct = (Number.isFinite(rawPct) && !isNaN(rawPct)) ? Math.max(0, Math.min(100, rawPct)) : 0;
        
        // Check structural reset (e.g., job restart)
        isResetRef.current = newPct < percentageRef.current - 50;
        percentageRef.current = newPct;
        
        // Direct DOM Mutation (0 Re-renders)
        if (fillRef.current) {
            fillRef.current.style.transitionProperty = isResetRef.current ? 'none' : 'width';
            fillRef.current.style.width = `${Number.isFinite(newPct) ? newPct : 0}%`;
            fillRef.current.title = `${Math.round(newPct || 0)}%`;
            
            if (showBloom && !isPaused) {
                if (newPct > 0) fillRef.current.classList.add('bloom-steady');
                else fillRef.current.classList.remove('bloom-steady');
            }
        }
        
        if (textRef.current && showText) {
            textRef.current.innerText = `${Math.floor(pCurrent || 0)}/${safeMax}`;
        }

        if (innerLabelRef.current && innerLabelFillRef.current) {
            const labelText = `${Math.floor(pCurrent || 0)}/${safeMax}`;
            innerLabelRef.current.innerText = labelText;
            innerLabelFillRef.current.innerText = labelText;
        }
        
        if (bitContainerRef.current && showBitDrift) {
            bitContainerRef.current.style.width = `${Number.isFinite(newPct) ? newPct : 0}%`;
            if (bitContainerRef.current.firstChild) {
                const bitScale = (newPct / 100) || 0.01;
                bitContainerRef.current.firstChild.style.width = `${100 / bitScale}%`;
            }
        }
    }, ['cards_progress_updated']);

    // Standard Prop-driven updates
    const safeCurrent = Number(propCurrent) || 0;
    const safeMax = Number(propMax) || 100;
    const propPercentage = (isNaN(safeCurrent) || safeMax <= 0)
        ? 0
        : Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));

    // Determine initial paint percentage
    const rawPaintPercentage = cardId ? percentageRef.current : propPercentage;
    const paintPercentage = (Number.isFinite(rawPaintPercentage) && !isNaN(rawPaintPercentage)) ? rawPaintPercentage : 0;

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
        // Skill Colors (Assuming these are defined in tailwind.css)
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
        width: `${Number.isFinite(paintPercentage) ? paintPercentage : 0}%`,
        transitionProperty: (cardId ? isResetRef.current : false) ? 'none' : 'width',
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
                    <span className="text-[10px] text-gi-muted font-pixel uppercase tracking-wider">{label}</span>
                </div>
            )}

            <div className={cn("progress-track w-full relative overflow-hidden", heightClass, isGlassy && "progress-track--glass")}>
                {/* 1. Background Label (Behind the bar) */}
                {innerLabel && (
                    <div 
                        ref={innerLabelRef}
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-white/30 pointer-events-none z-0 tracking-tighter"
                    >
                        {innerLabel}
                    </div>
                )}

                <div
                    ref={fillRef}
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
                    {/* 2. Foreground Label (Clipped to the bar) */}
                    {innerLabel && (
                        <div 
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{ width: `${100 / ((paintPercentage / 100) || 0.01)}%` }}
                        >
                            <span 
                                ref={innerLabelFillRef}
                                className="text-[10px] font-black font-mono text-black/60 whitespace-nowrap tracking-tighter"
                            >
                                {innerLabel}
                            </span>
                        </div>
                    )}

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
                        ref={bitContainerRef}
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

            {showText && (
                <span ref={textRef} className="text-[9px] text-gi-muted font-mono text-center tracking-tight">
                    {Math.floor(safeCurrent)}/{safeMax}
                </span>
            )}
        </div>
    );
};

export default memo(ProgressBar);
