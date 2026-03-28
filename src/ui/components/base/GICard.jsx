import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../utils/cn.js';

/**
 * GI-Card: The standardized base visual container for all Cards (Heroes, Quests, Items).
 * Supports rarity-based borders and standardized content padding.
 */
export const GICard = ({
    children,
    className,
    interactive = true,
    active = false,
    intent = null,
    isUnique = false,
    imageSrc,
    handleProps,
    ...props
}) => {
    const cardRef = useRef(null);
    const cardRectRef = useRef(null);
    const rafRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    
    // Parallax Motion Values
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth springs for the nudge
    const springConfig = { stiffness: 150, damping: 25 };
    const nudgeX = useSpring(useTransform(mouseX, [-146, 146], [15, -15]), springConfig);
    const nudgeY = useSpring(useTransform(mouseY, [-230, 230], [20, -20]), springConfig);

    const handlePointerEnter = () => {
        // PERFORMANCE: Skip hover state + rect measurement during drag.
        // The DragOverlay has pointer-events:none, so cards still receive
        // pointer events. Without this guard, every card boundary crossing
        // triggers a React re-render + forced reflow from getBoundingClientRect.
        if (document.body.hasAttribute('data-dragging-type')) return;
        setIsHovered(true);

        // Notify AudioSystem of focus change
        if (props.id) {
            import('../../../systems/core/EventBus.js').then(({ EventBus }) => {
                EventBus.publish('audio:focus_changed', { cardId: props.id });
            });
        }

        // PERFORMANCE: Cache the bounding rect on enter to avoid calling getBoundingClientRect 
        // on every mouse move (which triggers a forced synchronous layout).
        if (cardRef.current) {
            cardRectRef.current = cardRef.current.getBoundingClientRect();
        }
    };

    const handlePointerMove = (e) => {
        // BAIL 1: Disable parallax during active drag operations (User Request)
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

        // Clear AudioSystem focus
        import('../../../systems/core/EventBus.js').then(({ EventBus }) => {
            EventBus.publish('audio:focus_changed', { cardId: null });
        });
    };

    return (
        <motion.div
            ref={cardRef}
            initial={false}
            animate={{ 
                // PERFORMANCE: Use scale instead of width/height to avoid triggering 
                // expensive layout recalculations for the entire page on every frame.
                scale: active ? 1.05 : 1.0,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className={cn(
                "relative flex flex-col overflow-hidden rounded-xl no-pan transform-gpu",
                "w-[280px] h-[440px]", // Default dimensions
                "bg-black/40 border border-white/10",
                active && "border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.25)]",
                intent === 'combat' && "gi-border-combat",
                intent === 'task' && "gi-border-task",
                intent === 'project' && "gi-border-project",
                intent === 'blueprint' && "gi-border-blueprint",
                intent === 'artifact' && "gi-border-artifact",
                intent === 'area' && "gi-border-area",
                isUnique && "gi-unique-shimmer",
                className
            )}
            {...props}
        >
            {/* 512px Art Engine: Window reveal & Parallax */}
            {imageSrc && (
                <div className="absolute inset-0 z-0 pointer-events-none" style={{ imageRendering: 'pixelated' }}>
                     <motion.div
                        className="absolute top-1/2 left-1/2 bg-cover bg-center bg-no-repeat"
                        style={{ 
                            backgroundImage: `url(${imageSrc})`,
                            width: 512,
                            height: 512,
                            imageRendering: 'pixelated', // Force crisp edges for pixel art
                            x: useTransform(nudgeX, (v) => `calc(-50% + ${v}px)`),
                            y: useTransform(nudgeY, (v) => `calc(-50% + ${v}px)`),
                        }}
                    />
                </div>
            )}

            {/* Content Safe Area: Always fills the parent container but respects 280x440 aspect ratio internally if needed */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div 
                    className={cn(
                        "relative w-full h-full flex flex-col pointer-events-auto",
                        imageSrc && "gi-text-outline"
                    )}
                >
                    {children}
                </div>
            </div>
        </motion.div>
    );
};

export default GICard;
