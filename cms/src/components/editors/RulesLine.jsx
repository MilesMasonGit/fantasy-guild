import { useState, useMemo, useRef, useId } from 'react';
import {
  slotsOf, slotDisplay, slotIsOrphaned, filterOptions, nearestOptions, slotsWithoutWords,
  SLOT_KIND, renderSegments, getFilterKind,
} from '../../utils/constants';

/**
 * ⭐ **The Rules Line** — a rule is a line of prose you write into (E-1, E-2).
 *
 * The line on screen is `renderSegments`' own output: the exact sentence the
 * game prints, with every word that stands for a decision made clickable. There
 * is no second copy of the sentence beneath it and no row of chips above it —
 * the words ARE the controls.
 *
 * > *"I write the rules text with support, and it builds the effect from that."*
 *
 * ## ⭐ Click a word, retype that word (E-3)
 * Clicking a decision turns *that word* into a typing box, in place. Typing
 * narrows the panel to what is legal there; Enter takes the best match; Escape
 * leaves the word as it was. Nothing else in the sentence moves, because the
 * owner tweaks rules far more often than writing them, and most tweaks are one
 * word.
 *
 * ## ⚠️ There is still no parser
 * Enter commits an OPTION the slot already offers, or a number, or a tag. Text
 * is never read back into meaning. An unrecognised word inserts nothing (E-4) —
 * the panel offers the nearest real words instead of a dead end.
 *
 * ## ⚠️ A number keeps its direction
 * "work 5% faster" stores −5. Retyping the 5 as 20 must not silently produce
 * "work 20% slower", so a typed number inherits the current sign unless the
 * author types one. "faster" is a different word, and E-3 retypes one word.
 *
 * ## ⚠️ Decisions with no word still get a control
 * A flat damage never says "measured as"; "ignores armour" is absent until it is
 * true; an empty filter stack says nothing. `slotsWithoutWords` names every such
 * slot and a quiet row beneath the line offers each one — the failure the last
 * code review found was a decision that became unauthorable by quietly losing
 * its only control.
 *
 * ## What is not here yet
 * The panel sits beneath the line; P3 moves it to the left (E-5) and adds the
 * search-to-pick for a blank. The forms beneath survive until P4 deletes them,
 * and cost and cadence move into their strip in P5.
 */

/** Slot kinds retyped in place, inside the sentence. */
const INLINE = new Set([SLOT_KIND.VOCABULARY, SLOT_KIND.NUMBER, SLOT_KIND.TEXT]);

/**
 * A retyped number inherits the current sign unless the author types one.
 *
 * Only the `Provides` amount carries a sign — every other number slot floors at
 * zero — and a trailing "%" or "×" is accepted, because that is how the number
 * reads in the sentence the author is looking at.
 */
function numberAsTyped(slot, statement, text) {
  const bare = text.replace(/\s*[%×]\s*$/, '').trim();
  if (slot.id !== 'value' || /^[+-]/.test(bare)) return bare;
  return (Number(statement?.payload?.value) || 0) < 0 ? `-${bare}` : bare;
}

/** A decision word: dashed underline at rest, highlighted while it is the focus. */
function Word({ text, slot, active, onClick }) {
  const unset = text === '…';
  const warn = slotIsOrphaned(slot) || (unset && !slot.optional);
  return (
    <button
      type="button"
      data-slot={slot.id}
      onClick={onClick}
      // ⚠️ Named by the WORD, explicitly. With only a `title`, some tools name
      // this button "damage" (the slot) rather than "2" (what it says), and a
      // re-rendered one came back with no name at all. The tooltip still says
      // which decision the word is.
      aria-label={text}
      title={slot.label}
      style={{
        font: 'inherit',
        cursor: 'text',
        padding: '0 1px',
        borderRadius: 2,
        border: 'none',
        borderBottom: `1px dashed ${warn ? 'var(--color-warning)' : 'var(--color-border-default)'}`,
        background: active ? 'var(--color-accent-muted)' : 'transparent',
        color: warn ? 'var(--color-warning)' : 'var(--color-text-primary)',
      }}
    >
      {text}
    </button>
  );
}

