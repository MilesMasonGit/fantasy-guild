import { useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { makeTokenConfig, makeInputEntry, makeOutputEntry, makeCurrencyOutputEntry } from '../../stores/useEntityStore';
import SupplyChainColumn from './SupplyChainColumn';

/**
 * The 3-column shape: origins on the left, the editor in the middle, products
 * on the right.
 *
 * ## What this used to be
 * A ~350-line `if`-chain computing sidebar contents for nine entity types —
 * task, recipe, enemy, item, area, quest, station, lootTable, encounter,
 * encounterTable. Eight of those no longer exist (CMS-36/37).
 *
 * ## What it is now
 * **Tokens** get CMS-59's literal, editable Inputs and Outputs. Production
 * lives in the sidebars so the centre column stays free for the stackable
 * effect blocks Phase 5 adds.
 *
 * **Items** get a read-only dependency view — which Tokens and Maps produce
 * this item, and which consume it. That is the reachability check CMS-9's
 * backward chaining needs.
 *
 * **Maps** get empty sidebars until Phase 7 builds the pool editor.
 */
export default function SupplyChainLayout({ children }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const activeType = useEntityStore((s) => s.activeEntityType);
  const tokens = useEntityStore((s) => s.tokens);
  const maps = useEntityStore((s) => s.maps);
  const updateToken = useEntityStore((s) => s.updateToken);

  const token = activeType === 'token' ? tokens[activeId] : null;

  /**
   * Edit one side of a Token's production config.
   *
   * The config is created lazily: a Token with no production at all has
   * `config: null` rather than an empty object, because CMS-58 allows Tokens
   * with no production side and an empty config would claim otherwise. Adding
   * the first input or output is what brings it into being.
   */
  const editList = (key, mutate) => {
    const config = token?.config || makeTokenConfig();
    const next = mutate([...(config[key] || [])]);
    updateToken(activeId, { config: { ...config, [key]: next } });
  };

  const tokenSidebars = useMemo(() => {
    if (!token) return null;
    const config = token.config;
    const isEnemy = token.tokenType === 'enemy';

    return {
      // An enemy's outputs are its drops (CMS-68) — the same shape, relabelled,
      // because an enemy is a Token and a kill is a cycle (D-104, D-129).
      leftTitle: isEnemy ? 'Consumes' : 'Inputs',
      rightTitle: isEnemy ? 'Drops' : 'Outputs',
      leftEntries: config?.inputs || [],
      rightEntries: config?.outputs || [],
      leftHint: isEnemy
        ? 'Enemies usually consume nothing.'
        : 'No inputs — this creates from nothing, and so should cost nothing (D-97).',
      rightHint: isEnemy ? 'No drops yet.' : 'No outputs yet.',
    };
  }, [token]);

  const itemSidebars = useMemo(() => {
    if (activeType !== 'item' || !activeId) return null;

    const producers = [];
    const consumers = [];

    // Every way a Token can move an item: its own production config, and each
    // recipe in a pooled station's list (CMS-76, Phase 3). Both shapes are
    // checked so pooled stations are not silently invisible here later.
    for (const t of Object.values(tokens || {})) {
      const routes = [t.config, ...(Array.isArray(t.recipes) ? t.recipes : [])].filter(Boolean);
      if (routes.some((r) => (r.outputs || []).some((o) => o.itemId === activeId))) {
        producers.push({ id: t.id, type: 'token' });
      }
      if (routes.some((r) => (r.inputs || []).some((i) => i.itemId === activeId))) {
        consumers.push({ id: t.id, type: 'token' });
      }
    }

    // A Map produces an item by dropping it from its pool, and consumes one by
    // charging it as part of the purchase price (D-100).
    for (const m of Object.values(maps || {})) {
      if ((m.pool || []).some((e) => e.kind === 'item' && e.refId === activeId)) {
        producers.push({ id: m.id, type: 'map' });
      }
      if ((m.materials || []).some((mat) => mat.itemId === activeId)) {
        consumers.push({ id: m.id, type: 'map' });
      }
    }

    return { producers, consumers };
  }, [activeType, activeId, tokens, maps]);

  if (!activeId) return <div className="h-full w-full">{children}</div>;

  const main = (
    <div className="flex-1 overflow-y-auto px-10 py-6 bg-[#0f0f12] custom-scrollbar">{children}</div>
  );

  if (token && tokenSidebars) {
    return (
      <div className="flex h-full w-full overflow-hidden">
        <SupplyChainColumn
          side="left"
          title={tokenSidebars.leftTitle}
          editable
          entries={tokenSidebars.leftEntries}
          emptyHint={tokenSidebars.leftHint}
          onAdd={(itemId) => editList('inputs', (list) => [...list, makeInputEntry(itemId)])}
          onUpdate={(i, patch) =>
            editList('inputs', (list) => list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
          }
          onRemove={(i) => editList('inputs', (list) => list.filter((_, idx) => idx !== i))}
        />
        {main}
        <SupplyChainColumn
          side="right"
          title={tokenSidebars.rightTitle}
          editable
          entries={tokenSidebars.rightEntries}
          emptyHint={tokenSidebars.rightHint}
          onAdd={(itemId) => editList('outputs', (list) => [...list, makeOutputEntry(itemId)])}
          onAddCurrency={(currency) =>
            editList('outputs', (list) => [...list, makeCurrencyOutputEntry(currency)])
          }
          onUpdate={(i, patch) =>
            editList('outputs', (list) => list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
          }
          onRemove={(i) => editList('outputs', (list) => list.filter((_, idx) => idx !== i))}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SupplyChainColumn
        side="left"
        title={itemSidebars ? 'Produced By' : 'Origins'}
        entities={itemSidebars?.producers || []}
        emptyHint={itemSidebars ? 'Nothing produces this yet.' : undefined}
      />
      {main}
      <SupplyChainColumn
        side="right"
        title={itemSidebars ? 'Consumed By' : 'Products'}
        entities={itemSidebars?.consumers || []}
        emptyHint={itemSidebars ? 'Nothing consumes this yet.' : undefined}
      />
    </div>
  );
}
