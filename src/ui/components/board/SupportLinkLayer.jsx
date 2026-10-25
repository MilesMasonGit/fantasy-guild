import { memo, useEffect, useMemo } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { placementCandidates, linksAt, LINK } from '../../../systems/board/supportLinks.js';
import { useTokenDragLanding } from './MatRings.jsx';
import { MAT_Z } from './matLayers.js';
import { SpeechFrame } from './SpeechFrame.jsx';
import { SPEECH_TONE } from './speechTone.js';
import { supportTag } from './supportTags.js';
import { setLit } from './supportLit.js';
import { useMatFit } from './MatFitContext.jsx';
import { plateUnit } from './workPlate.js';

/** Clear air between the top of a Token's art and the tail of its tag, in mat units. */
const GAP_PX = 6;

/**
 * While a Token is in the hand, the Tokens it would trade support with where it would land light
 * up (their white outline, `supportLit`) and each wears a small tag of what passes: over a Token it
 * would help, the effect it would get, in the gold frame ("−50 % grow"); over one that would help
 * it, what it gives, in the plain frame ("gives ×2 Wheat 25 %").
 *
 * ⚠️ Cheap by construction: who could link with the held Token is worked out once, as the drag
 * starts (`placementCandidates`); each frame only measures those few against the landing that
 * `MatRings` already works out, and the tags and outlines redraw only when the set changes.
 */
export const SupportLinkLayer = memo(function SupportLinkLayer({ matRef = null }) {
    const { activePayload, isDragging } = useActiveDrag();
    const held = isDragging && activePayload?.kind === DRAG_KIND.TOKEN ? activePayload : null;
    const candidates = useMemo(
        () => (held ? placementCandidates(held.typeId, held.from?.instanceId || null) : []),
        [held]
    );
    const landing = useTokenDragLanding(matRef);
    const links = candidates.length ? linksAt(candidates, landing) : [];
    const key = links.map(c => c.id).join('|');

    useEffect(() => {
        setLit(key ? key.split('|') : []);
    }, [key]);
    useEffect(() => () => setLit([]), []);

    const fit = useMatFit() || 1;
    const u = plateUnit(fit);
    const tags = useMemo(() => links.map(c => ({
        id: c.id,
        x: c.x,
        top: c.y - artRadiusOf(c.typeId) - GAP_PX,
        lines: c.links.map((l, i) => ({
            key: i,
            tone: l.role === LINK.HELPS ? SPEECH_TONE.ATTENTION : SPEECH_TONE.PLAIN,
            role: l.role,
            text: l.role === LINK.HELPS ? supportTag(l.payload) : `gives ${supportTag(l.payload)}`
        }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [key, candidates]);

    if (!tags.length) return null;
    return (
        <div data-support-links className="absolute left-0 top-0 w-0 h-0 pointer-events-none" style={{ zIndex: MAT_Z.CALLOUT }}>
            {tags.map(t => (
                <div
                    key={t.id}
                    data-support-link={t.id}
                    className="absolute flex flex-col-reverse items-center gap-1"
                    style={{ left: 0, top: 0, transform: `translate(${t.x}px, ${t.top}px) translate(-50%, -100%)` }}
                >
                    {t.lines.map((l, i) => (
                        <SpeechFrame
                            key={l.key}
                            tone={l.tone}
                            u={u}
                            tail={i === 0}
                            data-support-tag={l.role}
                            className="whitespace-nowrap ui-text-body font-bold"
                        >
                            {l.text}
                        </SpeechFrame>
                    ))}
                </div>
            ))}
        </div>
    );
});

export default SupportLinkLayer;
