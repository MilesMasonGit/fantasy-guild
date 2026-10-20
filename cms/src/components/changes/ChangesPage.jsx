import { useEffect, useMemo, useState } from 'react';
import { Inbox, Archive, Check, X, Pencil, Eye, AlertTriangle, Undo2, CheckCheck, Ban, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { currentValue, proposedValue, changedFields, canonicalJson } from '../../engine/changePacks';
import {
  rowState, accept, force, applyEarly, reject, acceptAll, rejectAll, finish, planUndo, undo,
} from '../../engine/packReview';

/**
 * Changes to review: agents' change packs (`cms/incoming/`), one row per entry, accepted or
 * rejected here or opened in the normal editor to tweak first. Finish applies the accepted entries
 * to this workspace (the owner then Syncs as usual) and archives the pack; Undo puts an archived
 * pack's entries back as they were.
 */

const OP_LOOK = {
  create: { word: 'New', color: 'var(--color-success)' },
  edit: { word: 'Changed', color: 'var(--color-info)' },
  delete: { word: 'Deleted', color: 'var(--color-error)' },
};
const KIND_WORD = { item: 'Item', token: 'Token', recipe: 'Recipe', effect: 'Effect', map: 'Map' };

const when = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};

function useWorkspace() {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const effects = useEntityStore((s) => s.effects);
  const recipePools = useEntityStore((s) => s.recipePools);
  return useMemo(() => ({ items, tokens, effects, recipePools }), [items, tokens, effects, recipePools]);
}

/** Write review results into the workspace; an open editor on an entity that just went away is closed. */
function writeWorkspace(ws) {
  const s = useEntityStore.getState();
  const patch = { items: ws.items, tokens: ws.tokens, effects: ws.effects, recipePools: ws.recipePools };
  const type = s.activeEntityType;
  const key = type === 'token' ? 'tokens' : type === 'effect' ? 'effects' : 'items';
  if (s.activeEntityId && type && !patch[key]?.[s.activeEntityId]) Object.assign(patch, { activeEntityId: null, activeEntityType: null });
  useEntityStore.setState(patch);
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'HTTP ' + res.status);
  return out;
}

async function getJson(url) {
  const res = await fetch(url);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error([out.error, ...(out.errors || [])].filter(Boolean).join(' — ') || 'HTTP ' + res.status);
  return out;
}

export default function ChangesPage({ setCurrentView }) {
  const listing = useReviewStore((s) => s.listing);
  const listingError = useReviewStore((s) => s.listingError);
  const refresh = useReviewStore((s) => s.refresh);
  const [selected, setSelected] = useState(null);
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const open = async (where, file) => {
    setSelected({ where, file });
    setPack(null);
    setError('');
    try {
      setPack(await getJson(`/api/change-packs/${where}/${encodeURIComponent(file)}`));
    } catch (err) {
      setError(err.message);
    }
  };

  const closed = async () => {
    setSelected(null);
    setPack(null);
    await refresh();
  };

  const inbox = listing?.inbox || [];
  const applied = listing?.applied || [];

  return (
    <div className="flex h-full gap-4" data-testid="changes-page">
      <aside className="w-72 shrink-0 overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Inbox size={15} /> Changes to review
          </h2>
          <button className="btn-ghost p-1" title="Read the inbox again" onClick={refresh}><RefreshCw size={13} /></button>
        </div>
        {listingError && <p className="text-xs" style={{ color: 'var(--color-error)' }}>Could not read the inbox: {listingError}</p>}
        {inbox.length === 0 && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Nothing waiting. Agents put packs in <code>cms/incoming/</code>.</p>}
        {inbox.map((p) => (
          <PackCard key={p.file} summary={p} active={selected?.where === 'inbox' && selected.file === p.file} onClick={() => open('inbox', p.file)} />
        ))}

        <h3 className="text-xs font-semibold uppercase tracking-wider pt-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <Archive size={12} /> Applied
        </h3>
        {applied.length === 0 && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No finished packs yet.</p>}
        {applied.map((p) => (
          <PackCard key={p.file} summary={p} archived active={selected?.where === 'applied' && selected.file === p.file} onClick={() => open('applied', p.file)} />
        ))}
      </aside>

      <section className="flex-1 overflow-y-auto pr-2">
        {error && <p className="text-sm p-3 rounded" style={{ color: 'var(--color-error)', background: 'var(--color-bg-surface)' }}>{error}</p>}
        {!selected && !error && (
          <p className="text-sm mt-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Pick a pack on the left.</p>
        )}
        {pack && selected?.where === 'inbox' && (
          <PackReview key={selected.file} file={selected.file} pack={pack} onFinished={closed} setCurrentView={setCurrentView} />
        )}
        {pack && selected?.where === 'applied' && (
          <ArchivedPack key={selected.file} file={selected.file} pack={pack} onUndone={closed} />
        )}
      </section>
    </div>
  );
}

