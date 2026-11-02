import { useMemo, useState } from 'react';
import { Shuffle, Play, Copy } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import {
  workspaceWorldContext, worldForSeed, sweepWorkspace, sweepText, heroTime, worldTablesSource,
} from '../../engine/ledgerWorld';
import { F_CHECKS, WORLD_F } from '../../../../src/systems/progression/ledger/world.js';
import { CHECKS } from '../../../../src/systems/progression/ledger/checks.js';
import { tokenKey, itemKey } from '../../../../src/systems/progression/ledger/engine.js';
import { STRICT_RINGS, kitById, heroTokensOf } from '../../../../src/config/worldTablesShape.js';
import { cellCentre, hexPoints, mapSize } from '../../../../src/ui/components/atlas/worldMapLayout.js';
import { SeverityChip } from './LedgerProblems';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const card = 'rounded-xl border bg-[#1a1a1e] border-white/10 p-4';
const R = 38;
const LISTED = 12;

/** Each line's colour on the map; any other line takes one by its place. */
const LINE_COLOR = { ores: '#b0835a', trees: '#4f9a58', crops: '#cfa93e', herbs: '#3fa39a', waters: '#4a82c8', arcane: '#9a66cc' };
const SPARE = ['#c06c84', '#6c8cc0', '#8cc06c', '#c0a06c', '#6cc0b8', '#b86cc0'];
const HALL_COLOR = '#d8cfbd';
const ROLE_TEXT = { main: 'main', blend: 'blend', key: 'key', specialty: 'specialty', hall: 'camp' };
const RULES = [...F_CHECKS, WORLD_F.RULE];

const lineColor = (tables, id) => LINE_COLOR[id] || SPARE[Math.max(0, tables.lines.findIndex((l) => l.id === id)) % SPARE.length];
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** An origin's name cut to what fits in a cell: "Copper Ore Vein" → "Copper". */
function shortName(name) {
  const cut = String(name).replace(/ (Ore Vein|Vein|Tree|Bush|Deposit|Outcrop|Patch|Ore)$/i, '');
  return cut.length > 11 ? `${cut.slice(0, 10)}…` : cut;
}

/** Heroes of natural work per skill on a mat (each skill's Tokens over what one hero keeps busy; camps are combat). */
function heroesOf(mat, tables) {
  const out = {};
  for (const n of mat.nodes) if (n.skill) out[n.skill] = (out[n.skill] || 0) + n.count / heroTokensOf(tables, n.skill);
  const camps = mat.camps.reduce((sum, c) => sum + c.count, 0);
  if (camps) out.combat = (out.combat || 0) + camps / heroTokensOf(tables, 'combat');
  return out;
}

/**
 * The World plan (brief 330 W5): the world a seed generates, drawn as the game's hex map by wedge
 * and ring, each cell's contents a click away and the checks F laid over it; then many worlds at
 * once for how often each rule fails, the per-skill bands and the price spreads.
 * ⚠️ Worked out from the workspace as it stands: an origin's wedge and ring set on the Entries page
 * shows here at once. A sweep is kept until it is run again.
 */
