import React, { useMemo } from 'react';
import { PackageOpen, Archive, Trash2 } from 'lucide-react';
import { Button } from '@headlessui/react';
import { motion } from 'framer-motion';

import { GICard } from './base/GICard.jsx';
import { getSkill, getBiome, getAreaSet } from '../../config/registries/index.js';
import { getCardLayout, getAvailableTabs } from './card-modules/ModuleRegistry.jsx';
import { ModuleRenderer } from './card-modules/ModuleRenderer.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { cn } from '../utils/cn.js';

/**
 * ActiveCardFace
 * The visual "Face" of an active card. 
 * Extracted from ActiveCard.jsx to be shared with the Dnd DragOverlay,
 * ensuring high-fidelity visual synchronization during "Pick-Up" interactions.
 * 
 * @param {Object} props
 * @param {string} props.cardId - The instance ID of the card
 * @param {Object} props.cardState - The live state data of the card (e.g. progress, traits)
 * @param {Object} props.template - The static configuration of the card
 * @param {boolean} props.isHovered - Whether the card is currently active/hovered
 * @param {string|null} props.activeTab - Currently selected tab ID
 * @param {Function} props.setActiveTab - Callback for tab changes
 * @param {Object} props.dndHandlers - { attributes, listeners } for DND interaction
 */
export const ActiveCardFace = React.memo(({
    cardId,
    cardState,
    template,
    isHovered = false,
    activeTab = null,
    setActiveTab = () => { },
    dndHandlers = { attributes: {}, listeners: {} },
    onOpenPack = () => { },
    onPutAway = () => { },
    onAbandon = () => { }
}) => {
    // Calculate Layout & Assets
    const layout = useMemo(() =>
        getCardLayout(cardState, template, activeTab, isHovered),
        [cardState.traits, cardState.status, template, activeTab, isHovered]
    );

    const availableTabs = useMemo(() =>
        getAvailableTabs(cardState),
        [cardState.traits]
    );

    const backgroundPath = useMemo(() => {
        let bgId = template.areaArt || template.background;
        if (!bgId) {
            const areaSet = getAreaSet(template.areaSet || cardState.areaId);
            if (template.cardType === 'quest') {
                bgId = areaSet?.questBackground || 'bg_q_generic';
            } else if (template.cardType === 'invasion') {
                bgId = areaSet?.invasionBackground || 'bg_i_village';
            } else {
                bgId = getBiome(cardState.areaId)?.backgroundImage || areaSet?.areaArt;
            }
        }
        return bgId ? resolveSpritePath(bgId) : null;
    }, [template.areaArt, template.background, template.areaSet, cardState.areaId, template.cardType]);

    return (
        <GICard
            id={cardId}
            imageSrc={backgroundPath}
            active={isHovered}
            intent={template.cardType?.toLowerCase()}
            isUnique={template.isUnique}
        >
            <GICard.Header>
                {layout.header.map(m => (
                    <ModuleRenderer key={m.key} trait={m.trait} card={cardState} template={template} isFirst={m.isFirst} />
                ))}
            </GICard.Header>

            <GICard.Main
                {...dndHandlers.attributes}
                {...dndHandlers.listeners}
                className="cursor-grab active:cursor-grabbing"
            >
                {layout.content.map(m => (
                    <ModuleRenderer key={m.key} trait={m.trait} card={cardState} template={template} isFirst={m.isFirst} isHovered={isHovered} />
                ))}
            </GICard.Main>

            {/* Unified Bottom Section (Drawer + Ribbon + Footer) */}
            <div className="mt-auto flex flex-col z-40 relative">
                {/* Description Drawer (Slides out from behind ribbon) */}
                <GICard.Drawer
                    visible={layout.drawer.length > 0}
                    className={cn(
                        "z-10 !px-0", // Behind the Ribbon (z-40)
                        "bottom-full" // Sit directly on top of the bottom unit
                    )}
                >
                    <div className="w-full bg-black/30 border-t border-white/5 p-3">
                        {layout.drawer.map(m => (
                            <ModuleRenderer key={m.key} trait={m.trait} card={cardState} template={template} />
                        ))}
                    </div>
                </GICard.Drawer>

                {/* Skill Ribbon */}
                {layout.ribbon.length > 0 && (
                    <div className="w-full bg-black/30 border-t border-white/5 py-1.5 flex items-center justify-center min-h-[32px] z-40">
                        {layout.ribbon.map(m => (
                            <ModuleRenderer key={m.key} trait={m.trait} card={cardState} template={template} />
                        ))}
                    </div>
                )}

                <GICard.Footer className="mt-0 z-40">
                    {template.cardType === 'pack' && (
                        <CardActionButton
                            icon={<PackageOpen size={14} />}
                            label="Open"
                            onClick={onOpenPack}
                        />
                    )}

                    {availableTabs.map(tab => (
                        <CardActionButton
                            key={tab.id}
                            icon={<span className="text-sm">{tab.icon || '❔'}</span>}
                            label={tab.label || tab.id}
                            active={activeTab === tab.id}
                            onClick={() => setActiveTab(activeTab === tab.id ? null : tab.id)}
                        />
                    ))}

                    {template.cardType === 'quest' ? (
                        <CardActionButton
                            icon={<Trash2 size={14} />}
                            label="Abandon"
                            onClick={onAbandon}
                        />
                    ) : template.cardType !== 'pack' && (
                        <CardActionButton
                            icon={<Archive size={14} />}
                            label="Put Away"
                            onClick={onPutAway}
                        />
                    )}
                </GICard.Footer>
            </div>
        </GICard>
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

export default ActiveCardFace;
