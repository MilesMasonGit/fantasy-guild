// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIModals } from '../ui/hooks/useUIModals.js';

const open = (ui) => ({
    bank: ui.drawer.panes.includes('bank'),
    shop: ui.shop.isOpen
});

describe('the Bank and Shop drawers close each other', () => {
    it('opening the Shop while the Bank is open leaves only the Shop; closing it leaves none', () => {
        const { result } = renderHook(() => useUIModals(null));
        act(() => { result.current.drawer.open('bank'); });
        expect(open(result.current)).toEqual({ bank: true, shop: false });
        act(() => { result.current.shop.open(); });
        expect(open(result.current)).toEqual({ bank: false, shop: true });
        act(() => { result.current.shop.close(); });
        expect(open(result.current)).toEqual({ bank: false, shop: false });
    });

    it('the Work Permissions drawer is gone (hero orders, brief 260 O1)', () => {
        const { result } = renderHook(() => useUIModals(null));
        expect(result.current.flagRules).toBeUndefined();
    });
});
