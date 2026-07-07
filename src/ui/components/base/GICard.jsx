import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';

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
    ...props
}) => {
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
                "w-[280px] h-[440px]",
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
            {...props}
        >
            {/* Background Parallax Layer */}
            {imageSrc && (
                <div className="absolute inset-0 z-0 pointer-events-none" style={{ imageRendering: 'pixelated' }}>
                     <motion.div
                        className="absolute top-1/2 left-1/2 bg-cover bg-center bg-no-repeat"
                        style={{ 
                            backgroundImage: `url(${imageSrc})`,
                            width: 512,
                            height: 512,
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
    <div className={cn("p-4 pb-2 z-20 pointer-events-auto", className)}>
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
