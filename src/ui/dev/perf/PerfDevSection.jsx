// The QA panel's Performance section.
// ⚠️ DEV BUILDS ONLY. TestDashboard renders this behind `import.meta.env.DEV && …`, so a
// production build drops it, and with it the section. Nothing is measured or wrapped until a
// button is pressed, and the bench fixtures are only loaded (and registered) when a scenario
// starts.

import { useState } from 'react';
import { SaveManager } from '../../../systems/core/SaveManager.js';

// Kept in step with STRESS_SCENARIOS in stressScenarios.js (not imported, so
// that opening the QA panel does not load the harness and the bench fixtures).
const SCENARIOS = [
    ['quiet', 'S1 Quiet'],
    ['realistic', 'S2 Realistic'],
    ['torture', 'S3 Torture'],
    ['push', 'S4 Push'],
    ['rebuild', 'S5 Rebuild']
];

const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

const loadHarness = () => import('./perfHarness.js');

export function PerfDevSection() {
    const [status, setStatus] = useState('');

    const toggleHud = async () => {
        const h = await loadHarness();
        const on = h.toggleHud();
        setStatus(on
            ? (h.report().react.armed ? 'HUD on' : 'HUD on — reload to count React commits')
            : 'HUD off');
    };

    const runScenario = async (name) => {
        // A loaded game is saved first and then left alone, but the tab stops
        // showing it — say so before doing it.
        if (SaveManager.getCurrentSlot() !== null &&
            !window.confirm('Replace this game with a stress board? Your game is saved first and is not touched; reload the page to get back to it.')) {
            return;
        }
        setStatus(`Building ${name}…`);
        try {
            const h = await loadHarness();
            const built = await h.start(name);
            h.showHud();
            setStatus(`${built.id} live: ${built.census?.tokens ?? '?'} Tokens, built in ${built.buildMs} ms. Not saved.`);
        } catch (err) {
            console.error('[perf]', err);
            setStatus(`Failed: ${err.message}`);
        }
    };

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-perf-section">
            <div className={labelClass}>Performance (dev only)</div>
            <button onClick={toggleHud} className={`${buttonClass} w-full`}>Toggle Perf HUD</button>
            <div className={labelClass}>Stress scenario — replaces this game, never saved</div>
            <div className="grid grid-cols-2 gap-1">
                {SCENARIOS.map(([name, label]) => (
                    <button key={name} onClick={() => runScenario(name)} className={buttonClass}>{label}</button>
                ))}
            </div>
            {status && <div className="text-[10px] text-gi-muted break-words" role="status">{status}</div>}
        </div>
    );
}

export default PerfDevSection;
