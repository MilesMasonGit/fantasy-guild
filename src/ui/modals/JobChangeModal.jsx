import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { GIModal } from '../components/base/GIModal.jsx';
import {
    getJob, getJobsByTier, JOB_TIERS, STARTING_JOB_ID
} from '../../config/registries/jobRegistry.js';
import { PromotionTrade } from '../components/hero/PromotionTrade.jsx';
import { ArrowRight, Lock, GraduationCap } from 'lucide-react';

/**
 * JobChangeModal — where a hero becomes someone else.
 *
 * ## Promotion and re-training are one screen, deliberately (D-248)
 * There is no "undo" button and no separate reversal flow. Every job the hero
 * could move to is listed the same way, at the same price, whether it is a step
 * forward, a step sideways between siblings, or a step back to something they
 * held before. Presenting reversal as its own mechanism would have implied it
 * is a correction — it isn't, it is just another job.
 *
 * ## The trade is shown BEFORE the click, not after
 * "You will lose Fishing 23" *is* the decision. Discovering it afterwards is
 * not a decision at all, which is why `previewPromotion` exists and why this
 * screen refuses to have a confirm button until a job is selected and its
 * consequences are on screen.
 *
 * ## ⚠️ This screen PLANS a promotion; it no longer performs one (PR-9)
 * A promotion is paid for with a charge of a Token whose Promotes rule names
 * the job, and it happens on that Token's tile (Promotes rule P3). A confirm
 * button here would be a second route to the same act with no Token at all —
 * and once gold stopped being charged, a free one. What it keeps is what the
 * board cannot give you: the whole tree at once, with every shortfall spelled
 * out, so a player knows which hero to train toward what.
 *
 * ## Ineligible jobs are shown, not hidden
 * With the reason, and the shortfall spelled out. A job that silently vanishes
 * from the list teaches nothing; one that says "Needs Mining 8/25" tells the
 * player exactly what to go and do.
 */
export const JobChangeModal = ({ heroId, isOpen, onClose }) => {
    const engine = useEngine();
    const [selected, setSelected] = useState(null);

    // Re-read on any hero change so the list reflects a promotion the moment
    // it lands on the board.
    const stamp = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            const skills = Object.entries(h.skills || {}).map(([k, v]) => `${k}:${v.level}`).join(',');
            return `${h.jobId}|${skills}`;
        },
        ['heroes_updated', 'hero_promoted', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    if (!isOpen || !stamp) return null;

    const hero = engine.HeroManager.getHero(heroId);
    if (!hero) return null;

    const P = engine.PromotionSystem;
    const currentJob = getJob(hero.jobId);
    const preview = selected ? P.previewPromotion(heroId, selected) : null;

    const tiers = [
        { tier: JOB_TIERS.BASE, label: 'Base classes' },
        { tier: JOB_TIERS.ADVANCED, label: 'Advanced jobs' }
    ];

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title={`${hero.name} — ${currentJob?.name || hero.jobId}`}
            maxWidth="max-w-3xl"
        >
            <div className="flex flex-col gap-3 p-4">
                {/* ⚠️ This deliberately does NOT say "swaps two for two".
                    A step down the tree does, but a lateral move across
                    branches — Fighter to Rogue — swaps three, because the
                    combat skill and the shared specialist change too. The
                    per-job panel states the real trade; this line only has to
                    be true every time. */}
                <p className="text-[10px] text-gi-muted italic">
                    Changing job rewrites which skills this hero can use. Nothing is lost —
                    what comes off the sheet is set aside at its level, and comes back if a
                    later job uses it.
                </p>

                <div className="grid grid-cols-[1fr_auto] gap-4">
                    {/* The tree */}
                    <div className="flex flex-col gap-3 max-h-[22rem] overflow-y-auto custom-scrollbar pr-1">
                        {tiers.map(({ tier, label }) => (
                            <div key={tier} className="flex flex-col gap-1">
                                <span className="text-[9px] gi-caps tracking-wider text-gi-muted/60">{label}</span>
                                <div className="grid grid-cols-2 gap-1">
                                    {getJobsByTier(tier).map(jobId => (
                                        <JobRow
                                            key={jobId}
                                            jobId={jobId}
                                            verdict={P.canPromote(heroId, jobId)}
                                            isCurrent={hero.jobId === jobId}
                                            isSelected={selected === jobId}
                                            onSelect={() => setSelected(jobId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* The trade */}
                    <div className="w-56 shrink-0 flex flex-col gap-2">
                        {!preview ? (
                            <span className="text-[10px] text-gi-muted italic self-center mt-8 text-center">
                                Pick a job to see what it would cost {hero.name}.
                            </span>
                        ) : (
                            <>
                                {/* The same trade display the promotion ceremony
                                    draws (P4), so the two screens can never
                                    disagree about what a job costs a hero. */}
                                <PromotionTrade preview={preview} />
                                {/* Where the confirm button used to be (PR-9). The
                                    price is a Token, so this says where to go
                                    rather than offering a free way round it. */}
                                <div
                                    data-promotion-hint
                                    className="mt-auto flex items-start gap-1.5 px-2 py-2 rounded border border-gi-border/40 text-[10px] text-gi-muted"
                                >
                                    <GraduationCap size={11} className="shrink-0 mt-0.5" />
                                    <span>
                                        Promote on the board: stand {hero.name} on a Token that
                                        promotes to {getJob(selected)?.name}.
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </GIModal>
    );
};

/** One job in the tree, with its verdict on this hero. */
const JobRow = ({ jobId, verdict, isCurrent, isSelected, onSelect }) => {
    const job = getJob(jobId);
    const parent = getJob(job.parent);
    const locked = !verdict.ok && !isCurrent;

    return (
        <button
            type="button"
            onClick={onSelect}
            title={isCurrent ? 'Current job' : (verdict.detail || `Become a ${job.name}`)}
            className={cn(
                'flex flex-col gap-0.5 px-2 py-1.5 rounded border text-left transition-colors',
                isSelected
                    ? 'border-gi-primary bg-gi-primary/15'
                    : isCurrent
                        ? 'border-gi-gold/50 bg-gi-gold/10'
                        : 'border-gi-border/30 bg-black/20 hover:border-gi-muted',
                locked && !isSelected && 'opacity-60'
            )}
        >
            <span className="flex items-center gap-1 text-[10px] font-bold text-gi-text">
                {job.icon} {job.name}
                {isCurrent && <span className="text-[8px] text-gi-gold gi-caps">· current</span>}
                {locked && <Lock size={9} className="text-gi-muted ml-auto shrink-0" />}
            </span>
            {parent && parent.id !== STARTING_JOB_ID && (
                <span className="text-[8px] text-gi-muted/60 flex items-center gap-0.5">
                    {parent.name} <ArrowRight size={7} /> {job.name}
                </span>
            )}
            {locked && verdict.detail && (
                <span className="text-[8px] text-gi-danger/80 truncate">{verdict.detail}</span>
            )}
        </button>
    );
};

// The trade list that lived here moved to `components/hero/PromotionTrade.jsx`
// (Promotes rule P4): the ceremony draws the same trade, and two copies of
// "what this promotion costs you" is exactly the pair that drifts apart.

export default JobChangeModal;
