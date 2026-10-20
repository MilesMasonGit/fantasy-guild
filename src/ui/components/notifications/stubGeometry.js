import { FRAME_BAND_PX } from '../base/PixelFrame.jsx';

/**
 * The item stubs' measurements, shared by the column that draws them and the loot flights that
 * land on them (`stubLanding.js`).
 */

/** The item sprite at its own size. */
export const SPRITE_PX = 32;
/** Padding inside the frame: tight on the left (the frame band is there), a little more at the screen edge. */
export const PAD_LEFT_PX = 2;
export const PAD_RIGHT_PX = 4;
/** Between the amount, the sprite, the name and the rate. */
export const ROW_GAP_PX = 4;
/** One stub's height. Each stub is as wide as its content. */
export const STUB_PX = SPRITE_PX + FRAME_BAND_PX * 2;
/** Between two stubs. */
export const GAP_PX = 4;
/** One stub's height plus the gap below it. */
export const PITCH_PX = STUB_PX + GAP_PX;
/** The Clear all row's height. */
export const HEADER_PX = 24;
/** From a closed stub's right edge (the screen's edge, no frame side) to its sprite's centre. */
export const SPRITE_INSET_PX = PAD_RIGHT_PX + SPRITE_PX / 2;
