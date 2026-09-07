import { Sparkles, ScrollText, Library, Boxes } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import { StatementList } from './Statements';
import { rulesLinesOf, effectRefsOf, hasWorkingStatements } from '../../utils/constants';

/**
 * The Effect editor — one named entry in the library (Unified Effects P1).
 *
 * ## Why effects have a screen of their own
 * A rule used to live on the Token that used it, which meant it had no name, no
 * identity, and no way to be shared. An entry here is the same statements it
 * always was, plus the two things they lacked: **a name**, which is what the
 * player will be shown when it fires (P3), and **a place**, so a second bearer
 * can point at it rather than re-authoring it (UE-3, UE-5).
 *
 * ## ⚠️ The name is a title, never a description (UE-8)
 * The generated sentences below the name stay the body, the validation loop and
 * the only description this effect has. There is no free-text description field
 * on this screen, deliberately and permanently: an override is how a
 * description drifts from behaviour, which is the failure the whole effect
 * redesign exists to have removed. A name may be evocative precisely *because*
 * it never appears without its sentences underneath it.
 *
 * ## The used-by panel is not a nicety
 * Editing an entry changes every bearer using it — that is the feature, and it
 * is also the only way this can hurt. The panel is what turns a blind
 * cross-content edit into an informed one, so it sits above the rules rather
 * than below them.
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

  if (!effect) return <Empty message="Select an effect from the sidebar" />;

  const names = {
    token: (id) => tokens[id]?.name || id,
    item: (id) => items[id]?.name || id,
  };

  const users = Object.values(tokens).filter((t) =>
    effectRefsOf(t).some((r) => r.effectId === effect.id)
  );

  const lines = rulesLinesOf(effect, names);
  const backed = hasWorkingStatements(effect);

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
              {users.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveEntity(t.id, 'token')}
                  className="btn-ghost flex items-center gap-1 text-[11px]"
                  style={{ padding: '3px 8px' }}
                >
                  <Boxes size={11} /> {t.name}
                </button>
              ))}
            </div>
          </>
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