export default function LedgerWorld({ onOpen, baseTables = undefined }) {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const recipePools = useEntityStore((s) => s.recipePools);
  const effects = useEntityStore((s) => s.effects);
  const starterCamp = useEntityStore((s) => s.starterCamp);
  const worldRecord = useEntityStore((s) => s.world);

  const [seed, setSeed] = useState(1);
  const [seedText, setSeedText] = useState('1');
  const [wild, setWild] = useState(false);
  const [picked, setPicked] = useState(null);
  const [focus, setFocus] = useState('');
  const [count, setCount] = useState(100);
  const [sweep, setSweep] = useState(null);
  const [running, setRunning] = useState(false);

  const context = useMemo(
    () => workspaceWorldContext({ items, tokens, recipePools, effects, starterCamp, world: worldRecord }, null, baseTables),
    [items, tokens, recipePools, effects, starterCamp, worldRecord, baseTables],
  );
  const plan = useMemo(() => worldForSeed(context, seed), [context, seed]);
  const cell = picked ? plan.world.cells.find((c) => c.id === picked) : null;

  const goTo = (n, cellId = null) => {
    const s = Math.max(0, Math.floor(Number(n)) || 0) >>> 0;
    setSeed(s);
    setSeedText(String(s));
    setPicked(cellId);
    if (cellId && plan.world.cells.find((c) => c.id === cellId)?.wild) setWild(true);
  };
  const run = () => {
    setRunning(true);
    // Let the button show it is running before the sweep holds the page.
    setTimeout(() => {
      setSweep({ result: sweepWorkspace(context, count), context });
      setRunning(false);
    }, 20);
  };

  return (
    <div className="space-y-4" data-world-plan={plan.seed}>
      <section className={`${card} space-y-2`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={sectionHead} style={{ marginRight: 8 }}>World plan</h3>
          <label className="text-[11px] text-gray-400 flex items-center gap-1.5">
            Seed
            <input
              type="number"
              min={0}
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              onBlur={() => goTo(seedText)}
              onKeyDown={(e) => { if (e.key === 'Enter') goTo(seedText); }}
              aria-label="World seed"
              style={{ width: 120, padding: '3px 6px', fontSize: 11 }}
            />
          </label>
          <button
            onClick={() => goTo(Math.floor(Math.random() * 4294967295))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
          >
            <Shuffle size={12} /> Another world
          </button>
          <label className="text-[11px] text-gray-400 flex items-center gap-1.5 ml-2">
            <input type="checkbox" checked={wild} onChange={(e) => setWild(e.target.checked)} aria-label="Show the wild rings" />
            Wild rings ({STRICT_RINGS + 1}–{plan.world.rings})
          </label>
        </div>
        <p className="text-[10px] text-gray-500">
          The world a new game with this seed generates, from {worldTablesSource({ world: worldRecord })}, with each origin&apos;s planned wedge and
          ring laid on. Every cell&apos;s contents are a click away; a red edge is a problem of checks F on that cell.
        </p>
        {(plan.moved.length > 0 || plan.unknown.length > 0) && (
          <p className="text-[11px]" style={{ color: 'var(--color-warning)' }} data-world-moved={plan.moved.length}>
            {plan.moved.length > 0 && `${plan.moved.length} origin${plan.moved.length === 1 ? ' is' : 's are'} placed by the plan, not where the game's tables have ${plan.moved.length === 1 ? 'it' : 'them'}: this is the planned world. `}
            {plan.unknown.length > 0 && `${plan.unknown.length} plan${plan.unknown.length === 1 ? ' names' : 's name'} a wedge the tables do not have.`}
          </p>
        )}
        <RuleChips findings={plan.findings} focus={focus} onFocus={setFocus} />
      </section>

      <div className="flex gap-4 items-start">
        <section className={`${card} flex-1 min-w-0`}>
          <HexMap plan={plan} context={context} wild={wild} picked={picked} focus={focus} onPick={setPicked} />
          <Legend plan={plan} />
        </section>
        <section className={`${card} space-y-3`} style={{ width: 340, flexShrink: 0 }}>
          {cell ? (
            <CellPanel plan={plan} context={context} cell={cell} onOpen={onOpen} onPick={setPicked} />
          ) : (
            <WorldSummary plan={plan} context={context} />
          )}
        </section>
      </div>

      <WorldProblems plan={plan} focus={focus} onOpen={onOpen} onPick={(id) => { setPicked(id); if (plan.world.cells.find((c) => c.id === id)?.wild) setWild(true); }} />

      <section className={`${card} space-y-3`} aria-label="Many worlds">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={sectionHead} style={{ marginRight: 8 }}>Many worlds</h3>
          <label className="text-[11px] text-gray-400 flex items-center gap-1.5">
            Worlds (seeds 1 to)
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-label="How many worlds"
              style={{ width: 80, padding: '3px 6px', fontSize: 11 }}
            />
          </label>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: running ? 'default' : 'pointer' }}
          >
            <Play size={12} /> {running ? 'Generating…' : 'Generate and check'}
          </button>
          {sweep && (
            <button
              onClick={() => navigator.clipboard?.writeText(sweepText(sweep.result))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
              title="Copy the whole result as plain text"
            >
              <Copy size={12} /> Copy as text
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-500">
          Generates seeds 1 to the number given and runs checks F on each: how many worlds pass, what fails and in how many worlds,
          how evenly each skill&apos;s new work and natural work land per ring, and what a cell costs per ring. About two seconds for a hundred.
        </p>
        {sweep && sweep.context !== context && (
          <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>Worked out before the last edit: generate again to see it.</p>
        )}
        {sweep && <SweepResult sweep={sweep.result} onOpen={onOpen} onWorld={goTo} />}
      </section>
    </div>
  );
}

/** One chip per rule: how many problems this world has of it; a click shows only that rule on the map and list. */
function RuleChips({ findings, focus, onFocus }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Checks F on this world">
      {RULES.map((check) => {
        const n = findings.filter((f) => f.check === check).length;
        const on = focus === check;
        const color = n ? (check === WORLD_F.RULE ? 'var(--color-warning)' : 'var(--color-error)') : 'var(--color-success)';
        return (
          <button
            key={check}
            onClick={() => onFocus(on ? '' : check)}
            data-rule={check}
            data-count={n}
            title={on ? 'Show every rule again' : 'Show only this rule on the map and in the list'}
            className="px-2 py-1 rounded-lg text-[11px]"
            style={{ background: on ? 'var(--color-accent-muted)' : 'transparent', border: `1px solid ${color}`, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
          >
            <span style={{ color, fontWeight: 700 }}>{n || '✓'}</span> {CHECKS[check].label}
          </button>
        );
      })}
    </div>
  );
}

/** The world as the game's map draws it: flat-topped hexes by ring, coloured by wedge, problems on their cells. */
function HexMap({ plan, context, wild, picked, focus, onPick }) {
  const rings = wild ? plan.world.rings : Math.min(STRICT_RINGS, plan.world.rings);
  const { width, height } = mapSize(rings, R);
  const pad = 8;
  const points = hexPoints(R - 1);
  const shown = plan.world.cells.filter((c) => c.ring <= rings);
  const counted = (f) => (!focus || f.check === focus);
  return (
    <svg
      viewBox={`${-width / 2 - pad} ${-height / 2 - pad} ${width + 2 * pad} ${height + 2 * pad}`}
      width="100%"
      style={{ display: 'block', maxHeight: wild ? 980 : 620 }}
      role="img"
      aria-label={`World ${plan.seed}, rings 0 to ${rings}`}
    >
      {shown.map((cell) => {
        const { x, y } = cellCentre(cell, R);
        const found = (plan.byCell.get(cell.id) || []).filter(counted);
        const serious = found.filter((f) => f.check !== WORLD_F.RULE).length;
        const on = picked === cell.id;
        const fill = cell.ring === 0 ? HALL_COLOR : lineColor(plan.tables, cell.wedge);
        const stroke = on ? '#ffffff' : serious ? 'var(--color-error)' : found.length ? 'var(--color-warning)' : 'rgba(0,0,0,0.5)';
        const main = cell.origins.find((o) => o.role === 'main');
        const label = cell.ring === 0 ? 'Starter Camp' : main ? shortName(context.nameOf(tokenKey(main.id))) : 'no main';
        const dim = focus && !found.length;
        return (
          <g
            key={cell.id}
            transform={`translate(${x},${y})`}
            onClick={() => onPick(on ? null : cell.id)}
            style={{ cursor: 'pointer', opacity: dim ? 0.45 : 1 }}
            data-cell={cell.id}
            data-ring={cell.ring}
            data-problems={found.length}
          >
            <title>{`${context.cellName(cell)} · ring ${cell.ring}${cell.wild ? ' (wild)' : ''}${found.length ? ` · ${found.length} problem${found.length === 1 ? '' : 's'}` : ''}`}</title>
            <polygon points={points} fill={fill} fillOpacity={cell.wild ? 0.28 : cell.ring === 0 ? 0.85 : 0.55} stroke={stroke} strokeWidth={on || found.length ? 2.5 : 1} />
            <text y={cell.ring === 0 ? 3 : -2} fontSize={cell.ring === 0 ? 8 : 9} textAnchor="middle" fill={cell.ring === 0 ? '#1a1a1e' : '#ffffff'} style={{ pointerEvents: 'none', fontWeight: 700, fontStyle: main || cell.ring === 0 ? 'normal' : 'italic' }}>{label}</text>
            {cell.ring > 0 && (
              <text y={10} fontSize={7.5} textAnchor="middle" fill="#e5e7eb" style={{ pointerEvents: 'none' }}>
                {`${cell.origins.length} · ${capital(cell.specialty || '')}`}
              </text>
            )}
            {found.length > 0 && (
              <g transform={`translate(${R * 0.5},${-R * 0.55})`} style={{ pointerEvents: 'none' }}>
                <circle r={7} fill={serious ? 'var(--color-error)' : 'var(--color-warning)'} />
                <text y={3} fontSize={8} textAnchor="middle" fill="#ffffff" style={{ fontWeight: 700 }}>{found.length}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ plan }) {
  return (
    <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400">
      {plan.world.wedges.map((line, side) => (
        <span key={line} className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: lineColor(plan.tables, line) }} />
          {plan.tables.lines.find((l) => l.id === line)?.name || line}
          <span style={{ color: 'var(--color-text-muted)' }}>(side {side + 1})</span>
        </span>
      ))}
      <span>Each cell: its main origin (&ldquo;no main&rdquo; when its wedge has none for its ring), then how many origins and its specialty.</span>
    </div>
  );
}

function WorldSummary({ plan, context }) {
  const strict = plan.world.cells.filter((c) => c.ring >= 1 && c.ring <= STRICT_RINGS).length;
  const serious = plan.findings.filter((f) => f.check !== WORLD_F.RULE).length;
  return (
    <>
      <h3 className={sectionHead}>World {plan.seed}</h3>
      <p className="text-[11px] text-gray-400">
        {strict} cells in the three strict rings around the Starter Camp, {plan.world.cells.length - strict - 1} in the wild rings beyond.
        {' '}{serious ? `${serious} problem${serious === 1 ? '' : 's'} of checks F.` : 'It keeps every rule of checks F.'}
      </p>
      <p className="text-[11px] text-gray-500">Click a cell to see what it holds, what it asks and what is wrong with it.</p>
      {plan.problems.length > 0 && (
        <div className="space-y-1">
          <h4 className={sectionHead}>What the generation could not meet</h4>
          {plan.problems.map((p, i) => <p key={i} className="text-[11px] text-gray-400">{p.message}</p>)}
        </div>
      )}
      <p className="text-[10px] text-gray-500">Starter Camp origins: {plan.world.cells[0].origins.map((o) => context.nameOf(tokenKey(o.id))).join(', ') || 'none'}.</p>
    </>
  );
}

const rowLabel = { minWidth: 70, color: 'var(--color-text-muted)' };

function Name({ entryKey, context, onOpen }) {
  return (
    <button
      onClick={() => onOpen(entryKey)}
      className="underline text-left"
      title={`${entryKey}: open its page`}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}
    >
      {context.nameOf(entryKey)}
    </button>
  );
}

/** One cell: where it is, what it holds, what it asks, what it hides, who holds it on arrival, and its problems. */
function CellPanel({ plan, context, cell, onOpen, onPick }) {
  const mat = plan.mats.get(cell.id);
  const found = plan.byCell.get(cell.id) || [];
  const tables = plan.tables;
  const ringOfItem = (id) => plan.reach.get(itemKey(id))?.tier;
  const asked = cell.requires?.items || [];
  const effort = asked.reduce((n, i) => n + i.qty * context.effortOf(i.itemId), 0);
  const target = cell.ring >= 1 && cell.ring <= STRICT_RINGS ? tables.ringValue[cell.ring] : null;
  const heroes = mat ? heroesOf(mat, tables) : {};
  const kit = kitById(tables, cell.kit);
  return (
    <div className="space-y-3 text-[11px]" data-cell-panel={cell.id}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">{context.cellName(cell)}</h3>
          <p className="text-gray-500">Ring {cell.ring}{cell.wild ? ' · wild' : ` · tier ${cell.tier}`}</p>
        </div>
        <button onClick={() => onPick(null)} className="text-[10px] underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>close</button>
      </div>

      {cell.ring > 0 && (
        <div className="space-y-0.5">
          <p className="flex gap-2"><span style={rowLabel}>Wedge</span><span>{context.lineName(cell.wedge)}</span></p>
          <p className="flex gap-2"><span style={rowLabel}>Kit</span><span>{kit?.name || cell.kit || '—'}{kit?.biome ? ` (${kit.biome})` : ''}</span></p>
          <p className="flex gap-2"><span style={rowLabel}>Specialty</span><span>{capital(cell.specialty) || '—'}</span></p>
          {cell.extreme && (
            <p className="flex gap-2"><span style={rowLabel}>Wild</span><span>{cell.extreme.kind === 'composition' ? `${context.nameOf(tokenKey(cell.extreme.focus))} almost everywhere` : `odd layout: ${cell.extreme.layout}`}</span></p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <h4 className={sectionHead}>Origins</h4>
        {cell.origins.map((o) => (
          <div key={o.id} className="flex items-baseline gap-2" data-origin={o.id}>
            <Name entryKey={tokenKey(o.id)} context={context} onOpen={onOpen} />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{ROLE_TEXT[o.role] || o.role}{o.line ? ` · ${context.lineName(o.line)}` : ''}</span>
            <span className="text-gray-500 truncate">{context.materialsOf(o.id).map((m) => context.nameOf(itemKey(m))).join(', ')}</span>
          </div>
        ))}
        {!cell.origins.length && <p className="text-gray-500">None.</p>}
      </div>

      {cell.requires && (
        <div className="space-y-1">
          <h4 className={sectionHead}>Price</h4>
          {asked.map((i) => {
            const at = ringOfItem(i.itemId);
            return (
              <p key={i.itemId} className="flex gap-2 items-baseline" data-price={i.itemId}>
                <span style={{ minWidth: 34, textAlign: 'right' }}>{i.qty} ×</span>
                <Name entryKey={itemKey(i.itemId)} context={context} onOpen={onOpen} />
                <span className="text-gray-500">{Number.isInteger(at) ? `first had at ring ${at}` : 'not in the inner rings'}</span>
              </p>
            );
          })}
          {(cell.requires.skills || []).map((s) => <p key={s.skill} className="text-gray-400">{capital(s.skill)} {s.level}</p>)}
          <p className="text-gray-500">
            {heroTime(effort)} of hero time at the content&apos;s own rates
            {cell.payFrom.length > 0 && ` · gathered at ${cell.payFrom.map((id) => context.cellName(plan.world.cells.find((c) => c.id === id))).join(' and ')}`}
          </p>
        </div>
      )}

      {cell.ring > 0 && (
        <div className="space-y-1">
          <h4 className={sectionHead}>Hidden extras</h4>
          {cell.extras.map((e, i) => <p key={`${e.id}${i}`} className="text-gray-400">{context.nameOf(e.kind === 'treasure' ? tokenKey(e.id) : itemKey(e.id))} <span className="text-gray-500">({e.kind}, worth {e.value})</span></p>)}
          <p className="text-gray-500">
            Worth {cell.value}{target !== null ? ` of ring ${cell.ring}'s ${target} (±${Math.round(tables.valueTolerance * 100)} %)` : ''}.
          </p>
        </div>
      )}

      {cell.arrival.length > 0 && (
        <div className="space-y-1">
          <h4 className={sectionHead}>Arrives held by</h4>
          <p className="text-gray-400">{cell.arrival.map((a) => `${a.count} × ${context.nameOf(tokenKey(a.typeId))}${a.boss ? ' (boss)' : ''}`).join(', ')}</p>
        </div>
      )}

      {mat && (
        <div className="space-y-1">
          <h4 className={sectionHead}>The mat&apos;s natural work</h4>
          <p className="text-gray-400">
            {Object.entries(heroes).sort((a, b) => b[1] - a[1]).map(([skill, n]) => `${capital(skill)} ${n.toFixed(1)}`).join(' · ') || 'none'}
            {' '}<span className="text-gray-500">heroes</span>
          </p>
          <p className="text-gray-500">
            {plural(mat.nodes.reduce((n, x) => n + x.count, 0), 'node')}, {plural(mat.camps.reduce((n, x) => n + x.count, 0), 'camp')}{mat.stone.outcrops ? `, ${plural(mat.stone.outcrops, 'Stone outcrop')}` : ''}{mat.rare ? `; rare: ${context.nameOf(tokenKey(mat.rare))}` : ''}.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <h4 className={sectionHead}>Problems here</h4>
        {found.map((f, i) => (
          <div key={i} className="flex gap-2 items-start">
            <SeverityChip severity={f.severity} />
            <span style={{ color: 'var(--color-text-secondary)' }}><span style={{ color: 'var(--color-text-muted)' }}>{CHECKS[f.check]?.label}:</span> {f.message}</span>
          </div>
        ))}
        {!found.length && <p style={{ color: 'var(--color-success)' }}>None.</p>}
      </div>
    </div>
  );
}

/** This world's problems, rule by rule: a cell opens on the map, an entry its page. */
function WorldProblems({ plan, focus, onOpen, onPick }) {
  const [open, setOpen] = useState({});
  const rules = focus ? [focus] : RULES;
  const any = plan.findings.length > 0;
  return (
    <section className={`${card} space-y-3`} aria-label="This world's problems">
      <h3 className={sectionHead}>Checks F on world {plan.seed}</h3>
      {!any && <p className="text-[11px]" style={{ color: 'var(--color-success)' }}>This world keeps every rule.</p>}
      {rules.map((check) => {
        const list = plan.findings.filter((f) => f.check === check);
        if (!list.length) return null;
        const shown = open[check] ? list : list.slice(0, LISTED);
        return (
          <div key={check} className="space-y-1" data-rule-list={check}>
            <h4 className="text-[11px] font-bold" style={{ color: check === WORLD_F.RULE ? 'var(--color-warning)' : 'var(--color-error)' }}>
              {CHECKS[check].label} ({list.length})
            </h4>
            {shown.map((f, i) => (
              <p key={i} className="text-[11px] flex gap-2 items-baseline">
                {f.cellId ? (
                  <button onClick={() => onPick(f.cellId)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit', minWidth: 52, textAlign: 'left' }}>
                    {f.cellId}
                  </button>
                ) : f.key ? (
                  <button onClick={() => onOpen(f.key)} className="underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit', textAlign: 'left' }}>
                    {f.name}
                  </button>
                ) : null}
                <span style={{ color: 'var(--color-text-secondary)' }}>{f.message}</span>
                {f.before !== undefined && <BeforeTag before={f.before} />}
              </p>
            ))}
            {list.length > LISTED && (
              <button onClick={() => setOpen({ ...open, [check]: !open[check] })} className="text-[10px] underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                {open[check] ? 'Show fewer' : `Show all ${list.length}`}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Whether an entry the world does not cover was reachable before it (lost with the maps) or never was. */
function BeforeTag({ before }) {
  const lost = before !== null;
  return (
    <span
      className="text-[9px] uppercase tracking-wider whitespace-nowrap px-1 rounded"
      style={{ color: lost ? 'var(--color-error)' : 'var(--color-text-muted)', border: `1px solid ${lost ? 'var(--color-error)' : 'var(--color-border-subtle)'}` }}
      title={lost ? `Reachable before the world map (tier ${before}), through map items` : 'Never reachable before the world map either: unfinished content'}
    >
      {lost ? 'lost with the maps' : 'never reachable'}
    </span>
  );
}

const td = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };
const th = { ...td, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', textAlign: 'left' };

/** Many worlds' result: the pass count, each rule's failures by subject, the bands and the spreads. */
function SweepResult({ sweep, onOpen, onWorld }) {
  const [open, setOpen] = useState({});
  const rings = [...new Set(sweep.bands.map((b) => b.ring))];
  const skills = [...new Set(sweep.bands.map((b) => b.skill))];
  const band = (skill, ring) => sweep.bands.find((b) => b.skill === skill && b.ring === ring);
  return (
    <div className="space-y-4" data-sweep={sweep.seeds}>
      <p className="text-sm" data-sweep-passed={sweep.passed}>
        <span style={{ color: sweep.passed === sweep.seeds ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 700 }}>
          {sweep.passed} of {sweep.seeds}
        </span>
        <span className="text-gray-300"> worlds pass checks F; </span>
        <span style={{ fontWeight: 700 }}>{sweep.passedAll}</span>
        <span className="text-gray-300"> keep every rule of the world.</span>
      </p>

      {RULES.map((check) => {
        const rule = sweep.rules[check];
        const shown = open[check] ? rule.subjects : rule.subjects.slice(0, LISTED);
        return (
          <div key={check} className="space-y-1" data-sweep-rule={check} data-worlds={rule.worlds}>
            <h4 className="text-[11px] font-bold" style={{ color: rule.worlds ? (check === WORLD_F.RULE ? 'var(--color-warning)' : 'var(--color-error)') : 'var(--color-success)' }}>
              {CHECKS[check].label}: {rule.worlds ? `fails in ${rule.worlds} of ${sweep.seeds} worlds` : 'never fails'}
            </h4>
            {shown.length > 0 && (
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.subject} data-subject={s.subject}>
                      <td style={{ ...td, width: 64, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{s.worlds} world{s.worlds === 1 ? '' : 's'}</td>
                      <td style={{ ...td, width: 280 }}>
                        {s.key ? (
                          <button onClick={() => onOpen(s.key)} className="underline text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)', font: 'inherit' }}>{s.name}</button>
                        ) : <span style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>}
                        {s.before !== undefined && <span className="ml-1"><BeforeTag before={s.before} /></span>}
                      </td>
                      <td style={{ ...td, color: 'var(--color-text-secondary)' }}>
                        <button onClick={() => onWorld(s.example.seed, s.example.cellId)} className="underline mr-1" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)', font: 'inherit' }} title="Open this world on the map">
                          world {s.example.seed}
                        </button>
                        {s.example.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {rule.subjects.length > LISTED && (
              <button onClick={() => setOpen({ ...open, [check]: !open[check] })} className="text-[10px] underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                {open[check] ? 'Show fewer' : `Show all ${rule.subjects.length}`}
              </button>
            )}
          </div>
        );
      })}

      {sweep.generation.length > 0 && (
        <div className="space-y-1">
          <h4 className={sectionHead}>What the generation could not meet</h4>
          {sweep.generation.map((g) => <p key={g.message} className="text-[11px] text-gray-400"><span className="text-gray-500">{g.worlds} worlds:</span> {g.message}</p>)}
        </div>
      )}

      <div className="space-y-1" aria-label="Per-skill bands">
        <h4 className={sectionHead}>Per skill and ring, over the worlds</h4>
        <p className="text-[10px] text-gray-500">Cells offering the skill&apos;s new work (an origin of it; for combat a boss camp), and the heroes its natural work keeps busy across the ring: least, middle, most. Red: some worlds have none.</p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Skill</th>
              {rings.map((r) => <th key={r} style={th}>Ring {r}</th>)}
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill} data-band={skill}>
                <td style={{ ...td, color: 'var(--color-text-primary)' }}>{capital(skill)}</td>
                {rings.map((r) => {
                  const b = band(skill, r);
                  return (
                    <td key={r} style={td} data-band-ring={r} data-zero={b.zero}>
                      <span style={{ color: b.zero ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                        {b.cells.min}–{b.cells.max} cells
                      </span>
                      <span className="text-gray-500"> (mid {b.cells.median})</span>
                      <br />
                      <span className="text-gray-400">{b.heroes.min.toFixed(1)}–{b.heroes.max.toFixed(1)} heroes</span>
                      {b.zero > 0 && <span style={{ color: 'var(--color-error)' }}> · none in {b.zero}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1" aria-label="Price spreads">
        <h4 className={sectionHead}>A cell&apos;s price, by ring</h4>
        <p className="text-[10px] text-gray-500">Items asked, and the hero time to gather them at the content&apos;s own rates (no boosts): least, middle, most; and the skill levels asked.</p>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Ring</th><th style={th}>Items</th><th style={th}>Hero time</th><th style={th}>Levels asked</th>
            </tr>
          </thead>
          <tbody>
            {sweep.prices.map((p, i) => {
              const before = sweep.prices[i - 1];
              const overlaps = before && p.effortMs.min < before.effortMs.max;
              return (
                <tr key={p.ring} data-price-ring={p.ring}>
                  <td style={{ ...td, color: 'var(--color-text-primary)' }}>{p.ring}{p.ring > STRICT_RINGS ? ' (wild)' : ''}</td>
                  <td style={td}>{p.items.min === p.items.max ? p.items.min : `${p.items.min}–${p.items.max}`}</td>
                  <td style={td}>
                    {heroTime(p.effortMs.min)} · <b>{heroTime(p.effortMs.median)}</b> · {heroTime(p.effortMs.max)}
                    {overlaps && <span style={{ color: 'var(--color-warning)' }} title="Its cheapest cell costs less hero time than the dearest cell one ring in"> · overlaps ring {before.ring}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{p.skills.map((s) => `level ${s.level}`).join(', ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
