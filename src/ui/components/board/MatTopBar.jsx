import { useOptionalImage } from '../../hooks/useOptionalImage.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useLiveMatFit } from './MatFitContext.jsx';
import { t } from '../../../i18n/index.js';
import { TITLE_LOGO_SRC } from '../title/titleArt.js';

/**
 * The bar's height in px: a row of title-size text over the Region's banner. The mat does not sit
 * under it: `ReactRoot` stacks the bar above `Board` in a column, so the box `Board` measures for
 * its fit (`useBoardScale`) is this much shorter and the mat shrinks to match.
 */
export const MAT_TOP_BAR_PX = 64;

/**
 * Whether the bar's middle shows the Token cap and Upkeep while no map mode is on. Off for now
 * (owner: not used enough); the badges' code stays for their return.
 */
export const SHOW_MAT_COUNTS = false;

/** The left end's width, px: kept for the game's logo whether the logo or its words stand there. */
export const MAT_LOGO_SLOT_PX = 288;

/**
 * The bar's own icons, drawn at 32 px, their art's own size. Placeholders until the owner draws the
 * Token and upkeep icons (owner_art_list.md).
 */
export const TOP_BAR_ICON = Object.freeze({
    TOKENS: '/assets/ui/u_tree.png',
    UPKEEP: '/assets/ui/u_coin_small.png'
});

/** One of {@link TOP_BAR_ICON}, crisp at the item bar's 32 px. */
export const TopBarIcon = ({ src }) => (
    <img src={src} alt="" draggable={false} width={32} height={32} className="select-none pointer-events-none" style={{ imageRendering: 'pixelated' }} />
);

/**
 * The bar's width in px: the mat's own on-screen width (its size in mat units times the fit
 * `Board` reports), so the bar's ends line up with the mat's edges. It follows a window resize,
 * a column opening and the Mat Tuner, all of which change one of the two.
 */
export function useMatScreenWidth() {
    const mat = useMatSize();
    const fit = useLiveMatFit();
    return Math.round(mat.w * fit);
}

/**
 * The bar's left end: the game's logo (the title screen's picture, once the owner draws it, at a
 * whole multiple that fits the bar), else its words in the title screen's display type. The slot
 * keeps the logo's width either way.
 * @param {{ logoSrc?: string }} props  `logoSrc` for tests
 */
export const MatLogo = ({ logoSrc = TITLE_LOGO_SRC }) => {
    const logo = useOptionalImage(logoSrc);
    const scale = logo ? Math.max(1, Math.floor(Math.min(MAT_LOGO_SLOT_PX / logo.width, (MAT_TOP_BAR_PX - 8) / logo.height))) : 0;
    return (
        <div data-mat-logo={logo ? 'logo' : 'text'} className="shrink-0 h-full flex items-center pl-2" style={{ width: MAT_LOGO_SLOT_PX }}>
            {logo ? (
                <img
                    src={logo.src}
                    alt={t('matTopBar.logoText')}
                    draggable={false}
                    style={{ width: logo.width * scale, height: logo.height * scale, maxWidth: 'none', imageRendering: 'pixelated' }}
                />
            ) : (
                <span data-mat-logo-text className="ui-text-display ui-text-outline-2 font-bold text-white tracking-widest whitespace-nowrap">
                    {t('matTopBar.logoText')}
                </span>
            )}
        </div>
    );
};

/**
 * The mat's top bar: a strip above the mat, exactly as wide as it, with no frame or fill of its
 * own. Three parts:
 * * **left**: the game's logo ({@link MatLogo}),
 * * **middle**, centred on the mat: the map mode's banner while a mode is on (and the Token cap
 *   and Upkeep while {@link SHOW_MAT_COUNTS}),
 * * **right**, at the mat's right edge: the Region name on its banner.
 * Only drawn on the playmat, never on the Guild Hall upgrade screen (ReactRoot lays it on the
 * table side of the Hall camera, with the mat).
 * @param {{ left?: React.ReactNode, middle?: React.ReactNode, right?: React.ReactNode, width?: number }} props
 *   `width` for tests; the mat's on-screen width otherwise
 */
export const MatTopBar = ({ left = null, middle = null, right = null, width }) => {
    const matWidth = useMatScreenWidth();
    return (
        <div
            data-mat-top-bar
            style={{ height: MAT_TOP_BAR_PX, width: width ?? matWidth, maxWidth: '100%' }}
            // ⚠️ Equal side columns keep the middle on the mat's centre line whatever the two ends hold.
            // The bar is a size container so the Region's banner can reach across it (`100cqw`).
            className="shrink-0 self-center select-none pointer-events-auto z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ui-text-title text-amber-100 [container-type:inline-size]"
        >
            {/* ⚠️ Raised so they paint over the right end's banner, which runs on under them. */}
            <div data-mat-top-bar-left className="relative z-10 flex items-center gap-2 h-full">{left}</div>
            <div data-mat-top-bar-middle className="relative z-10 flex items-center justify-center gap-2 min-w-0 h-full">{middle}</div>
            {/* As wide as the logo's end at least, so the middle stays on the mat's centre line when it is crowded. */}
            <div data-mat-top-bar-right className="flex items-center justify-end gap-2 h-full" style={{ minWidth: MAT_LOGO_SLOT_PX }}>{right}</div>
        </div>
    );
};

export default MatTopBar;
