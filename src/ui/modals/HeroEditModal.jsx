import { useState, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { GIModal } from '../components/base/GIModal.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { HERO_PORTRAITS, HERO_NAME_MAX } from '../../config/registries/heroPortraits.js';
import { HeroSkillSheet } from '../components/hero/HeroSkillSheet.jsx';
import { previewRetirementInfluence } from '../../utils/RetirementFormula.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';
import { AlertTriangle, Check, Repeat } from 'lucide-react';

/**
 * HeroEditModal — **the hero's full sheet**, plus everything about them that
 * isn't drag-and-drop (roadmap D8): rename, repick their portrait, retire them.
 *
 * This is the home for the actions the retired Hero side drawer used to own.
 * The dock handles deploying, recalling and equipping by drag; this handles
 * the rest, opened by the Edit button on a pinned dock card.
 *
 * ⚠️ **It is also the only place banked skills are visible** (D-250). The dock
 * card shows the six a hero can use *now* and nothing else, because it is a
 * glance surface; what someone used to be able to do belongs where the decision
 * to re-train is actually made, which is here.
 */
export const HeroEditModal = ({ heroId, isOpen, onClose, onChangeJob }) => {
    const engine = useEngine();

    // Flat projection per the useGameState selector contract.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            return h ? { id: h.id, name: h.name, spriteId: h.spriteId, classId: h.classId } : null;
        },
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    const [name, setName] = useState('');
    const [spriteId, setSpriteId] = useState(null);
    const [confirmRetire, setConfirmRetire] = useState(false);

    // Seed the draft from the hero each time the modal opens on someone new.
    useEffect(() => {
        if (!isOpen || !hero) return;
        setName(hero.name);
        setSpriteId(hero.spriteId || hero.classId);
        setConfirmRetire(false);
    }, [isOpen, heroId]); // eslint-disable-line react-hooks/exhaustive-deps

    // The hero was retired (possibly from here) — close rather than render null.
    useEffect(() => {
        if (isOpen && heroId && !hero) onClose();
    }, [isOpen, heroId, hero, onClose]);

    if (!hero) return null;

    const trimmed = name.trim();
    const dirty = trimmed !== hero.name || spriteId !== (hero.spriteId || hero.classId);
    const canSave = trimmed.length > 0 && dirty;

    // Retirement is refused unless the payout beats the current recruit cost,
    // so the button explains itself rather than failing silently on click.
    const payout = previewRetirementInfluence(engine.HeroManager.getHero(heroId) || {});
    const recruitCost = calculateRecruitCost();
    const canRetire = payout > recruitCost;

    const handleSave = () => {
        engine.HeroManager.updateHeroProfile(heroId, { name: trimmed, spriteId });
        onClose();
    };

    const handleRetire = () => {
        if (!confirmRetire) return setConfirmRetire(true);
        const result = engine.HeroManager.retireHero(heroId);
        if (!result.success) {
            engine.EventBus.publish('ui:notify', {
                message: result.reason || 'Retirement blocked',
                type: 'error'
            });
            setConfirmRetire(false);
            return;
        }
        onClose();
    };

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title={`Edit ${hero.name}`} maxWidth="max-w-lg">
            <div className="flex flex-col gap-4 p-4">
                {/* What this hero IS, before what you can change about them.
                    This is the only surface in the game that shows banked
                    skills (D-250) — the dock card deliberately does not — so
                    it is also where a re-training decision gets made. */}
                <HeroSkillSheet heroId={heroId} />

                {/* The one action that changes what this hero IS, kept next to
                    the sheet it rewrites rather than buried with rename. */}
                <button
                    onClick={onChangeJob}
                    className={cn(
                        'flex items-center justify-center gap-1.5 px-2 py-2 rounded border',
                        'text-[10px] font-bold gi-caps tracking-wide transition-colors',
                        'border-gi-primary/50 bg-gi-primary/10 text-gi-text hover:bg-gi-primary/20'
                    )}
                >
                    <Repeat size={11} /> Change job
                </button>

                <div className="border-t border-gi-border/40" />

                {/* Name */}
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">Name</span>
                    <input
                        type="text"
                        value={name}
                        maxLength={HERO_NAME_MAX}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
                        className={cn(
                            'px-3 py-2 rounded border bg-black/40 text-gi-text text-sm',
                            'border-gi-border focus:border-gi-primary focus:outline-none transition-colors'
                        )}
                    />
                    <span className="text-[9px] text-gi-muted/70 tabular-nums self-end">
                        {trimmed.length}/{HERO_NAME_MAX}
                    </span>
                </label>

                {/* Portrait */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">Portrait</span>
                    <div className="grid grid-cols-8 gap-1.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                        {HERO_PORTRAITS.map(id => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSpriteId(id)}
                                title={id}
                                className={cn(
                                    'aspect-square rounded border flex items-center justify-center transition-colors',
                                    spriteId === id
                                        ? 'border-gi-primary bg-gi-primary/15'
                                        : 'border-gi-border/50 bg-black/30 hover:border-gi-muted'
                                )}
                                style={{ imageRendering: 'pixelated' }}
                            >
                                <ItemIcon item={{ sprite: id }} size={32} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Save */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded border border-gi-border text-[10px] font-bold gi-caps tracking-wide text-gi-muted hover:text-gi-text transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-bold gi-caps tracking-wide transition-colors',
                            canSave
                                ? 'border-gi-primary bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25'
                                : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                        )}
                    >
                        <Check size={11} /> Save
                    </button>
                </div>

                {/* Retire — the destructive action, kept apart from the rest */}
                <div className="pt-3 border-t border-gi-border/40 flex flex-col gap-1.5">
                    <button
                        onClick={handleRetire}
                        onMouseLeave={() => setConfirmRetire(false)}
                        disabled={!canRetire}
                        title={canRetire
                            ? `Retire ${hero.name} for ${payout} Influence`
                            : `Payout (${payout}) must exceed the recruit cost (${recruitCost})`}
                        className={cn(
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded border text-[10px] font-bold gi-caps tracking-wide transition-colors',
                            !canRetire
                                ? 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                                : confirmRetire
                                    ? 'border-gi-danger bg-gi-danger/20 text-gi-danger'
                                    : 'border-gi-border text-gi-muted hover:text-gi-danger hover:border-gi-danger'
                        )}
                    >
                        {confirmRetire
                            ? <><AlertTriangle size={11} /> Click again to confirm</>
                            : <>Retire (+{payout} Influence)</>}
                    </button>
                    {!canRetire && (
                        <span className="text-[9px] text-gi-muted/70 text-center">
                            This hero is worth less ({payout}) than a new recruit costs ({recruitCost}).
                            Level them up first.
                        </span>
                    )}
                </div>
            </div>
        </GIModal>
    );
};

export default HeroEditModal;
