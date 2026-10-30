import { DAMAGE_TYPES, DAMAGE_GROUPS, damageTypeLabel, isTypeOrGroupId, statusBlockOf, MOVE_TARGETS, moveLastsFor, moveProblems } from '../../utils/constants';

const TARGET_WORDS = { self: 'Itself', hero: 'The hero' };
const LASTS_WORDS = { attack: 'For one attack', swing: 'For the swing', fight: 'For the fight' };
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A move with `key` set to `value`, or without it when `value` is undefined. */
function withField(move, key, value) {
  const next = { ...move };
  if (value === undefined) delete next[key]; else next[key] = value;
  return next;
}

/**
 * An enemy's moves (`enemyMoves.js`): a few attacks, one made each swing, picked at random by weight
 * (owner's chicken: Peck, Stab; Scratch, Slash; Flutter, +50 % Physical resistance for one attack).
 * Each row: a name, whether it hits and in which type (Physical when none is picked), an effect it
 * lands from the library, on itself or the hero, and for how long, and its weight. No moves, the key
 * goes: the enemy swings a plain Physical hit. Each problem the audit would name shows under its row.
 */
export default function EnemyMovesFields({ enemy, effects, onChange }) {
  const raw = enemy?.moves;
  const moves = Array.isArray(raw) ? raw : [];
  const library = Object.values(effects || {}).filter((e) => e?.id).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const hasEffect = (id) => !!effects?.[id];
  const isStatus = (id) => !!statusBlockOf(effects?.[id]);

  const write = (next) => {
    const copy = { ...enemy };
    if (next.length) copy.moves = next; else delete copy.moves;
    onChange(copy);
  };
  const setMove = (i, move) => write(moves.map((m, j) => (j === i ? move : m)));
  const removeMove = (i) => write(moves.filter((_, j) => j !== i));
  const addMove = () => write([...moves, { name: `Move ${moves.length + 1}` }]);

  return (
    <div className="mt-3" data-field="enemy-moves">
      <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Moves (one made each swing, at random)</span>
      {raw != null && !Array.isArray(raw) && (
        <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-warning)' }} data-field="enemy-moves-broken">
          Its moves are not a list, so it swings a plain Physical hit.{' '}
          <button type="button" className="hover:underline" onClick={() => write([])}>Clear them</button>
        </p>
      )}
      <div className="flex flex-col gap-2">
        {moves.map((move, i) => {
          if (!isPlainObject(move)) {
            return (
              <div key={i} className="text-[11px]" style={{ color: 'var(--color-warning)' }} data-field={`enemy-move-${i}-broken`}>
                {`Move ${i + 1} is not a move. `}
                <button type="button" className="hover:underline" onClick={() => removeMove(i)}>Remove it</button>
              </div>
            );
          }
          const hits = move.hits !== false;
          const target = MOVE_TARGETS.includes(move.target) ? move.target : 'hero';
          const status = move.effectId ? isStatus(move.effectId) : false;
          const lasts = moveLastsFor(target);
          const problems = moveProblems([move], { hasEffect, isStatus }).map((p) => p.replace(/^its move (\d+|"[^"]*")/, 'This move'));
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2 flex flex-col gap-1.5" data-field={`enemy-move-${i}`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Move ${i + 1} name`}
                  data-field={`enemy-move-${i}-name`}
                  value={move.name ?? ''}
                  onChange={(e) => setMove(i, withField(move, 'name', e.target.value))}
                  placeholder="Name (Peck)"
                  className="flex-1"
                />
                <label className="flex items-center gap-1.5 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label={`Move ${i + 1} hits`}
                    data-field={`enemy-move-${i}-hits`}
                    checked={hits}
                    onChange={(e) => {
                      let next = withField(move, 'hits', e.target.checked ? undefined : false);
                      if (!e.target.checked) next = withField(next, 'damageType', undefined);
                      setMove(i, next);
                    }}
                  />
                  <span className="text-[11px] text-gray-300">Hits</span>
                </label>
                <select
                  aria-label={`Move ${i + 1} damage type`}
                  data-field={`enemy-move-${i}-type`}
                  disabled={!hits}
                  value={hits && isTypeOrGroupId(move.damageType) ? move.damageType : ''}
                  onChange={(e) => setMove(i, withField(move, 'damageType', e.target.value || undefined))}
                  className={`w-36 ${hits && move.damageType ? '' : 'text-gray-500 italic'}`}
                >
                  <option value="">{hits ? 'Physical (plain)' : 'No hit'}</option>
                  {DAMAGE_GROUPS.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      <option value={g.id}>{g.label} (the whole group)</option>
                      {DAMAGE_TYPES.filter((t) => t.group === g.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  aria-label={`Move ${i + 1} weight`}
                  title="How likely, against the other moves (1 when blank)"
                  data-field={`enemy-move-${i}-weight`}
                  value={move.weight ?? ''}
                  placeholder="1"
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    setMove(i, withField(move, 'weight', e.target.value === '' || !(n >= 1) || n === 1 ? undefined : n));
                  }}
                  className="w-14"
                />
                <button type="button" className="text-[11px] text-gray-500 hover:text-white" data-field={`enemy-move-${i}-remove`} onClick={() => removeMove(i)}>Remove</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-12">Lands</span>
                <select
                  aria-label={`Move ${i + 1} effect`}
                  data-field={`enemy-move-${i}-effect`}
                  value={move.effectId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    let next = withField(move, 'effectId', id);
                    if (!id) next = withField(withField(next, 'target', undefined), 'lasts', undefined);
                    setMove(i, next);
                  }}
                  className={`flex-1 ${move.effectId ? '' : 'text-gray-500 italic'}`}
                >
                  <option value="">No effect</option>
                  {move.effectId && !hasEffect(move.effectId) && <option value={move.effectId}>{`${move.effectId} (missing)`}</option>}
                  {library.map((e) => (
                    <option key={e.id} value={e.id}>{e.name || e.id}{statusBlockOf(e) ? ' (status)' : ''}</option>
                  ))}
                </select>
                <select
                  aria-label={`Move ${i + 1} target`}
                  data-field={`enemy-move-${i}-target`}
                  disabled={!move.effectId}
                  value={target}
                  onChange={(e) => {
                    let next = withField(move, 'target', e.target.value);
                    if (!moveLastsFor(e.target.value).includes(next.lasts)) next = withField(next, 'lasts', undefined);
                    setMove(i, next);
                  }}
                  className="w-28"
                >
                  {MOVE_TARGETS.map((id) => <option key={id} value={id}>{TARGET_WORDS[id]}</option>)}
                </select>
                <select
                  aria-label={`Move ${i + 1} lasts`}
                  data-field={`enemy-move-${i}-lasts`}
                  disabled={!move.effectId || status}
                  value={status ? '' : (lasts.includes(move.lasts) ? move.lasts : 'fight')}
                  onChange={(e) => setMove(i, withField(move, 'lasts', e.target.value === 'fight' ? undefined : e.target.value))}
                  className="w-36"
                  title={status ? 'A status keeps its own lifetime' : undefined}
                >
                  {status && <option value="">Its own (a status)</option>}
                  {lasts.map((id) => <option key={id} value={id}>{LASTS_WORDS[id]}</option>)}
                </select>
              </div>
              {problems.map((p) => (
                <p key={p} className="text-[11px] leading-snug" style={{ color: 'var(--color-warning)' }} data-field={`enemy-move-${i}-problem`}>{p}.</p>
              ))}
            </div>
          );
        })}
        <button type="button" className="self-start text-[11px] text-gray-400 hover:text-white" data-field="enemy-move-add" onClick={addMove}>+ Add a move</button>
      </div>
      <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
        No moves: it swings a plain Physical hit. Each swing makes one move, picked at random (a weight of 2 is twice as likely as 1).
        A move hits with the enemy&apos;s Hit in its type, and may land an effect: on itself as the move is made (Flutter, a heavy strike
        for the swing), on the hero with the hit that lands. For one attack lasts until the next attack on whoever carries it, hit or miss.
        Shown on the enemy&apos;s card and named in the fight.
        {moves.some((m) => isPlainObject(m) && m.damageType && !isTypeOrGroupId(m.damageType)) ? ' A type the game does not have hits as Physical.' : ''}
      </p>
    </div>
  );
}

/** `Peck Stab, Scratch Slash, Flutter`: an enemy's moves for the read-only preview, or null without any. */
export function movesText(moves) {
  if (!Array.isArray(moves) || !moves.length) return null;
  return moves.map((m) => `${m.name || 'Attack'}${m.hits ? ` ${damageTypeLabel(m.type)}` : ''}`).join(', ');
}
