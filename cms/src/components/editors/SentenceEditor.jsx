import { useState, useRef, useEffect, useMemo } from 'react';
import {
  slotsOf, slotDisplay, slotIsOrphaned, filterOptions, SLOT_KIND,
  renderStatement, getFilterKind,
} from '../../utils/constants';

/**
 * ⭐ **The editor is the sentence** (G-18).
 *
 * The CMS used to ask for a rule through nested dropdowns — a keyword box, a
 * payload box, a target box, a trigger box. The owner asked for the opposite:
 *
 * > *"Instead of many nested dropdown menus… what if I was able to type into
 * > words and it auto-filled valid syntax words. Basically, I write the rules
 * > text with support, and it builds the effect from that."*
 *
 * So a rule is a **row of chips read left to right in sentence order**. Click one
 * and type; the list narrows to what is legal *there*; enter picks it.
 *
 * ## ⚠️ There is no parser, and there never will be
 * A chip is backed by a **declared option**, not by text. The statement object
 * is this component's state and `renderStatement` is what it displays, so there
 * is one renderer and no inverse of it to maintain. An invalid rule stays
 * unwritable — the dropdowns' guarantee, kept at typing speed.
 *
 * ## ⚠️ The chips are the DECISIONS, not every word
 * "When", "deals", "damage to" and the rest of the connective tissue belong to
 * the sentence, which is printed beneath the row by the one renderer. A chip is
 * a choice an author makes. Keeping the two apart is what stops this file
 * becoming a second renderer that can quietly disagree with the first — and the
 * sentence underneath stays the thing you read to check the rule.
 *
 * ## The panel (G-19)
 * A dropdown is self-documenting; typing is not. So everything legal at the
 * focused slot is listed beside the row, with its hint. You can author entirely
 * by reading and clicking it, entirely by typing, or by mixing — which matters
 * most for the parts of the vocabulary you have not used before.
 */

