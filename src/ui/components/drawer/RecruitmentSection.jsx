import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { RecruitSystem } from '../../../systems/cards/RecruitSystem.js';
import { User, Coins, Beer, Dices } from 'lucide-react';

/**
 * RecruitmentSection — roll candidates + hire with Influence. Lived in the
 * Heroes pane through Phase 3; its home is the Guild Hall's Recruitment
 * Center from overhaul Phase 4 on (spec §COMP-GUILD / §COMP-HERO
 * "No Recruitment" in the roster pane).
 */
export const RecruitmentSection = () => {
    const engine = useEngine();
    const influence = useGameState(state => state.currency?.influence || 0, ['currency_changed']);
    const candidates = useGameState(state => state.recruitment?.candidates || [], ['recruitment_updated']);
    const cost = RecruitSystem.getRecruitCost();
    const canAfford = influence >= cost;

    return (
        <section>
            <div className="flex items-baseline gap-3 mb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gi-primary gi-caps tracking-widest">
                    <Beer size={12} /> Recruitment Center
                </span>
                <span className="text-[9px] text-gi-muted italic">
                    Influence: {influence} · next hire costs {cost}
                </span>
            </div>
            {candidates.length === 0 ? (
                <button
                    onClick={() => RecruitSystem.rollCandidates()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gi-gold/50 bg-gi-gold/10 text-xs font-bold gi-caps tracking-wide text-gi-text hover:bg-gi-gold/20 transition-colors"
                >
                    <Dices size={14} className="text-gi-gold" /> Find Candidates
                </button>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {candidates.map(candidate => (
                        <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            cost={cost}
                            canAfford={canAfford}
                            onHire={() => {
                                const result = RecruitSystem.hireCandidate(candidate.id);
                                if (!result.success) {
                                    engine.EventBus.publish('ui:notify', { message: result.error, type: 'error' });
                                }
                            }}
                        />
                    ))}
                    <span className="basis-full text-[9px] text-gi-muted italic">
                        Hiring one candidate dismisses the others.
                    </span>
                </div>
            )}
        </section>
    );
};

const CandidateCard = ({ candidate, cost, canAfford, onHire }) => {
    const className = getClass(candidate.classId)?.name || candidate.classId || 'Hero';
    const traitName = getTrait(candidate.traitId)?.name || '';
    const notableSkills = Object.entries(candidate.skills || {})
        .filter(([, s]) => (s?.level ?? 1) > 1)
        .sort((a, b) => (b[1].level || 0) - (a[1].level || 0))
        .slice(0, 3);

    return (
        <div className="w-48 rounded-lg border border-gi-border bg-gi-base/60 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full border-2 border-gi-gold/50 bg-gi-gold/10 flex items-center justify-center text-sm font-black gi-caps text-gi-text shrink-0">
                    {candidate.name?.[0] || <User size={13} />}
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] font-bold text-gi-text truncate">{candidate.name}</div>
                    <div className="text-[9px] text-gi-muted truncate">{className}{traitName ? ` · ${traitName}` : ''}</div>
                </div>
            </div>
            {notableSkills.length > 0 && (
                <div className="flex flex-col gap-0.5">
                    {notableSkills.map(([skillId, s]) => (
                        <span key={skillId} className="text-[9px] text-gi-muted capitalize">{skillId} Lv {s.level}</span>
                    ))}
                </div>
            )}
            <button
                onClick={onHire}
                disabled={!canAfford}
                className={cn(
                    'mt-auto flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-[10px] font-bold gi-caps tracking-wide transition-colors',
                    canAfford
                        ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                        : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                )}
            >
                <Coins size={10} className="text-gi-gold" /> Hire ({cost})
            </button>
        </div>
    );
};

export default RecruitmentSection;
