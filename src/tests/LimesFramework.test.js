// @vitest-environment jsdom
// Limes, the guide's framework: on the Starter Camp's mat only, dragged anywhere (its spot saved),
// clicked to talk (Next, Close); a step opens its bubble by itself and only collapses to "…";
// each screen's small Limes shows its blurb on hover, hidden by Settings unless it carries a step;
// a step's target wears the gold outline. Not a Token: never on the board.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as LimesGuide from '../systems/quests/LimesGuide.js';
import { LIMES_TEXT, LIMES_SPOTS } from '../systems/quests/limesText.js';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { MatLimes } from '../ui/components/limes/MatLimes.jsx';
import { LimesBlurb, LIMES_BLURBS_SETTING, blurbPlace } from '../ui/components/limes/LimesBlurb.jsx';
import {
    getLimes, resetLimes, clickLimes, openLimesStep, closeLimesStep, limesNext, limesClose,
    matConversation, stepAt, LIMES_MAT
} from '../ui/components/limes/limesStore.js';
import { limesSizeAt, limesCornerSpot, limesSpotOn, clampLimesSpot, bubbleAcross, LIMES_ART_PX, LIMES_SCALE } from '../ui/components/limes/limesSpot.js';
import { limesTargetSelector, applyLimesMark, watchLimesMark, LIMES_TARGET, LIMES_MARK_ATTR } from '../ui/components/limes/limesMark.js';
import { boardArtSteps } from '../ui/components/base/TokenSprite.jsx';
import { matW, matH } from '../config/matGeometry.js';
import { LIMES_INK, LIMES_FILL_TOP, LIMES_FILL_FOOT } from '../ui/components/board/speechTone.js';

const h = React.createElement;
const q = (sel) => document.querySelector(sel);

/** Puts the guild at a place of `kind` (the Starter Camp is 'starter'). */
function placeGuild(kind) {
    GameState.state.atlas.regions = { region_1: { id: 'region_1', kind } };
    GameState.state.atlas.activeRegionId = 'region_1';
}

const pointer = (type, x, y) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });

beforeEach(() => {
    GameState.initNew();
    resetLimes();
    SettingsManager.set(LIMES_BLURBS_SETTING, true);
});
afterEach(() => {
    cleanup();
    resetLimes();
});

describe('what Limes says (the store)', () => {
    it('a click starts the talk; Next steps to the last line and no further; Close ends it', () => {
        clickLimes();
        expect(matConversation()).toMatchObject({ kind: 'talk', index: 0, collapsed: false });
        for (let i = 0; i < LIMES_TEXT.talk.length + 2; i++) limesNext('talk');
        expect(matConversation().index).toBe(LIMES_TEXT.talk.length - 1);
        limesClose('talk');
        expect(matConversation()).toBeNull();
    });

    it('a step opens by itself and stays: Close and a click only collapse it to "…", a click opens it again', () => {
        clickLimes();
        openLimesStep({ id: 'lesson_1', lines: ['One', 'Two'] });
        // The step replaces the talk.
        expect(matConversation()).toMatchObject({ kind: 'step', lines: ['One', 'Two'], index: 0, collapsed: false });
        limesNext('step');
        expect(matConversation().index).toBe(1);
        limesClose('step');
        expect(matConversation()).toMatchObject({ kind: 'step', collapsed: true });
        clickLimes();
        expect(matConversation()).toMatchObject({ kind: 'step', collapsed: false, index: 1 });
        closeLimesStep('another');
        expect(getLimes().step).not.toBeNull();
        closeLimesStep('lesson_1');
        expect(matConversation()).toBeNull();
    });

    it('a step carried by a screen\'s small Limes leaves the mat\'s Limes free to talk', () => {
        openLimesStep({ id: 's', lines: 'Look at the Bank', spot: 'bank' });
        expect(stepAt('bank')).toMatchObject({ id: 's', lines: ['Look at the Bank'] });
        expect(stepAt(LIMES_MAT)).toBeNull();
        expect(matConversation()).toBeNull();
        clickLimes();
        expect(matConversation().kind).toBe('talk');
        expect(stepAt('bank')).not.toBeNull();
    });

    it('every word is in the one words file: a talk, a blurb for each spot, the buttons', () => {
        expect(LIMES_TEXT.talk.length).toBeGreaterThan(1);
        expect(LIMES_SPOTS).toEqual(['bank', 'shop', 'worldMap', 'guildHall', 'heroDrawer']);
        for (const spot of LIMES_SPOTS) expect(LIMES_TEXT.blurbs[spot].length).toBeGreaterThan(10);
        expect(LIMES_TEXT.buttons).toMatchObject({ next: 'Next', close: 'Close', more: '…' });
    });
});

