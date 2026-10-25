// The QA panel's Orchards section (brief 230 S2b): one click lays out an Orchard with a fruiting and a Bare apple tree and a picker, and a lone Bare tree with no Orchard; a second click puts an Orchard beside the lone one.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpOrchardScene, putOrchardByLoneTree, orchardReadout } from './orchardDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function OrchardDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(orchardReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-orchard">
            <div className={labelClass}>Orchards: fruit trees picked bare and fruiting again (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-orchard-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpOrchardScene();
                        setStatus(r.ok
                            ? 'Top of the mat, above the Guild Hall: a QA Apple Orchard with a fruiting and a Bare apple tree and a Picker (picked bare, a tree rests Bare 18 s, then fruits again in place; the Orchard plants a third tree). To its left, a lone Bare tree with no Orchard: it stays Bare (yellow mark: needs an Orchard nearby)'
                            : r.error);
                    }}
                >
                    Orchard, fruiting and Bare trees (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-orchard-lone
                    className={buttonClass}
                    onClick={() => {
                        const r = putOrchardByLoneTree();
                        setStatus(r.ok ? 'An Orchard beside the lone tree: it fruits again in 18 s' : r.error);
                    }}
                >
                    Put an Orchard beside the lone tree
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-orchard-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default OrchardDevSection;
