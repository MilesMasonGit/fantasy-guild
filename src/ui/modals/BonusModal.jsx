import React, { useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import GIModal from '../components/base/GIModal.jsx';
import GISurface from '../components/base/GISurface.jsx';
import { Sparkles, Globe, MapPin, Zap } from 'lucide-react';

/**
 * BonusModal
 * Displays all active Global and Local bonuses from Projects and Mastery.
 */
const BonusModal = ({ isOpen, onClose }) => {
    const engine = useEngine();
    
    // Subscribe to state revision to refresh bonuses when progress/cards change
    const stateRev = useGameState(state => state.meta?._rev, ['cards_updated']);
    const activeAreaId = useGameState(state => state.ui?.activeAreaId, ['area_switched']);

    const { global, local } = useMemo(() => {
        if (!engine.MasterySystem) return { global: [], local: [] };
        // We pass the activeAreaId through the context logic indirectly via getAllActiveBonuses
        return engine.MasterySystem.getAllActiveBonuses();
    }, [engine, stateRev, activeAreaId]);

    return (
        <GIModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Guild Bonuses" 
            maxWidth="max-w-2xl"
        >
            <div className="flex flex-col gap-8 p-1">
                
                {/* Global Section */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 border-b border-gi-primary/20 pb-2">
                        <div className="p-2 bg-gi-primary/20 rounded-lg">
                            <Globe size={18} className="text-gi-primary" />
                        </div>
                        <div>
                            <h3 className="font-display font-bold uppercase tracking-wider text-sm leading-none mb-1">Global Effects</h3>
                            <p className="text-[10px] text-gi-muted uppercase tracking-tighter">Persistent across all areas</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-2">
                        {global.length > 0 ? global.map((bonus, idx) => (
                            <BonusEntry key={`${bonus.id}_${idx}`} bonus={bonus} />
                        )) : (
                            <div className="text-xs text-gi-muted italic p-6 bg-gi-base/20 rounded-xl border border-dashed border-gi-border/20 flex items-center justify-center">
                                No active global bonuses.
                            </div>
                        )}
                    </div>
                </section>Section ends here

                {/* Local Section */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 border-b border-gi-accent/20 pb-2">
                        <div className="p-2 bg-gi-accent/20 rounded-lg">
                            <MapPin size={18} className="text-gi-accent" />
                        </div>
                        <div>
                            <h3 className="font-display font-bold uppercase tracking-wider text-sm leading-none mb-1">Local Area Effects</h3>
                            <p className="text-[10px] text-gi-muted uppercase tracking-tighter">Only active in the current biome</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-2">
                        {local.length > 0 ? local.map((bonus, idx) => (
                            <BonusEntry key={`${bonus.id}_${idx}`} bonus={bonus} />
                        )) : (
                            <div className="text-xs text-gi-muted italic p-6 bg-gi-base/20 rounded-xl border border-dashed border-gi-border/20 flex items-center justify-center">
                                No active local bonuses in this area.
                            </div>
                        )}
                    </div>
                </section>

                {/* Footer Info */}
                <GISurface className="mt-2 p-5 rounded-2xl bg-gi-primary/5 border border-gi-primary/10 flex gap-5 items-start">
                    <div className="p-2 bg-gi-primary/20 rounded-full shrink-0">
                        <Zap size={20} className="text-gi-primary" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gi-text uppercase tracking-wide mb-1">How Bonuses Work</h4>
                        <p className="text-[11px] text-gi-muted leading-relaxed opacity-80">
                            <strong>Global</strong> bonuses are permanently unlocked via Area Mastery (completing the local Codex or Quests) and certain Project upgrades. 
                            <strong>Local</strong> bonuses are provided by specialized Buildings or Rituals that must be present on your playmat to take effect.
                        </p>
                    </div>
                </GISurface>
            </div>
        </GIModal>
    );
};

const BonusEntry = ({ bonus }) => (
    <GISurface className="p-4 flex justify-between items-center bg-gi-surface/40 border-gi-border/30 hover:border-gi-primary/40 hover:bg-gi-surface/60 transition-all group rounded-xl">
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gi-text group-hover:text-gi-primary transition-colors tracking-wide">
                {bonus.description}
            </span>
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest opacity-60">
                    Source:
                </span>
                <span className="text-[9px] font-bold text-gi-primary uppercase tracking-widest">
                    {bonus.source}
                </span>
            </div>
        </div>
        <div className="p-2 rounded-lg bg-gi-primary/5 border border-gi-primary/10 group-hover:rotate-12 transition-transform">
            <Sparkles size={14} className="text-gi-primary opacity-80" />
        </div>
    </GISurface>
);

export default BonusModal;
