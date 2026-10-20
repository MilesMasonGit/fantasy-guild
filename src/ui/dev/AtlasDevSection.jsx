// The QA panel's Atlas section: test maps for the Cartography table, one click away.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import * as Atlas from '../../systems/atlas/Atlas.js';
import { TOME_SCALES } from '../components/atlas/tomeArt.js';
import { useTomeScale, setTomeScale } from '../components/atlas/tomeScale.js';

const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/**
 * Grant test maps: two of each placeholder map into the dev stock, which the Cartography table
 * lists beside the Bank's maps. The stock is not saved, and an Atlas already open reads it when
 * it next opens. Book size: the scale the Atlas book is drawn at (2×, 3×, 4×), to choose by eye;
 * remembered for this browser session.
 */
export function AtlasDevSection() {
    const [status, setStatus] = useState('');
    const scale = useTomeScale();
    const grant = () => {
        const lines = Atlas.devGrantMaps(2);
        setStatus(`${lines.length} kinds of map`);
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-atlas">
            <div className={labelClass}>Atlas (dev only)</div>
            <button type="button" data-qa-grant-maps className={buttonClass} onClick={grant}>Grant test maps</button>
            {status && <div className="text-[10px] text-gi-muted">{status}</div>}
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-gi-muted mr-1">Book size</span>
                {TOME_SCALES.map(n => (
                    <button
                        key={n}
                        type="button"
                        data-qa-atlas-scale={n}
                        aria-pressed={scale === n}
                        className={`${buttonClass} ${scale === n ? 'bg-gi-primary/40' : ''}`}
                        onClick={() => setTomeScale(n)}
                    >
                        {n}×
                    </button>
                ))}
            </div>
        </div>
    );
}

export default AtlasDevSection;