describe('Limes on the mat: size and spot', () => {
    it('is twice a Token\'s pixels, on whole screen pixels at every fit', () => {
        for (const fit of [0.31, 0.55, 0.62, 0.8, 1, 1.37]) {
            const px = limesSizeAt(fit) * fit;
            expect(px).toBeCloseTo(LIMES_ART_PX * LIMES_SCALE * boardArtSteps(fit), 6);
            expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-6);
        }
        // About one Token wide (a Token is 64 px art at the board's scale).
        expect(limesSizeAt(1)).toBe(128);
    });

    it('starts in the bottom-left corner and is kept wholly on the mat', () => {
        const mat = { w: 1920, h: 1040 };
        const corner = limesCornerSpot(128, mat);
        expect(corner.x).toBeLessThan(mat.w / 4);
        expect(corner.y).toBeGreaterThan(mat.h * 3 / 4);
        expect(clampLimesSpot({ x: -50, y: 5000 }, 128, mat)).toEqual({ x: 64, y: mat.h - 64 });
        expect(limesSpotOn({ x: 900, y: 400 }, 128, mat)).toEqual({ x: 900, y: 400 });
        expect(limesSpotOn(null, 128, mat)).toEqual(corner);
    });

    it('its bubble stays within the mat\'s sides, its tail over Limes', () => {
        const near = bubbleAcross(60, 300, 1920, 0.5, 20);
        expect(60 * 0.5 + near.left).toBe(0);
        expect(near.tail).toBe(30);
        const mid = bubbleAcross(960, 300, 1920, 0.5);
        expect(mid.left).toBe(-150);
        expect(mid.tail).toBe(150);
    });
});

describe('what the save keeps of Limes', () => {
    it('its spot and the lessons switch are saved in the guide section, and nowhere on the board', () => {
        const tokensBefore = BoardState.tokens().length;
        LimesGuide.setLimesSpot({ x: 400.4, y: 300.6 });
        LimesGuide.setLessons(false);
        const saved = GameState.serialize().state;
        expect(saved.guide).toEqual({ limesSpot: { x: 400, y: 301 }, lessons: false });
        expect(BoardState.tokens().length).toBe(tokensBefore);
        LimesGuide.setLimesSpot(null);
        expect(LimesGuide.limesSpot()).toBeNull();
    });

    it('a save from before Limes loads with its corner and the lessons on', () => {
        const old = structuredClone(INITIAL_STATE);
        delete old.guide;
        const migrated = migrateState(old, GAME_VERSION);
        expect(migrated.guide).toEqual({ limesSpot: null, lessons: true });
    });
});

