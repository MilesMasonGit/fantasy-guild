import { useState, useMemo, useRef, useId, useEffect } from 'react';
import {
  slotsOf, slotDisplay, slotIsOrphaned, slotsWithoutWords,
  SLOT_KIND, renderSegments, getFilterKind,
} from '../../utils/constants';
import { visibleOptions, visibleSuggestions } from './rulesLineModel';

/**
 * ⭐ **The Rules Line** — a rule is a line of prose you write into (E-1, E-2).
 *
 * The line on screen is `renderSegments`' own output: the exact sentence the
 * game prints, with every word that stands for a decision made clickable. There
 * is no second copy of the sentence and no row of chips — the words ARE the
 * controls.
 *
 * > *"I write the rules text with support, and it builds the effect from that."*
 *
 * ## ⭐ Click a word, retype that word (E-3)
 * Clicking a decision turns *that word* into a typing box, in place. Typing
 * narrows the panel to what is legal there; Enter takes the highlighted option;
 * Escape leaves the word as it was. Nothing else in the sentence moves.
 *
 * ## ⭐ Tab walks the words (Q3, owner ruling 2026-09-12)
 * Tab moves to the next underlined word and opens it; Shift+Tab goes back. What
 * was typed is committed on the way if it is valid, and simply dropped if it is
 * not — Tab never guesses. Up/Down move through the panel's list. Past the last
 * word, Tab leaves the sentence and the browser carries on as normal.
 *
 * ## ⚠️ The line does not own its cursor
 * Which word is being edited lives in `StatementList`, because there is ONE
 * panel for the whole list (E-5) and it has to follow the author from one rule
 * to the next. The line reports clicks and keys; the list decides what is open.
 *
 * ## ⚠️ There is still no parser
 * Enter commits an option the slot already offers, or a number, or a tag. An
 * unrecognised word inserts nothing (E-4) — the panel offers the nearest real
 * words, and only an author explicitly arrowing onto one can pick it.
 *
 * ## ⚠️ A number keeps its direction
 * "work 5% faster" stores −5. Retyping the 5 as 20 must not silently produce
 * "work 20% slower", so a typed number inherits the current sign unless the
 * author types one.
 *
 * ## ⚠️ Decisions with no word still get a control
 * `slotsWithoutWords` names every slot the sentence never mentions, and a quiet
 * row beneath the line offers each — so no decision becomes unauthorable by
 * quietly losing its only control.
 */

/** Slot kinds retyped in place, inside the sentence. */
const INLINE = new Set([SLOT_KIND.VOCABULARY, SLOT_KIND.NUMBER, SLOT_KIND.TEXT]);

// The lists themselves (what is shown, capped at LIST_CAP) live in
// `rulesLineModel.js`, shared by the line and the panel.
const listFor = (slot, query) =>
  slot.kind === SLOT_KIND.TEXT ? visibleSuggestions(slot, query) : visibleOptions(slot, query);

/** Which option in a list is highlighted: the one arrowed to, else the top hit. */
const highlightOf = (list, cursor) => (cursor?.moved ? cursor.active : list.near ? -1 : 0);

/**
 * A retyped number inherits the current sign unless the author types one.
 *
 * Only the `Provides` amount carries a sign, and a trailing "%" or "×" is
 * accepted, because that is how the number reads in the sentence.
 */
function numberAsTyped(slot, statement, text) {
  const bare = text.replace(/\s*[%×]\s*$/, '').trim();
  if (slot.id !== 'value' || /^[+-]/.test(bare)) return bare;
  return (Number(statement?.payload?.value) || 0) < 0 ? `-${bare}` : bare;
}

/**
 * The change committing what was typed would make — or null.
 *
 * ⚠️ Never guesses. An arrowed-to option is an explicit choice; the top hit is
 * taken only when the typed text genuinely matches; the nearest words to a
 * non-word are offered in the panel but never committed on their own (E-4).
 */
function typedPatch(slot, statement, cursor) {
  const text = (cursor?.query || '').trim();
  if (slot.kind === SLOT_KIND.VOCABULARY || slot.kind === SLOT_KIND.TEXT) {
    const list = listFor(slot, cursor?.query);
    if (cursor?.moved && list.shown[cursor.active]) return slot.patch(list.shown[cursor.active].id);
    if (!text) return null;
    if (slot.kind === SLOT_KIND.TEXT) return slot.patch(text);
    return !list.near && list.shown.length ? slot.patch(list.shown[0].id) : null;
  }
  if (slot.kind === SLOT_KIND.NUMBER) {
    if (!text) return null;
    const typed = numberAsTyped(slot, statement, text);
    return typed !== '' && Number.isFinite(Number(typed)) ? slot.patch(typed) : null;
  }
  return null;
}

