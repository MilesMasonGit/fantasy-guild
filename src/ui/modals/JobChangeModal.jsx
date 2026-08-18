import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { GIModal } from '../components/base/GIModal.jsx';
import {
    getJob, getJobsByTier, JOB_TIERS, STARTING_JOB_ID
} from '../../config/registries/jobRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ArrowRight, Coins, Check, Lock } from 'lucide-react';

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
 * ## Ineligible jobs are shown, not hidden
 * With the reason, and the shortfall spelled out. A job that silently vanishes
 * from the list teaches nothing; one that says "Needs Mining 8/25" tells the
 * player exactly what to go and do.
 */
export const JobChangeModal = ({ heroId, isOpen, onClose }) => {
    const engine = useEngine();
    const [selected, setSelected] = useState(null);

    // Re-read on any hero change so the list reflects a promotion the moment
    // it lands (and so costs update as gold and materials move).
    const stamp = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            const skills = Object.entries(h.skills || {}).map(([k, v]) => `${k}:${v.level}`).join(',');
            return `${h.jobId}|${skills}|${state.currency?.gold ?? 0}`;
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

    const confirm = () => {
        const result = P.promote(heroId, selected);
        if (!result.success) {
            engine.EventBus.publish('ui:notify', {
                message: result.detail || 'That job is out of reach',
                type: 'error'
            });
            return;
        }
        engine.EventBus.publish('ui:notify', {
            message: `${hero.name} is now a ${getJob(selected).name}`,
            type: 'success'
        });
        setSelected(null);
        onClose();
    };

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
                                <TradeList
                                    title="Gives up"
                                    tone="loss"
                                    rows={preview.losing.map(l => `${l.name} ${l.level}`)}
                                />
                                <TradeList
                                    title="Gains"
                                    tone="gain"
                                    rows={preview.arriving.map(a =>
                                        `${a.name} ${a.level}${a.restored ? ' — back from set aside' : ''}`
                                    )}
                                />
                                {preview.cost && (
                                    <div className="flex flex-col gap-0.5 pt-1.5 border-t border-gi-border/30">
                                        <span className="text-[9px] gi-caps tracking-wider text-gi-muted/60">Cost</span>
                                        <span className="text-[10px] text-gi-text flex items-center gap-1">
                                            <Coins size={10} className="text-gi-gold" /> {preview.cost.gold}g
                                        </span>
                                        {(preview.cost.materials || []).map(m => (
                                            <span key={m.itemId} className="text-[10px] text-gi-text">
                                                {m.quantity}× {getItem(m.itemId)?.name || m.itemId}
                                            </span>
                                        ))}
                                        <span className="text-[9px] text-gi-muted/70">
                                            Carried skills at level {preview.cost.skillLevel}
                                        </span>
                                    </div>
                                )}
                                {!preview.ok && (
                                    <span className="text-[9px] text-gi-danger">{preview.detail}</span>
                                )}
                                <button
                                    onClick={confirm}
                                    disabled={!preview.ok}
                                    className={cn(
                                        'mt-auto flex items-center justify-center gap-1.5 px-2 py-2 rounded border',
                                        'text-[10px] font-bold gi-caps tracking-wide transition-colors',
                                        preview.ok
                                            ? 'border-gi-primary bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25'
                                            : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                                    )}
                                >
                                    <Check size={11} /> Become {getJob(selected)?.name}
                                </button>
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

const TradeList = ({ title, tone, rows }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[9px] gi-caps tracking-wider text-gi-muted/60">{title}</span>
        {rows.length === 0
            ? <span className="text-[10px] text-gi-muted/50 italic">nothing</span>
            : rows.map(r => (
                <span
                    key={r}
                    className={cn('text-[10px]', tone === 'loss' ? 'text-gi-danger/80' : 'text-gi-text')}
                >
                    {tone === 'loss' ? '−' : '+'} {r}
                </span>
            ))}
    </div>
);

export default JobChangeModal;