describe('Limes on the mat (drawn)', () => {
    const mount = () => render(h(MatFitProvider, { value: 1 }, h('div', { 'data-mat-board': '' }, h(MatLimes))));

    it('shows only at the Starter Camp', () => {
        placeGuild('settled');
        mount();
        expect(q('[data-limes-sprite]')).toBeNull();
        cleanup();
        placeGuild('starter');
        mount();
        const sprite = q('[data-limes-sprite]');
        expect(sprite).not.toBeNull();
        expect(sprite.getAttribute('data-alpha-test')).toBe('true');
        // Its corner, at 128 mat units across.
        expect(sprite.style.width).toBe('128px');
        expect(parseFloat(sprite.style.top) + 128).toBeGreaterThan(matH() - 100);
        expect(parseFloat(sprite.style.left)).toBeLessThan(100);
    });

    it('a click talks: Next, then Close; the bubble is Limes\'s green', () => {
        placeGuild('starter');
        mount();
        const sprite = q('[data-limes-sprite]');
        act(() => { sprite.dispatchEvent(pointer('pointerdown', 100, 100)); sprite.dispatchEvent(pointer('pointerup', 101, 100)); });
        const bubble = q('[data-limes-bubble="talk"]');
        expect(bubble.getAttribute('data-speech-tone')).toBe('limes');
        expect(bubble.querySelector('[data-limes-fill]')).not.toBeNull();
        expect(q('[data-limes-words]').textContent).toBe(LIMES_TEXT.talk[0]);
        fireEvent.click(q('button[data-limes-next]'));
        expect(q('[data-limes-words]').textContent).toBe(LIMES_TEXT.talk[1]);
        fireEvent.click(q('button[data-limes-close]'));
        expect(q('[data-limes-bubble]')).toBeNull();
    });

    it('a step\'s bubble collapses to "…" and a click on it opens it again', () => {
        placeGuild('starter');
        mount();
        act(() => openLimesStep({ id: 'x', lines: ['Hello'] }));
        expect(q('[data-limes-bubble="step"]')).not.toBeNull();
        fireEvent.click(q('button[data-limes-close]'));
        expect(q('[data-limes-bubble="collapsed"]').textContent).toBe('…');
        fireEvent.click(q('button[data-limes-more]'));
        expect(q('[data-limes-bubble="step"]')).not.toBeNull();
    });

    it('a drag moves Limes and keeps its spot in the save; it is never a Token', () => {
        placeGuild('starter');
        mount();
        const sprite = q('[data-limes-sprite]');
        const from = { x: parseFloat(sprite.style.left) + 64, y: parseFloat(sprite.style.top) + 64 };
        act(() => {
            sprite.dispatchEvent(pointer('pointerdown', 100, 100));
            sprite.dispatchEvent(pointer('pointermove', 200, 50));
            sprite.dispatchEvent(pointer('pointermove', 400, -100));
            sprite.dispatchEvent(pointer('pointerup', 400, -100));
        });
        expect(LimesGuide.limesSpot()).toEqual({ x: Math.round(from.x + 300), y: Math.round(from.y - 200) });
        expect(q('[data-limes-bubble]')).toBeNull();
        expect(BoardState.tokens().some(t => /slurm|limes/i.test(t.typeId))).toBe(false);
        expect(parseFloat(q('[data-limes-sprite]').style.left)).toBeCloseTo(from.x + 300 - 64, 0);
        expect(matW()).toBeGreaterThan(0);
    });
});

describe('a screen\'s small Limes', () => {
    it('hovering it shows that screen\'s blurb', () => {
        render(h(LimesBlurb, { spot: 'bank' }));
        const small = q('[data-limes-blurb="bank"]');
        expect(q('[data-limes-blurb-box]')).toBeNull();
        fireEvent.pointerEnter(small);
        expect(q('[data-limes-blurb-box="bank"]').textContent).toBe(LIMES_TEXT.blurbs.bank);
        expect(q('[data-limes-blurb-box] [data-speech-tone]').getAttribute('data-speech-tone')).toBe('limes');
        fireEvent.pointerLeave(small);
        expect(q('[data-limes-blurb-box]')).toBeNull();
    });

    it('the Settings switch hides it, unless it carries a step: then it glows and its bubble stays open', () => {
        SettingsManager.set(LIMES_BLURBS_SETTING, false);
        render(h(LimesBlurb, { spot: 'shop' }));
        expect(q('[data-limes-blurb]')).toBeNull();
        act(() => openLimesStep({ id: 'st', lines: ['Buy a Foundation'], spot: 'shop' }));
        const small = q('[data-limes-blurb="shop"]');
        expect(small.querySelector('img').getAttribute(LIMES_MARK_ATTR)).toBe('glow');
        expect(q('[data-limes-blurb-box="shop"] [data-limes-words]').textContent).toBe('Buy a Foundation');
        fireEvent.click(q('button[data-limes-close]'));
        expect(q('[data-limes-blurb-box]')).toBeNull();
        fireEvent.click(small);
        expect(q('[data-limes-blurb-box="shop"]')).not.toBeNull();
        act(() => closeLimesStep('st'));
        expect(q('[data-limes-blurb]')).toBeNull();
    });

    it('its blurb sits under it, or over it when the window has no room below, never off the window', () => {
        const under = blurbPlace({ left: 100, top: 10, width: 32, height: 32, right: 132, bottom: 42 }, 300, 80, 1366, 768);
        expect(under).toMatchObject({ above: false, top: 48, left: 8 });
        const over = blurbPlace({ left: 1300, top: 700, width: 32, height: 32, right: 1332, bottom: 732 }, 300, 80, 1366, 768);
        expect(over.above).toBe(true);
        expect(over.left + 300).toBeLessThanOrEqual(1366 - 8);
    });
});

