// The QA panel's Limes section: make Limes speak by itself, on the mat or through a screen's small
// Limes, with the gold outline on a target, as the lessons will.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { openLimesStep, closeLimesStep, noteLimesMoved, LIMES_MAT } from '../components/limes/limesStore.js';
import { LIMES_TARGET } from '../components/limes/limesMark.js';
import * as LimesGuide from '../../systems/quests/LimesGuide.js';
import { GUILD_HALL_TYPE } from '../../systems/atlas/StarterCamp.js';
import { GameState } from '../../state/GameState.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

const QA_STEP = 'qa_limes_step';
const QA_LINES = [
    'Blorp! This is a test step: I opened by myself, and I stay until the step is done.',
    'Close only shrinks me to a little bubble. Click it, or me, to open me again.',
    'The QA panel\'s Close the step button ends me.'
];

/** The first item in the Bank, for the Bank item outline. */
const firstBankItem = () => Object.keys(GameState.state?.inventory?.items || {})[0] || null;

const STEPS = [
    { key: 'mat', label: 'Limes speaks by itself on the mat', step: { spot: LIMES_MAT } },
    { key: 'hall', label: 'On the mat, the Guild Hall outlined', step: { spot: LIMES_MAT, target: { kind: LIMES_TARGET.TOKEN_TYPE, id: GUILD_HALL_TYPE } } },
    { key: 'bank', label: 'Bank\'s Limes carries it, the Bank orb outlined', step: { spot: 'bank', target: { kind: LIMES_TARGET.NAV, id: 'bank' } } },
    { key: 'bankItem', label: 'Bank\'s Limes carries it, a Bank item outlined', step: () => ({ spot: 'bank', target: { kind: LIMES_TARGET.BANK_ITEM, id: firstBankItem() } }) },
    { key: 'shop', label: 'Shop\'s Limes carries it, the Shop orb outlined', step: { spot: 'shop', target: { kind: LIMES_TARGET.NAV, id: 'shop' } } },
    { key: 'world', label: 'World map\'s Limes carries it', step: { spot: 'worldMap', target: { kind: LIMES_TARGET.NAV, id: 'atlas' } } },
    { key: 'guildHall', label: 'Guild Hall\'s Limes carries it, Bunk Beds outlined', step: { spot: 'guildHall', target: { kind: LIMES_TARGET.HALL_STAR, id: 'roster_size' } } },
    { key: 'heroDrawer', label: 'Hero drawer\'s Limes carries it', step: { spot: 'heroDrawer' } },
    { key: 'hallStar', label: 'Upgrade drawer\'s Limes carries it', step: { spot: 'hallStar' } },
    { key: 'tokenCard', label: 'Token card\'s Limes carries it', step: { spot: 'tokenCard' } },
    { key: 'fight', label: 'Fight window\'s Limes carries it', step: { spot: 'fight' } },
    { key: 'encyclopedia', label: 'Encyclopedia\'s Limes carries it', step: { spot: 'encyclopedia' } },
    { key: 'foundation', label: 'Foundation card\'s Limes carries it, the Shop orb outlined', step: { spot: 'foundation', target: { kind: LIMES_TARGET.NAV, id: 'shop' } } }
];

export function LimesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-limes">
            <div className={labelClass}>Limes (dev only)</div>
            <div className="flex flex-wrap gap-1">
                {STEPS.map(({ key, label, step }) => (
                    <button
                        key={key}
                        type="button"
                        data-qa-limes-step={key}
                        className={buttonClass}
                        onClick={() => {
                            const s = typeof step === 'function' ? step() : step;
                            openLimesStep({ id: QA_STEP, lines: QA_LINES, ...s });
                            setStatus(`${label}. Open that screen to see it`);
                        }}
                    >
                        {label}
                    </button>
                ))}
                <button
                    type="button"
                    data-qa-limes-close
                    className={buttonClass}
                    onClick={() => { closeLimesStep(QA_STEP); setStatus('The step is done: bubble, glow and outline gone'); }}
                >
                    Close the step
                </button>
                <button
                    type="button"
                    data-qa-limes-corner
                    className={buttonClass}
                    onClick={() => { LimesGuide.setLimesSpot(null); noteLimesMoved(); setStatus('Limes is back in its corner'); }}
                >
                    Limes back to its corner
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
