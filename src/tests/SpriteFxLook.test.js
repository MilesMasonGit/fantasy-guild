// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses, tokenSpritePath } from '../config/registries/tokenRegistry.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { resetMatTuning, MAT_TUNABLES } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { PixelArt, TokenSprite, TOKEN_SURFACE } from '../ui/components/base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../ui/components/board/AnimatedHeroSprite.jsx';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';
import { FlagMark } from '../ui/components/board/FlagMark.jsx';
import { tokenOutline, heroOutline, flagOutline } from '../ui/components/board/spriteOutline.js';
import { setSpriteFxManifest, assetKey, loadSpriteFxManifest } from '../ui/utils/spriteFx.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Wave 5 (owner rulings Z §11) — the hard pixel shadow and the coloured
 * outlines, as drawn:
 */

const h = React.createElement;
const TOKEN_SRC = '/assets/tokens/test/token_look.png';
const ITEM_SRC = '/assets/items/item_look.png';
const SHEET_SRC = 'assets/heroes/animations/ani_look_0.png';
const ENEMY_SRC = 'assets/enemies/animal/anim/ani_look.png';
const FLAG_SRC = '/assets/ui/flag/hero_flag_base.png';

/** A manifest as the generator writes it, for the sprites these tests draw. */
function manifestWith(extra = {}) {
    return {
        sprites: {
            'assets/tokens/test/token_look.png': { w: 64, h: 64, outlined: true },
            'assets/items/item_look.png': { w: 32, h: 32, outlined: false },
            'assets/heroes/animations/ani_look_0.png': { w: 512, h: 192, cols: 8, rows: 3, outlined: true },
            'assets/enemies/animal/anim/ani_look.png': { w: 256, h: 256, cols: 4, rows: 4, outlined: true },
            'assets/ui/flag/hero_flag_base.png': { w: 64, h: 64, outlined: true },
            ...extra
        }
    };
}

const withFit = (fit, el) => h(MatFitProvider, { value: fit }, el);
const filtersIn = (root) => [root, ...root.querySelectorAll('*')].filter(el => el.style?.filter && el.style.filter !== 'none');

beforeEach(() => { resetMatTuning(); setSpriteFxManifest(manifestWith()); });
afterEach(() => cleanup());
afterAll(() => { resetMatTuning(); setSpriteFxManifest(null); });

describe('a sprite at rest has no shadow, and no filter', () => {
    it('a plain sprite is one <img> with no filter', () => {
        const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, alt: 'x' }));
        const img = container.querySelector('img');
        expect(container.firstChild).toBe(img);
        expect(img.style.filter).toBe('');
        expect(container.querySelector('[data-sprite-shadow]')).toBeNull();
    });

    it('a Token on the board (outlinable, no state) has no shadow and no outline', () => {
        const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, outline: null }));
        expect(container.querySelector('[data-sprite-shadow]')).toBeNull();
        expect(container.querySelector('[data-sprite-ring]')).toBeNull();
        expect(filtersIn(container)).toEqual([]);
        // The sprite is still the only <img> (the alpha hit-test reads the first one).
        expect(container.querySelectorAll('img')).toHaveLength(1);
    });
});

