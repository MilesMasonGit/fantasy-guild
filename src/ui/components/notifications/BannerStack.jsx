import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Banners from '../../../systems/notifications/banners.js';
import { TONE, BANNER_KINDS } from '../../../systems/notifications/bannerKinds.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { cn } from '../../utils/cn.js';
import { outlineSubjects } from './bannerHighlight.js';

/**
 * The banners: what the player must not miss, at the top centre of the mat, dropping from behind
 * the top bar with one small overshoot. A big sprite on the left, a title and one line, in a
 * studded frame with a gold edge for a milestone and a red one for a problem (placeholder frames
 * until the owner's ribbon). A milestone gets one pass of the shine.
 *
 * Each stays until clicked, and a click dismisses it. Up to three stack, newest on top; past
 * three a "+N" tab counts the rest. Hovering a banner about a hero or a Token outlines it on the
 * mat (gold; red for a problem). A kind that `pointsTo` its Token (an event's) also asks, as it is
 * clicked, for that Token to be shown on the mat (`UI_EVENTS.SHOW_ON_MAT`): from the World Map or
 * the Guild Hall back to the mat, then a short gold pulse on it.
 *
 * Drawn on the mat's side of the cameras; over the World Map and the Guild Hall a second stack
 * (`away`) shows only the kinds that point to a Token, so an event can be reached from there.
 */

export const BANNER_WIDTH_PX = 480;
/** The sprite box: item art (32 px) at 2x, hero faces and upgrade icons (64 px) at 1x. */
const SPRITE_PX = 64;
/** How long the lift takes before the banner is gone (`gi-banner-lift`). */
const LIFT_MS = 200;

const BannerSprite = ({ sprite }) => {
    if (!sprite) return <div style={{ width: SPRITE_PX, height: SPRITE_PX }} />;
    if (sprite.kind === 'item') {
        return <ItemIcon item={sprite.id} size={SPRITE_PX} title={null} className="shrink-0" />;
    }
    // A Token (an event's): its board art at 1x.
    if (sprite.kind === 'token') {
        return (
            <span data-banner-token={sprite.id} className="shrink-0 flex items-center justify-center" style={{ width: SPRITE_PX, height: SPRITE_PX }}>
                <TokenSprite typeId={sprite.id} surface={TOKEN_SURFACE.INSPECT} size={SPRITE_PX} alt="" />
            </span>
        );
    }
    // A place: a square of its area banner at 1x, never shrunk.
    if (sprite.kind === 'area') {
        return (
            <div data-banner-area={sprite.id} className="relative shrink-0 overflow-hidden" style={{ width: SPRITE_PX, height: SPRITE_PX }}>
                <BannerArt banner={sprite.id} scale={1} />
            </div>
        );
    }
    return (
        <img
            src={sprite.src}
            alt=""
            draggable={false}
            width={SPRITE_PX}
            height={SPRITE_PX}
            className="select-none pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
        />
    );
};

/** One banner. */
export const Banner = memo(function Banner({ banner }) {
    const [leaving, setLeaving] = useState(false);
    const timer = useRef(null);
    const problem = banner.tone === TONE.PROBLEM;
    useEffect(() => () => {
        clearTimeout(timer.current);
        outlineSubjects([]);
    }, []);

    return (
        <button
            type="button"
            data-banner={banner.kind}
            data-banner-tone={banner.tone}
            data-banner-leaving={leaving ? 'true' : undefined}
            className="gi-banner pointer-events-auto block text-left cursor-pointer shrink-0"
            style={{ width: BANNER_WIDTH_PX }}
            onMouseEnter={() => banner.subjects.length && outlineSubjects(banner.subjects, problem ? 'red' : 'gold')}
            onMouseLeave={() => outlineSubjects([])}
            onClick={() => {
                if (leaving) return;
                setLeaving(true);
                outlineSubjects([]);
                if (BANNER_KINDS[banner.kind]?.pointsTo) {
                    const subjects = banner.subjects.filter(s => s.type !== 'token' || BoardState.getTokenById(s.id));
                    if (subjects.length) EventBus.publish(UI_EVENTS.SHOW_ON_MAT, { subjects });
                }
                timer.current = setTimeout(() => Banners.dismiss(banner.id), LIFT_MS);
            }}
        >
            <PixelFrame
                kind={FRAME_KIND.STUDS}
                frameClassName={cn(
                    'relative overflow-hidden flex items-center gap-3 px-2 py-1 font-pixel text-amber-100',
                    problem ? 'ui-frame-studs-red' : 'ui-frame-studs-gold gi-banner-shine'
                )}
            >
                <BannerSprite sprite={banner.sprite} />
                <div className="flex flex-col min-w-0 flex-1">
                    <span
                        data-banner-title
                        className="ui-text-title font-bold"
                        style={{ color: problem ? 'var(--color-ui-red)' : 'var(--color-ui-gold)' }}
                    >
                        {banner.title}
                    </span>
                    <span data-banner-line className="ui-text-body">{banner.line}</span>
                </div>
            </PixelFrame>
        </button>
    );
});

/** @param {{away?: boolean}} props `away`: the stack over the World Map and the Guild Hall, only kinds that point to a Token. */
export const BannerStack = memo(function BannerStack({ away = false }) {
    const drawn = useDrawn('notifications');
    useSyncExternalStore(Banners.subscribe, Banners.getVersion);
    if (!drawn) return null;
    const view = Banners.getView();
    const shown = away ? view.shown.filter(b => BANNER_KINDS[b.kind]?.pointsTo) : view.shown;
    const waiting = away ? 0 : view.waiting;
    const { problemWaiting } = view;
    if (!shown.length) return null;
    return (
        // Clipped at the top edge, so a banner seems to come from behind the top bar.
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
            <div data-banners={away ? 'away' : 'mat'} className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
                {shown.map(b => <Banner key={b.id} banner={b} />)}
                {waiting > 0 && (
                    <PixelFrame
                        kind={FRAME_KIND.CHAMFER}
                        data-banners-waiting={waiting}
                        title={`${waiting} more waiting: click a banner to see the next`}
                        className="pointer-events-auto"
                        frameClassName="px-2 font-pixel ui-text-body font-bold"
                        frameStyle={{ color: problemWaiting ? 'var(--color-ui-red)' : 'var(--color-ui-gold)' }}
                    >
                        +{waiting}
                    </PixelFrame>
                )}
            </div>
        </div>
    );
});
