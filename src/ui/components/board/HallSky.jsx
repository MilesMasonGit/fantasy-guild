import React from 'react';

/** Both sky tiles are 512 art pixels square, drawn at 2×. */
export const SKY_TILE_ART_PX = 512;
export const SKY_SCALE = 2;
export const SKY_TILE_PX = SKY_TILE_ART_PX * SKY_SCALE;

export const SKY_STARS_SRC = '/assets/playmat/screens/bg_nightsky_1.png';
export const SKY_CLOUDS_SRC = '/assets/playmat/screens/bg_nightsky_cloud_layer.png';

/**
 * HallSky: the Guild Hall screen's night sky, the star field with the see-through cloud layer
 * over it, both tiled at 2× and drifting in whole art pixels (`gi-sky-drift-*` in
 * `tailwind.css`).
 * Each layer is one tile larger than the screen on the side it drifts from and slides by one
 * tile, then wraps: the tile is seamless, so the wrap is invisible. The slide is a `transform`
 * animation, so the browser moves an already-painted layer and never repaints the sky.
 * ⚠️ Mounted only while the Hall screen is open (`ReactRoot`): nothing about the sky exists,
 * runs or holds memory on the mat.
 */
export function HallSky() {
    return (
        <div data-hall-sky className="absolute inset-0 z-0 overflow-clip pointer-events-none bg-[#07061a]">
            <div
                data-hall-sky-layer="stars"
                className="absolute gi-sky-drift-stars"
                style={{
                    left: 0,
                    top: 0,
                    width: `calc(100% + ${SKY_TILE_PX}px)`,
                    height: '100%',
                    backgroundImage: `url('${SKY_STARS_SRC}')`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: `${SKY_TILE_PX}px`,
                    imageRendering: 'pixelated'
                }}
            />
            <div
                data-hall-sky-layer="clouds"
                className="absolute gi-sky-drift-clouds"
                style={{
                    left: -SKY_TILE_PX,
                    top: -SKY_TILE_PX,
                    width: `calc(100% + ${SKY_TILE_PX}px)`,
                    height: `calc(100% + ${SKY_TILE_PX}px)`,
                    opacity: 0.25,
                    backgroundImage: `url('${SKY_CLOUDS_SRC}')`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: `${SKY_TILE_PX}px`,
                    imageRendering: 'pixelated'
                }}
            />
        </div>
    );
}

export default HallSky;
