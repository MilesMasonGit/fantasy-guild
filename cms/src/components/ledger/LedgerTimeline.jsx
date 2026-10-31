import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { timelineOf, timeTicks, OTHER_LANE, CROWD_MIN, EMPTY_LEVELS } from '../../engine/ledgerTimeline';
import { effectiveTier } from '../../engine/ledgerPage';
import { hoursText } from '../../engine/ledgerPace';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { tierColor } from './LedgerTree';
import { useLedgerWatchStore } from '../../stores/useLedgerWatchStore';
import { compareSnapshots, moveText } from '../../engine/ledgerCompare';
import LedgerChanges, { EARLIER, LATER, GONE, NEW } from './LedgerChanges';

/** What the ghosts compare with: nothing, the workspace before the last edit, or what the last Sync wrote. */
const COMPARE = [['off', 'Off'], ['edit', 'Before the last edit'], ['sync', 'Since the last Sync']];
const GHOST_COLOR = { earlier: EARLIER, later: LATER, lane: '#e5e7eb', gone: GONE };
const MAX_GHOSTS = 250;

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const cell = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' };

const W = 1080;
const GUTTER = 118;
const RIGHT = 14;
const PLOT = 62;
const LABEL_ROW = 14;
const LANE_GAP = 10;
const OTHER_ROWS = 4;
const WALL_BAR = 9;
const WALL = '#ef4444';
const CROWD = '#facc15';
const TRACK = '#e5e7eb';
const CURVE = '#60a5fa';

/**
 * The Ledger's timeline: a lane per skill, time from a new game across (a log scale, at the Typical
 * player's rates), the level the skill has reached drawn as a line with the pace curve dashed beside
 * it; every item and Token a dot at its first reach (at the level its own step asks), coloured by
 * tier; walls hatched red and labelled with what holds them up; crowded spots glowing, empty
 * stretches grey; the stages' finish and budget as lines across. A dot or a wall's label opens the
 * entry's page; a lane's name its row on the Pace page.
 * Before and after: ghost dots where entries were before the last edit or at the last Sync, with an
 * arrow to where they are now, and the moved entries listed below (`useLedgerWatchStore`, worked
 * out in the ledger's Worker after every edit).
 */
