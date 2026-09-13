import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { useEngine } from '../hooks/useEngine.js';
import { GIModal } from '../components/base/GIModal.jsx';
import { PromotionTrade } from '../components/hero/PromotionTrade.jsx';
import { getJob } from '../../config/registries/jobRegistry.js';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Why an acceptance was refused, in words a player can act on.
 *
 * `BoardPromotion.accept` re-checks everything at the moment of the click and
 * returns a reason code rather than prose (Promotes rule P3). The ceremony is
 * where the player reads it, beside the button they just pressed.
 */
function refusalText(result) {
    if (result?.detail) return result.detail;
    switch (result?.reason) {
        case 'NO_CHARGES': return 'This Token no longer has the charges to pay for it.';
        case 'NO_OFFER': return 'This offer is no longer standing.';
        case 'SAME_JOB': return 'Your hero already holds this job.';
        case 'SKILL_TOO_LOW': return 'Your hero no longer meets the skill requirement.';
        default: return 'That promotion is no longer possible.';
    }
}

/**
 * The moment a hero becomes someone else.
 *
 * Ported from the unmerged `promotion-tokens` branch (Promotes rule P4). The
 * offer now comes from a Token's **Promotes rule**; everything the player sees
 * and chooses is the branch's, as the owner approved it.
 *
 * ## Why this exists when the Change Job screen already shows the trade
 * The Change Job screen is for planning: a tree, a list, small text. This is
 * the payoff for a Token the player went and found, at the end of a training
 * cycle they watched run. Same information — the same component renders the
 * trade — but one answers "what would this cost?" and this answers "do it?".
 *
 * ## Two ways out, and neither is the corner X
 * Accept and Decline, both explicit. Declining is a real choice with a real
 * outcome (the tile holds, nothing is spent), not a dismissal — so it gets a
 * button that says what it does. `hideClose` removes the corner X and makes the
 * backdrop inert, so an accidental click outside never becomes an unrecorded
 * answer.
 *
 * ## Nothing has happened yet
 * When this opens, no skill has moved and no charge has been spent. The Token
 * holds the offer (`promotionPaused` on the instance, which is saved board
 * state), so the player can close the game mid-decision and be asked again.
 */
export const PromotionCeremonyModal = ({ offer, onClose }) => {
    const engine = useEngine();
    const [done, setDone] = useState(null);

    if (!offer) return null;

    const hero = engine.HeroManager.getHero(offer.heroId);
    if (!hero) return null;

    const job = getJob(offer.jobId);
    if (!job) return null;

    // ⚠️ **Both of these must be SNAPSHOT before the promotion, not read after
    // it.** `previewPromotion` diffs the hero's CURRENT sheet against the
    // target, and `hero.jobId` is the job they hold right now — so the instant
    // the promotion lands, the preview reports "nothing changes" and the arrow
    // reads "Wizard → Wizard". The moment the player most wants to see what they
    // gave up is the moment after they gave it up, so the answered state renders
    // the frozen copy. (A bug found by playing, on the branch.)
    const livePreview = engine.PromotionSystem.previewPromotion(offer.heroId, offer.jobId);
    const preview = done?.preview || livePreview;
    const fromJob = done?.fromJob || getJob(hero.jobId);

    const accept = () => {
        // Captured first — `accept` mutates the hero.
        const snapshot = { preview: livePreview, fromJob: getJob(hero.jobId) };
        const result = engine.BoardPromotion.accept(offer.tile);
        if (!result.success) {
            // Re-checked at the last moment and refused — say so rather than
            // closing silently, because the tile will still be holding.
            setDone({ ...snapshot, failed: true, detail: refusalText(result) });
            return;
        }
        setDone({ ...snapshot, failed: false });
    };

    const decline = () => {
        engine.BoardPromotion.decline(offer.tile);
        onClose();
    };

    return (
        <GIModal
            isOpen
            hideClose
            title={done && !done.failed ? 'Promotion complete' : 'Training complete'}
            maxWidth="max-w-md"
        >
            <div className="flex flex-col gap-4 p-5" data-promotion-ceremony>
                {/* Who, becoming what. The whole point of the screen, said big. */}
                <div className="flex items-center justify-center gap-3 py-2">
                    <div className="flex flex-col items-center gap-0.5 opacity-60">
                        <span className="text-2xl">{fromJob?.icon || '🧑'}</span>
                        <span className="text-[10px] gi-caps tracking-wider text-gi-muted" data-from-job>
                            {fromJob?.name || hero.jobId}
                        </span>
                    </div>
                    <ArrowRight size={16} className="text-gi-muted/50 shrink-0" />
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-4xl">{job.icon}</span>
                        <span className="text-[12px] font-bold gi-caps tracking-wider text-gi-gold" data-to-job>
                            {job.name}
                        </span>
                    </div>
                </div>

                <p className="text-center text-[12px] text-gi-text">
                    <span className="font-bold">{hero.name}</span>
                    {done && !done.failed
                        ? <> is now a <span className="text-gi-gold font-bold">{job.name}</span>.</>
                        : <> has finished training. Make it official?</>}
                </p>

                {job.description && !done && (
                    <p className="text-center text-[11px] text-gi-muted italic">{job.description}</p>
                )}

                {/* The trade — the same component the Change Job screen uses, so
                    the two can never disagree about what this costs. */}
                <div className="rounded-lg border border-gi-border/30 bg-black/20 p-3">
                    <PromotionTrade preview={preview} size="lg" />
                </div>

                {!done && (
                    <p className="text-center text-[10px] text-gi-muted/70">
                        Nothing is set aside for good — a skill that comes off the sheet keeps
                        its level and returns if a later job needs it.
                    </p>
                )}

                {done?.failed && (
                    <p className="text-center text-[11px] text-gi-danger" data-promotion-refusal>{done.detail}</p>
                )}

                <div className="flex gap-2">
                    {done ? (
                        <button
                            onClick={onClose}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border',
                                'text-[11px] font-bold gi-caps tracking-wide transition-colors',
                                'border-gi-primary bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25'
                            )}
                        >
                            Done
                        </button>
                    ) : (
                        <>
                            {/* Decline is a real answer, not a dismissal, so it
                                says what happens: nothing is spent, and the
                                hero stays put. */}
                            {/* ⚠️ Named explicitly. With only a `title`, the
                                button is announced by its tooltip ("Nothing is
                                spent…") rather than by what it says — found in
                                the browser, P4. */}
                            <button
                                onClick={decline}
                                aria-label="Not yet"
                                title="Nothing is spent. Your hero stays where they are, and the Token waits."
                                className={cn(
                                    'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border',
                                    'text-[11px] font-bold gi-caps tracking-wide transition-colors',
                                    'border-gi-border/50 text-gi-muted hover:border-gi-muted hover:text-gi-text'
                                )}
                            >
                                <X size={12} /> Not yet
                            </button>
                            <button
                                onClick={accept}
                                disabled={!preview?.ok}
                                title={preview?.ok ? undefined : preview?.detail}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border',
                                    'text-[11px] font-bold gi-caps tracking-wide transition-colors',
                                    preview?.ok
                                        ? 'border-gi-gold bg-gi-gold/20 text-gi-text hover:bg-gi-gold/30'
                                        : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                                )}
                            >
                                {preview?.ok ? <Sparkles size={12} /> : <Check size={12} />}
                                Become {job.name}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </GIModal>
    );
};

export default PromotionCeremonyModal;
