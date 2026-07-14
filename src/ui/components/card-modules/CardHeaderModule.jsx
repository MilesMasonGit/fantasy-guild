import React from 'react';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { cn } from '../../utils/cn.js';
import Badge from '../base/Badge.jsx';

/**
 * CardHeaderModule
 * Renders the main Title, Type, and Tags/Rarity for a Card.
 */
const CardHeaderModule = React.memo(({ trait, card, isFirst, globalIndex = 0 }) => {
    if (!card) return null;

    const template = getCard(card.templateId) || {};

    // Get active area threat state for Invasions
    const activeAreaId = useGameState(state => state?.ui?.activeAreaId);
    const resolvedAreaId = card.areaId || activeAreaId || 'farmland';

    const threat = useGameState(
        state => state?.areaStates?.[resolvedAreaId]?.invasionThreat || 0,
        ['invasion_threat_updated']
    );

    const count = card.hordeCount || 0;
    const total = card.hordeTotal || 1;
    const enemyDef = getEnemy(card.enemyId);
    const enemyName = enemyDef?.name || 'Enemies';

    // Combat cards are titled by their enemy (owner design 2026-07-14);
    // undiscovered enemies stay hidden until first sighted.
    const { isDiscovered } = useDiscovery();
    const usesEnemyTitle = card.cardType === 'invasion' || (card.cardType === 'combat' && enemyDef);
    const enemyTitle = enemyDef && !isDiscovered('enemy', enemyDef.id) ? '???' : enemyName;

    const threatLevel = Math.floor(threat / 20);
    const multVal = 1.0 + (threatLevel * 0.2);
    const multStr = multVal % 1 === 0 ? multVal.toFixed(0) : multVal.toFixed(1);

    return (
        <div className="flex flex-col relative z-10 w-full bg-black/30 py-2 px-3 rounded-t-xl border-b border-white/10">
            {/* Title */}
            <div className="flex flex-col items-center justify-center gap-1 mb-1 text-center relative">
                <span className="gi-card-title font-bold text-white tracking-widest uppercase">
                    {usesEnemyTitle ? enemyTitle : (card.name || template.name || 'Unknown Card')}
                </span>
            </div>

            {/* Horde and Threat grouped segment for Invasions */}
            {card.cardType === 'invasion' && (
                <div className="flex flex-col gap-1 w-full border-t border-white/5 pt-1.5 mt-1">
                    {/* Horde info */}
                    <div className="flex items-center justify-center py-1.5 px-3 bg-gi-danger/5 border border-gi-danger/10 rounded">
                        <span className="gi-outline-2 text-[10px] font-bold uppercase tracking-widest text-gi-danger font-display">
                            Defeat {enemyName} Horde - {count}/{total}
                        </span>
                    </div>
                    {/* Threat info */}
                    <div className="flex items-center justify-center py-1.5 px-3 bg-gi-warning/5 border border-gi-warning/10 rounded">
                        <span className="gi-outline-2 text-[10px] font-bold uppercase tracking-widest text-gi-warning font-display">
                            Threat {Math.floor(threat)}% - x{multStr} Task Time
                        </span>
                    </div>
                </div>
            )}

            {/* Tags (Matte GI Labels) */}
            {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-1 px-2">
                    {card.tags.map(tag => (
                        <span key={tag} className="gi-label-matte">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // Custom comparison to ensure re-render on card changes (including hordeCount/areaStates)
    return prev.card?._rev === next.card?._rev && prev.trait === next.trait;
});

export default CardHeaderModule;
