import { layoutTree, effortText, TREE_LAYOUT } from '../../engine/ledgerPage';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { LEDGER_ENGINE_TEXT } from '../../../../src/systems/progression/ledger/engine.js';

/** One colour per tier, the Starter Camp first; an entry with no tier is grey. */
export const TIER_COLORS = ['#4ade80', '#60a5fa', '#c084fc', '#fb923c', '#f87171', '#facc15'];
export const tierColor = (tier) => (Number.isInteger(tier) ? TIER_COLORS[tier % TIER_COLORS.length] : '#6b7280');

/**
 * The layered ingredient tree: the item on the left, each column one step further down towards its
 * origins. A box is coloured by its tier; an edge is red where the ingredient comes from a later
 * tier than the item, dashed where it is first had only by luck. A box names how it is made and
 * what it costs in hero time; click one to open its page.
 */
export default function LedgerTree({ tree, tierOf, luckOf, rootTier, onOpen }) {
  const layout = layoutTree(tree, { tierOf, luckOf, rootTier });
  const { nodeW, nodeH } = TREE_LAYOUT;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg width={layout.width} height={layout.height} role="img" aria-label={`Ingredient tree of ${tree.name}`} style={{ display: 'block' }}>
        {layout.edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          const x1 = a.x + nodeW;
          const y1 = a.y + nodeH / 2;
          const x2 = b.x;
          const y2 = b.y + nodeH / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              fill="none"
              stroke={e.later ? '#ef4444' : 'rgba(255,255,255,0.28)'}
              strokeWidth={e.later ? 2 : 1.25}
              strokeDasharray={e.luck ? '4 3' : undefined}
              data-edge={e.later ? 'later' : e.luck ? 'luck' : 'plain'}
            />
          );
        })}
        {layout.nodes.map((n) => {
          const { node } = n;
          const color = tierColor(n.tier);
          const how = node.source
            ? `${node.source.viaName || LEDGER_ENGINE_TEXT.how[node.source.how]}${node.source.at ? ` at ${node.source.at}` : ''}${node.source.skill ? ` · ${LEDGER_ENGINE_TEXT.level(node.source.skill, node.source.level)}` : ''}`
            : node.cycle ? 'already on the way up' : node.unknown ? 'nothing makes it' : 'an origin';
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onClick={() => onOpen?.(node.key)}
              style={{ cursor: onOpen ? 'pointer' : 'default' }}
              data-node={node.key}
            >
              <title>{`${node.name} · ${tierLabel(n.tier)}${n.luck ? ' · luck only' : ''}${node.tools.length ? ` · tool: ${node.tools.join(', ')}` : ''}`}</title>
              <rect width={nodeW} height={nodeH} rx={6} fill="#1f1f24" stroke={color} strokeWidth={1.5} strokeDasharray={n.luck ? '4 3' : undefined} />
              <rect width={4} height={nodeH} rx={2} fill={color} />
              <text x={12} y={17} fontSize={11} fontWeight={700} fill="#e5e7eb">
                {clip(node.name, 20)}
                <tspan fill="#9ca3af" fontWeight={400}>{` ×${round(node.quantity)}`}</tspan>
              </text>
              <text x={12} y={31} fontSize={9} fill="#9ca3af">{clip(how, 34)}</text>
              <text x={12} y={44} fontSize={9} fill={color}>
                {tierLabel(n.tier)}
                <tspan fill="#9ca3af">{node.effortMs > 0 ? ` · ${effortText(node.effortMs)}` : node.unknown && node.source ? ' · time unknown' : ''}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const round = (q) => (Number.isInteger(q) ? q : Math.round(q * 100) / 100);
