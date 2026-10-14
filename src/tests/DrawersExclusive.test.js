// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIModals } from '../ui/hooks/useUIModals.js';

const open = (ui) => ({
    bank: ui.drawer.panes.includes('bank'),
    shop: ui.shop.isOpen,
    rules: ui.flagRules.isOpen
});

describe('the Bank, Shop and Work Rules drawers close each other', () => {
    it('opening the Shop while the Bank is open leaves only the Shop; closing it leaves none', () => {
        const { result } = renderHook(() => useUIModals(null));
        act(() => { result.current.drawer.open('bank'); });
        expect(open(result.current)).toEqual({ bank: true, shop: false, rules: false });
        act(() => { result.current.shop.open(); });
        expect(open(result.current)).toEqual({ bank: false, shop: true, rules: false });
        act(() => { result.current.shop.close(); });
        expect(open(result.current)).toEqual({ bank: false, shop: false, rules: false });
    });

    it('opening Work Rules closes the Bank and the Shop, and either closes Work Rules', () => {
        const { result } = renderHook(() => useUIModals(null));
        act(() => { result.current.drawer.open('bank'); });
        act(() => { result.current.flagRules.open('h1'); });
        expect(open(result.current)).toEqual({ bank: false, shop: false, rules: true });
        act(() => { result.current.drawer.open('shop'); });
        expect(open(result.current)).toEqual({ bank: false, shop: true, rules: false });
        act(() => { result.current.flagRules.toggle(); });
        expect(open(result.current)).toEqual({ bank: false, shop: false, rules: true });
        act(() => { result.current.drawer.open('bank'); });
        expect(open(result.current)).toEqual({ bank: true, shop: false, rules: false });
    });

    it('a settings window or a full-screen view leaves an open drawer alone', () => {
        const { result } = renderHook(() => useUIModals(null));
        act(() => { result.current.flagRules.open(null); });
        act(() => { result.current.settings.open(); });
        act(() => { result.current.fullscreen.open('guild'); });
        expect(open(result.current).rules).toBe(true);
    });
});
