import { useState } from 'react';
import { KEYWORD, makeStatement } from '../../utils/constants';
import { StatementList } from '../editors/Statements';

/**
 * ⚠️ **A sandbox for the Rules Line that cannot touch the workspace.**
 *
 * Throwaway, like the P0 prototype beside it, and reachable at `?p2=1`.
 *
 * It mounts the REAL rule editor — `StatementList`, the rows, the line, the
 * panel, the forms — on rules held in this component's own state, and hands it
 * its OWN vocabulary through `content`.
 *
 * ⚠️ That second part matters as much as the first. The CMS store persists
 * itself to localStorage, so seeding it with test items "just to try the search"
 * would quietly add them to the author's real workspace — and a later "Sync to
 * Game" would ship them into `data/`. Nothing here is ever written to the store.
 */

const REAL_ITEMS = [
  'Oak Wood', 'Raw Shrimp', 'Iron Ore', 'Copper Ore', 'Coal', 'Charcoal', 'Stone', 'Clay',
  'Flax', 'Wool', 'Leather', 'Bones', 'Tin Ore', 'Sand', 'Glass', 'Rope',
];
const REAL_EFFECTS = ['Thorns', 'Poison', 'Burning', 'Bleed', 'Armor Shield', 'Well Fed', 'Cookout', 'Stun'];

function buildContent() {
  const items = {};
  REAL_ITEMS.forEach((name, i) => { items[`item_${i}`] = { id: `item_${i}`, name }; });
  // Enough to exceed the panel's list, so the search and its count can be seen.
  for (let i = REAL_ITEMS.length; i < 40; i++) items[`item_${i}`] = { id: `item_${i}`, name: `Reagent ${i}` };

  const effects = {};
  REAL_EFFECTS.forEach((name, i) => { effects[`effect_${i}`] = { id: `effect_${i}`, name }; });
  for (let i = REAL_EFFECTS.length; i < 45; i++) effects[`effect_${i}`] = { id: `effect_${i}`, name: `Test Effect ${i}` };

  const tokens = {
    tok_oak: { id: 'tok_oak', name: 'Oak Tree', tags: ['Forest'] },
    tok_pool: { id: 'tok_pool', name: 'Shrimp Pool', tags: ['Coast'] },
    tok_quarry: { id: 'tok_quarry', name: 'Quarry', tags: ['Stone'] },
  };
  return { items, effects, tokens };
}

const seed = () => [
  { ...makeStatement(KEYWORD.DEALS), id: 'sbx_deals', payload: { amount: 2 } },
  {
    ...makeStatement(KEYWORD.PROVIDES), id: 'sbx_faster',
    payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 },
    to: { mode: 'tag', value: 'Coast' },
  },
  {
    ...makeStatement(KEYWORD.DEALS), id: 'sbx_count',
    payload: { amount: 1, magnitude: 'count', ignoresArmor: true },
    counted: { mode: 'tag', value: 'Coast' },
  },
  // Blanks to search: the owner's "…" ruling (a blank opens a search to pick).
  {
    ...makeStatement(KEYWORD.GRANTS), id: 'sbx_watch',
    payload: { itemId: 'item_0', quantity: 1 },
    when: { event: 'ITEM_PRODUCED', scope: 'adjacent' },
  },
  { ...makeStatement(KEYWORD.APPLIES), id: 'sbx_apply', payload: { effectId: '', durationMs: 30000 } },
  { ...makeStatement(KEYWORD.SPAWNS), id: 'sbx_spawn', payload: { placement: 'nearest_free' } },
  // P4: what the retired forms used to hold, now in the line.
  { ...makeStatement(KEYWORD.GRANTS), id: 'sbx_grants' },
  { ...makeStatement(KEYWORD.STATION), id: 'sbx_station' },
  { ...makeStatement(KEYWORD.ACTS_AS), id: 'sbx_acts', payload: { tag: 'net', tier: 2 } },
  { ...makeStatement(KEYWORD.RESTOCKS), id: 'sbx_restock', payload: { tokenIds: ['tok_oak'] } },
  {
    ...makeStatement(KEYWORD.CANNOT), id: 'sbx_cannot',
    payload: { kind: 'adjacency_limit', max: 2 },
    to: { mode: 'tag', value: 'Coast' },
  },
  // P5: cost and cadence beside the sentence — a cooldown the sentence says, and an upkeep it does not.
  {
    ...makeStatement(KEYWORD.DEALS), id: 'sbx_cooled', payload: { amount: 3 },
    when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 5000 }, chargeDelta: -2,
  },
  {
    ...makeStatement(KEYWORD.PROVIDES), id: 'sbx_upkeep',
    payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.2 },
    to: { mode: 'tag', value: 'Forest' },
    upkeep: { items: [{ itemId: 'item_4', quantity: 1 }], cadenceMs: 30000 },
  },
  {
    // The one form that survives (E-8): a conversion's two item lists.
    ...makeStatement(KEYWORD.CONVERTS), id: 'sbx_convert',
    payload: { type: 'CONVERT', consumes: [{ itemId: 'item_4', quantity: 20 }], produces: [{ itemId: 'item_5', quantity: 2 }], chance: 100 },
    when: { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: 'item_4', threshold: 20 },
  },
];

export default function RulesLineSandbox() {
  const [statements, setStatements] = useState(seed);
  const [content] = useState(buildContent);
  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Rules Line — sandbox</h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6, maxWidth: 820 }}>
        The real rule editor, on rules and items that live only on this page. Click an
        underlined word and retype it, or Tab through the words. Nothing here is saved.
      </p>
      <div style={{ maxWidth: 1100 }}>
        <StatementList statements={statements} onChange={setStatements} content={content} />
      </div>
    </div>
  );
}