describe('a dragged Token and floating loot cast the hard shadow', () => {
    it('lifted: the black silhouette, 2 art pixels (4 screen px at 2×) down-right, art raised 4 px', () => {
        const { container } = render(h(TokenSprite, { typeId: 'fixture_producer', surface: TOKEN_SURFACE.CARRY, lifted: true }));
        // The fixture's art is not in this manifest: no shadow, nothing broken.
        expect(container.querySelector('img')).not.toBeNull();
        expect(container.querySelector('[data-sprite-shadow]')).toBeNull();

        cleanup();
        const lifted = render(h(PixelArt, { src: TOKEN_SRC, size: 128, lifted: true })).container;
        const sil = lifted.querySelector('[data-sprite-shadow]');
        expect(sil).not.toBeNull();
        expect(sil.style.backgroundImage).toContain('/_gen/sprite-fx/sil/assets/tokens/test/token_look.png');
        expect([sil.style.left, sil.style.top, sil.style.width, sil.style.height]).toEqual(['4px', '4px', '128px', '128px']);
        expect(lifted.querySelector('img').parentElement.style.transform).toBe('translateY(-4px)');
        expect(filtersIn(lifted)).toEqual([]);
    });

    it('a Token being dragged off the mat draws the shadow through the drag ghost’s TokenSprite', () => {
        const key = assetKey(tokenSpritePath('fixture_producer'));
        setSpriteFxManifest(manifestWith({ [key]: { w: 64, h: 64, outlined: true } }));
        const { container } = render(h(TokenSprite, { typeId: 'fixture_producer', surface: TOKEN_SURFACE.CARRY, scale: 2, lifted: true }));
        expect(container.querySelector('[data-sprite-shadow]').style.backgroundImage).toContain(`/sil/${key}`);
    });

    it('floating loot: shadow 2 art px away (32 px art at 64 px: 4 px), and the bob moves art and shadow together', () => {
        const { container } = render(h(PixelArt, { src: ITEM_SRC, size: 64, hovering: true }));
        const sil = container.querySelector('[data-sprite-shadow]');
        expect([sil.style.left, sil.style.top]).toEqual(['4px', '4px']);
        expect(sil.parentElement.className).toContain('gi-sprite-hover');
        expect(container.querySelector('img').parentElement).toBe(sil.parentElement);
    });

    it('inside the mat, offsets are whole SCREEN pixels: at fit 0.5 a 256 u sprite is 128 px, so 4 px = 8 u', () => {
        const { container } = render(withFit(0.5, h(PixelArt, { src: TOKEN_SRC, size: 256, lifted: true })));
        expect(container.querySelector('[data-sprite-shadow]').style.left).toBe('8px');
    });

    it('the shadow always follows the sprite (owner’s final ruling): it rises in the same box as the art', () => {
        const lifted = render(h(PixelArt, { src: TOKEN_SRC, size: 128, lifted: true })).container;
        const sil = lifted.querySelector('[data-sprite-shadow]');
        expect(sil.parentElement).toBe(lifted.querySelector('img').parentElement);
        expect(sil.parentElement.style.transform).toBe('translateY(-4px)');
        expect(MAT_TUNABLES.find(t => t.key === 'raisedShadow')).toBeUndefined();
    });

    it('a sprite the generator has not seen draws without a shadow, never broken', () => {
        setSpriteFxManifest(null);
        const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, lifted: true }));
        expect(container.querySelector('img').getAttribute('src')).toBe(TOKEN_SRC);
        expect(container.querySelector('[data-sprite-shadow]')).toBeNull();
        cleanup();
        const data = render(h(PixelArt, { src: 'data:image/png;base64,AAAA', size: 128, lifted: true, outline: 'work' })).container;
        expect(data.querySelector('img')).not.toBeNull();
        expect(data.querySelector('[data-sprite-shadow], [data-sprite-ring]')).toBeNull();
    });
});

describe('state → outline colour', () => {
    it('Tokens: white hovered or selected, then red alert, then green working', () => {
        expect(tokenOutline({})).toBeNull();
        expect(tokenOutline({ working: true })).toBe('work');
        expect(tokenOutline({ working: true, alert: true })).toBe('alert');
        expect(tokenOutline({ alert: true })).toBe('alert');
        expect(tokenOutline({ alert: true, hovered: true })).toBe('hover');
        expect(tokenOutline({ working: true, selected: true })).toBe('hover');
    });

    it('heroes: white hovered or inspected, green working but not when stuck', () => {
        expect(heroOutline({ working: true })).toBe('work');
        expect(heroOutline({ working: true, stuck: true })).toBeNull();
        expect(heroOutline({ working: true, hovered: true })).toBe('hover');
        expect(heroOutline({ selected: true })).toBe('hover');
        expect(heroOutline({})).toBeNull();
    });

    it('flags: white while hovered or inspected; nothing while carried', () => {
        expect(flagOutline({ hovered: true })).toBe('hover');
        expect(flagOutline({ selected: true })).toBe('hover');
        expect(flagOutline({ hovered: true, carried: true })).toBeNull();
        expect(flagOutline({})).toBeNull();
    });

    it('each colour draws its own generated image', () => {
        for (const colour of ['work', 'hover', 'alert']) {
            const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, outline: colour }));
            const ring = container.querySelector('[data-sprite-ring]');
            expect(ring.getAttribute('data-sprite-ring')).toBe(colour);
            expect(ring.style.backgroundImage).toContain(`/_gen/sprite-fx/ol-${colour}/`);
            expect(filtersIn(container)).toEqual([]);
            cleanup();
        }
    });

    it('a flag on the mat is outlined the same way', () => {
        const { container } = render(h(FlagMark, { size: 128, outline: 'hover' }));
        expect(container.querySelector('[data-sprite-ring="hover"]').style.backgroundImage).toContain(`ol-hover/${assetKey(FLAG_SRC)}`);
    });
});

