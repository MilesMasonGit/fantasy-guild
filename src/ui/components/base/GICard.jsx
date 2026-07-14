import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * Card size tiers — the frame is a window into a square art sprite whose native
 * resolution is `art` px. All three are integer scales of the 256 source sprite
 * (0.5× / 1× / 2×), so pixel art stays crisp. `w` is the default window width
 * (narrower than `art`, so the frame crops the sides). `md` is the banner card
 * (width overridable via the QA slider), `sm` the drawer tile, `lg` the pack reveal.
 */
export const CARD_TIERS = {
    sm: { art: 128, w: 100 },
    md: { art: 256, w: 200 },
    lg: { art: 512, w: 400 },
};

/**
 * GICard - Standardized Card Container
 * Features: Parallax art, Shimmer (Unique), and Layout Slots.
 */
export const GICard = ({
    children,
    className,
    interactive = true,
    active = false,
    isStashing = false,
    intent = null,
    isUnique = false,
    imageSrc,
    size,
    width,
    ...props
}) => {
    // Legacy default (no size/width) preserves the original 280×440 / 512-bg card
    // so flag-off callers are untouched. New tiers are opt-in via `size` or `width`.
    const legacy = !size && width == null;
    const tier = CARD_TIERS[size] || CARD_TIERS.md;
    const frameW = legacy ? 280 : (width ?? tier.w);
    const frameH = legacy ? 440 : tier.art;
    const artPx = legacy ? 512 : tier.art;
    const cardRef = useRef(null);
    const cardRectRef = useRef(null);
    const rafRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springConfig = { stiffness: 150, damping: 25 };
    const nudgeX = useSpring(useTransform(mouseX, [-146, 146], [15, -15]), springConfig);
    const nudgeY = useSpring(useTransform(mouseY, [-230, 230], [20, -20]), springConfig);

    const handlePointerEnter = () => {
        if (document.body.hasAttribute('data-dragging-type')) return;
        setIsHovered(true);
        
        if (props.id) {
            EventBus.publish('audio:focus_changed', { cardId: props.id });
        }

        if (cardRef.current) {
            cardRectRef.current = cardRef.current.getBoundingClientRect();
        }
    };

    const handlePointerMove = (e) => {
        if (document.body.hasAttribute('data-dragging-type')) {
            if (mouseX.get() !== 0) mouseX.set(0);
            if (mouseY.get() !== 0) mouseY.set(0);
            return;
        }

        if (!cardRectRef.current || !active || !isHovered) return;
        
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const rect = cardRectRef.current;
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            mouseX.set(e.clientX - centerX);
            mouseY.set(e.clientY - centerY);
        });
    };

    const handlePointerLeave = () => {
        setIsHovered(false);
        cardRectRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        mouseX.set(0);
        mouseY.set(0);

        EventBus.publish('audio:focus_changed', { cardId: null });
    };

    return (
        <motion.div
            ref={cardRef}
            initial={false}
            animate={{
                scale: active ? 1.05 : 1.0,
            }}
            transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25
            }}
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className={cn(
                "relative flex flex-col overflow-hidden rounded-xl no-pan",
                "bg-black/40 border border-white/10",
                active && "border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.1)]",
                intent === 'combat' && "gi-border-combat",
                intent === 'task' && "gi-border-task",
                intent === 'project' && "gi-border-project",
                intent === 'blueprint' && "gi-border-blueprint",
                intent === 'artifact' && "gi-border-artifact",
                intent === 'area' && "gi-border-area",
                intent === 'pack' && "gi-border-pack",
                (isUnique || intent === 'pack') && "gi-unique-shimmer",
                className
            )}
            style={{ width: frameW, height: frameH }}
            {...props}
        >
            {/* Background Parallax Layer */}
            {imageSrc && (
                <div className="absolute inset-0 z-0 pointer-events-none" style={{ imageRendering: 'pixelated' }}>
                     <motion.div
                        className="absolute top-1/2 left-1/2 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${imageSrc})`,
                            width: artPx,
                            height: artPx,
                            backgroundSize: `${artPx}px ${artPx}px`,
                            imageRendering: 'pixelated',
                            x: useTransform(nudgeX, (v) => `calc(-50% + ${v}px)`),
                            y: useTransform(nudgeY, (v) => `calc(-50% + ${v}px)`),
                        }}
                    />
                </div>
            )}

            {/* Content Layers */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
                {children}
            </div>
        </motion.div>
    );
};

/** Layout Slots */
GICard.Header = ({ children, className }) => (
    <div className={cn("z-20 pointer-events-auto w-full relative", className)}>
        {children}
    </div>
);

GICard.Main = ({ children, className, ...props }) => (
    <div 
        className={cn("flex-1 p-4 pt-1 z-10 overflow-hidden pointer-events-auto flex flex-col justify-center gap-2", className)}
        {...props}
    >
        {children}
    </div>
);

GICard.Footer = ({ children, className }) => (
    <div className={cn("mt-auto p-3 z-30 pointer-events-auto bg-black/30 flex justify-evenly gap-2", className)}>
        {children}
    </div>
);

GICard.Drawer = ({ children, className, visible = false }) => (
    <div className={cn("absolute bottom-12 left-0 w-full z-40 transition-all duration-300 pointer-events-none px-2", className)}>
        <div className={cn(
            "transform transition-all duration-300",
            visible ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
        )}>
            {children}
        </div>
    </div>
);

export default GICard;
