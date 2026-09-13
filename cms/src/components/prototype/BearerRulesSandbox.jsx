import { useEffect, useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import TokenEditor from '../editors/TokenEditor';
import ItemEditor from '../editors/ItemEditor';

/**
 * ⚠️ **A sandbox for the Token and Item editors' rules that cannot touch the
 * workspace** (Rules Line P6). Throwaway, reachable at `?p6=1`.
 *
 * The P2 sandbox hands `StatementList` its own vocabulary, but a Token's rules
 * panel reads and WRITES the CMS store directly — effects, refs, acceptedTokens.
 * And the store persists itself to localStorage, so seeding it would overwrite
 * the author's draft.
 *
 * So, before anything is written:
 * 1. the author's saved draft is copied aside;
 * 2. the store's persistence is pointed at a do-nothing storage;
 * 3. only then is the store emptied and seeded with test content.
 *
 * ⚠️ And afterwards it CHECKS: if the saved draft changed anyway, it is put back
 * byte for byte and the page says so. Reloading the CMS without `?p6=1` reads
 * the untouched draft again. Never press "Sync to Game" from here.
 */

const STORE_KEY = 'fantasy-guild-cms-v2';
const nowhere = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function seed() {
  const s = useEntityStore.getState();
  const oak = s.addItem({ name: 'Oak Wood' });
  const coast = s.addToken({ name: 'Shrimp Coast', tags: ['Coast'] });
  const crab = s.addToken({ name: 'Crab Coast', tags: ['Coast'] });
  const shed = s.addToken({ name: 'Net Shed', tags: ['Coast'] });

  const own = s.addEffect({
    name: 'Tide Rush',
    statements: [{ id: 'sbx_fast', keyword: 'provides', to: { mode: 'tag', value: 'Coast' },
      payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 } }],
  });
  const shared = s.addEffect({
    name: 'Shared Pinch',
    statements: [{ id: 'sbx_pinch', keyword: 'deals', payload: { amount: 2 },
      when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 } }],
  });
  const net = s.addEffect({
    name: 'Net',
    statements: [{ id: 'sbx_net', keyword: 'acts_as', payload: { tag: 'net', tier: 2 } }],
  });
  const lucky = s.addEffect({
    name: 'Lucky Find',
    statements: [{ id: 'sbx_luck', keyword: 'grants', payload: { type: 'BONUS_DROP', itemId: oak, quantity: 1, chance: 25 } }],
  });

  s.addEffectRef('tokens', coast, own);
  s.addEffectRef('tokens', coast, shared);
  s.addEffectRef('tokens', crab, shared);
  s.addEffectRef('tokens', shed, net);
  s.updateToken(coast, { acceptedTokens: [{ tag: 'net', minTier: 1 }] });

  const charm = s.addItem({ name: 'Lucky Charm', equipSlot: '' });
  s.addEffectRef('items', charm, lucky);

  return { coast, charm };
}

export default function BearerRulesSandbox() {
  const [ids, setIds] = useState(null);
  const [status, setStatus] = useState('Preparing…');
  const activeType = useEntityStore((s) => s.activeEntityType);

  /* eslint-disable react-hooks/set-state-in-effect --
     Deliberate, and only in this throwaway: seeding must happen AFTER
     persistence is switched off, which is itself a side effect, so it cannot
     move into render. */
  useEffect(() => {
    const saved = window.localStorage.getItem(STORE_KEY);
    useEntityStore.persist.setOptions({ storage: nowhere });
    useEntityStore.setState({ items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null });
    const seeded = seed();
    useEntityStore.getState().setActiveEntity(seeded.coast, 'token');
    setIds(seeded);

    // ⚠️ The safety net: prove nothing reached the saved draft, and undo it if it did.
    const check = () => {
      if (window.localStorage.getItem(STORE_KEY) === saved) return true;
      if (saved === null) window.localStorage.removeItem(STORE_KEY);
      else window.localStorage.setItem(STORE_KEY, saved);
      return false;
    };
    setStatus(check() ? 'Saved draft untouched.' : '⚠️ The saved draft was written to — it has been restored.');
    const timer = window.setInterval(() => {
      if (!check()) setStatus('⚠️ The saved draft was written to — it has been restored.');
    }, 500);
    return () => window.clearInterval(timer);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!ids) return <p style={{ padding: 20 }}>{status}</p>;

  const show = (id, type) => useEntityStore.getState().setActiveEntity(id, type);
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Token and Item rules — sandbox</h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, maxWidth: 820, lineHeight: 1.6 }}>
        The real Token and Item editors, on made-up content. Nothing here is saved, and
        reloading without <code>?p6=1</code> brings your own workspace back. Do not sync from here.
      </p>
      <p data-sandbox-status style={{ fontSize: 11, marginBottom: 12, color: status.startsWith('⚠️') ? 'var(--color-warning)' : 'var(--color-success)' }}>
        {status}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => show(ids.coast, 'token')}>Token: Shrimp Coast</button>
        <button type="button" className="btn-ghost" onClick={() => show(ids.charm, 'item')}>Item: Lucky Charm</button>
      </div>
      {activeType === 'item' ? <ItemEditor /> : <TokenEditor />}
    </div>
  );
}
