// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIModals } from '../ui/hooks/useUIModals.js';

/**
 * Those groups used to be rebuilt on every render, so every ReactRoot render
 * unsubscribed and resubscribed three events. They are memoised now: the same
 * object until their own state moves.
 */
describe('useUIModals keeps fullscreen and inspect stable (CR3-302)', () => {
    it('an unrelated change (a window opening) leaves both groups the same object', () => {
        const { result } = renderHook(() => useUIModals(null));
        const { fullscreen, inspect } = result.current;
        act(() => { result.current.settings.open(); });
        expect(result.current.settings.isOpen).toBe(true);
        expect(result.current.fullscreen).toBe(fullscreen);
        expect(result.current.inspect).toBe(inspect);
    });

    it('their own state still gets through', () => {
        const { result } = renderHook(() => useUIModals(null));
        const before = result.current.inspect;
        act(() => { result.current.fullscreen.open('guild'); });
        expect(result.current.fullscreen.view).toBe('guild');
        act(() => { result.current.inspect.set('token', 'tok_1', { instanceId: 'tok_1' }); });
        expect(result.current.inspect).not.toBe(before);
        expect(result.current.inspect.selection).toMatchObject({ type: 'token', id: 'tok_1', pane: 'cartographer' });
        expect(result.current.inspect.getByPane('cartographer')).toMatchObject({ id: 'tok_1' });
    });
});