describe('the gold outline on a step\'s target', () => {
    it('finds a Token, a type, a nav bubble, a Bank item and a Hall star', () => {
        expect(limesTargetSelector({ kind: LIMES_TARGET.TOKEN, id: 't1' })).toBe('[data-token-art="true"][data-token-id="t1"]');
        expect(limesTargetSelector({ kind: LIMES_TARGET.TOKEN_TYPE, id: 'token_guild_hall' })).toBe('[data-token-art="true"][data-token-type="token_guild_hall"]');
        expect(limesTargetSelector({ kind: LIMES_TARGET.NAV, id: 'bank' })).toBe('[id="bank-bubble-target"] > button');
        expect(limesTargetSelector({ kind: LIMES_TARGET.BANK_ITEM, id: 'item_oak_wood' })).toBe('[data-bank-item="item_oak_wood"]');
        expect(limesTargetSelector({ kind: LIMES_TARGET.HALL_STAR, id: 'roster_size' })).toBe('[data-hall-node="roster_size"]');
        expect(limesTargetSelector({ kind: 'nope', id: 'x' })).toBeNull();
        expect(limesTargetSelector(null)).toBeNull();
    });

    it('marks what the step names, unmarks what it no longer names, and leaves a small Limes\'s glow alone', () => {
        document.body.innerHTML = '<div data-bank-item="a"></div><div data-bank-item="b"></div><img data-limes-mark="glow">';
        applyLimesMark('[data-bank-item="a"]');
        expect(q('[data-bank-item="a"]').getAttribute(LIMES_MARK_ATTR)).toBe('target');
        applyLimesMark('[data-bank-item="b"]');
        expect(q('[data-bank-item="a"]').hasAttribute(LIMES_MARK_ATTR)).toBe(false);
        expect(q('[data-bank-item="b"]').getAttribute(LIMES_MARK_ATTR)).toBe('target');
        applyLimesMark(null);
        expect(document.querySelectorAll(`[${LIMES_MARK_ATTR}="target"]`)).toHaveLength(0);
        expect(q('img').getAttribute(LIMES_MARK_ATTR)).toBe('glow');
        document.body.innerHTML = '';
    });

    it('ends with its step: a re-mark already queued for the next frame does not put it back', async () => {
        document.body.innerHTML = '<div data-bank-item="a"></div>';
        const stop = watchLimesMark({ kind: LIMES_TARGET.BANK_ITEM, id: 'a' });
        expect(q('[data-bank-item="a"]').getAttribute(LIMES_MARK_ATTR)).toBe('target');
        document.body.appendChild(document.createElement('span'));
        await Promise.resolve();
        stop();
        await new Promise(r => setTimeout(r, 60));
        expect(q('[data-bank-item="a"]').hasAttribute(LIMES_MARK_ATTR)).toBe(false);
        document.body.innerHTML = '';
    });
});

describe('Limes\'s green bubble reads clearly', () => {
    const lum = (hex) => {
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contrast = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    };
    it('its dark words keep at least 7:1 against both ends of the lime gradient', () => {
        expect(contrast(LIMES_INK, LIMES_FILL_TOP)).toBeGreaterThan(7);
        expect(contrast(LIMES_INK, LIMES_FILL_FOOT)).toBeGreaterThan(7);
    });
});
