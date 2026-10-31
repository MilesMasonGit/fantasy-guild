import { useState } from 'react';
import { moveText, stageMoveText } from '../../engine/ledgerCompare';
import { SEVERITY_COLOR } from './LedgerProblems';
import { OTHER_LANE } from '../../engine/ledgerTimeline';
import { PACE_TEXT } from '../../../../src/systems/progression/ledger/pace.js';

const laneName = (id) => (id === OTHER_LANE ? 'No skill level' : PACE_TEXT.skill(id));

export const EARLIER = '#22d3ee';
export const LATER = '#fbbf24';
export const GONE = '#f87171';
export const NEW = '#a3e635';

const CHANGE = {
  earlier: { word: 'Earlier', color: EARLIER },
  later: { word: 'Later', color: LATER },
  lane: { word: 'Other level', color: 'var(--color-text-secondary)' },
  new: { word: 'Newly reached', color: NEW },
  gone: { word: 'No longer reached', color: GONE },
};

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

/**
 * A before-and-after comparison (`engine/ledgerCompare.js`) as cards and a list: the stages that
 * moved (red beyond the tolerance), the checks turned red and green, and every moved entry,
 * furthest first. Shared by the Ledger's timeline and the change-pack review's gate.
 */
export default function LedgerChanges({ diff, onOpen = null, limit = 40, declared = null }) {
  const [all, setAll] = useState(false);
  const stages = diff.stages.filter((s) => s.pct || s.lost);
  const shown = all ? diff.moved : diff.moved.slice(0, limit);
  const serious = (list) => list.filter((f) => f.severity !== 'info');

  return (
    <div className="space-y-3" data-testid="ledger-changes">
      <div className="flex flex-wrap gap-2">
        {stages.length === 0 && <Card label="Stages" text="No stage time changes." />}
        {stages.map((s) => {
          const intent = declared?.get(s.tier);
          return (
            <Card
              key={s.tier}
              label={`Stage${s.beyond ? ` · beyond ±${diff.tolerancePct} %` : ''}${intent ? ` · declared ${intent.move}` : ''}`}
              text={stageMoveText(s)}
              color={s.beyond ? (intent && intent.move === s.direction ? 'var(--color-warning)' : 'var(--color-error)') : undefined}
              data-stage-move={s.tier}
            />
          );
        })}
        <Card
          label="Checks"
          text={`${serious(diff.added).length} problem${serious(diff.added).length === 1 ? '' : 's'} added · ${serious(diff.cleared).length} cleared${diff.added.length - serious(diff.added).length ? ` · ${diff.added.length - serious(diff.added).length} note${diff.added.length - serious(diff.added).length === 1 ? '' : 's'} added` : ''}`}
          color={diff.added.some((f) => f.severity === 'block') ? 'var(--color-error)' : undefined}
        />
      </div>

      {(diff.added.length > 0 || diff.cleared.length > 0) && (
        <ul className="text-[11px] space-y-0.5" aria-label="Checks turned on and off">
          {diff.added.map((f, i) => (
            <li key={`a${i}`} style={{ color: SEVERITY_COLOR[f.severity] }}>
              + {f.severity}: {f.name ? `${f.name}: ` : ''}{f.message}
            </li>
          ))}
          {diff.cleared.map((f, i) => (
            <li key={`c${i}`} style={{ color: 'var(--color-success)' }}>
              − cleared {f.severity}: {f.name ? `${f.name}: ` : ''}{f.message}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h4 className={sectionHead}>Moved entries ({diff.moved.length})</h4>
        {diff.moved.length === 0 ? (
          <p className="text-[11px] text-gray-500 mt-1">Nothing moves on the timeline.</p>
        ) : (
          <table className="w-full mt-1" style={{ borderCollapse: 'collapse' }} aria-label="Moved entries">
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'left' }}>Entry</th>
                <th style={{ ...head, textAlign: 'left', width: 130 }}>Change</th>
                <th style={{ ...head, textAlign: 'left' }}>First reach at Typical</th>
                <th style={{ ...head, textAlign: 'left', width: 110 }}>Lane</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.key} data-moved={m.key}>
                  <td style={{ ...cell, color: 'var(--color-text-primary)' }}>
                    {onOpen ? (
                      <button onClick={() => onOpen(m.key)} className="underline text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>{m.name}</button>
                    ) : m.name}
                  </td>
                  <td style={{ ...cell, color: CHANGE[m.change].color, fontWeight: 700 }}>{CHANGE[m.change].word}</td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{moveText(m)}</td>
                  <td style={{ ...cell, color: 'var(--color-text-muted)' }}>{laneName((m.to || m.from).lane)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {diff.moved.length > limit && (
          <button className="text-[11px] mt-1 underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} onClick={() => setAll((v) => !v)}>
            {all ? 'Show the furthest only' : `Show all ${diff.moved.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ label, text, color, ...rest }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: color || 'var(--color-border-subtle)', background: 'rgba(255,255,255,0.02)', minWidth: 200 }} {...rest}>
      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: color || 'var(--color-text-muted)' }}>{label}</div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{text}</div>
    </div>
  );
}
