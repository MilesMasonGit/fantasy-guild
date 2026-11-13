import { useMemo } from 'react';
import { CloudLightning, Plus, Trash2 } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { STANDS_ON_CHOICES } from '../../utils/constants';
import { newEventRow } from '../../engine/events';
import {
  EVENT_KIND, EVENT_KIND_CHOICES, EVENT_BIOMES, DEFAULT_BUFF_MINUTES, eventProblems,
} from '../../../../src/config/eventTable.js';

/**
 * The Events page: the events table (`engine/events.js`), as Sync writes it to `data/events.json`.
 * Each row names the Token type that lands, its kind (a rich node, or a buff with its time on the
 * mat), its weight in the draw, and where it may land: ground words and Region biomes, none of
 * either meaning anywhere its Token may stand. The game lands one about once an hour of play
 * (`src/systems/events/EventClock.js`). The checks below are the game's boot audit's
 * (`src/config/eventTable.js`).
 */

const label = 'flex items-center gap-1 text-[11px]';
const labelStyle = { color: 'var(--color-text-secondary)' };
const muted = { color: 'var(--color-text-muted)' };

/** A chip that is on or off. */
function Chip({ on, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${on
        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** `list` with `word` toggled, kept in `order`. */
function toggled(list, word, order) {
  const now = new Set(list || []);
  if (now.has(word)) now.delete(word);
  else now.add(word);
  return order.filter((w) => now.has(w));
}

const biomeLabel = (id) => id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** The first `event_<n>` the table does not hold. */
function freshId(events) {
  for (let n = 1; ; n++) if (!events?.[`event_${n}`]) return `event_${n}`;
}

export default function EventsPage() {
  const events = useEntityStore((s) => s.events);
  const tokens = useEntityStore((s) => s.tokens);
  const addEvent = useEntityStore((s) => s.addEvent);
  const setEvent = useEntityStore((s) => s.setEvent);
  const removeEvent = useEntityStore((s) => s.removeEvent);

  const tokenOptions = useMemo(
    () => Object.values(tokens || {}).filter((t) => t?.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [tokens]
  );
  const problems = useMemo(() => eventProblems(events, {
    hasTokenType: (id) => !!tokens?.[id],
    groundWords: STANDS_ON_CHOICES.map((c) => c.id),
    biomes: EVENT_BIOMES,
  }), [events, tokens]);
  const groundOrder = STANDS_ON_CHOICES.map((c) => c.id);

  const add = () => {
    // Read at click time: a click may come before this page's last drawing (TESTING.md, "A click can beat React's effects").
    const id = freshId(useEntityStore.getState().events);
    addEvent(id, newEventRow(id));
  };

  const addButton = (
    <button type="button" onClick={add} className="btn-ghost text-xs flex items-center gap-1" data-event-add>
      <Plus size={12} /> Add an event
    </button>
  );

  if (events == null) {
    return (
      <div className="p-4" data-testid="events-page">
        <Section title="Events" icon={<CloudLightning size={14} />}>
          <p className="text-[11px] mb-2" style={muted}>
            This workspace holds no events yet. Until it does, no event lands in the game and Sync leaves data/events.json
            alone. A change pack can bring the first events in, or add one here.
          </p>
          {addButton}
        </Section>
      </div>
    );
  }

  const rows = Object.entries(events);
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" data-testid="events-page">
      <p className="text-[11px]" style={muted}>
        About once an hour of play one event lands on the mat, drawn by weight among those that fit the place; the next comes
        an hour after it ends. A rich node stays put and leaves when worked out, or after an hour if no hero can work it. A buff
        Token can be moved and leaves when its time is up. Its Token is an ordinary Token: make it on the Token editor.
      </p>
      <Section title={`Events (${rows.length})`} icon={<CloudLightning size={14} />}>
        <div className="space-y-2">
          {rows.map(([id, row]) => {
            const buff = row.kind === EVENT_KIND.BUFF;
            const missing = row.typeId && !tokens?.[row.typeId];
            return (
              <div key={id} data-event-row={id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={row.name || ''}
                    placeholder="Name the player reads"
                    data-event-name
                    onChange={(e) => setEvent(id, { name: e.target.value })}
                    className="text-xs font-semibold flex-1 min-w-40"
                  />
                  <span className="text-[10px]" style={muted}>{id}</span>
                  <button type="button" onClick={() => removeEvent(id)} className="btn-ghost" style={{ padding: '2px 6px' }} title="Remove this event" data-event-remove>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className={label} style={labelStyle}>
                    Token
                    <select value={row.typeId || ''} onChange={(e) => setEvent(id, { typeId: e.target.value })} className="text-[11px] max-w-56" data-event-token>
                      <option value="">Choose a Token</option>
                      {missing && <option value={row.typeId}>{row.typeId} (missing)</option>}
                      {tokenOptions.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                    </select>
                  </label>
                  <label className={label} style={labelStyle}>
                    Kind
                    <select value={row.kind || ''} onChange={(e) => setEvent(id, { kind: e.target.value })} className="text-[11px]" data-event-kind>
                      {!row.kind && <option value="">Choose</option>}
                      {EVENT_KIND_CHOICES.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                  </label>
                  <label className={label} style={labelStyle} title="Its share of the draw among the events that fit the place. 0: it never lands.">
                    Weight
                    <input
                      type="number" min={0} step={1}
                      value={row.weight ?? ''}
                      onChange={(e) => setEvent(id, { weight: Number(e.target.value) || 0 })}
                      className="w-16" style={{ fontSize: 11, padding: '1px 4px' }}
                      data-event-weight
                    />
                  </label>
                  {buff && (
                    <label className={label} style={labelStyle} title="How long the buff stays on the mat.">
                      Minutes
                      <input
                        type="number" min={1} step={1}
                        value={row.durationMinutes ?? ''}
                        placeholder={String(DEFAULT_BUFF_MINUTES)}
                        onChange={(e) => setEvent(id, { durationMinutes: Number(e.target.value) || undefined })}
                        className="w-16" style={{ fontSize: 11, padding: '1px 4px' }}
                        data-event-minutes
                      />
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap" title="The ground it may land on. None ticked: wherever its Token may stand (its own Stands on still applies).">
                  <span className="text-[11px] mr-1" style={labelStyle}>Lands on</span>
                  {STANDS_ON_CHOICES.map((c) => (
                    <Chip key={c.id} on={(row.ground || []).includes(c.id)} data-event-ground={c.id} onClick={() => setEvent(id, { ground: toggled(row.ground, c.id, groundOrder) })}>
                      {c.label}
                    </Chip>
                  ))}
                  {!(row.ground || []).length && <span className="text-[10px] ml-1" style={muted}>any ground its Token may stand on</span>}
                </div>
                <div className="flex items-center gap-1 flex-wrap" title="The Regions it may land in, by biome. None ticked: any Region.">
                  <span className="text-[11px] mr-1" style={labelStyle}>In</span>
                  {EVENT_BIOMES.map((b) => (
                    <Chip key={b} on={(row.biomes || []).includes(b)} data-event-biome={b} onClick={() => setEvent(id, { biomes: toggled(row.biomes, b, EVENT_BIOMES) })}>
                      {biomeLabel(b)}
                    </Chip>
                  ))}
                  {!(row.biomes || []).length && <span className="text-[10px] ml-1" style={muted}>any Region</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2">{addButton}</div>
      </Section>
      {problems.length > 0 && (
        <Section title={`Checks (${problems.length})`}>
          <ul className="text-[11px] space-y-0.5" data-event-problems>
            {problems.map((p, i) => <li key={i} style={{ color: 'var(--color-warning, #f59e0b)' }}>{p.message}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