/** A decision word: dashed underline at rest, highlighted while it is the focus. */
function Word({ text, slot, active, focusNow, onClick, onKeyDown }) {
  const ref = useRef(null);
  // Reached by Tab but not retyped in place (a flag, a filter stack, a form):
  // the button itself takes the focus, so Tab can carry on from it.
  useEffect(() => { if (focusNow) ref.current?.focus(); }, [focusNow]);
  const unset = text === '…';
  const warn = slotIsOrphaned(slot) || (unset && !slot.optional);
  return (
    <button
      ref={ref}
      type="button"
      data-slot={slot.id}
      onClick={onClick}
      onKeyDown={onKeyDown}
      // ⚠️ Named by the WORD, explicitly. With only a `title`, some tools name
      // this button "damage" (the slot) rather than "2" (what it says), and a
      // re-rendered one came back with no name at all.
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
function WordInput({ word, slot, query, listId, onQuery, onKey, onBlur }) {
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
      onChange={(e) => onQuery(e.target.value)}
      onKeyDown={onKey}
      // Clicking anywhere else leaves the word as it was. Panel options keep
      // the focus on mouse-down, so choosing one still commits.
      onBlur={onBlur}
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
function OptionButton({ option, current, highlighted, onPick }) {
  return (
    <button
      type="button"
      data-option={option.id}
      data-highlighted={highlighted ? 'true' : undefined}
      aria-selected={highlighted}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(option.id)}
      className="w-full text-left px-1.5 py-1 rounded hover:bg-white/5"
      style={{
        background: highlighted
          ? 'var(--color-accent-muted)'
          : option.id === current ? 'rgba(255,255,255,0.05)' : 'transparent',
        outline: highlighted ? '1px solid var(--color-accent)' : 'none',
      }}
    >
      <span className="text-[12px] block">{option.label}</span>
      {option.hint && <span className="text-[10px] text-gray-500 block leading-snug">{option.hint}</span>}
    </button>
  );
}

/**
 * A narrowed list, with the nearest words when nothing matches (E-4) and a count
 * when there is more than fits.
 */
function OptionList({ list, query, current, highlight, onPick }) {
  return (
    <div className="max-h-80 overflow-y-auto space-y-0.5">
      {list.near && (
        <p className="text-[10px] text-gray-500" data-nearest>
          Nothing here is called “{query.trim()}”. Nearest:
        </p>
      )}
      {list.shown.map((o, i) => (
        <OptionButton key={o.id} option={o} current={current} highlighted={i === highlight} onPick={onPick} />
      ))}
      {list.total > list.shown.length && (
        <p className="text-[10px] text-gray-500 pt-1" data-list-count>
          Showing {list.shown.length} of {list.total} — keep typing to narrow.
        </p>
      )}
      {!list.near && list.total === 0 && (
        <p className="text-[10px] text-gray-500">Nothing to pick from yet.</p>
      )}
    </div>
  );
}

/** A panel search for a vocabulary slot that has no word in the line to retype. */
function PanelSearch({ slot, onPick }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState({ active: 0, moved: false });
  const list = visibleOptions(slot, query);
  const highlight = highlightOf(list, cursor);
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={query}
        placeholder={`Type to narrow ${slot.label}…`}
        onChange={(e) => { setQuery(e.target.value); setCursor({ active: 0, moved: false }); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setCursor((c) => ({ active: Math.max(0, Math.min(list.shown.length - 1, (c.moved ? c.active : 0) + step)), moved: true }));
          }
          if (e.key === 'Enter') {
            const patch = typedPatch(slot, null, { query, ...cursor });
            if (patch) onPick(list.shown[cursor.moved ? cursor.active : 0].id);
          }
        }}
        className="w-full px-1.5 py-1 rounded text-[12px]"
      />
      <OptionList list={list} query={query} current={slot.value} highlight={highlight} onPick={onPick} />
    </div>
  );
}