function PackCard({ summary, archived, active, onClick }) {
  const bad = summary.errors?.length > 0;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border block"
      style={{
        background: active ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
        borderColor: bad ? 'var(--color-error)' : active ? 'var(--color-accent)' : 'var(--color-border-subtle)',
        cursor: 'pointer',
      }}
    >
      <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{summary.id || summary.file}</div>
      {summary.asked && <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{summary.asked}</div>}
      <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
        {bad ? 'Malformed: cannot be reviewed' : archived
          ? `${summary.review?.applied ?? 0} of ${summary.entries} applied · ${when(summary.review?.finishedAt)}`
          : `${summary.entries} entr${summary.entries === 1 ? 'y' : 'ies'} · ${when(summary.createdAt)}`}
      </div>
      {bad && (
        <ul className="text-[11px] mt-1 list-disc pl-4" style={{ color: 'var(--color-error)' }}>
          {summary.errors.slice(0, 4).map((e) => <li key={e}>{e}</li>)}
          {summary.errors.length > 4 && <li>and {summary.errors.length - 4} more</li>}
        </ul>
      )}
    </button>
  );
}

function PackReview({ file, pack, onFinished, setCurrentView }) {
  const ws = useWorkspace();
  const session = useReviewStore((s) => s.sessions[file]) || { entries: {} };
  const setSession = useReviewStore((s) => s.setSession);
  const dropSession = useReviewStore((s) => s.dropSession);
  const [blocked, setBlocked] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = pack.entries.map((entry, index) => ({ entry, index, state: rowState(ws, pack, session, index) }));
  const accepted = rows.filter((r) => r.state.decision === 'accepted').length;
  const pending = rows.filter((r) => r.state.decision === 'pending').length;
  const art = rows.filter((r) => r.entry.placeholderArt).length;

  const step = (result) => {
    if (!result) return;
    if (result.workspace) writeWorkspace(result.workspace);
    setSession(file, result.session);
    setBlocked(null);
  };

  const openInEditor = (entry, index) => {
    if (entry.op !== 'delete') {
      const result = applyEarly(useEntityStore.getState(), pack, session, index);
      if (!result) return;
      step(result);
    }
    if (entry.kind === 'recipe') {
      useEntityStore.getState().focusRecipe(entry.id);
      setCurrentView('recipes');
    } else {
      useEntityStore.getState().setActiveEntity(entry.id, entry.kind);
      setCurrentView('editor');
    }
  };

  const onFinish = async () => {
    const result = finish(useEntityStore.getState(), pack, session);
    if (result.blocked) {
      setBlocked(result.blocked);
      return;
    }
    writeWorkspace(result.workspace);
    setSession(file, result.session);
    setBusy(true);
    try {
      await postJson(`/api/change-packs/inbox/${encodeURIComponent(file)}/archive`, { review: result.record });
      dropSession(file);
      await onFinished();
    } catch (err) {
      setError('The changes are in the workspace, but the pack could not be archived: ' + err.message + '. Finish again to retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pack-review">
      <header className="p-4 rounded-lg border space-y-2" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pack.id} · made {when(pack.createdAt)}{pack.author ? ` by ${pack.author}` : ''}</div>
            <h2 className="text-base font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{pack.asked}</h2>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {pack.entries.length} entries · {accepted} accepted · {pending} to decide{art ? ` · ${art} with placeholder art` : ''}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn-ghost flex items-center gap-1" onClick={() => step({ session: acceptAll(ws, pack, session) })}><CheckCheck size={14} /> Accept all</button>
            <button className="btn-ghost flex items-center gap-1" onClick={() => step(rejectAll(useEntityStore.getState(), pack, session))}><Ban size={14} /> Reject all</button>
            <button className="btn-primary flex items-center gap-1" disabled={busy} onClick={onFinish}>
              <Check size={14} /> Finish review{accepted ? ` (apply ${accepted})` : ''}
            </button>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Finish applies the accepted entries to this workspace and moves the pack to Applied, where it can be undone. Nothing reaches the game until you Sync. Run Recalculate after accepting new content.
        </p>
        {blocked && (
          <div className="text-xs p-2 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-error)' }}>
            Not finished yet:
            <ul className="list-disc pl-4">{blocked.map((b) => <li key={b.index}>Entry {b.index + 1} ({pack.entries[b.index].id}): {b.reason}</li>)}</ul>
          </div>
        )}
        {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
      </header>

      {rows.map(({ entry, index, state }) => (
        <EntryRow
          key={index}
          entry={entry}
          index={index}
          state={state}
          ws={ws}
          onAccept={() => step({ session: accept(ws, pack, session, index) })}
          onForce={() => step({ session: force(session, index) })}
          onReject={() => step(reject(useEntityStore.getState(), pack, session, index))}
          onOpen={() => openInEditor(entry, index)}
        />
      ))}
    </div>
  );
}

function EntryRow({ entry, index, state, ws, onAccept, onForce, onReject, onOpen }) {
  const look = OP_LOOK[entry.op];
  const now = currentValue(ws, entry.kind, entry.id);
  const before = state.appliedEarly ? state.before : now;
  const after = state.appliedEarly ? now : proposedValue(entry);
  const name = after?.name || before?.name || entry.id;
  const status = state.decision === 'accepted'
    ? (state.appliedEarly ? 'Accepted, in the workspace (tweak it in the editor)' : 'Accepted')
    : state.decision === 'rejected' ? 'Rejected' : 'To decide';

  return (
    <article
      className="rounded-lg border p-3 space-y-2"
      data-testid={`entry-${index}`}
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: state.conflict && !state.forced ? 'var(--color-warning)' : state.decision === 'accepted' ? 'var(--color-success)' : 'var(--color-border-subtle)',
        opacity: state.decision === 'rejected' ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded uppercase" style={{ background: look.color, color: '#0a0c12' }}>{look.word}</span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{KIND_WORD[entry.kind]}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
        <code className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{entry.id}</code>
        {entry.placeholderArt && (
          <span className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' }}>
            <ImageIcon size={11} /> placeholder art
          </span>
        )}
        <span className="ml-auto text-xs" data-testid={`status-${index}`} style={{ color: state.decision === 'accepted' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{status}</span>
      </div>
      <p className="text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>{entry.note}</p>

      {state.conflict && (
        <div className="text-xs p-2 rounded flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
          <AlertTriangle size={13} /> Conflict: {state.reason}
          {state.forced ? <span> Will be applied anyway.</span> : (
            <button className="btn-ghost ml-auto text-xs" onClick={onForce} title="Overwrite what is in the workspace with this entry">Apply anyway</button>
          )}
        </div>
      )}
      {state.missing && (
        <div className="text-xs p-2 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
          No longer under this id: renamed or deleted in the editor. Undo will not be able to find it.
        </div>
      )}

      <BeforeAfter op={entry.op} before={before} after={after} />

      <div className="flex gap-2">
        <button className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={state.decision === 'accepted' || (state.conflict && !state.forced)} onClick={onAccept}><Check size={13} /> Accept</button>
        <button className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={state.decision === 'rejected'} onClick={onReject}><X size={13} /> Reject</button>
        {entry.op === 'delete' ? (
          now && <button className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed" onClick={onOpen}><Eye size={13} /> View in the editor</button>
        ) : (
          <button className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={state.conflict && !state.forced} onClick={onOpen}><Pencil size={13} /> Open in the editor</button>
        )}
      </div>
    </article>
  );
}

const show = (v) => (v === undefined ? '—' : canonicalJson(v));

function Value({ v }) {
  const text = show(v);
  return <code className="text-[11px] break-all" title={text.length > 160 ? text : undefined}>{text.length > 160 ? text.slice(0, 160) + '…' : text}</code>;
}

/** Before / after: the changed fields for an edit, the whole record for a create or a delete. */
function BeforeAfter({ op, before, after }) {
  if (op === 'edit') {
    const fields = changedFields(before, after);
    if (!fields.length) return <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No field differs from the workspace.</p>;
    return (
      <table className="w-full text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <thead><tr style={{ color: 'var(--color-text-muted)' }}><th className="text-left w-32 font-normal">Field</th><th className="text-left font-normal">Before</th><th className="text-left font-normal">After</th></tr></thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f} className="align-top">
              <td className="pr-2 font-semibold">{f}</td>
              <td className="pr-2" style={{ color: 'var(--color-error)' }}><Value v={before?.[f]} /></td>
              <td style={{ color: 'var(--color-success)' }}><Value v={after?.[f]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const record = op === 'delete' ? before : after;
  if (!record) return <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Not in the workspace.</p>;
  return (
    <table className="w-full text-xs" style={{ color: op === 'delete' ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
      <tbody>
        {Object.keys(record).filter((k) => k !== 'id').sort().map((k) => (
          <tr key={k} className="align-top">
            <td className="pr-2 w-32 font-semibold" style={{ textDecoration: op === 'delete' ? 'line-through' : 'none' }}>{k}</td>
            <td><Value v={record[k]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArchivedPack({ file, pack, onUndone }) {
  const ws = useWorkspace();
  const plan = useMemo(() => planUndo(ws, pack), [ws, pack]);
  const [also, setAlso] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const decided = pack.review?.entries || [];

  const onUndo = async () => {
    const result = undo(useEntityStore.getState(), pack, also);
    writeWorkspace(result.workspace);
    setBusy(true);
    try {
      await postJson(`/api/change-packs/applied/${encodeURIComponent(file)}/restore`, { undone: result.undone });
      await onUndone();
    } catch (err) {
      setError('The workspace is put back, but the pack could not be returned to the inbox: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="archived-pack">
      <header className="p-4 rounded-lg border space-y-1" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pack.id} · finished {when(pack.review?.finishedAt)}</div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{pack.asked}</h2>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {plan.length} applied · {decided.length - plan.length} rejected
        </div>
      </header>

      <div className="space-y-2">
        {decided.map((d) => {
          const p = plan.find((x) => x.index === d.index);
          const entry = pack.entries[d.index];
          return (
            <div key={d.index} data-testid={`undo-${d.index}`} className="p-3 rounded-lg border text-xs flex items-center gap-2 flex-wrap" style={{ background: 'var(--color-bg-surface)', borderColor: p?.flagged ? 'var(--color-warning)' : 'var(--color-border-subtle)' }}>
              <span className="font-bold uppercase" style={{ color: OP_LOOK[d.op].color }}>{OP_LOOK[d.op].word}</span>
              <span style={{ color: 'var(--color-text-primary)' }}>{entry?.value?.name || d.before?.name || d.id}</span>
              <code style={{ color: 'var(--color-text-muted)' }}>{d.id}</code>
              <span className="ml-auto" style={{ color: 'var(--color-text-secondary)' }}>
                {!d.applied ? 'Rejected: nothing to undo' : p?.flagged ? '' : 'Will be put back'}
              </span>
              {p?.flagged && (
                <span className="flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle size={12} /> {p.reason}
                  {!p.missingAfter && (
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={also.includes(d.index)} onChange={(e) => setAlso(e.target.checked ? [...also, d.index] : also.filter((i) => i !== d.index))} />
                      put back anyway
                    </label>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary flex items-center gap-1" disabled={busy || plan.length === 0} onClick={onUndo}><Undo2 size={14} /> Undo this pack</button>
        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Puts the workspace back as it was before the pack (flagged entries stay as they are unless ticked) and returns the pack to the inbox.</span>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}
