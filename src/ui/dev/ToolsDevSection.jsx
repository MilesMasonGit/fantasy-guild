// The QA panel's Tools section: the tools-as-gear content, one click away, before the owner Syncs it.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { applyToolsPreview, toolsPreviewOn } from './toolsPreview.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/**
 * Preview the tools pack: the tool items, which gathering Tokens need which tool, and the starter
 * tools in the Bank. In memory only: after a reload, press it again.
 */
export function ToolsDevSection() {
    const [status, setStatus] = useState(() => (toolsPreviewOn() ? 'On' : ''));
    const preview = () => {
        const { items, tokens, granted } = applyToolsPreview();
        setStatus(`On: ${items} tool items, ${tokens} Tokens need a tool, ${granted.length} starter tools added to the Bank`);
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-tools">
            <div className={labelClass}>Tools (dev only)</div>
            <button type="button" data-qa-tools-preview className={buttonClass} onClick={preview}>Preview the tools pack</button>
            {status && <div className="ui-text-body text-gi-muted" data-qa-tools-status>{status}</div>}
        </div>
    );
}

export default ToolsDevSection;
