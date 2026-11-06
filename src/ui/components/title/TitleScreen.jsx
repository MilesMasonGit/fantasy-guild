import { useEffect, useState } from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import {
    TITLE_LOGO_SRC, TITLE_PAINTING_SRC, TITLE_BANNER_SIZE, titleBannerSrc,
    TITLE_LOOK, DEFAULT_TITLE_LOOK, coverScale, fitScale
} from './titleArt.js';

/** A picture that may not exist yet: its size once it loads, else null (a missing file stays null). */
function useOptionalImage(src) {
    const [art, setArt] = useState(null);
    useEffect(() => {
        let live = true;
        const img = new Image();
        img.onload = () => {
            if (live && img.naturalWidth > 0) setArt({ src, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = src;
        return () => { live = false; };
    }, [src]);
    return art;
}

function useViewport() {
    const read = () => ({ width: window.innerWidth || 0, height: window.innerHeight || 0 });
    const [size, setSize] = useState(read);
    useEffect(() => {
        const onResize = () => setSize(read());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return size;
}

/** `art` drawn to cover a `box` at {@link coverScale}, centred across and at `focusY` down, cropped. */
const CoverPicture = ({ art, box, focusY = 0.5, minScale = 1, className, style }) => {
    const scale = Math.max(minScale, coverScale(art, box));
    const w = Math.round(art.width * scale);
    const h = Math.round(art.height * scale);
    return (
        <div aria-hidden="true" className={cn('absolute inset-0 overflow-hidden pointer-events-none select-none', className)} style={style}>
            <img
                src={art.src}
                alt=""
                draggable={false}
                data-title-picture={art.src}
                data-title-picture-scale={scale}
                className="absolute"
                style={{
                    // ⚠️ Inline: a global img rule caps the width at the box and squashes the art.
                    maxWidth: 'none',
                    maxHeight: 'none',
                    width: w,
                    height: h,
                    left: Math.round((box.width - w) / 2),
                    top: Math.round((box.height - h) * focusY),
                    imageRendering: 'pixelated'
                }}
            />
        </div>
    );
};

/** The game's name: the owner's logo once it exists, else the name in the display size with a hard outline. */
const TitleName = ({ logo, maxWidth }) => {
    if (logo) {
        const scale = fitScale(logo, { width: maxWidth, height: 240 });
        return (
            <h1 data-title-name="logo" className="m-0">
                <img
                    src={logo.src}
                    alt={t('titleScreen.gameName')}
                    draggable={false}
                    style={{ width: logo.width * scale, height: logo.height * scale, maxWidth: 'none', imageRendering: 'pixelated' }}
                />
            </h1>
        );
    }
    return (
        <h1 data-title-name="text" className="m-0 ui-text-display ui-text-outline-2 font-bold text-white tracking-widest text-center">
            {t('titleScreen.gameName')}
        </h1>
    );
};

/** The width of the slots' window, px: the title's other pieces line up with it. */
export const TITLE_PANEL_PX = 672;
/** The new-game screen's window, px: the world beside the Guild's name and first hero. */
export const TITLE_WIDE_PANEL_PX = 1040;

/**
 * The title screen: the game's name over a picture, and the slots (`children`) beneath. The
 * picture is the owner's painting once `TITLE_PAINTING_SRC` exists, else an area banner; the name
 * is the owner's logo once `TITLE_LOGO_SRC` exists, else written out (`titleArt.js`). `panelPx` widens
 * the window under the name; `showName: false` leaves the name and its picture out and the window
 * fills the screen's height (the new-game screen, which must fit a 1366 x 768 screen whole).
 */
export const TitleScreen = ({ look = DEFAULT_TITLE_LOOK, panelPx = TITLE_PANEL_PX, showName = true, children }) => {
    const viewport = useViewport();
    const painting = useOptionalImage(TITLE_PAINTING_SRC);
    const logo = useOptionalImage(TITLE_LOGO_SRC);
    const picture = painting || { src: titleBannerSrc(), width: TITLE_BANNER_SIZE, height: TITLE_BANNER_SIZE };
    const panelWidth = Math.min(TITLE_PANEL_PX, Math.max(0, viewport.width - 32));

    let top;
    if (look === TITLE_LOOK.STRIP) {
        // A band across the top, the banner at 3× (as the top bar draws Region banners), melting into the dark at its sides.
        const box = { width: viewport.width, height: Math.max(180, Math.min(320, Math.round(viewport.height * 0.36))) };
        const art = picture;
        const scale = painting ? coverScale(art, box) : 3;
        const w = Math.round(art.width * scale);
        const fade = 'linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)';
        top = (
            <div data-title-look="strip" className="relative w-full shrink-0 flex items-center justify-center" style={{ height: box.height }}>
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: Math.min(w, box.width) }}>
                    <CoverPicture
                        art={art}
                        box={{ width: Math.min(w, box.width), height: box.height }}
                        minScale={scale}
                        focusY={0.6}
                        style={painting ? undefined : { maskImage: fade, WebkitMaskImage: fade }}
                    />
                </div>
                <div className="relative"><TitleName logo={logo} maxWidth={panelWidth} /></div>
            </div>
        );
    } else if (look === TITLE_LOOK.FRAMED) {
        // The picture in a studs frame the slots' width, the name on a plate at its foot.
        const box = { width: panelWidth - 12, height: Math.max(160, Math.min(256, Math.round(viewport.height * 0.3))) };
        top = (
            <PixelFrame data-title-look="framed" kind={FRAME_KIND.STUDS} className="shrink-0" style={{ width: panelWidth }} frameClassName="p-[6px]">
                <div className="relative overflow-hidden" style={{ height: box.height }}>
                    <CoverPicture art={picture} box={box} focusY={0.6} />
                    <div className="absolute inset-x-0 bottom-3 flex justify-center">
                        <PixelFrame kind={FRAME_KIND.STUDS} frameClassName="px-5 py-1 bg-gi-surface/90">
                            <TitleName logo={logo} maxWidth={panelWidth - 48} />
                        </PixelFrame>
                    </div>
                </div>
            </PixelFrame>
        );
    } else {
        top = (
            <div data-title-look="backdrop" className="relative shrink-0 pt-[5vh] pb-2">
                <TitleName logo={logo} maxWidth={panelWidth} />
            </div>
        );
    }

    return (
        <div data-title-screen className="fixed inset-0 z-(--z-modal) bg-[#0a0a0a] text-white overflow-y-auto">
            {look === TITLE_LOOK.BACKDROP && (
                <>
                    <CoverPicture art={picture} box={viewport} focusY={0.6} className="fixed" />
                    <div aria-hidden="true" className="fixed inset-0 bg-black/40 pointer-events-none" />
                </>
            )}
            {showName ? (
                <div className="relative min-h-full flex flex-col items-center gap-6 pb-8 px-4">
                    {top}
                    <div className="w-full shrink-0" style={{ maxWidth: panelPx }}>{children}</div>
                </div>
            ) : (
                <div className="relative h-full flex items-center justify-center p-4">
                    <div className="w-full h-full max-h-[900px]" style={{ maxWidth: panelPx }}>{children}</div>
                </div>
            )}
        </div>
    );
};

export default TitleScreen;
