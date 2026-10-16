import { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';
import { ART_BAKE, planBrighten } from '../../../paletteBrighten.js';

/**
 * The Recolor tab's one-off action: brighten every palette in the Material Library with the
 * setting baked into the sprite art, so new recolours match it. It counts what would change,
 * asks once, then saves through `/api/custom-palettes` with a marker that blocks a second run.
 * The plan is always made from the file on the server, never from the page's own copy.
 */
export default function PaletteBrighten({ library, onApplied }) {
  const [plan, setPlan] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPlan = async () => {
    const res = await fetch('/api/custom-palettes');
    if (!res.ok) throw new Error('could not read the Material Library');
    const next = planBrighten(await res.json());
    setPlan(next);
    return next;
  };

  useEffect(() => {
    loadPlan().catch((err) => setStatus(err.message));
  }, [library]);

  const apply = async () => {
    setBusy(true);
    try {
      const fresh = await loadPlan();
      if (fresh.applied) {
        setStatus('Already applied: nothing was written.');
        return;
      }
      const res = await fetch('/api/custom-palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fresh.next),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'save failed');
      setStatus(`Brightened ${fresh.changedColors} colours in ${fresh.changedPalettes} palettes.`);
      await onApplied?.();
      await loadPlan();
    } catch (err) {
      setStatus('Not brightened: ' + err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const label = `Brighten material palettes (art bake: ${ART_BAKE.brightness} / ${ART_BAKE.saturation})`;
  const applied = plan?.applied;

  return (
    <div className="mb-3 flex flex-col gap-1.5" aria-label="Brighten material palettes">
      {!confirming ? (
        <button
          type="button"
          disabled={!plan || applied || busy || plan.changedColors === 0}
          onClick={() => { setStatus(''); setConfirming(true); }}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-bold border hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
        >
          <Sun size={13} />
          {label}
        </button>
      ) : (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={apply}
            className="flex-1 px-2 py-1.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {busy ? 'Brightening…' : `Yes, brighten ${plan.changedColors} colours`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="px-2 py-1.5 rounded text-xs font-bold border hover:bg-white/5"
            style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      )}
      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        {!plan
          ? 'Counting…'
          : applied
            ? `Already applied (brightness ${plan.marker.brightness}, saturation ${plan.marker.saturation}, outlines at or below ${plan.marker.threshold} kept).`
            : `Would change ${plan.changedColors} of ${plan.colors} colours in ${plan.changedPalettes} of ${plan.palettes} palettes. Once only; undo with git.`}
      </p>
      {status && <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{status}</p>}
    </div>
  );
}
