import { memo, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { snapToArt } from './reachDot.js';
import { onFrame } from './frameClock.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import {
    subscribeFlashes, currentFlashes, dropFlashes, flashFrame, drawFlashFrame, flashEndMs, flashExtent
} from './levelUpFlash.js';

/** Where a hero's point is now: the mat's list, or the walk's own reading for a hero on the move. */
function heroPoint(heroes, heroId) {
    const h = heroes.find(x => x.heroId === heroId);
    if (!h) return null;
    return h.x == null ? HeroMotion.bodyView(heroId) : h;
}

/**
 * The level-up flashes playing (`levelUpFlash.js`), each a canvas of one pixel per art pixel,
 * centred on its hero's centre cell and following them, scaled up to the mat's art scale with no
 * smoothing. Over the heroes with the rings (`MAT_Z.RINGS`), clipped to the mat, never in the
 * pointer's way. Drawn on the frame clock only while a flash plays; each is let go once played
 * out, and with none left the layer draws nothing and asks for no frames.
 */
export const LevelUpFlashLayer = memo(function LevelUpFlashLayer({ heroes }) {
    const list = useSyncExternalStore(subscribeFlashes, currentFlashes);
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const heroesRef = useRef(heroes);
    heroesRef.current = heroes;
    const canvases = useRef(new Map());

    useLayoutEffect(() => {
        if (!list.length) return undefined;
        let stop = null;
        const draw = (now) => {
            const done = [];
            for (const f of list) {
                const el = canvases.current.get(f.id);
                const t = now - f.at;
                if (t >= flashEndMs(f.size)) { done.push(f.id); continue; }
                if (!el) continue;
                const at = heroPoint(heroesRef.current, f.heroId);
                if (!at) { el.style.visibility = 'hidden'; continue; }
                const e = flashExtent(f.size);
                el.style.visibility = '';
                el.style.transform = `translate(${snapToArt(at.x, artScale) - e * artScale}px, ${snapToArt(at.y, artScale) - e * artScale}px)`;
                const g = el.getContext?.('2d');
                if (!g) continue;
                g.clearRect(0, 0, el.width, el.height);
                drawFlashFrame(g, flashFrame(f.size, Math.max(0, t), f.seed), e, e);
            }
            if (done.length) {
                if (stop) stop();
                stop = null;
                dropFlashes(done);
            }
        };
        draw(performance.now());
        stop = onFrame(draw);
        return () => {
            if (stop) stop();
            stop = null;
        };
    }, [list, artScale]);

    if (!list.length) return null;
    return (
        <div
            data-levelup-burst-layer
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.RINGS, borderRadius: MAT_EDGE.radius }}
        >
            {list.map(f => {
                const side = 2 * flashExtent(f.size) + 1;
                return (
                    <canvas
                        key={f.id}
                        data-levelup-burst={f.heroId}
                        data-levelup-burst-size={f.size}
                        ref={el => { if (el) canvases.current.set(f.id, el); else canvases.current.delete(f.id); }}
                        width={side}
                        height={side}
                        className="absolute left-0 top-0 pointer-events-none"
                        style={{ width: side * artScale, height: side * artScale, imageRendering: 'pixelated', visibility: 'hidden' }}
                    />
                );
            })}
        </div>
    );
});
