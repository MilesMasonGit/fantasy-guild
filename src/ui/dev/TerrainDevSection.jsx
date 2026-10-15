// The QA panel's Terrain section: each view of the ground, one click away.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as Atlas from '../../systems/atlas/Atlas.js';
import { lastGroundBuilds, onGroundBuilt } from '../components/board/groundBuilds.js';
import { TERRAIN_DEV_REGIONS, goToDevRegion, rerollDevRegion, backToStarterCamp, viewOf } from './terrainDev.js';

const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/** Where the guild is, in words. */
function whereNow() {
    const here = Atlas.activeRegion();
    if (!here) return '';
    if (here.kind === Atlas.REGION_KIND.STARTER) return 'At the Starter Camp (meadow)';
    const view = viewOf(here);
    return view ? `At the dev ${view.label} (seed ${here.seed})` : `At ${here.practicalName || here.id}`;
}

const ms = (n) => (n == null ? '–' : `${n.toFixed(1)} ms`);

/**
 * Six buttons, one per view of the ground (each biome, each pair): each settles a dev Region for
 * free and takes the guild there. Reroll it gives the one the guild is in a new seed; Back to the
 * Starter Camp goes home. The dev Region left behind is removed. Under them, how long the ground's
 * last build took.
 */
export function TerrainDevSection() {
    const [status, setStatus] = useState('');
    const [where, setWhere] = useState(whereNow);
    const [builds, setBuilds] = useState(lastGroundBuilds);

    useEffect(() => {
        const refresh = () => setWhere(whereNow());
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, refresh, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, refresh, UI_LISTENER),
            onGroundBuilt(() => setBuilds(lastGroundBuilds()))
        ];
        return () => offs.forEach(off => off?.());
    }, []);

    const run = (what, label) => {
        const result = what();
        setStatus(result.success ? '' : `${label}: ${result.reason}`);
        setWhere(whereNow());
    };

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-terrain">
            <div className={labelClass}>Terrain (dev only)</div>
            <div className="text-[10px] text-gi-muted leading-tight">
                Each button makes a dev Region for free and takes the guild there. The dev Region you leave is removed.
            </div>
            <div className="grid grid-cols-2 gap-1">
                {TERRAIN_DEV_REGIONS.map(view => (
                    <button
                        key={view.id}
                        data-terrain-view={view.id}
                        onClick={() => run(() => goToDevRegion(view.maps), view.label)}
                        className={buttonClass}
                    >
                        {view.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
                <button data-terrain-reroll onClick={() => run(rerollDevRegion, 'Reroll it')} className={buttonClass}>
                    Reroll it
                </button>
                <button data-terrain-home onClick={() => run(backToStarterCamp, 'Back')} className={buttonClass}>
                    Back to the Starter Camp
                </button>
            </div>
            <div className="text-[10px] text-gi-text" data-terrain-where>{where}</div>
            <div className="text-[10px] text-gi-muted tabular-nums" data-terrain-builds>
                Last ground build: plan {ms(builds.plan)}, picture {ms(builds.screen)}
                {builds.cols ? ` (${builds.cols} × ${builds.rows} ground pixels)` : ''}
            </div>
            {status && <div className="text-[10px] text-gi-danger break-words" role="status">{status}</div>}
        </div>
    );
}