/**
 * ⭐ **The panel — one for the whole list, on the left (E-5).**
 *
 * Shows everything legal for whichever word the author is on, in whichever rule.
 * It is how an author meets a word they did not know existed, and it keeps the
 * editor fully usable by clicking alone.
 *
 * @param {object|null} slot       the focused slot, resolved by the list
 * @param {object|null} cursor     `{ mode, query, active, moved }`
 * @param {object|null} statement  the rule the slot belongs to
 * @param {(patch: object) => void} onPatch        change that rule
 * @param {(id: string) => void} onPickRetyped     commit a picked option
 */
export function RulesPanel({ slot, cursor, statement, onPatch, onPickRetyped }) {
  const retyping = !!slot && cursor?.mode === 'retype';
  const shown = slot ? slotDisplay(slot) : '';
  const blank = retyping && slot.kind === SLOT_KIND.VOCABULARY && (!shown || shown === '…');
  const header = !slot ? 'What can go here' : blank ? `Pick ${slot.label}` : slot.label;

  let body;
  if (!slot) {
    body = (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Click any underlined word to retype it, or Tab through them. What can go there will
        appear here.
      </p>
    );
  } else if (retyping && (slot.kind === SLOT_KIND.VOCABULARY || slot.kind === SLOT_KIND.TEXT)) {
    const list = listFor(slot, cursor.query);
    body = (
      <>
        {slot.kind === SLOT_KIND.TEXT && (
          <p className="text-[10px] text-gray-500 mb-1">Type it and press Enter. Already in use:</p>
        )}
        {blank && (
          <p className="text-[10px] text-gray-500 mb-1">Start typing to search.</p>
        )}
        <OptionList
          list={list}
          query={cursor.query}
          current={slot.value}
          highlight={highlightOf(list, cursor)}
          onPick={onPickRetyped}
        />
      </>
    );
  } else if (retyping && slot.kind === SLOT_KIND.NUMBER) {
    const signed = slot.id === 'value' && (Number(statement?.payload?.value) || 0) !== 0;
    body = (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Type a number and press Enter or Tab. Escape leaves it as it was.
        {signed && ' It keeps its direction — type a minus or a plus sign to flip it.'}
      </p>
    );
  } else {
    switch (slot.kind) {
      case SLOT_KIND.VOCABULARY:
        body = <PanelSearch key={slot.id} slot={slot} onPick={(v) => onPatch(slot.patch(v))} />;
        break;
      case SLOT_KIND.NUMBER:
        body = (
          <input
            type="number"
            min={slot.min}
            value={slot.value ?? ''}
            onChange={(e) => onPatch(slot.patch(e.target.value))}
            className="px-1.5 py-1 rounded text-[12px] w-24"
          />
        );
        break;
      case SLOT_KIND.TEXT:
        body = (
          <input
            type="text"
            value={slot.value ?? ''}
            onChange={(e) => onPatch(slot.patch(e.target.value))}
            className="px-1.5 py-1 rounded text-[12px] w-40"
          />
        );
        break;
      case SLOT_KIND.FLAG:
        body = (
          <label className="flex items-start gap-2 text-[12px]">
            <input type="checkbox" checked={!!slot.value} onChange={(e) => onPatch(slot.patch(e.target.checked))} />
            <span>
              {slot.label}
              {slot.hint && <span className="block text-[10px] text-gray-500 leading-relaxed">{slot.hint}</span>}
            </span>
          </label>
        );
        break;
      case SLOT_KIND.FILTERS:
        body = <FilterStack slot={slot} onChange={onPatch} />;
        break;
      default:
        body = (
          <p className="text-[11px] text-gray-500 leading-relaxed">
            This one is edited in the form beneath the rule.
          </p>
        );
    }
  }

  return (
    <div
      data-rules-panel
      className="rounded p-2"
      style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-base)' }}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">{header}</p>
      {body}
    </div>
  );
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
 * @param {object} ctx  the content a slot may pick from
 * @param {object|null} cursor  this rule's share of the list's cursor, or null
 *   when the author is working in another rule
 * @param {object} actions  cursor moves, bound to this rule by the list
 */
