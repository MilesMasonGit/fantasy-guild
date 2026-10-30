import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { workspaceContent } from '../../stores/useLedgerWatchStore';
import { runLedgerJob } from '../../engine/ledgerJobsClient';
import { gateStatus } from '../../engine/packGate';
import { declaredStages } from '../../engine/packIntent';
import LedgerChanges from '../ledger/LedgerChanges';

const LOOK = {
  pass: { word: 'Gate passed', color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)', Icon: ShieldCheck },
  block: { word: 'Gate blocked', color: 'var(--color-error)', bg: 'rgba(239,68,68,0.12)', Icon: ShieldAlert },
  stale: { word: 'Gate stale', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.10)', Icon: ShieldQuestion },
  none: { word: 'Not gated', color: 'var(--color-text-muted)', bg: 'transparent', Icon: ShieldQuestion },
};

/**
 * The gate's state on a pack's card in the inbox: what the review page found when it last ran it
 * against this workspace, else what the agent's own run says (`stale` once the workspace differs).
 */
export function GateBadge({ summary, fingerprintNow }) {
  const fresh = useReviewStore((s) => s.gates[summary.file]);
  const status = fresh && fresh.workspaceFingerprint === fingerprintNow ? fresh.verdict : gateStatus(summary.gate, fingerprintNow);
  const look = LOOK[status];
  const title = status === 'none' ? 'The agent did not run the gate; it runs when you open the pack.'
    : status === 'stale' ? 'The agent ran the gate against another workspace; it runs again when you open the pack.'
      : (fresh?.summary || summary.gate?.summary || '');
  return (
    <span className="text-[10px] font-bold inline-flex items-center gap-1 mt-1" style={{ color: look.color }} title={title} data-gate-badge={status}>
      <look.Icon size={11} /> {look.word}{summary.declares ? ` · declares ${summary.declares} stage move${summary.declares === 1 ? '' : 's'}` : ''}
    </span>
  );
}

/**
 * The agent gate at the top of a pack's review (`engine/packGate.js`): run again on open against
 * the workspace as it is now, in the ledger's Worker. Says in plain words whether the pack passes,
 * why it is blocked, what it declares, and what it moves.
 */
export default function PackGate({ file, pack, onOpenEntry = null }) {
  const [state, setState] = useState({ running: true, result: null, error: null });
  const setGate = useReviewStore((s) => s.setGate);
  const alive = useRef(true);

  const run = useCallback(async () => {
    setState({ running: true, result: null, error: null });
    try {
      const result = await runLedgerJob('gate', { workspace: workspaceContent(useEntityStore.getState()), pack });
      if (!alive.current) return;
      setState({ running: false, result, error: null });
      setGate(file, { verdict: result.verdict, summary: result.summary, workspaceFingerprint: result.workspaceFingerprint });
    } catch (err) {
      if (alive.current) setState({ running: false, result: null, error: err.message });
    }
  }, [file, pack, setGate]);

  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);

  const { running, result, error } = state;
  const look = result ? LOOK[result.verdict] : LOOK.none;
  const declared = declaredStages(pack);

  return (
    <section className="p-4 rounded-lg border space-y-3" data-testid="pack-gate" data-verdict={result?.verdict || (running ? 'running' : 'error')}
      style={{ background: look.bg, borderColor: result ? look.color : 'var(--color-border-subtle)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <look.Icon size={18} style={{ color: look.color, marginTop: 1 }} />
          <div>
            <div className="text-sm font-bold" style={{ color: look.color }}>
              {running ? 'Running the gate…' : error ? 'The gate could not run' : look.word}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {running ? 'Working the ledger out before and after this pack, against the workspace as it is now.'
                : error ? error
                  : result.summary}
            </p>
          </div>
        </div>
        <button className="btn-ghost flex items-center gap-1 text-xs shrink-0" disabled={running} onClick={run} title="Run the gate again against the workspace as it is now">
          <RefreshCw size={12} /> Run again
        </button>
      </div>

      {result?.blocks.length > 0 && (
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-error)' }}>Why it is blocked</div>
          <ul className="text-xs list-disc pl-5 mt-1 space-y-0.5" style={{ color: 'var(--color-text-primary)' }} data-testid="gate-blocks">
            {result.blocks.map((b, i) => <li key={i}>{b.message}</li>)}
          </ul>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            An agent must not send a blocked pack. You can still accept or reject its entries; problems the workspace already had never block.
          </p>
        </div>
      )}
      {declared.size > 0 && (
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>The pack declares </span>
          {[...declared.values()].map((d) => `stage ${d.tier} ${d.move}${d.toHours ? ` (to about ${d.toHours} h)` : ''}: ${d.note}`).join(' · ')}
        </div>
      )}
      {result?.notes.length > 0 && (
        <ul className="text-[11px] list-disc pl-5 space-y-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {result.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      {result?.diff && <LedgerChanges diff={result.diff} declared={declared} limit={15} onOpen={onOpenEntry} />}
    </section>
  );
}
