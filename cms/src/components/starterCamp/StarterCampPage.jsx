import { useEffect, useMemo, useState } from 'react';
import { Tent, Package, Map as MapIcon, Inbox, X, Plus, Trash2 } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { fetchPendingFromGame, clearPendingFromGame, isEmptyStarterCamp } from '../../engine/starterCamp';

/**
 * The Starter Camp page: the Region a new game opens in, as the game's dev button saved it ("Save
 * this mat as the Starter Camp" in the game's QA panel). Read-mostly: the Tokens and their points
 * come from the game, where the layout is made; the opening Bank's counts can be edited here. Sync
 * to Game writes it to `data/starterCamp.json`.
 */

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export default function StarterCampPage() {
  const camp = useEntityStore((s) => s.starterCamp);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);
  const setStarterCamp = useEntityStore((s) => s.setStarterCamp);
  const setBankCount = useEntityStore((s) => s.setStarterCampBankCount);
  const removeToken = useEntityStore((s) => s.removeStarterCampToken);
  const clearStarterCamp = useEntityStore((s) => s.clearStarterCamp);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    fetchPendingFromGame()
      .then((found) => { if (live) setPending(found); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const takePending = async () => {
    setStarterCamp(pending.camp);
    setPending(null);
    try { await clearPendingFromGame(); } catch (err) { setError(err.message); }
  };
  const discardPending = async () => {
    setPending(null);
    try { await clearPendingFromGame(); } catch (err) { setError(err.message); }
  };
  const onClear = () => {
    if (window.confirm('Clear the Starter Camp? After the next Sync to Game, a new game opens on the built-in camp (the Guild Hall, an Oak Forest and a Copper Mine).')) {
      clearStarterCamp();
    }
  };

  const tokenName = (id) => tokens[id]?.name || null;
  const itemName = (id) => items[id]?.name || id;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white leading-tight flex items-center gap-2"><Tent size={18} /> Starter Camp</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            The Region a new game opens in. Lay it out in the game (QA panel, Starter Camp), press
            Save this mat as the Starter Camp, then review it here and Sync to Game.
          </p>
        </div>
        {camp && !isEmptyStarterCamp(camp) && (
          <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold">
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      {pending && (
        <div data-camp-pending className="rounded-xl p-4 border border-amber-500/40 bg-amber-500/10 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-bold"><Inbox size={14} /> A layout saved from the game is waiting</div>
          <p className="text-xs text-gray-300">
            {pending.camp.tokens.length} Tokens and {Object.keys(pending.camp.bank).length} Bank items
            {pending.receivedAt ? `, saved ${when(pending.receivedAt)}` : ''}. Using it replaces the Starter Camp below.
          </p>
          <div className="flex gap-2">
            <button onClick={takePending} className="btn-primary px-3 py-1.5 text-xs">Use this layout</button>
            <button onClick={discardPending} className="btn-ghost px-3 py-1.5 text-xs">Discard it</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}

      {!camp && (
        <p className="text-sm text-gray-400">
          This workspace holds no Starter Camp, so Sync to Game leaves data/starterCamp.json as it is.
        </p>
      )}
      {camp && isEmptyStarterCamp(camp) && (
        <p className="text-sm text-gray-400">
          Cleared. After the next Sync to Game, a new game opens on the built-in camp.
        </p>
      )}

      {camp && !isEmptyStarterCamp(camp) && (
        <>
          <p className="text-xs text-gray-500">
            {camp.savedAt ? `Saved from the game ${when(camp.savedAt)}` : 'Saved from the game'}
            {camp.mat ? ` on a ${camp.mat.w} × ${camp.mat.h} mat` : ''}.
            {camp.hall ? ` The Guild Hall stands at (${camp.hall.x}, ${camp.hall.y}).` : ' The Guild Hall stands in the middle.'}
          </p>
          <Section title="Layout" icon={<MapIcon size={14} />}>
            <MiniMap camp={camp} tokens={tokens} />
          </Section>
          <Section title={`Tokens (${camp.tokens.length})`} icon={<Tent size={14} />}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="font-semibold pb-1">Token</th>
                  <th className="font-semibold pb-1 text-right">x</th>
                  <th className="font-semibold pb-1 text-right">y</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {camp.tokens.map((t, i) => (
                  <tr key={`${t.typeId}-${i}`} data-camp-token={t.typeId} className="border-t border-white/5">
                    <td className="py-1">
                      <span className="text-gray-200">{tokenName(t.typeId) || t.typeId}</span>
                      {!tokenName(t.typeId) && <span className="ml-2 text-[10px]" style={{ color: 'var(--color-error)' }}>not in the workspace</span>}
                      {tokens[t.typeId]?.landmark === true && <span className="ml-2 text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">landmark</span>}
                      <span className="ml-2 text-[10px] font-mono text-gray-600">{t.typeId}</span>
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-300">{t.x}</td>
                    <td className="py-1 text-right tabular-nums text-gray-300">{t.y}</td>
                    <td className="py-1 text-right">
                      <button onClick={() => removeToken(i)} title="Leave this Token out of the Starter Camp" className="text-gray-600 hover:text-red-400" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Opening Bank" icon={<Package size={14} />}>
            <BankRows camp={camp} itemName={itemName} items={items} setBankCount={setBankCount} />
          </Section>
        </>
      )}
    </div>
  );
}

function BankRows({ camp, itemName, items, setBankCount }) {
  const [adding, setAdding] = useState('');
  const choices = useMemo(
    () => Object.values(items || {}).filter((it) => it?.id && !(it.id in camp.bank)).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [items, camp.bank]
  );
  return (
    <div className="space-y-1">
      {Object.entries(camp.bank).map(([itemId, count]) => (
        <div key={itemId} data-camp-bank={itemId} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-200">{itemName(itemId)} <span className="text-[10px] font-mono text-gray-600">{itemId}</span></span>
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setBankCount(itemId, e.target.value)}
            className="w-24 text-right"
            aria-label={`${itemName(itemId)} count`}
          />
        </div>
      ))}
      {Object.keys(camp.bank).length === 0 && <p className="text-xs text-gray-500">The Bank opens empty.</p>}
      <div data-camp-add-item className="flex items-center gap-2 pt-2">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1" style={{ fontSize: 12 }}>
          <option value="">Add an item…</option>
          {choices.map((it) => <option key={it.id} value={it.id}>{it.name || it.id}</option>)}
        </select>
        <button
          onClick={() => { if (adding) { setBankCount(adding, 1); setAdding(''); } }}
          disabled={!adding}
          className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

/** A small drawing of the layout: the mat, the Hall, every Token as a dot (landmarks in gold). */
function MiniMap({ camp, tokens }) {
  const w = camp.mat?.w || 1760;
  const h = camp.mat?.h || 1126;
  const hall = camp.hall || { x: w / 2, y: h / 2 };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-lg border border-white/10" style={{ background: '#14161f' }} role="img" aria-label="Starter Camp layout">
      <rect x={hall.x - 144} y={hall.y - 144} width={288} height={288} rx={24} fill="#6366f1" opacity={0.6} />
      {camp.tokens.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={56} fill={tokens[t.typeId]?.landmark === true ? '#fbbf24' : '#34d399'} opacity={0.75}>
          <title>{`${tokens[t.typeId]?.name || t.typeId} (${t.x}, ${t.y})`}</title>
        </circle>
      ))}
    </svg>
  );
}