describe('the outline is one art pixel, scaled with the sprite like the art', () => {
    const ring = (props, fit = 1) => render(withFit(fit, h(PixelArt, { src: TOKEN_SRC, outline: 'work', ...props })))
        .container.querySelector('[data-sprite-ring]');

    it('64-pixel art at 128 px (2×): the ring image reaches exactly one art pixel (2 px) past the sprite', () => {
        const el = ring({ size: 128 });
        expect(el.style.backgroundImage).toContain('ol-work/');
        // The image is the art's size plus one pixel each side (66), drawn 132 px: 2 px per image pixel.
        expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(['-2px', '-2px', '132px', '132px']);
    });

    it('at 3× it is 3 px; inside a mat at fit 0.5 it is one art pixel in mat units, whatever the fit', () => {
        expect(ring({ size: 192 }).style.left).toBe('-3px');
        cleanup();
        const inMat = ring({ size: 256 }, 0.5);    // 256 u = 128 screen px: one art pixel = 4 u = 2 screen px
        expect([inMat.style.left, inMat.style.width]).toEqual(['-4px', '264px']);
    });

    it('there is one outline image per colour — no thickness setting, and no Look rows in the Mat Tuner', () => {
        expect(MAT_TUNABLES.find(t => t.key === 'outlinePx')).toBeUndefined();
        expect(MAT_TUNABLES.filter(t => t.group === 'Look')).toEqual([]);
    });
});

