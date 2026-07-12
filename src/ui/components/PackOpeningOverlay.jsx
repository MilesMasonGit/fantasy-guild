import React, { useMemo } from 'react';
import { cn } from '../utils/cn.js';
import { motion, AnimatePresence } from 'framer-motion';
import { useEngine } from '../hooks/useEngine.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import GISurface from './base/GISurface.jsx';
import Button from './base/Button.jsx';
import { Sparkles, Star, Check } from 'lucide-react';
import { GICard } from './base/GICard.jsx';
import { ActiveCardFace } from './ActiveCardFace.jsx';
import { Hammer, Sword, Hand, Map as MapIcon, Skull, PartyPopper } from 'lucide-react';
import { BadgeItem } from './hud/BadgeGutter.jsx';
import CardFactory from '../../systems/cards/logic/CardFactory.js';

/**
 * PackOpeningOverlay: Standardized "Pick 1 of 4" Discovery Overlay.
 * Replaces the old random-results reveal with a strategic selection process.
 */
const PackOpeningOverlay = ({ results, onClose }) => {
    const engine = useEngine();

    // results is the pack data. Two shapes share this overlay:
    // - Legacy board packs: { options, areaId, packCardId } — claiming spawns
    //   a card instance and consumes the physical pack card.
    // - Unified packs (Phase 5 §5F, USE_DECK_LOOP): { options, unified: true }
    //   — claiming only increments collection.playsets. No board, no pack card.
    const { options = [], areaId, packCardId, unified = false } = results || {};
    const area = useMemo(() => getAreaSet(areaId), [areaId]);
    const areaName = unified ? 'Booster' : (area?.name || 'Booster');

    const cardCount = !unified ? engine.CardManager.getCardCount() : 0;
    const cardLimit = !unified ? engine.CardManager.getCardLimit() : 0;
    const hasSpace = !unified ? engine.CardManager.findFirstEmptyCell() !== null : true;
    const isAtLimit = !unified && cardCount >= cardLimit;

    const getDestinationInfo = () => {
        if (unified) return { text: "Card will be added to your Collection Binder", isWarning: false };
        if (isAtLimit) return { text: "Card Limit Reached - Card will be stored in the Library", isWarning: true };
        if (!hasSpace) return { text: "Playmat is Full - Card will be stored in the Library", isWarning: true };
        return { text: "Card will be placed on the Playmat", isWarning: false };
    };

    const dest = getDestinationInfo();

    const handleSelect = (templateId) => {
        if (unified) {
            const claimResult = engine.CollectionManager.claimToCollection(templateId);
            if (claimResult.success) onClose();
            return;
        }

        // 1. Get the physical pack's position to hand off to the new card
        const packCard = engine.CardManager.getCard(packCardId);
        const position = packCard?.position || null;

        // 2. Claim the card into the collection/binder
        const claimResult = engine.CollectionManager.claimCard(templateId, areaId, position);

        if (claimResult.success) {
            // 3. Consume the physical pack card
            engine.CardManager.discardCard(packCardId);

            // 4. Close the overlay
            onClose();
        }
    };

    if (options.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[350] flex flex-col items-center justify-center pointer-events-auto"
            >
                {/* Stunning Backdrop */}
                <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

                {/* Content Container */}
                <motion.div
                    className="relative z-10 flex flex-col items-center w-full min-h-0"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                >
                    {/* Header Section */}
                    <div className="relative z-0 flex flex-col items-center gap-4 text-center mt-12 mb-[-60px]">
                        <div className="flex items-center gap-4">
                            <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                            <h2 className="font-base text-4xl text-white tracking-[0.2em] uppercase gi-text-outline">
                                {areaName} Pack Opening
                            </h2>
                            <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                        </div>
                        <p className="text-gray-400 font-pixel text-xl tracking-widest uppercase opacity-80">
                            {unified ? 'Select a card to add to your collection' : 'Select a quest or task to add to your collection'}
                        </p>
                    </div>

                    {/* Discovery Track - Tall and Wide */}
                    <div className="w-full overflow-x-auto overflow-y-visible no-scrollbar snap-x snap-mandatory h-[750px] z-50">
                        <motion.div
                            className="flex gap-48 px-[20vw] justify-start lg:justify-center min-w-max h-full items-center"
                            variants={{
                                show: { transition: { staggerChildren: 0.15 } }
                            }}
                            initial="hidden"
                            animate="show"
                        >
                            {options.map((templateId, index) => (
                                <div key={templateId} className="snap-center shrink-0">
                                    <DiscoveryOption 
                                        templateId={templateId} 
                                        index={index}
                                        areaId={areaId}
                                        onSelect={() => handleSelect(templateId)}
                                    />
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <span className={cn(
                            "font-base text-xs uppercase tracking-[0.2em] transition-all duration-500",
                            dest.isWarning ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" : "text-gi-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]"
                        )}>
                            {dest.text}
                        </span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

/**
 * Individual Card Option in the Selection Grid.
 */
const DiscoveryOption = ({ templateId, onSelect, index, areaId }) => {
    const template = useMemo(() => getCard(templateId), [templateId]);
    const [isHovered, setIsHovered] = React.useState(false);
    
    // Hydrate a high-fidelity mock state using the real CardFactory
    const mockCardState = useMemo(() => {
        const instance = CardFactory.createInstance(templateId, {
            overrides: { areaId: areaId }
        });
        if (instance) {
            instance.id = `preview-${templateId}`;
            instance.status = 'idle';
        }
        return instance;
    }, [templateId, areaId]);
    
    if (!template) return null;

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 40, scale: 0.9 },
                show: { opacity: 1, y: 0, scale: 1 }
            }}
            transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative flex flex-col items-center gap-12"
        >
            {/* Type Badge - Above the card */}
            <div className="h-20 flex items-end pb-2">
                <DiscoveryTypeBadge template={template} />
            </div>

            {/* The Physical Card Preview */}
            <div className="flex flex-col items-center w-[400px] relative transform transition-transform duration-500 group-hover:scale-110">
                <div className="w-full flex justify-center">
                    <ActiveCardFace
                        cardId={`preview-${templateId}`}
                        cardState={mockCardState}
                        template={template}
                        isHovered={isHovered}
                        size="lg"
                    />
                </div>
            </div>

            {/* Select Button */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="w-full"
            >
                <button
                    onClick={onSelect}
                    className={cn(
                        "w-full py-4 px-8 rounded-xl font-base text-lg tracking-[0.1em] uppercase transition-all duration-300",
                        "bg-gi-gold text-black border border-white/20 shadow-[0_0_20px_rgba(255,215,0,0.2)]",
                        "hover:bg-white hover:scale-105 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] active:scale-95",
                        "flex items-center justify-center gap-3"
                    )}
                >
                    <Check size={20} strokeWidth={3} />
                    Claim Reward
                </button>
            </motion.div>
        </motion.div>
    );
};

/**
 * Specialized badge for the Discovery screen that only shows the Card Type.
 */
const DiscoveryTypeBadge = ({ template }) => {
    const traits = template?.traits || [];
    const isCrafting = traits.some(t => ['inputslot', 'recipe_selector', 'dynamic_inputslots'].includes(t.type));
    const isCombat = traits.some(t => t.type === 'combat');
    const isInvasion = traits.some(t => t.type === 'debuff_timer');
    const isArea = template.cardType === 'area';

    let typeIcon = <Hand size={16} />;
    let typeLabel = "Task";
    let typeColor = "text-blue-400";
    let typeDesc = "Assign a hero to complete this task and earn gold, experience, and resources.";
    
    if (isCrafting) {
        typeIcon = <Hammer size={16} />;
        typeLabel = "Crafting";
        typeColor = "text-orange-400";
        typeDesc = "Assign a hero and provide required item inputs to create new items.";
    } else if (isArea) {
        typeIcon = <MapIcon size={16} />;
        typeLabel = "Area Hub";
        typeColor = "text-gi-gold";
        typeDesc = "The central hub for this area. Purchase card packs to unlock new tasks and quests.";
    } else if (isInvasion) {
        typeIcon = <Skull size={16} />;
        typeLabel = "Invasion";
        typeColor = "text-red-500";
        typeDesc = "Hostile forces attacking your guild. Defeat them quickly to prevent negative consequences.";
    } else if (isCombat) {
        typeIcon = <Sword size={16} />;
        typeLabel = "Combat";
        typeColor = "text-red-400";
        typeDesc = "Assign well-equipped heroes to defeat enemies and collect loot.";
    } else if (template.cardType === 'event') {
        typeIcon = <PartyPopper size={16} />;
        typeLabel = "Event";
        typeColor = "text-orange-400";
        typeDesc = "A temporary event. Provides unique opportunities or challenges until completed or expires.";
    }

    return (
        <BadgeItem
            id="type-discovery"
            icon={typeIcon}
            label={typeLabel}
            color={typeColor}
            description={typeDesc}
        />
    );
};

export default PackOpeningOverlay;
