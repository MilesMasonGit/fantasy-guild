import { useState } from 'react';
import { KEYWORD, makeStatement } from '../../utils/constants';
import { StatementList } from '../editors/Statements';

/**
 * ⚠️ **A sandbox for the Rules Line that cannot touch the workspace** (P2).
 *
 * Throwaway, like the P0 prototype beside it, and reachable at `?p2=1`.
 *
 * It mounts the REAL rule editor — `StatementList`, the rows, the line, the
 * forms — on statements held in this component's own state. The store is only
 * ever READ (names, tags). Nothing here is added to the CMS workspace, so
 * nothing here can reach `data/` through a later "Sync to Game".
 *
 * That is the whole reason it exists: verifying the line against the author's
 * real workspace would mean leaving a test effect in it.
 */
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
];

export default function RulesLineSandbox() {
  const [statements, setStatements] = useState(seed);
  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto', color: 'var(--color-text-primary)', maxWidth: 820 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Rules Line — P2 sandbox</h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        The real rule editor, on rules that live only on this page. Click an underlined
        word and retype it. Nothing here is saved to the workspace.
      </p>
      <StatementList statements={statements} onChange={setStatements} />
    </div>
  );
}