/** The typing box that stands in for a word while it is being retyped. */
function WordInput({ word, slot, query, setQuery, listId, onCommit, onCancel }) {
  return (
    <input
      // The word being retyped takes the focus: the author clicked it to type.
      autoFocus
      data-retyping={slot.id}
      aria-label={`Retype ${slot.label}`}
      type="text"
      list={listId}
      value={query}
      placeholder={word}
      size={Math.max(word.length, query.length, 2)}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      // Clicking anywhere else leaves the word as it was. Panel options keep
      // the focus on mouse-down, so choosing one still commits.
      onBlur={onCancel}
      style={{
        font: 'inherit',
        padding: '0 3px',
        borderRadius: 3,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

/**
 * The stacked filters (G-9), opened from their words in the line.
 *
 * ⚠️ Every row carries its own **negate** toggle, because negation doubles what
 * each filter can say for the cost of one checkbox. The wording flips with it,
 * because each filter owns both readings.
 */
function FilterStack({ slot, onChange }) {
  const rows = slot.value || [];
  const write = (next) => onChange(slot.patch(next));

  return (
    <div className="space-y-1">
      {rows.map((row, i) => {
        const kind = getFilterKind(row.kind);
        return (
          <div key={i} className="flex items-center gap-1.5 flex-wrap">
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={!!row.not}
                onChange={(e) => write(rows.map((r, j) => (j === i ? { ...r, not: e.target.checked } : r)))}
              />
              not
            </label>
            <select
              value={row.kind}
              onChange={(e) => write(rows.map((r, j) => (j === i ? { kind: e.target.value } : r)))}
              className="text-[12px]"
            >
              {slot.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {kind?.value && (
              <input
                type={kind.value === 'number' ? 'number' : 'text'}
                value={row.value ?? ''}
                placeholder={kind.placeholder || ''}
                onChange={(e) => write(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                className="px-1 py-0.5 rounded text-[12px] w-24"
              />
            )}
            <button
              type="button"
              onClick={() => write(rows.filter((_, j) => j !== i))}
              className="text-[11px] opacity-60 hover:opacity-100"
              aria-label="Remove this filter"
            >
              ✕
            </button>
            {kind?.hint && <span className="text-[10px] text-gray-500 basis-full">{kind.hint}</span>}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => write([...rows, { kind: slot.options[0]?.id }])}
        className="text-[11px] px-1.5 py-0.5 rounded"
        style={{ border: '1px dashed var(--color-border-default)' }}
      >
        + narrow it further
      </button>
    </div>
  );
}

/** One option in the panel. Mouse-down keeps the line's typing box focused. */
function OptionButton({ option, current, onPick }) {
  return (
    <button
      type="button"
      data-option={option.id}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(option.id)}
      className="w-full text-left px-1.5 py-1 rounded hover:bg-white/5"
      style={{ background: option.id === current ? 'var(--color-accent-muted)' : 'transparent' }}
    >
      <span className="text-[12px] block">{option.label}</span>
      {option.hint && <span className="text-[10px] text-gray-500 block leading-snug">{option.hint}</span>}
    </button>
  );
}

/**
 * A vocabulary list, narrowed by `query` — with the nearest words when nothing
 * matches (E-4), so a wrong guess becomes a way of finding the right word.
 */
function OptionList({ slot, query, onPick }) {
  const hits = query.trim() ? filterOptions(slot, query) : slot.options;
  const near = query.trim() && hits.length === 0 ? nearestOptions(slot, query) : [];
  return (
    <div className="max-h-52 overflow-y-auto space-y-0.5">
      {near.length > 0 && (
        <p className="text-[10px] text-gray-500" data-nearest>
          Nothing here is called “{query.trim()}”. Nearest:
        </p>
      )}
      {(near.length ? near : hits).map((o) => (
        <OptionButton key={o.id} option={o} current={slot.value} onPick={onPick} />
      ))}
    </div>
  );
}

/** A panel search for a vocabulary slot that has no word in the line to retype. */
function PanelSearch({ slot, onPick }) {
  const [query, setQuery] = useState('');
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={query}
        placeholder={`Type to narrow ${slot.label}…`}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          const hits = filterOptions(slot, query);
          if (e.key === 'Enter' && query.trim() && hits.length) onPick(hits[0].id);
        }}
        className="w-full px-1.5 py-1 rounded text-[12px]"
      />
      <OptionList slot={slot} query={query} onPick={onPick} />
    </div>
  );
}

/** What the panel shows for the slot in focus. */
function PanelBody({ slot, retyping, query, statement, onPatch, onPickRetyped }) {
  if (!slot) {
    return (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Click any underlined word to retype it. What can go there will appear here.
      </p>
    );
  }

  if (retyping && slot.kind === SLOT_KIND.VOCABULARY) {
    return <OptionList slot={slot} query={query} onPick={onPickRetyped} />;
  }

  if (retyping && slot.kind === SLOT_KIND.TEXT) {
    const typed = query.trim().toLowerCase();
    const suggestions = (slot.suggestions || []).filter((t) => !typed || t.toLowerCase().includes(typed));
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] text-gray-500">Type it and press Enter. Already in use:</p>
        {suggestions.map((t) => (
          <OptionButton key={t} option={{ id: t, label: t }} current={slot.value} onPick={onPickRetyped} />
        ))}
      </div>
    );
  }

  if (retyping && slot.kind === SLOT_KIND.NUMBER) {
    const signed = slot.id === 'value' && (Number(statement?.payload?.value) || 0) !== 0;
    return (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Type a number and press Enter. Escape leaves it as it was.
        {signed && ' It keeps its direction — type a minus or a plus sign to flip it.'}
      </p>
    );
  }

  switch (slot.kind) {
    case SLOT_KIND.VOCABULARY:
      return <PanelSearch key={slot.id} slot={slot} onPick={(v) => onPatch(slot.patch(v))} />;
    case SLOT_KIND.NUMBER:
      return (
        <input
          type="number"
          min={slot.min}
          value={slot.value ?? ''}
          onChange={(e) => onPatch(slot.patch(e.target.value))}
          className="px-1.5 py-1 rounded text-[12px] w-24"
        />
      );
    case SLOT_KIND.TEXT:
      return (
        <input
          type="text"
          value={slot.value ?? ''}
          onChange={(e) => onPatch(slot.patch(e.target.value))}
          className="px-1.5 py-1 rounded text-[12px] w-40"
        />
      );
    case SLOT_KIND.FLAG:
      return (
        <label className="flex items-start gap-2 text-[12px]">
          <input type="checkbox" checked={!!slot.value} onChange={(e) => onPatch(slot.patch(e.target.checked))} />
          <span>
            {slot.label}
            {slot.hint && <span className="block text-[10px] text-gray-500 leading-relaxed">{slot.hint}</span>}
          </span>
        </label>
      );
    case SLOT_KIND.FILTERS:
      return <FilterStack slot={slot} onChange={onPatch} />;
    default:
      return (
        <p className="text-[11px] text-gray-500 leading-relaxed">
          This one is edited in the form beneath the rule.
        </p>
      );
  }
}

/** How a decision with no word in the sentence is offered. */
function affordanceLabel(slot) {
  if (slot.kind === SLOT_KIND.FLAG || slot.kind === SLOT_KIND.FILTERS) return `+ ${slot.label}`;
  const shown = slotDisplay(slot);
  return `${slot.label}: ${shown && shown !== '…' ? shown : '—'}`;
}

/**
 * One statement, edited as the sentence it is.
 *
 * @param {object} statement
 * @param {(patch: object) => void} onChange  merged into the statement
 * @param {object} names  id → display name, for the rendered sentence
 * @param {React.ReactNode} form  the list-shaped payload editor, beneath the line
 *   until P4 folds it in
 * @param {object} ctx  the content a slot may pick from (`tokens`, `items`,
 *   `capabilities`, `effects`). Supplied rather than imported, because the CMS
 *   edits its own DRAFT store while the game reads its registry.
 */
export default function RulesLine({ statement, onChange, names, form, ctx }) {
  const slots = useMemo(() => slotsOf(statement, ctx), [statement, ctx]);
  const segments = useMemo(() => renderSegments(statement, names), [statement, names]);
  const byId = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const unworded = useMemo(() => slotsWithoutWords(slots, segments), [slots, segments]);

  const [focusedId, setFocusedId] = useState(null);
  // Which segment is being retyped, by position — one slot can own several
  // words ("every … on the board"), and only the clicked one becomes a box.
  const [retypingAt, setRetypingAt] = useState(null);
  const [query, setQuery] = useState('');
  const formRef = useRef(null);
  const idBase = useId();

  // Resolved against the CURRENT slots every render: changing the verb changes
  // which slots exist, and a stale slot object must never be patched.
  const focused = byId.get(focusedId) || null;
  const retypingSlot = retypingAt != null ? byId.get(segments[retypingAt]?.slot) || null : null;
  const listIdFor = (slot) => (slot.kind === SLOT_KIND.TEXT && slot.suggestions?.length ? `${idBase}-${slot.id}` : undefined);

  const stopRetyping = () => { setRetypingAt(null); setQuery(''); };
  const apply = (patch) => { onChange(patch); stopRetyping(); };

  const open = (slot, index) => {
    setFocusedId(slot.id);
    if (index != null && INLINE.has(slot.kind)) {
      setRetypingAt(index);
      setQuery('');
      return;
    }
    stopRetyping();
    if (slot.kind === SLOT_KIND.FORM) formRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  /** Enter: commit what was typed — or, when it is not a word here, nothing (E-4). */
  const commitTyped = () => {
    const slot = retypingSlot;
    const text = query.trim();
    if (!slot || !text) { stopRetyping(); return; }
    if (slot.kind === SLOT_KIND.VOCABULARY) {
      const hits = filterOptions(slot, text);
      if (hits.length) apply(slot.patch(hits[0].id));
      return;
    }
    if (slot.kind === SLOT_KIND.NUMBER) {
      const typed = numberAsTyped(slot, statement, text);
      if (typed !== '' && Number.isFinite(Number(typed))) apply(slot.patch(typed));
      return;
    }
    apply(slot.patch(text));
  };

  const orphan = slots.find(slotIsOrphaned);
  const panelSlot = retypingSlot || focused;

  return (
    <div className="space-y-2">
      <p
        data-rules-line
        className="rounded px-3 py-2"
        style={{
          fontSize: 14,
          lineHeight: 1.8,
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {segments.map((seg, i) => {
          const slot = seg.slot ? byId.get(seg.slot) : null;
          if (!slot) return <span key={i}>{seg.text}</span>;
          if (i === retypingAt) {
            return (
              <WordInput
                key={i}
                word={seg.text}
                slot={slot}
                query={query}
                setQuery={setQuery}
                listId={listIdFor(slot)}
                onCommit={commitTyped}
                onCancel={stopRetyping}
              />
            );
          }
          return (
            <Word key={i} text={seg.text} slot={slot} active={slot.id === focusedId} onClick={() => open(slot, i)} />
          );
        })}
      </p>

      {unworded.length > 0 && (
        <div data-rules-more className="flex flex-wrap gap-1.5">
          {unworded.map((slot) => (
            <button
              key={slot.id}
              type="button"
              data-slot={slot.id}
              onClick={() => open(slot)}
              // Named by what it says, not by its hint — the hint is the tooltip.
              aria-label={affordanceLabel(slot)}
              className="px-1.5 py-0.5 rounded text-[11px]"
              style={{
                border: '1px dashed var(--color-border-default)',
                color: slot.id === focusedId ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background: slot.id === focusedId ? 'var(--color-accent-muted)' : 'transparent',
              }}
              title={slot.hint || slot.label}
            >
              {affordanceLabel(slot)}
            </button>
          ))}
        </div>
      )}

      {/* Tag suggestions, for typing a tag straight into the line. */}
      {slots.filter((s) => listIdFor(s)).map((s) => (
        <datalist key={s.id} id={listIdFor(s)}>
          {s.suggestions.map((t) => <option key={t} value={t} />)}
        </datalist>
      ))}

      {/*
        A slot's own note or warning — the buff-or-penalty reading and the
        unknown-tag catch. Computed by the slot model, so they are testable in
        the game's suite rather than only visible on screen.
      */}
      {slots.filter((s) => s.note || s.warning).map((s) => (
        <p
          key={s.id}
          className="text-[10px] leading-relaxed"
          style={{ color: s.warning ? 'var(--color-warning)' : 'var(--color-accent-hover)' }}
        >
          {s.warning || s.note}
        </p>
      ))}

      {orphan && (
        <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
          ⚠️ “{slotDisplay(orphan)}” is not something this rule can still reach — the
          moment you picked never supplies it. Pick again.
        </p>
      )}

      <div data-rules-panel className="rounded p-2" style={{ border: '1px solid var(--color-border-default)' }}>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
          {panelSlot ? panelSlot.label : 'What can go here'}
        </p>
        <PanelBody
          slot={panelSlot}
          retyping={!!retypingSlot}
          query={query}
          statement={statement}
          onPatch={onChange}
          onPickRetyped={(v) => retypingSlot && apply(retypingSlot.patch(v))}
        />
      </div>

      <div ref={formRef}>{form}</div>
    </div>
  );
}