export default function LedgerTimeline({ report, onRefresh, onOpen, onOpenSkill = () => {} }) {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const recipePools = useEntityStore((s) => s.recipePools);
  const { pace, ledger, findings } = report;
  const [compare, setCompare] = useState('off');
  const current = useLedgerWatchStore((s) => s.current);
  const previous = useLedgerWatchStore((s) => s.previous);
  const sync = useLedgerWatchStore((s) => s.sync);
  const syncLoading = useLedgerWatchStore((s) => s.syncLoading);
  const syncError = useLedgerWatchStore((s) => s.syncError);
  const busy = useLedgerWatchStore((s) => s.busy);
  const loadSync = useLedgerWatchStore((s) => s.loadSync);
  useEffect(() => { if (compare === 'sync' && !sync && !syncLoading && !syncError) loadSync(); }, [compare, sync, syncLoading, syncError, loadSync]);
  const base = compare === 'edit' ? previous : compare === 'sync' ? sync : null;
  const diff = useMemo(() => (base && current ? compareSnapshots(base, current) : null), [base, current]);
  const timeline = useMemo(() => {
    if (!pace) return null;
    const state = { items, tokens, recipePools };
    return timelineOf(pace, ledger, { tierOf: (key) => effectiveTier(state, ledger, key), findings });
  }, [pace, ledger, findings, items, tokens, recipePools]);
  if (!timeline) return <p className="text-sm text-gray-500">The pace is not worked out.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">
          When a new game first has each item and Token at the Typical player's rates, by the skill whose level its own step asks.
          {timeline.unreached > 0 && ` ${timeline.unreached} never reached (Planned, or no way in) are not drawn.`}
        </p>
        <button
          onClick={onRefresh}
          title={`Worked out at ${report.at.toLocaleTimeString()}. Work it out again after edits.`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Timeline">
        <div className="flex items-center justify-between gap-3">
          <h3 className={sectionHead}>Timeline at Typical</h3>
          <CompareBar compare={compare} setCompare={setCompare} />
        </div>
        <Legend ghosts={!!diff} />
        <CompareNote compare={compare} diff={diff} current={current} base={base} report={report} busy={busy} syncLoading={syncLoading} syncError={syncError} onRetry={loadSync} />
        <TimelineChart timeline={timeline} onOpen={onOpen} onOpenSkill={onOpenSkill} diff={diff} />
      </section>

      {diff && (
        <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="What moved">
          <h3 className={sectionHead}>{compare === 'edit' ? 'What the last edit moved' : 'What moved since the last Sync'}</h3>
          <LedgerChanges diff={diff} onOpen={onOpen} />
        </section>
      )}

      <section className="rounded-xl border bg-[#1a1a1e] border-white/10 p-4 space-y-2" aria-label="Lanes">
        <h3 className={sectionHead}>By skill</h3>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left', width: 120 }}>Skill</th>
              <th style={{ ...head, textAlign: 'left', width: 70 }}>Unlocks</th>
              <th style={{ ...head, textAlign: 'left', width: 270 }}>To the top level asked</th>
              <th style={{ ...head, textAlign: 'left' }}>Walls</th>
              <th style={{ ...head, textAlign: 'left', width: 170 }}>Crowded · empty</th>
            </tr>
          </thead>
          <tbody>
            {timeline.lanes.map((lane) => {
              const last = lane.track[lane.track.length - 1];
              const curve = lane.curve[lane.curve.length - 1];
              return (
                <tr key={lane.id} data-lane-row={lane.id}>
                  <td style={{ ...cell, color: 'var(--color-text-primary)' }}>{lane.name}</td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{lane.dots.length}</td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                    {lane.top > 1 ? `Level ${lane.top}: ${hoursText(last.hours)} (curve ${hoursText(curve.hours)})` : '—'}
                  </td>
                  <td style={{ ...cell, color: lane.walls.length ? WALL : 'var(--color-text-muted)' }}>
                    {lane.walls.length ? lane.walls.map((w) => `${w.from} → ${w.to} (${hoursText(w.hours)}): ${w.blocker}`).join('; ') : 'none'}
                  </td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>
                    {lane.crowded.length} crowded · {lane.empty.length} empty
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CompareBar({ compare, setCompare }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Before and after">
      <span className="text-[10px] text-gray-500 mr-1">Ghosts:</span>
      {COMPARE.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setCompare(key)}
          aria-pressed={compare === key}
          className="px-2 py-1 rounded text-[11px] font-bold"
          style={{
            background: compare === key ? 'var(--color-accent-muted)' : 'transparent',
            color: compare === key ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border-subtle)', cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** What the ghosts are showing, or why there are none yet. */
function CompareNote({ compare, diff, current, base, report, busy, syncLoading, syncError, onRetry }) {
  if (compare === 'off') return null;
  let text;
  if (compare === 'sync' && syncError) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>
        Could not read what the last Sync wrote: {syncError}. <button className="underline" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={onRetry}>Try again</button>
      </p>
    );
  }
  if (compare === 'sync' && syncLoading) text = 'Working out what the last Sync wrote…';
  else if (!current) text = busy ? 'Working out the ledger in the background…' : 'The before-and-after is not worked out yet.';
  else if (compare === 'edit' && !base) text = 'No edit since the CMS opened: the ghosts show where entries were before your next edit.';
  else if (diff) {
    text = diff.moved.length
      ? `Hollow dots: where ${diff.moved.length} entr${diff.moved.length === 1 ? 'y was' : 'ies were'} ${compare === 'edit' ? 'before the last edit' : 'at the last Sync'}; the arrow points to where it is now.`
      : `Nothing has moved ${compare === 'edit' ? 'with the last edit' : 'since the last Sync'}.`;
    if (current.at > report.at.getTime()) text += ' The dots are as of the last Refresh; Refresh to draw them where they are now.';
  }
  return <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }} data-compare-note>{text}{busy && current ? ' (updating…)' : ''}</p>;
}

function Legend({ ghosts = false }) {
  const item = (swatch, text) => (
    <span className="inline-flex items-center gap-1.5 mr-4">{swatch}<span>{text}</span></span>
  );
  return (
    <p className="text-[10px] text-gray-500">
      {item(<svg width={18} height={8}><line x1={0} y1={4} x2={18} y2={4} stroke={TRACK} strokeWidth={1.5} /></svg>, 'level at Typical')}
      {item(<svg width={18} height={8}><line x1={0} y1={4} x2={18} y2={4} stroke={CURVE} strokeWidth={1.5} strokeDasharray="4 3" /></svg>, 'pace curve')}
      {item(<svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="#4ade80" /></svg>, 'first reach (colour: tier)')}
      {item(<svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="#4ade80" stroke={WALL} strokeWidth={1.5} /></svg>, 'a long wait for that one unlock')}
      {item(<svg width={18} height={10}><rect width={18} height={10} fill="url(#ledger-hatch-legend)" /><defs><Hatch id="ledger-hatch-legend" /></defs></svg>, 'wall')}
      {item(<svg width={18} height={10}><rect width={18} height={10} rx={3} fill={CROWD} opacity={0.22} /></svg>, `crowded (${CROWD_MIN}+ at once)`)}
      {item(<svg width={18} height={10}><rect width={18} height={10} fill="rgba(156,163,175,0.16)" /></svg>, `empty (nothing new for ${EMPTY_LEVELS} curve levels)`)}
      {ghosts && item(<svg width={22} height={10}><circle cx={5} cy={5} r={3.5} fill="none" stroke={EARLIER} strokeDasharray="2 1.5" /><line x1={10} y1={5} x2={21} y2={5} stroke={EARLIER} /></svg>, 'was here, now earlier')}
      {ghosts && item(<svg width={22} height={10}><circle cx={5} cy={5} r={3.5} fill="none" stroke={LATER} strokeDasharray="2 1.5" /><line x1={10} y1={5} x2={21} y2={5} stroke={LATER} /></svg>, 'now later')}
      {ghosts && item(<svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="none" stroke={GONE} strokeDasharray="2 1.5" /></svg>, 'no longer reached')}
      {ghosts && item(<svg width={12} height={12}><circle cx={6} cy={6} r={5} fill="none" stroke={NEW} strokeWidth={1.5} /></svg>, 'newly reached')}
    </p>
  );
}

function Hatch({ id }) {
  return (
    <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={6} height={6} fill="rgba(239,68,68,0.18)" />
      <line x1={0} y1={0} x2={0} y2={6} stroke={WALL} strokeWidth={2.5} strokeOpacity={0.9} />
    </pattern>
  );
}

function laneY(lane, top, plot, level) {
  const bottom = top + plot;
  return lane.top > 1 ? bottom - 4 - ((level - 1) / (lane.top - 1)) * (plot - WALL_BAR - 8) : bottom - plot / 2;
}

const otherY = (top, i) => top + 8 + (i % OTHER_ROWS) * 9;

function TimelineChart({ timeline, onOpen, onOpenSkill, diff = null }) {
  const lo = 1 / 60;
  const hi = Math.max(timeline.maxHours * 1.15, 1);
  const x0 = GUTTER;
  const x1 = W - RIGHT;
  const x = (h) => x0 + ((Math.log(Math.max(h, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (x1 - x0);
  const ticks = timeTicks(lo, hi);

  const AXIS = 18 + Math.max(1, timeline.stages.length) * 13;
  let y = AXIS;
  const lanes = timeline.lanes.map((lane) => {
    const plot = lane.id === OTHER_LANE ? OTHER_ROWS * 9 + 8 : PLOT;
    const top = y;
    y += plot + lane.walls.length * LABEL_ROW + LANE_GAP;
    return { lane, top, plot };
  });
  const height = y + 22;
  const stageBits = timeline.stages.map((s, i) => ({ ...s, color: tierColor(s.tier), row: i }));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Timeline: a lane per skill against the pace curve" style={{ display: 'block' }}>
      <defs><Hatch id="ledger-hatch" /></defs>

      {ticks.map((t) => (
        <g key={t.hours}>
          <line x1={x(t.hours)} x2={x(t.hours)} y1={AXIS - 4} y2={height - 22} stroke="rgba(255,255,255,0.06)" />
          <text x={x(t.hours)} y={height - 8} fontSize={9} fill="#9ca3af" textAnchor="middle">{t.hours === lo ? '≤ 1 min' : t.text}</text>
        </g>
      ))}

      {stageBits.map((s) => (
        <g key={s.tier} data-stage-mark={s.tier}>
          <line x1={x(s.budgetHours)} x2={x(s.budgetHours)} y1={AXIS - 6} y2={height - 22} stroke={s.color} strokeOpacity={0.5} strokeDasharray="2 4" />
          {Number.isFinite(s.hours) && (
            <line x1={x(s.hours)} x2={x(s.hours)} y1={AXIS - 6} y2={height - 22} stroke={s.color} strokeOpacity={0.8} strokeWidth={1.25} />
          )}
          <text x={Number.isFinite(s.hours) ? x(s.hours) + 3 : x1} y={12 + s.row * 13} fontSize={9} fill={s.color} textAnchor={Number.isFinite(s.hours) && x(s.hours) > x1 - 220 ? 'end' : 'start'}>
            <title>{`${s.label}: everything planned for it is first had ${hoursText(s.hours)} into a new game at Typical; its budget is ${hoursText(s.budgetHours)} (the dotted line).`}</title>
            {`${s.label} done ${hoursText(s.hours)}${s.complete ? '' : '*'} · budget ${hoursText(s.budgetHours)}`}
          </text>
        </g>
      ))}

      {lanes.map(({ lane, top, plot }) => (
        <Lane key={lane.id} lane={lane} top={top} plot={plot} x={x} x0={x0} x1={x1} onOpen={onOpen} onOpenSkill={onOpenSkill} />
      ))}

      {diff && <Ghosts diff={diff} lanes={lanes} x={x} onOpen={onOpen} />}
    </svg>
  );
}

/**
 * The ghosts of a comparison: a hollow dot where each moved entry was, an arrow to where it is
 * drawn now (or, when the dots are older than the comparison, to where it is now), and a ring
 * round each newly reached one.
 */
function Ghosts({ diff, lanes, x, onOpen }) {
  const geo = new Map(lanes.map((g) => [g.lane.id, g]));
  const drawn = new Map();
  for (const { lane, top, plot } of lanes) {
    lane.dots.forEach((d, i) => drawn.set(d.key, { x: x(d.hours), y: lane.id === OTHER_LANE ? otherY(top, i) : laneY(lane, top, plot, d.level ?? 1) }));
  }
  const at = (where) => {
    if (!where) return null;
    const g = geo.get(where.lane);
    if (!g) return null;
    // A lane is as tall as the top level asked now, so a ghost at a level no longer asked sits at its top.
    return { x: x(where.hours), y: where.lane === OTHER_LANE ? otherY(g.top, 1) : laneY(g.lane, g.top, g.plot, Math.min(where.level ?? 1, g.lane.top)) };
  };
  const moved = diff.moved.filter((m) => m.change !== 'new').slice(0, MAX_GHOSTS);
  const fresh = diff.moved.filter((m) => m.change === 'new').slice(0, MAX_GHOSTS);

  return (
    <g data-ghosts>
      <defs>
        {Object.entries(GHOST_COLOR).map(([change, color]) => (
          <marker key={change} id={`ledger-arrow-${change}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={color} />
          </marker>
        ))}
      </defs>
      {moved.map((m) => {
        const from = at(m.from);
        if (!from) return null;
        const to = m.change === 'gone' ? null : drawn.get(m.key) ?? at(m.to);
        const color = GHOST_COLOR[m.change];
        const len = to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
        const k = len > 9 ? (len - 5) / len : 0;
        return (
          <g key={m.key} data-ghost={m.key} style={{ cursor: 'pointer' }} onClick={() => onOpen(m.key)}>
            <title>{`${m.name}: ${moveText(m)}`}</title>
            {to && k > 0 && (
              <line x1={from.x} y1={from.y} x2={from.x + (to.x - from.x) * k} y2={from.y + (to.y - from.y) * k} stroke={color} strokeOpacity={0.75} strokeWidth={1} markerEnd={`url(#ledger-arrow-${m.change})`} />
            )}
            <circle cx={from.x} cy={from.y} r={4} fill="rgba(15,15,18,0.6)" stroke={color} strokeWidth={1.25} strokeDasharray="2 1.5" />
          </g>
        );
      })}
      {fresh.map((m) => {
        const to = drawn.get(m.key) ?? at(m.to);
        if (!to) return null;
        return (
          <circle key={m.key} cx={to.x} cy={to.y} r={6.5} fill="none" stroke={NEW} strokeWidth={1.5} data-ghost-new={m.key} pointerEvents="none">
            <title>{`${m.name}: ${moveText(m)}`}</title>
          </circle>
        );
      })}
    </g>
  );
}

function Lane({ lane, top, plot, x, x0, x1, onOpen, onOpenSkill }) {
  const other = lane.id === OTHER_LANE;
  const bottom = top + plot;
  const y = (level) => laneY(lane, top, plot, level);
  const line = (points) => points.filter((p) => Number.isFinite(p.hours)).map((p) => `${x(p.hours).toFixed(1)},${y(p.level).toFixed(1)}`).join(' ');
  const dotY = (d, i) => (other ? otherY(top, i) : y(d.level ?? 1));

  return (
    <g data-lane={lane.id}>
      <rect x={x0} y={top} width={x1 - x0} height={plot} fill="rgba(255,255,255,0.02)" />
      {other ? (
        <text x={8} y={top + 14} fontSize={11} fontWeight={700} fill="#9ca3af">{lane.name}</text>
      ) : (
        <text x={8} y={top + 14} fontSize={11} fontWeight={700} fill="#e5e7eb" style={{ cursor: 'pointer' }} onClick={() => onOpenSkill(lane.id)} data-lane-name={lane.id}>
          <title>Open its row on the Pace page</title>
          {lane.name}
        </text>
      )}
      {!other && lane.top > 1 && (
        <>
          <text x={x0 - 6} y={y(lane.top) + 3} fontSize={8} fill="#6b7280" textAnchor="end">{`Lv ${lane.top}`}</text>
          <text x={x0 - 6} y={y(1) + 3} fontSize={8} fill="#6b7280" textAnchor="end">Lv 1</text>
        </>
      )}

      {lane.empty.map((e) => (
        <rect key={`e${e.startHours}`} x={x(e.startHours)} y={top} width={Math.max(1, x(e.endHours) - x(e.startHours))} height={plot} fill="rgba(156,163,175,0.10)" data-empty>
          <title>{`Nothing new in ${lane.name} from ${hoursText(e.startHours)} to ${hoursText(e.endHours)} (${Math.round(e.curveLevels)} levels on the curve).`}</title>
        </rect>
      ))}
      {lane.crowded.map((c) => (
        <rect key={`c${c.startHours}`} x={x(c.startHours) - 5} y={top + 1} width={Math.max(10, x(c.endHours) - x(c.startHours) + 10)} height={plot - 2} rx={6} fill={CROWD} opacity={0.14} data-crowded>
          <title>{`${c.count} first reaches in ${lane.name} between ${hoursText(c.startHours)} and ${hoursText(c.endHours)}.`}</title>
        </rect>
      ))}
      {lane.walls.map((w) => {
        const wx = x(w.startHours);
        const ww = Math.max(2, x(w.endHours) - wx);
        return (
          <g key={`w${w.from}`} data-wall={`${lane.id}|${w.from}`}>
            <title>{`${w.label}. Held up by: ${w.blocker}.`}</title>
            <rect x={wx} y={top} width={ww} height={plot} fill={WALL} opacity={0.05} />
            <rect x={wx} y={top} width={ww} height={WALL_BAR} fill="url(#ledger-hatch)" stroke={WALL} strokeOpacity={0.6} strokeWidth={0.75} />
          </g>
        );
      })}

      {!other && lane.curve.length > 1 && <polyline points={line(lane.curve)} fill="none" stroke={CURVE} strokeWidth={1.25} strokeDasharray="4 3" data-curve={lane.id} />}
      {!other && lane.track.length > 1 && <polyline points={line(lane.track)} fill="none" stroke={TRACK} strokeWidth={1.5} data-track={lane.id} />}

      {lane.dots.map((d, i) => (
        <circle
          key={d.key}
          cx={x(d.hours)}
          cy={dotY(d, i)}
          r={3.5}
          fill={tierColor(d.tier)}
          fillOpacity={d.complete ? 0.95 : 0.55}
          stroke={d.wait ? WALL : '#0f0f12'}
          strokeWidth={d.wait ? 1.75 : 0.75}
          style={{ cursor: 'pointer' }}
          onClick={() => onOpen(d.key)}
          data-dot={d.key}
        >
          <title>{`${d.name} · ${hoursText(d.hours)}${d.complete ? '' : ' (a floor: a step is not timed)'}${d.level ? ` · ${lane.name} ${d.level}` : ''} · ${tierLabel(d.tier)}${d.wait ? `\n${d.wait}` : ''}`}</title>
        </circle>
      ))}

      {lane.walls.map((w, i) => {
        const late = x(w.startHours) > x1 - 560;
        return (
          <text
            key={`l${w.from}`}
            x={late ? Math.min(x(w.endHours), x1) : x(w.startHours) + 2}
            textAnchor={late ? 'end' : 'start'}
            y={bottom + 11 + i * LABEL_ROW}
            fontSize={10}
            fill={WALL}
            style={{ cursor: w.sourceKey ? 'pointer' : 'default' }}
            onClick={() => w.sourceKey && onOpen(w.sourceKey)}
            data-wall-label={`${lane.id}|${w.from}`}
          >
            <title>{w.waiting.length ? `Waiting on it: ${w.waiting.length} entr${w.waiting.length === 1 ? 'y' : 'ies'}. Click to open the blocker's page.` : 'Click to open the blocker\'s page.'}</title>
            {`${w.label} · held up by ${w.blocker}`}
          </text>
        );
      })}
    </g>
  );
}
