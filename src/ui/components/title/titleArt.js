// The title screen's pictures and looks (pure: no React).

import { areaBannerSrc } from '../../../config/areaBanners.js';

/**
 * The owner's own title art: drop a file at either path and it replaces the stand-in, no code
 * change (a missing file just keeps the stand-in).
 * - The logo replaces the game's name written in the display font.
 * - The painting replaces the banner picture behind or above the name.
 * Both draw at a whole multiple of their size, pixelated, like every sprite.
 */
export const TITLE_LOGO_SRC = '/assets/ui/u_title_logo.png';
export const TITLE_PAINTING_SRC = '/assets/backgrounds/title/b_title_painting.png';

/** The stand-in picture until the painting exists: an area banner (256 x 256). */
export const TITLE_BANNER = 'b_guild_hall';
export const TITLE_BANNER_SIZE = 256;
export const titleBannerSrc = () => areaBannerSrc(TITLE_BANNER);

/**
 * How the picture and the name stand over the slots. Picked in code, not in the game: the owner
 * chooses from the screenshots in `docs/active/research/settings_title/built/`.
 * - backdrop: the picture fills the screen behind everything, the name at the top.
 * - strip: the picture as a wide band across the top, fading out at its sides, the name over it.
 * - framed: the picture in a studs frame the slots' width, the name on a plate at its foot.
 */
export const TITLE_LOOK = Object.freeze({ BACKDROP: 'backdrop', STRIP: 'strip', FRAMED: 'framed' });
export const DEFAULT_TITLE_LOOK = TITLE_LOOK.FRAMED;

/**
 * The scale a picture `art` ({ width, height }) draws at to cover a `box`: the smallest whole
 * multiple that covers it, or a plain fraction when the picture is bigger than the box already
 * (a large painting is shrunk, not cropped to a quarter).
 */
export function coverScale(art, box) {
    if (!art?.width || !art?.height || !box?.width || !box?.height) return 1;
    const cover = Math.max(box.width / art.width, box.height / art.height);
    return cover >= 1 ? Math.ceil(cover) : cover;
}

/** The largest whole multiple of `art` that fits inside `box` (at least 1). */
export function fitScale(art, box) {
    if (!art?.width || !art?.height || !box?.width || !box?.height) return 1;
    return Math.max(1, Math.floor(Math.min(box.width / art.width, box.height / art.height)));
}
