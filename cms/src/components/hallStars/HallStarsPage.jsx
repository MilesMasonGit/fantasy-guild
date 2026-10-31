import { useMemo, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { rulesLinesOf } from '../../utils/constants';
import { normaliseHallSky, TAG_SIDES } from '../../../../src/config/hallStars.js';
import { BUILT_IN_CONSTELLATIONS } from '../../../../src/config/guildUpgrades.js';

/**
 * The Guild Hall page: the authored sky (constellations and their stars), as Sync writes it to
 * `data/hallStars.json`. A star's name, description, constellation, place and tag sit here; its
 * ranks (tier, price, rules, Passive Production lines) show as the game reads them and come in by
 * change pack (the ledger sets tiers and prices, brief 320 H2). The built-in Bunk Beds, Bank Tabs
 * and Wishing Well are the game's own and are not listed.
 */

const ALL_TOKENS = { mode: 'all', value: '' };
/** A star's rule as it holds: guild-wide, every Token unless it names some. */
const asGuildRule = (st) => ({ ...st, reach: 'board', to: st?.to?.mode || st?.to?.filters?.length ? st.to : ALL_TOKENS });

function NumberField({ label, value, onChange, step = 0.05 }) {
  return (
    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
      {label}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-16" style={{ fontSize: 11, padding: '1px 4px' }} />
    </label>
  );
}

export default function HallStarsPage() {
  const hallStars = useEntityStore((s) => s.hallStars);
  const hallConstellations = useEntityStore((s) => s.hallConstellations);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const setHallStar = useEntityStore((s) => s.setHallStar);
  const removeHallStar = useEntityStore((s) => s.removeHallStar);

  const names = useMemo(() => ({
    token: (id) => tokens[id]?.name || id,
    item: (id) => items[id]?.name || id,
  }), [tokens, items]);
  const sky = useMemo(() => normaliseHallSky({ constellations: hallConstellations || {}, stars: hallStars || {} }), [hallConstellations, hallStars]);
  const groups = useMemo(() => {
    const all = [...BUILT_IN_CONSTELLATIONS.map((c) => ({ ...c, builtIn: true })), ...sky.constellations];
    const known = new Set(all.map((c) => c.id));
    const orphans = sky.stars.filter((s) => !known.has(s.constellation));
    return [
      ...all.map((c) => ({ ...c, stars: sky.stars.filter((s) => s.constellation === c.id) })),
      ...(orphans.length ? [{ id: '', name: 'In no constellation', stars: orphans }] : []),
    ].filter((g) => g.stars.length || !g.builtIn);
  }, [sky]);
  const [open, setOpen] = useState(null);

  if (hallStars == null && hallConstellations == null) {
    return (
      <div className="p-4" data-testid="hall-stars-page">
        <Section title="Guild Hall stars" icon={<Sparkles size={14} />}>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            This workspace holds no Guild Hall sky yet. A change pack brings the first stars in; until then the game shows
            only its built-in Bunk Beds, Bank Tabs and Wishing Well, and Sync leaves data/hallStars.json alone.
          </p>
        </Section>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" data-testid="hall-stars-page">
      {groups.map((group) => (
        <Section key={group.id || 'none'} title={`${group.name} (${group.stars.length})`} icon={<Sparkles size={14} />}>
          <div className="space-y-2" data-hall-constellation={group.id}>
            {group.stars.map((star) => {
              const raw = hallStars?.[star.id] || star;
              const shown = open === star.id;
              return (
                <div key={star.id} data-hall-star={star.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={raw.name || ''}
                      data-hall-star-name
                      onChange={(e) => setHallStar(star.id, { name: e.target.value })}
                      className="text-xs font-semibold flex-1 min-w-40"
                    />
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{star.id}</span>
                    <button type="button" className="btn-ghost text-[10px]" style={{ padding: '2px 6px' }} onClick={() => setOpen(shown ? null : star.id)}>
                      {shown ? 'Hide ranks' : `${star.ranks.length} rank${star.ranks.length === 1 ? '' : 's'}`}
                    </button>
                    <button type="button" onClick={() => removeHallStar(star.id)} className="btn-ghost" style={{ padding: '2px 6px' }} title="Remove this star from the sky">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <input
                    value={raw.description || ''}
                    placeholder="Description"
                    onChange={(e) => setHallStar(star.id, { description: e.target.value })}
                    className="w-full text-[11px]"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <NumberField label="x" value={star.node.x} onChange={(x) => setHallStar(star.id, { node: { ...star.node, x } })} />
                    <NumberField label="y" value={star.node.y} onChange={(y) => setHallStar(star.id, { node: { ...star.node, y } })} />
                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      tag
                      <select value={star.tag} onChange={(e) => setHallStar(star.id, { tag: e.target.value })} className="text-[11px]">
                        {TAG_SIDES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>linked to {star.links.join(', ') || 'nothing'}</span>
                  </div>
                  {shown && (
                    <ol className="text-[11px] space-y-1 pl-4 list-decimal" data-hall-star-ranks>
                      {star.ranks.map((rank, i) => (
                        <li key={i} style={{ color: 'var(--color-text-secondary)' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {rank.tier == null ? 'no tier' : `tier ${rank.tier}`} · {rank.price.length ? rank.price.map((p) => `${p.quantity} ${names.item(p.itemId)}`).join(' + ') : 'free'}
                          </span>
                          {rulesLinesOf({ statements: rank.rules.map(asGuildRule) }, names).map((line, j) => <div key={`r${j}`}>{line}</div>)}
                          {rank.lines.map((l, j) => <div key={`l${j}`}>{l.quantity} {names.item(l.itemId)} each Passive Production lap</div>)}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
            {group.stars.length === 0 && <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>No stars yet.</p>}
          </div>
        </Section>
      ))}
    </div>
  );
}
