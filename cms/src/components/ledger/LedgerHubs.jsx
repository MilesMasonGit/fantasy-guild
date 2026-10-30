import { useMemo, useState } from 'react';

import { useEntityStore } from '../../stores/useEntityStore';
import { effectiveTier } from '../../engine/ledgerPage';
import { itemKey } from '../../../../src/systems/progression/ledger/engine.js';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { tierColor } from './LedgerTree';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const SHOWN = 20;
const W = 330;
const NAME_W = 118;
const ROW = 19;

/**
 * The hubs: items ranked by how many recipes, builds and Tokens spend them (where balance hinges),
 * a bar each coloured by its tier. A name opens the item's page; a bar narrows the problems list
 * beside it to the item and everything that spends it.
 */
export default function LedgerHubs({ report, onOpen, selected, onSelect }) {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const recipePools = useEntityStore((s) => s.recipePools);
  const { ledger } = report;
  const [all, setAll] = useState(false);
  const hubs = useMemo(() => {
    const state = { items, tokens, recipePools };
    return ledger.hubs().map((h) => ({ ...h, key: itemKey(h.id), tier: effectiveTier(state, ledger, itemKey(h.id)) }));
  }, [ledger, items, tokens, recipePools]);
  const shown = all ? hubs : hubs.slice(0, SHOWN);
  const most = Math.max(1, ...hubs.map((h) => h.uses));
  const barW = W - NAME_W - 30;
  const name = (key) => ledger.world.names.get(key) ?? key;

  return (
    <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Hubs">
      <h3 className={sectionHead}>Hubs</h3>
      <p className="text-[10px] text-gray-500">Items by how many recipes, builds and Tokens spend them. A name opens its page; a bar lists its problems and its users'.</p>
      <svg viewBox={`0 0 ${W} ${shown.length * ROW + 4}`} width="100%" role="img" aria-label="Hubs by how many things spend them" style={{ display: 'block' }}>
        {shown.map((h, i) => {
          const y = i * ROW + 2;
          const w = Math.max(2, (h.uses / most) * barW);
          const color = tierColor(h.tier);
          const on = selected === h.key;
          return (
            <g key={h.key} data-hub={h.id}>
              <text x={NAME_W - 6} y={y + 12} fontSize={10} fill={on ? '#ffffff' : '#e5e7eb'} textAnchor="end" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onOpen(h.key)} data-hub-name={h.id}>
                <title>{`${h.name} · ${tierLabel(h.tier)}: open its page`}</title>
                {h.name.length > 20 ? `${h.name.slice(0, 19)}…` : h.name}
              </text>
              <g style={{ cursor: 'pointer' }} onClick={() => onSelect(on ? null : h.key, h)} data-hub-bar={h.id}>
                <title>{`Spent by ${h.uses}: ${h.consumers.slice(0, 12).map(name).join(', ')}${h.consumers.length > 12 ? ` and ${h.consumers.length - 12} more` : ''}. ${on ? 'Click to list every problem again.' : 'Click to list the problems of it and its users.'}`}</title>
                <rect x={NAME_W} y={y + 2} width={barW + 26} height={ROW - 4} fill="transparent" />
                <rect x={NAME_W} y={y + 3} width={w} height={ROW - 6} rx={2} fill={color} fillOpacity={on ? 1 : 0.7} stroke={on ? '#ffffff' : 'none'} />
                <text x={NAME_W + w + 4} y={y + 12} fontSize={10} fill="#9ca3af">{h.uses}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {hubs.length > SHOWN && (
        <button onClick={() => setAll((v) => !v)} className="text-[10px] underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          {all ? `Show the top ${SHOWN}` : `Show all ${hubs.length}`}
        </button>
      )}
    </section>
  );
}

/** What a hub narrows the problems list to: the item and every entry that spends it. */
export function hubScope(hub) {
  return { key: hub.key, name: hub.name, keys: new Set([hub.key, ...hub.consumers]) };
}
