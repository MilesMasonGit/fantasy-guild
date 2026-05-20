import React, { useState, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Info, PackageOpen } from 'lucide-react';
import { Button } from '@headlessui/react';

import { GICard } from './base/GICard.jsx';
import { useGameState } from '../hooks/useGameState.js';
import { useEngine } from '../hooks/useEngine.js';
import { getCard, getSkill, getBiome, getAreaSet } from '../../config/registries/index.js';
import { getCardLayout, getAvailableTabs } from './card-modules/ModuleRegistry.jsx';
import { ModuleRenderer } from './card-modules/ModuleRenderer.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { cn } from '../utils/cn.js';

import { useDndTarget } from '../hooks/useDndTarget.js';
import { ActiveCardFace } from './ActiveCardFace.jsx';
import BadgeGutter from './hud/BadgeGutter.jsx';

/**
 * ActiveCard - The data-driven interactive card component.
 * Refactored into Shell (DND/State) and Visual (UI) for atomic updates.
 */
export const ActiveCard = React.memo(({ cardId }) => {
    const engine = useEngine();
    const [isHovered, setIsHovered] = useState(false);
    const [activeTab, setActiveTab] = useState(null);
    const [isStashing, setIsStashing] = useState(false);

    const handlePutAway = () => {
        if (isStashing) return;
        setIsStashing(true);
        // Wait for the local flourish before telling the engine to delete
        setTimeout(() => {
            engine.CardManager.vaultCard(cardId);
        }, 1000);
    };

    // Optimized state subscription
    const cardState = useGameState(
        state => state.getCardById(cardId),
        ['cards_updated', 'cards_progress_updated'],
        (eventData) => !eventData?.cardId || eventData.cardId === cardId
    );

    const template = cardState ? getCard(cardState.templateId) : null;

    if (!cardState || !template) return null;

    // DND Setup
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: cardId,
        disabled: cardState.isLocked || isStashing,
        data: {
            type: 'card',
            cardType: template?.cardType,
            id: cardId,
            icon: cardState?.icon || '🃏',
            name: cardState?.name,
            cardState,
            template
        }
    });


    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['hero', 'item', 'blueprint', 'tool'],
        validate: (activeData) => {
            if (isStashing) return false;
            // Smart scanning for valid slots
            if (activeData.type === 'hero') return template?.traits?.some(t => t.type === 'heroslot');
            if (activeData.type === 'item') return template?.traits?.some(t => t.type === 'inputslot' || t.type === 'toolslot');
            return true;
        }
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `area-${cardId}`,
        disabled: isStashing,
        data: {
            targetType: 'card_area',
            cardId: cardId,
            type: 'card_area',
            accepts: ['hero', 'item', 'blueprint', 'tool']
        }
    });

    const setNodeRef = (el) => {
        setDraggableRef(el);
        setDroppableRef(el);
    };

    // PERFORMANCE: When dragging, we hide the source immediately.
    const dragStyle = {
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 0 : 200,
        pointerEvents: (isDragging || isStashing) ? 'none' : 'auto',
        transform: (!isDragging && transform)
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        willChange: isDragging ? 'auto' : 'transform, opacity',
    };

    return (
        <motion.div
            ref={setNodeRef}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            data-type="card"
            data-card-id={cardId}
            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
            className={cn(
                "flex flex-col items-center w-[280px] relative dnd-target",
                isDragging ? "pointer-events-none" : "transform-gpu",
                isAnyDragging && !isValidTarget && "opacity-50 grayscale-[0.2]"
            )}
            style={dragStyle}
            animate={isStashing ? {
                scale: 0.1,
                filter: 'brightness(3) drop-shadow(0 0 20px white)',
                opacity: 0.8
            } : {
                scale: 1,
                filter: 'brightness(1) drop-shadow(0 0 0px transparent)',
                opacity: 1
            }}
            transition={{ duration: 1.0, ease: "easeIn" }}
        >
            <ActiveCardFace
                cardId={cardId}
                cardState={cardState}
                template={template}
                isHovered={isHovered}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                dndHandlers={{ attributes, listeners }}
                onOpenPack={() => engine.CardManager.openPack(cardId)}
                onPutAway={handlePutAway}
                isStashing={isStashing}
            />

            <div className="absolute top-0 left-0 pointer-events-none">
                <BadgeGutter
                    template={template}
                    isLocked={cardState.isLocked}
                    isVisible={!isDragging && !isStashing}
                    aggregator={cardState.aggregator}
                />
            </div>
        </motion.div>
    );
});

const CardActionButton = ({ icon, label, active, onClick }) => (
    <Button
        type="button"
        onClick={onClick}
        className={cn(
            "group h-8 px-3 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 bg-black/40 text-gray-400 hover:bg-black/60 hover:w-auto min-w-[32px] pointer-events-auto",
            active && "bg-gi-primary text-white"
        )}
    >
        <div className="relative flex items-center justify-center">
            <div className="transition-all duration-300 group-hover:opacity-0 group-hover:scale-0">{icon}</div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 whitespace-nowrap text-pixel-base font-bold uppercase tracking-wider">
                {label}
            </div>
        </div>
    </Button>
);

export default ActiveCard;