describe('animated sheets carry an outline sheet that follows every frame', () => {
    it('a hero: the outline sheet is the sheet’s size and moves with the same frame step', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(h(AnimatedHeroSprite, { src: SHEET_SRC, size: 128, animationState: 'walk', outline: null }));
            const ringEl = container.querySelector('span[aria-hidden]');
            expect(ringEl.style.backgroundImage).toBe('none');
            rerender(h(AnimatedHeroSprite, { src: SHEET_SRC, size: 128, animationState: 'walk', outline: 'work' }));
            expect(ringEl.getAttribute('data-sprite-ring')).toBe('work');
            expect(ringEl.style.backgroundImage).toContain('ol-work/assets/heroes/animations/ani_look_0.png');
            expect([ringEl.style.width, ringEl.style.height]).toEqual(['1024px', '384px']);
            const img = container.querySelector('img');
            expect(ringEl.style.transform).toBe(img.style.transform);
            act(() => { vi.advanceTimersByTime(400); });
            expect(img.style.transform).not.toBe('');
            expect(ringEl.style.transform).toBe(img.style.transform);
            expect(filtersIn(container)).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('an enemy: no resting shadow filter; the outline sheet shares the frame position', () => {
        vi.useFakeTimers();
        try {
            const { container } = render(h(AnimatedEnemySprite, { src: ENEMY_SRC, size: 128, outline: 'alert' }));
            expect(filtersIn(container)).toEqual([]);
            const ringEl = container.querySelector('[data-sprite-ring]');
            expect(ringEl.style.backgroundImage).toContain('ol-alert/');
            const art = container.querySelector('[role="img"]');
            act(() => { vi.advanceTimersByTime(300); });
            expect(art.style.backgroundPosition).not.toBe('');
            expect(ringEl.style.backgroundPosition).toBe(art.style.backgroundPosition);
            expect(ringEl.style.backgroundSize).toBe(art.style.backgroundSize);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('on the mat: no shadow at rest; outlines from the game’s own state', () => {
    const TOKEN = { x: 400, y: 300 };
    const hero = (id) => ({ id, name: id, status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } });
    const put = (point, typeId) => {
        const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(instance, point);
        return instance;
    };
    const mount = (el) => render(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el)));

    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.heroes = [hero('h1')];
        const key = assetKey(tokenSpritePath('fixture_producer'));
        setSpriteFxManifest(manifestWith({ [key]: { w: 64, h: 64, outlined: true } }));
    });

    it('a resting, unworked Token: no shadow, no outline, no filter on its art', () => {
        const t = put(TOKEN, 'fixture_producer');
        const { container } = mount(h(MatBoard));
        const art = container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        expect(art.getAttribute('data-outline')).toBeNull();
        expect(art.className).not.toContain('gi-glow-active');
        expect(art.querySelector('[data-sprite-shadow]')).toBeNull();
        expect(art.querySelector('[data-sprite-ring]')).toBeNull();
        expect(filtersIn(art)).toEqual([]);
    });

    it('worked: green on the Token and its hero; in alert: red on the Token; selected: white', () => {
        const t = put(TOKEN, 'fixture_producer');
        Flags.plant('h1', TOKEN);
        const first = mount(h(MatBoard));
        const art = () => first.container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        expect(art().getAttribute('data-outline')).toBe('work');
        expect(art().querySelector('[data-sprite-ring="work"]')).not.toBeNull();
        expect(first.container.querySelector('[data-board-hero="h1"]').getAttribute('data-outline')).toBe('work');
        cleanup();

        t.alert = ALERT.INPUTS;
        const alerted = mount(h(MatBoard)).container;
        expect(alerted.querySelector(`[data-token-art][data-token-id="${t.id}"]`).getAttribute('data-outline')).toBe('alert');
        expect(alerted.querySelector('[data-board-hero="h1"]').getAttribute('data-outline')).toBeNull();
        cleanup();

        const picked = mount(h(MatBoard, { inspectedTokenId: t.id, inspectedHeroId: 'h1' })).container;
        expect(picked.querySelector(`[data-token-art][data-token-id="${t.id}"]`).getAttribute('data-outline')).toBe('hover');
        expect(picked.querySelector('[data-board-hero="h1"]').getAttribute('data-outline')).toBe('hover');
    });
});

describe('no live filters left for shadows or the glow', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../tailwind.css'), 'utf8');
    const block = (name) => {
        const start = css.indexOf(`@keyframes ${name} {`);
        let depth = 0;
        for (let i = css.indexOf('{', start); i < css.length; i++) {
            if (css[i] === '{') depth++;
            if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
        }
        return '';
    };

    it('the landing bounce moves the Token but draws no shadow', () => {
        const land = block('gi-token-land');
        expect(land).toContain('translateY(-20px)');
        expect(land).not.toContain('filter');
    });

    it('the breathing green glow is gone; the hover hop on the mat has no brightening filter', () => {
        expect(css).not.toMatch(/@keyframes gi-glow-active/);
        expect(css).not.toMatch(/\.gi-glow-active\s*\{/);
        const hop = css.slice(css.indexOf('.gi-token-hover-hop {'), css.indexOf('}', css.indexOf('.gi-token-hover-hop {')));
        expect(hop).toContain('animation');
        expect(hop).not.toContain('filter');
    });

    it('nothing on a sprite asks for will-change (R6: 3× slower)', () => {
        const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, lifted: true, outline: 'work' }));
        expect([...container.querySelectorAll('*')].filter(el => el.style.willChange)).toEqual([]);
    });
});

describe('the manifest loader', () => {
    it('reads the generated manifest, and failure only means "no effects"', async () => {
        setSpriteFxManifest(null);
        const ok = await loadSpriteFxManifest(async (u) => ({ ok: u === '/_gen/sprite-fx/manifest.json', json: async () => manifestWith() }));
        expect(ok).toBe(true);
        const { container } = render(h(PixelArt, { src: TOKEN_SRC, size: 128, lifted: true }));
        expect(container.querySelector('[data-sprite-shadow]')).not.toBeNull();
        expect(await loadSpriteFxManifest(async () => { throw new Error('offline'); })).toBe(false);
        expect(await loadSpriteFxManifest(async () => ({ ok: false }))).toBe(false);
    });

    it('asset keys: leading slash, query and the dev origin are ignored; non-assets are not keys', () => {
        expect(assetKey('/assets/x/y.png?t=1')).toBe('assets/x/y.png');
        expect(assetKey('assets/x/y.png')).toBe('assets/x/y.png');
        expect(assetKey(`${location.origin}/assets/x/y.png`)).toBe('assets/x/y.png');
        expect(assetKey('data:image/png;base64,AA')).toBeNull();
        expect(assetKey('https://elsewhere.example/assets/x.png')).toBeNull();
        expect(assetKey(null)).toBeNull();
    });
});
