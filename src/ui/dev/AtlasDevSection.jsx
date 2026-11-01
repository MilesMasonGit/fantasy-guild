// The QA panel's Atlas section: the world map's prices met, fixture places settled, and the run's world in words.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import * as World from '../../systems/world/World.js';
import { meetFrontierPrices, settleFixture, beatArrival, jumpTutorialToWorld } from './worldDev.js';

/** The kits a fixture place can be settled as, with their buttons' words. */
const FIXTURE_KITS = Object.freeze([
    ['highland', 'Highland'], ['woodland', 'Woodland'], ['plains', 'Plains'], ['wetland', 'Wetland'], ['riverside', 'Riverside']
]);

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';
const dumpClass = 'max-h-96 overflow-auto whitespace-pre ui-text-small leading-tight p-2 rounded bg-black/30 border border-gi-border select-text';

const TEXT = Object.freeze({
    noWorld: 'This save has no world: it was made before worlds existed. Start a new game, or preview one.',
    thisWorld: (world) => `This game's world: seed ${world.seed}, ${world.cells.length} cells, ${world.problems.length} problems`,
    seedLabel: 'Seed',
    met: (r) => `${r.cells} frontier cells: ${r.items} items topped up, ${r.skills} skills raised on the first hero`,
    settled: (r) => `Settled ${r.region.practicalName} (${r.region.flavourName}): ${r.enemies} enemies hold it`,
    beaten: (r) => `${r.beaten} enemies beaten: the mat is the guild's`,
    jumped: 'The tutorial is at its last step: the world map opens with it'
});

/**
 * Meet the frontier's prices: every item the frontier cells ask for topped up in the Bank, and
 * their skills raised on the first hero, so Settle can be tried at once (`worldDev.js`). Settle a
 * fixture place of each kit for free (its mat, its Stone and its darkened arrival), beat that
 * arrival at once, and skip the tutorial to its last step, which opens the world map.
 *
 * The world in words: this game's world, or a preview of any seed (never kept).
 */
export function AtlasDevSection() {
    const [status, setStatus] = useState('');
    const [dump, setDump] = useState('');
    const [seed, setSeed] = useState('1');
    const meet = () => {
        const result = meetFrontierPrices();
        setStatus(result.success ? TEXT.met(result) : result.reason);
    };
    const settle = (kit) => {
        const result = settleFixture(kit);
        setStatus(result.success ? TEXT.settled(result) : result.reason);
    };
    const beat = () => {
        const result = beatArrival();
        setStatus(result.success ? TEXT.beaten(result) : result.reason);
    };
    const jump = () => {
        const result = jumpTutorialToWorld();
        setStatus(result.success ? TEXT.jumped : result.reason);
    };
    const world = World.currentWorld();
    const showCurrent = () => setDump(world ? World.describeWorld(world) : TEXT.noWorld);
    const preview = (value) => {
        const n = Math.max(0, Math.floor(Number(value) || 0));
        setSeed(String(n));
        setDump(World.describeWorld(World.previewWorld(n)));
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-atlas">
            <div className={labelClass}>Atlas (dev only)</div>
            <button type="button" data-qa-world-meet className={buttonClass} onClick={meet}>Meet the frontier&apos;s prices</button>
            <div className="ui-text-body text-gi-muted">Settle a ring-1 place for free, written from its kit, and go there:</div>
            <div className="flex flex-wrap gap-2">
                {FIXTURE_KITS.map(([kit, name]) => (
                    <button key={kit} type="button" data-qa-world-fixture={kit} className={buttonClass} onClick={() => settle(kit)}>{name}</button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" data-qa-world-beat className={buttonClass} onClick={beat}>Beat this mat&apos;s arrival</button>
                <button type="button" data-qa-world-tutorial className={buttonClass} onClick={jump}>Tutorial: jump to the world map step</button>
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-world-said>{status}</div>}

            <div className={labelClass}>World (dev only)</div>
            <div className="ui-text-body text-gi-muted" data-qa-world-status>{world ? TEXT.thisWorld(world) : TEXT.noWorld}</div>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" data-qa-world-show className={buttonClass} onClick={showCurrent}>Show this game's world</button>
                <label className="ui-text-body text-gi-muted flex items-center gap-1">
                    {TEXT.seedLabel}
                    <input
                        type="number" min="0" value={seed} data-qa-world-seed
                        onChange={(e) => setSeed(e.target.value)}
                        className="w-24 px-1 py-0.5 rounded bg-black/30 border border-gi-border text-xs"
                    />
                </label>
                <button type="button" data-qa-world-preview className={buttonClass} onClick={() => preview(seed)}>Preview this seed</button>
                <button type="button" data-qa-world-next className={buttonClass} onClick={() => preview(Number(seed) + 1)}>Next seed</button>
                {dump && <button type="button" data-qa-world-hide className={buttonClass} onClick={() => setDump('')}>Hide</button>}
            </div>
            {dump && <pre className={dumpClass} data-qa-world-dump>{dump}</pre>}
        </div>
    );
}

export default AtlasDevSection;
