import { Sparkles, ScrollText, Library, Boxes, Flame } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import { StatementList } from './Statements';
import { rulesLinesOf, effectRefsOf, hasWorkingStatements, statusBlockOf, MAX_STATUS_STACKS, VENOM_EFFECT_ID } from '../../utils/constants';

/**
 * The Effect editor: one named entry in the effect library.
 * ⚠️ The name is a title, never a description: there is deliberately no free-text description field, because an override lets a description drift from behaviour. The generated sentences under the name are the only description.
 * ⚠️ Editing an entry changes every bearer using it, so the used-by panel sits above the rules.
 */
export default function EffectEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const effect = useEntityStore((s) => s.effects[activeId]);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);
  const updateEffect = useEntityStore((s) => s.updateEffect);
  const deleteEffect = useEntityStore((s) => s.deleteEffect);
  const setEffectStatements = useEntityStore((s) => s.setEffectStatements);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  if (!effect) return <Empty text="Select an effect from the sidebar" />;

  const names = {
    token: (id) => tokens[id]?.name || id,
    item: (id) => items[id]?.name || id,
  };

  const users = Object.values(tokens)
    .map((t) => ({ token: t, ref: effectRefsOf(t).find((r) => r.effectId === effect.id) }))
    .filter((u) => u.ref);

  const lines = rulesLinesOf(effect, names);
  const backed = hasWorkingStatements(effect);
  const status = statusBlockOf(effect);
  const setStatus = (patch) => updateEffect(effect.id, { status: { ...(status || { stacks: 1, ticks: 0 }), ...patch } });

  return (
    <div className="space-y-5">
      <Header
        name={effect.name}
        id={effect.id}
        onDelete={() => deleteEffect(effect.id)}
      />

      <Section title="Identity" icon={<Sparkles size={14} />}>
        <Field label="Name">
          <input
            value={effect.name || ''}
            onChange={(e) => updateEffect(effect.id, { name: e.target.value })}
            className="input w-full"
          />
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            This is the title the player sees when the effect fires, and the name
            you pick it by. It never replaces the rules text below — a name can be
            evocative because the sentences always say what actually happens.
          </p>
        </Field>
      </Section>

      <Section title="Used by" icon={<Library size={14} />}>
        {users.length === 0 ? (
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Nothing uses this effect yet. Not a problem if you are still building
            what it is for — add it from a Token&rsquo;s Rules section.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
              {users.length === 1
                ? 'One Token uses this effect.'
                : `${users.length} Tokens use this effect — editing the rules below changes all of them.`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {users.map(({ token: t, ref }) => (
                <button
                  key={t.id}
                  onClick={() => setActiveEntity(t.id, 'token')}
                  className="btn-ghost flex items-center gap-1 text-[11px]"
                  style={{ padding: '3px 8px' }}
                  title={ref.scale > 1 ? `Carries this at scale ${ref.scale}` : undefined}
                >
                  <Boxes size={11} /> {t.name}
                  {/* Bearers may carry their own strength, so the list shows which. */}
                  {ref.scale > 1 && (
                    <span style={{ color: 'var(--color-accent-hover)' }}>x{ref.scale}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* A status is an ordinary effect with a lifetime of its own: it lands only in a fight, stacks
          up to a cap, and ends with the fight or after its ticks. */}
      <Section title="Status" icon={<Flame size={14} />}>
        <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!status}
            onChange={(e) => updateEffect(effect.id, { status: e.target.checked ? { stacks: 1, ticks: 0 } : undefined })}
          />
          This effect is a status, like Poison or Burn
        </label>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          A status lands only on a fighter in a fight and always ends with the fight. Each landing
          adds a stack, and its rules count once per stack. Put what it does each tick in an
          &ldquo;On Tick&rdquo; rule (a tick is 3 seconds), and anything it changes while carried
          (Burn&rsquo;s half healing from food) in a Provides rule.
        </p>
        {status && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Stacks up to">
              <input
                type="number" min={1} max={MAX_STATUS_STACKS}
                value={status.stacks}
                onChange={(e) => setStatus({ stacks: Number(e.target.value) || 1 })}
                className="input w-full"
              />
              <p className="text-[10px] text-gray-600 mt-1">1 does not stack: landing again renews it.</p>
            </Field>
            <Field label="Lasts (ticks)">
              <input
                type="number" min={0}
                value={status.ticks}
                onChange={(e) => setStatus({ ticks: Math.max(0, Number(e.target.value) || 0) })}
                className="input w-full"
              />
              <p className="text-[10px] text-gray-600 mt-1">0 lasts the whole fight.</p>
            </Field>
          </div>
        )}
        {effect.id === VENOM_EFFECT_ID && (
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            Venomous enemies land this effect by its id ({VENOM_EFFECT_ID}). Keep the id as it is.
          </p>
        )}
      </Section>

      <Section title="Rules" icon={<Sparkles size={14} />}>
        <StatementList
          statements={effect.statements || []}
          onChange={(next) => setEffectStatements(effect.id, next)}
        />
      </Section>

      <Section title="Rules Text" icon={<ScrollText size={14} />}>
        <div
          className="rounded-lg p-3 space-y-1"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {!backed ? (
            <p className="text-[11px] italic" style={{ color: 'var(--color-warning)' }}>
              A name with nothing behind it. Every bearer referencing this gets no
              rule at all — give it a statement above, or delete it.
            </p>
          ) : (
            lines.map((line, i) => (
              <p key={i} className="text-[11px] text-gray-400 leading-relaxed">{line}</p>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
