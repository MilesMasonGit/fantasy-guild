import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { HOVER_REST_MS } from '../../ui/components/board/hoverRest.js';

/**
 * Lets the pointer rest on whatever it hovers on the mat, so the name, the rings and the HP bar
 * come up (`useHoverRest`). The test must be on fake timers.
 */
export function restHover() {
    if (!vi.isFakeTimers()) throw new Error('restHover needs vi.useFakeTimers()');
    act(() => { vi.advanceTimersByTime(HOVER_REST_MS); });
}
