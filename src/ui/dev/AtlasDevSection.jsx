// The QA panel's Atlas section: test maps for the Cartography table, one click away.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import * as Atlas from '../../systems/atlas/Atlas.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/**
 * Grant test maps: two of each placeholder map into the dev stock, which the Cartography table
 * lists beside the Bank's maps. The stock is not saved, and an Atlas already open reads it when
 * it next opens.
 */
export function AtlasDevSection() {
    const [status, setStatus] = useState('');
    const grant = () => {
        const lines = Atlas.devGrantMaps(2);
        setStatus(`${lines.length} kinds of map`);
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-atlas">
            <div className={labelClass}>Atlas (dev only)</div>
            <button type="button" data-qa-grant-maps className={buttonClass} onClick={grant}>Grant test maps</button>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default AtlasDevSection;
