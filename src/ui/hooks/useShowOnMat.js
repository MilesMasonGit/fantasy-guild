import { useEffect, useRef } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../systems/core/engineEvents.js';
import { GLIDE_MS } from '../components/board/HallCamera.jsx';
import { pulseSubjects } from '../components/notifications/bannerHighlight.js';

/**
 * A banner that points to its Token was clicked (`UI_EVENTS.SHOW_ON_MAT`): from the World Map or
 * the Guild Hall the view goes back to the mat, and once the camera is home the Token pulses gold
 * (`pulseSubjects`). The Encyclopedia lies over the mat with no camera move: it closes and the
 * Token pulses at once, as it does on the mat.
 * @param {{awayOpen: boolean, bookOpen?: boolean, backToMat: () => void}} options `awayOpen`: the
 *   World Map or the Hall is the view; `bookOpen`: the Encyclopedia is; `backToMat` closes either
 */
export function useShowOnMat({ awayOpen, bookOpen = false, backToMat }) {
    const live = useRef({ awayOpen, bookOpen, backToMat });
    live.current = { awayOpen, bookOpen, backToMat };
    useEffect(() => EventBus.subscribe(UI_EVENTS.SHOW_ON_MAT, (p) => {
        const subjects = Array.isArray(p?.subjects) ? p.subjects : [];
        if (!subjects.length) return;
        const { awayOpen: away, bookOpen: book, backToMat: back } = live.current;
        if (away || book) back();
        pulseSubjects(subjects, { delayMs: away ? GLIDE_MS : 0 });
    }, UI_LISTENER), []);
}
