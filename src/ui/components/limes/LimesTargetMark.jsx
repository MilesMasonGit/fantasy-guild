import { useEffect } from 'react';
import { useLimes } from './limesStore.js';
import { watchLimesMark } from './limesMark.js';

/**
 * The hard gold outline on what the open Limes step names, while it is open (`limesMark.js`).
 * Draws nothing itself; mounted once, and idle while no step names a target.
 */
export function LimesTargetMark() {
    const { step } = useLimes();
    const target = step?.target ?? null;
    const key = target ? `${target.kind}:${target.id}` : '';
    // Keyed by value: a step's Next keeps the same target and must not re-watch it.
    useEffect(() => (key ? watchLimesMark(target) : undefined), [key]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}
