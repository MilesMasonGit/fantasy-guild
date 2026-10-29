import { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/cn.js';
import { HeroManager } from '../../systems/hero/HeroManager.js';
import { useGameState } from '../hooks/useGameState.js';
import { GIModal } from '../components/base/GIModal.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../components/base/KitButton.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { HERO_PORTRAITS, HERO_NAME_MAX } from '../../config/registries/heroPortraits.js';
import { Check, Repeat } from 'lucide-react';
import { FLAG_COLOURS, FLAG_COLOUR_LABELS, isFlagColour } from '../../systems/board/FlagColours.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';

/** A chosen portrait or flag: the white line and a little white over the well. */
const SWATCH_CHOSEN = 'border-[var(--color-ui-white)] bg-white/15';

/** A flag swatch's flag, in px: the job flag at twice the mat's usual size. */
export const SWATCH_FLAG_PX = 40;

/**
 * HeroEditModal: everything about a hero that isn't drag-and-drop: rename, repick their
 * portrait, flag colour, change job. Opened by the Edit button on the hero panel, which shows
 * their skills (held, banked and locked); this modal does not repeat them.
 * The name and portrait wait for Save. A flag colour is put on the hero the moment it is picked,
 * so their flag on the mat, the roster and the panel changes at once; Save keeps it, Cancel (or
 * closing) puts back the colour they had when the modal opened.
 */
export const HeroEditModal = ({ heroId, isOpen, onClose, onChangeJob }) => {

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
    // The colour the hero had when the modal opened, put back on Cancel.
    const openingColour = useRef(null);

    // Seed the draft from the hero each time the modal opens on someone new.
    useEffect(() => {
        if (!isOpen || !hero) return;
        setName(hero.name);
        setSpriteId(hero.spriteId || hero.classId);
        openingColour.current = hero.flagColour;
    }, [isOpen, heroId]); // eslint-disable-line react-hooks/exhaustive-deps

    // The hero is gone from the roster — close rather than render null.
    useEffect(() => {
        if (isOpen && heroId && !hero) onClose();
    }, [isOpen, heroId, hero, onClose]);

    if (!hero) return null;

    const trimmed = name.trim();
    const flagColour = hero.flagColour;
    const dirty = trimmed !== hero.name
        || spriteId !== (hero.spriteId || hero.classId)
        || flagColour !== openingColour.current;
    const canSave = trimmed.length > 0 && dirty;

    const pickColour = (colour) => {
        if (colour !== flagColour) HeroManager.updateHeroProfile(heroId, { flagColour: colour });
    };

    const handleSave = () => {
        HeroManager.updateHeroProfile(heroId, { name: trimmed, spriteId });
        onClose();
    };

    const handleCancel = () => {
        const was = openingColour.current;
        if (isFlagColour(was) && was !== flagColour) HeroManager.updateHeroProfile(heroId, { flagColour: was });
        onClose();
    };

    return (
        <GIModal isOpen={isOpen} onClose={handleCancel} title={`Edit ${hero.name}`} maxWidth="max-w-lg">
            <div className="flex flex-col gap-4 p-4">
                <KitButton
                    tone={KIT_BUTTON_TONE.PLAIN}
                    onClick={onChangeJob}
                    className="w-full"
                    buttonClassName="py-1.5 ui-text-body gi-caps tracking-wide"
                >
                    <Repeat size={11} /> Change job
                </KitButton>

                <div className="border-t border-gi-border/40" />

                <label className="flex flex-col gap-1.5">
                    <span className="ui-text-body font-bold gi-caps tracking-widest text-gi-muted">Name</span>
                    <input
                        type="text"
                        value={name}
                        maxLength={HERO_NAME_MAX}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
                        className="ui-pixel-edge px-3 py-2 bg-black/40 text-gi-text text-sm focus:outline-none transition-colors"
                    />
                    <span className="ui-text-body text-gi-muted/70 tabular-nums self-end">
                        {trimmed.length}/{HERO_NAME_MAX}
                    </span>
                </label>

                <div className="flex flex-col gap-1.5">
                    <span className="ui-text-body font-bold gi-caps tracking-widest text-gi-muted">Portrait</span>
                    <div className="grid grid-cols-8 gap-1.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                        {HERO_PORTRAITS.map(id => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSpriteId(id)}
                                title={id}
                                className={cn(
                                    'ui-slot-empty aspect-square flex items-center justify-center transition-colors cursor-pointer',
                                    spriteId === id && SWATCH_CHOSEN
                                )}
                                style={{ imageRendering: 'pixelated' }}
                            >
                                <ItemIcon item={{ sprite: id }} size={32} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Flag colour: each swatch is the hero's job flag in that colour. */}
                <div className="flex flex-col gap-1.5">
                    <span className="ui-text-body font-bold gi-caps tracking-widest text-gi-muted">Flag colour</span>
                    <div className="grid grid-cols-8 gap-1.5 p-1">
                        {FLAG_COLOURS.map(colour => (
                            <button
                                key={colour}
                                type="button"
                                data-flag-swatch={colour}
                                aria-pressed={flagColour === colour}
                                onClick={() => pickColour(colour)}
                                title={FLAG_COLOUR_LABELS[colour]}
                                className={cn(
                                    'ui-slot-empty aspect-square flex items-center justify-center overflow-hidden transition-colors cursor-pointer',
                                    flagColour === colour && SWATCH_CHOSEN
                                )}
                            >
                                <FlagMark size={SWATCH_FLAG_PX} colour={colour} alt={`${FLAG_COLOUR_LABELS[colour]} flag`} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={handleCancel} buttonClassName="px-3 py-1 ui-text-body gi-caps tracking-wide">
                        Cancel
                    </KitButton>
                    <KitButton onClick={handleSave} disabled={!canSave} className="mr-1 mb-1" buttonClassName="px-3 py-1 ui-text-body gi-caps tracking-wide">
                        <Check size={11} /> Save
                    </KitButton>
                </div>
            </div>
        </GIModal>
    );
};

export default HeroEditModal;