/** One chip: shows a slot's value, opens a typing popover when clicked. */
function Chip({ slot, active, onFocus, onChange }) {
  const orphaned = slotIsOrphaned(slot);
  const display = slotDisplay(slot);
  // ⚠️ An OPTIONAL slot left empty is not a hole. "Only for <skill>" unset means
  // "any skill", which is what most rules want — painting it as a warning would
  // make every ordinary rule look half-written.
  const blank = (!display || display === '…') && !slot.optional;
  const unset = !display || display === '…';

  // A flag that is off shows nothing at all — "ignores armour" is either part
  // of the rule or it is not, and an "off" chip would be a word that is not in
  // the sentence.
  if (slot.kind === SLOT_KIND.FLAG && !slot.value && !active) {
    return (
      <button
        type="button"
        onClick={onFocus}
        className="px-1.5 py-0.5 rounded text-[11px] opacity-40 hover:opacity-100"
        style={{ border: '1px dashed var(--color-border)' }}
        title={slot.hint || slot.label}
      >
        + {slot.label}
      </button>
    );
  }

  if (slot.kind === SLOT_KIND.NUMBER) {
    return (
      <input
        type="number"
        min={slot.min}
        value={slot.value ?? ''}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className="px-1 py-0.5 rounded text-[12px] w-16 text-center"
        style={{ border: '1px solid var(--color-border)' }}
        title={slot.label}
      />
    );
  }

  if (slot.kind === SLOT_KIND.TEXT) {
    const listId = `slot-suggest-${slot.id}`;
    return (
      <>
        <input
          type="text"
          list={slot.suggestions ? listId : undefined}
          value={slot.value ?? ''}
          placeholder={slot.label}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className="px-1 py-0.5 rounded text-[12px] w-28"
          style={{
            border: `1px solid ${slot.warning ? 'var(--color-warning)' : 'var(--color-border)'}`
          }}
        />
        {slot.suggestions && (
          <datalist id={listId}>
            {slot.suggestions.map((t) => <option key={t} value={t} />)}
          </datalist>
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onFocus}
      className="px-1.5 py-0.5 rounded text-[12px]"
      style={{
        border: `1px solid ${orphaned ? 'var(--color-warning)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-surface-2, rgba(255,255,255,0.06))' : 'transparent',
        color: orphaned || blank ? 'var(--color-warning)' : 'inherit',
        opacity: unset && slot.optional ? 0.45 : 1,
      }}
      title={slot.label}
    >
      {unset ? `— ${slot.label} —` : display}
    </button>
  );
}

/**
 * The stacked filters (G-9) — a list, so it gets a small form rather than a chip.
 *
 * ⚠️ Every row carries its own **negate** toggle, because negation doubles what
 * each filter can say for the cost of one checkbox. The wording flips with it:
 * "with fewer than 3 charges" becomes "with 3 or more charges", never "not with
 * fewer than", because each filter owns both readings.
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
            <span className="text-[11px] text-gray-500">only the ones</span>
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={!!row.not}
                onChange={(e) => write(rows.map((r, j) => j === i ? { ...r, not: e.target.checked } : r))}
              />
              not
            </label>
            <select
              value={row.kind}
              onChange={(e) => write(rows.map((r, j) => j === i ? { kind: e.target.value } : r))}
              className="text-[12px]"
            >
              {slot.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {kind?.value && (
              <input
                type={kind.value === 'number' ? 'number' : 'text'}
                value={row.value ?? ''}
                placeholder={kind.placeholder || ''}
                onChange={(e) => write(rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                className="px-1 py-0.5 rounded text-[12px] w-24"
                style={{ border: '1px solid var(--color-border)' }}
              />
            )}
            <button
              type="button"
              onClick={() => write(rows.filter((_, j) => j !== i))}
              className="text-[11px] opacity-60 hover:opacity-100"
            >
              ✕
            </button>
            {kind?.hint && (
              <span className="text-[10px] text-gray-500 basis-full">{kind.hint}</span>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => write([...rows, { kind: slot.options[0]?.id }])}
        className="text-[11px] px-1.5 py-0.5 rounded"
        style={{ border: '1px dashed var(--color-border)' }}
      >
        + narrow it further
      </button>
    </div>
  );
}

/**
 * The typing surface and the "what can go here" list (G-19).
 *
 * ⚠️ Shows the slot's **whole** vocabulary until the author types, rather than
 * waiting to be searched. The vocabulary is growing fast and the parts worth
 * discovering are the parts nobody has used yet.
 */
function WhatCanGoHere({ slot, onPick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  /**
   * ⚠️ Focus only. The query is reset by **remounting** — the caller gives this
   * a `key` of the slot id — rather than by clearing state inside an effect.
   * Setting state synchronously in an effect makes React render twice for every
   * slot change, and the framework says so out loud; a key expresses "this is a
   * different editing session" directly, which is what a new slot is.
   */
  useEffect(() => { inputRef.current?.focus(); }, []);

  const hits = useMemo(() => filterOptions(slot, query), [slot, query]);

  if (!slot) {
    return (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Click any part of the rule to change it. The options that fit there will
        appear here.
      </p>
    );
  }

  if (slot.kind === SLOT_KIND.FLAG) {
    return (
      <label className="flex items-start gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={!!slot.value}
          onChange={(e) => onPick(e.target.checked)}
        />
        <span>
          {slot.label}
          {slot.hint && (
            <span className="block text-[10px] text-gray-500 leading-relaxed">{slot.hint}</span>
          )}
        </span>
      </label>
    );
  }

  if (slot.kind !== SLOT_KIND.VOCABULARY) {
    return (
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Type the {slot.label} straight into the rule.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={`Type to narrow ${slot.label}…`}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter takes the top hit — the whole point of typing rather than
          // clicking. It can only ever pick something the slot already allows.
          if (e.key === 'Enter' && hits.length) onPick(hits[0].id);
        }}
        className="w-full px-1.5 py-1 rounded text-[12px]"
        style={{ border: '1px solid var(--color-border)' }}
      />
      <div className="max-h-52 overflow-y-auto space-y-0.5">
        {hits.length === 0 && (
          <p className="text-[10px] text-gray-500">Nothing here matches “{query}”.</p>
        )}
        {hits.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="w-full text-left px-1.5 py-1 rounded hover:bg-white/5"
            style={{
              background: o.id === slot.value ? 'var(--color-surface-2, rgba(255,255,255,0.06))' : 'transparent'
            }}
          >
            <span className="text-[12px] block">{o.label}</span>
            {o.hint && (
              <span className="text-[10px] text-gray-500 block leading-snug">{o.hint}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One statement, edited as a sentence.
 *
 * @param {object} statement
 * @param {(patch: object) => void} onChange  merged into the statement
 * @param {object} names  id → display name, for the rendered sentence
 * @param {React.ReactNode} form  the list-shaped payload editor (G-20), shown
 *   beneath the sentence for the keywords whose payload is a table
 * @param {{tokens: object, items: object}} ctx  the content a slot may pick
 *   from. Supplied rather than imported, because the CMS edits its own DRAFT
 *   store while the game reads its registry — neither is more correct, so the
 *   caller says which it means.
 * @param {{tokens: object, items: object}} ctx  the content a slot may pick
 *   from. Supplied rather than imported, because the CMS edits its own DRAFT
 *   store while the game reads its registry — see the note in `statementSlots`.
 */
export default function SentenceEditor({ statement, onChange, names, form, ctx }) {
  const slots = useMemo(() => slotsOf(statement, ctx), [statement, ctx]);
  const [focusedId, setFocusedId] = useState(null);

  // A slot can vanish under the cursor — changing the verb changes the row —
  // so the focus is resolved against the CURRENT slots every render rather than
  // held as an object that could go stale.
  const focused = slots.find((s) => s.id === focusedId) || null;
  /**
   * ⚠️ **The payload form is always rendered, not only for list payloads.**
   *
   * It was gated on a `FORM`-kind slot existing, which is true only for
   * `Converts`, `Restocks` and `Grants` — so every OTHER keyword lost the
   * controls the sentence editor does not replace. `Works as` has no slot at
   * all, which left it with a bare "does" chip and made **no new station Token
   * authorable at all**; `Acts as` lost its tier, `Applies` its chance,
   * `Cannot` its limit.
   *
   * The chips cover the vocabulary; the form covers what a sentence cannot
   * hold. Both are needed, and the form is harmless where it renders nothing.
   */
  const orphan = slots.find(slotIsOrphaned);

  return (
    <div className="space-y-2">
      {/*
        ⚠️ **Stacked, not two columns.** The panel began as a 240px sidebar and
        overlapped the chips: the CMS's centre editor column is narrow, and a
        fixed side column has nowhere to go. The panel sits beneath the sentence
        instead, which also puts it directly under the chip you just clicked.
      */}
      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {slots
              .filter((s) => s.kind !== SLOT_KIND.FORM && s.kind !== SLOT_KIND.FILTERS)
              .map((s) => (
                <Chip
                  key={s.id}
                  slot={s}
                  active={s.id === focusedId}
                  onFocus={() => setFocusedId(s.id)}
                  onChange={(v) => onChange(s.patch(v))}
                />
              ))}
          </div>

          {/*
            ⭐ The canonical sentence, from the one renderer. The chips above are
            the decisions; this is the rule. If the two ever read differently,
            this one is right.
          */}
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-accent-hover)' }}>
            “{renderStatement(statement, names)}”
          </p>

          {/*
            A slot's own note or warning — the buff-or-penalty reading, and the
            unknown-tag catch. Both used to live in the pickers this row
            replaced; they are computed by the slot model now, so they are
            testable in the game's suite rather than only visible on screen.
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
              ⚠️ “{slotDisplay(orphan)}” is not something this rule can still
              reach — the moment you picked never supplies it. Pick again.
            </p>
          )}

          {slots.filter((s) => s.kind === SLOT_KIND.FILTERS).map((s) => (
            <FilterStack key={s.id} slot={s} onChange={onChange} />
          ))}

          {form}
        </div>

        <div className="rounded p-2" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
            {focused ? focused.label : 'What can go here'}
          </p>
          <WhatCanGoHere
            key={focused?.id || 'none'}
            slot={focused}
            onPick={(v) => onChange(focused.patch(v))}
          />
        </div>
      </div>
    </div>
  );
}
