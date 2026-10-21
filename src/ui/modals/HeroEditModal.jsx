import { useState, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { GIModal } from '../components/base/GIModal.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { HERO_PORTRAITS, HERO_NAME_MAX } from '../../config/registries/heroPortraits.js';
import { Check, Repeat } from 'lucide-react';
import { FLAG_COLOURS, isFlagColour } from '../../systems/board/FlagColours.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * HeroEditModal: everything about a hero that isn't drag-and-drop: rename, repick their
 * portrait, flag colour, change job. Opened by the Edit button on the hero panel, which shows
 * their skills (held, banked and locked); this modal does not repeat them.
 */
export const HeroEditModal = ({ heroId, isOpen, onClose, onChangeJob }) => {
    const engine = useEngine();

    // Flat projection per the useGameState selector contract.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            return h ? {
                id: h.id, name: h.name, spriteId: h.spriteId, classId: h.classId,
                flagColour: isFlagColour(h.flagColour) ? h.flagColour : null
            } : null;
        },
        [ENGINE_EVENTS.HEROES_UPDATED],
        null,
        { deps: [heroId] }
    );

    const [name, setName] = useState('');
    const [spriteId, setSpriteId] = useState(null);
    // The hero's lasting flag colour. Null until their first plant.
    const [flagColour, setFlagColour] = useState(null);

    // Seed the draft from the hero each time the modal opens on someone new.
    useEffect(() => {
        if (!isOpen || !hero) return;
        setName(hero.name);
        setSpriteId(hero.spriteId || hero.classId);
        setFlagColour(hero.flagColour);
    }, [isOpen, heroId]); // eslint-disable-line react-hooks/exhaustive-deps

    // The hero is gone from the roster — close rather than render null.
    useEffect(() => {
        if (isOpen && heroId && !hero) onClose();
    }, [isOpen, heroId, hero, onClose]);

    if (!hero) return null;

    const trimmed = name.trim();
    const dirty = trimmed !== hero.name
        || spriteId !== (hero.spriteId || hero.classId)
        || flagColour !== hero.flagColour;
    const canSave = trimmed.length > 0 && dirty;

    const handleSave = () => {
        engine.HeroManager.updateHeroProfile(heroId, {
            name: trimmed,
            spriteId,
            ...(flagColour ? { flagColour } : {})
        });
        onClose();
    };

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title={`Edit ${hero.name}`} maxWidth="max-w-lg">
            <div className="flex flex-col gap-4 p-4">
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

                {/**
                 * Flag colour: the hero's lasting flag, drawn with the flag sprite itself.
                 * Full hero recolouring is later.
                 */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">Flag colour</span>
                    <div className="grid grid-cols-8 gap-1.5 p-1">
                        {FLAG_COLOURS.map(colour => (
                            <button
                                key={colour}
                                type="button"
                                data-flag-swatch={colour}
                                aria-pressed={flagColour === colour}
                                onClick={() => setFlagColour(colour)}
                                title={colour}
                                className={cn(
                                    'aspect-square rounded border flex items-center justify-center overflow-hidden transition-colors',
                                    flagColour === colour
                                        ? 'border-gi-primary bg-gi-primary/15'
                                        : 'border-gi-border/50 bg-black/30 hover:border-gi-muted'
                                )}
                            >
                                <FlagMark colour={colour} size={40} alt={`${colour} flag`} />
                            </button>
                        ))}
                    </div>
                </div>

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
            </div>
        </GIModal>
    );
};

export default HeroEditModal;