export default function RulesLine({ statement, onChange, names, form, ctx, cursor, actions }) {
  const slots = useMemo(() => slotsOf(statement, ctx), [statement, ctx]);
  const segments = useMemo(() => renderSegments(statement, names), [statement, names]);
  const byId = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const unworded = useMemo(() => slotsWithoutWords(slots, segments), [slots, segments]);
  const formRef = useRef(null);
  const idBase = useId();

  // Every clickable word's position, in reading order — what Tab walks.
  const words = useMemo(
    () => segments.reduce((acc, s, i) => (s.slot && byId.has(s.slot) ? [...acc, i] : acc), []),
    [segments, byId]
  );

  /**
   * ⚠️ A word is remembered by its slot and which occurrence of it, never by
   * position alone. Committing a word re-renders the sentence, and positions can
   * shift ("On Cycle" → "On Neighbour Produces …" adds words), so the cursor is
   * re-resolved against the CURRENT segments every render.
   */
  const occurrenceOf = (i) => segments.slice(0, i).filter((s) => s.slot === segments[i].slot).length;
  const indexOf = (slotId, occurrence = 0) => {
    let n = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].slot !== slotId) continue;
      if (n === occurrence) return i;
      n += 1;
    }
    return -1;
  };

  const at = cursor ? indexOf(cursor.slotId, cursor.occurrence) : -1;
  const retypingAt = cursor?.mode === 'retype' && at >= 0 ? at : null;
  const focusedAt = cursor?.mode === 'word' && at >= 0 ? at : null;
  const retypingSlot = retypingAt != null ? byId.get(segments[retypingAt].slot) : null;
  const listIdFor = (slot) => (slot.kind === SLOT_KIND.TEXT && slot.suggestions?.length ? `${idBase}-${slot.id}` : undefined);

  /** Where the cursor goes for the word at position `i`. */
  const targetAt = (i, { keyboard }) => {
    const slot = byId.get(segments[i].slot);
    const mode = INLINE.has(slot.kind) ? 'retype' : keyboard ? 'word' : 'panel';
    return { slotId: slot.id, occurrence: occurrenceOf(i), mode };
  };

  const click = (i) => {
    const target = targetAt(i, { keyboard: false });
    actions.set(target);
    if (byId.get(target.slotId).kind === SLOT_KIND.FORM) formRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  /** Tab / Shift+Tab: commit what is valid, then move to the neighbouring word. */
  const walk = (fromIndex, e) => {
    if (e.key !== 'Tab') return;
    const patch = retypingSlot && fromIndex === retypingAt ? typedPatch(retypingSlot, statement, cursor) : null;
    if (patch) onChange(patch);
    const next = words[words.indexOf(fromIndex) + (e.shiftKey ? -1 : 1)];
    if (next == null) {
      // Past either end of the sentence: let the browser move focus on normally.
      actions.close();
      return;
    }
    e.preventDefault();
    actions.set(targetAt(next, { keyboard: true }));
  };

  /** Keys inside the typing box. */
  const keyInBox = (e) => {
    const slot = retypingSlot;
    if (!slot) return;
    if (e.key === 'Tab') { walk(retypingAt, e); return; }
    if (e.key === 'Escape') { e.preventDefault(); actions.close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (slot.kind === SLOT_KIND.NUMBER) return;
      e.preventDefault();
      actions.move(e.key === 'ArrowDown' ? 1 : -1, listFor(slot, cursor.query).shown.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const patch = typedPatch(slot, statement, cursor);
      if (patch) { onChange(patch); actions.close(); return; }
      // Nothing typed and nothing chosen: keep what was there. Otherwise the
      // text is not a word here — insert nothing, keep the suggestions open (E-4).
      if (!cursor.query.trim() && !cursor.moved) actions.close();
    }
  };

  const orphan = slots.find(slotIsOrphaned);

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
            const occurrence = occurrenceOf(i);
            return (
              <WordInput
                key={i}
                word={seg.text}
                slot={slot}
                query={cursor.query}
                listId={listIdFor(slot)}
                onQuery={actions.query}
                onKey={keyInBox}
                onBlur={() => actions.closeIf(slot.id, occurrence)}
              />
            );
          }
          return (
            <Word
              key={i}
              text={seg.text}
              slot={slot}
              active={cursor?.slotId === slot.id}
              focusNow={i === focusedAt}
              onClick={() => click(i)}
              onKeyDown={(e) => walk(i, e)}
            />
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
              onClick={() => actions.set({ slotId: slot.id, occurrence: 0, mode: 'panel' })}
              // Named by what it says, not by its hint — the hint is the tooltip.
              aria-label={affordanceLabel(slot)}
              className="px-1.5 py-0.5 rounded text-[11px]"
              style={{
                border: '1px dashed var(--color-border-default)',
                color: cursor?.slotId === slot.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background: cursor?.slotId === slot.id ? 'var(--color-accent-muted)' : 'transparent',
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

      <div ref={formRef}>{form}</div>
    </div>
  );
}
