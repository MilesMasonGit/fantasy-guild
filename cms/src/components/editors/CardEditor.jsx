// === Unified Card Editor (CMS rework Phase 4) ===
//
// One editor for every card in the `tasks` collection — task, combat, and
// mutator (action). Replaces the old TaskEditor. The card's TYPE is not picked;
// it is DERIVED from content by inferCardType() and shown as a QUIET label
// (owner's explicit call — a small tag, not a banner). No manual override (L13).
//
// The 3-column SupplyChainLayout still wraps this editor, providing the
// Inputs (left) / Outputs (right) columns the owner likes — so this center
// form carries configuration + the content hooks that drive the type:
//   • an enemy link  → makes the card combat (R4)
//   • a token        → makes the card a mutator (R1)
// A station link (→ recipe, R3) is provisional and handled in a later slice.
//
// This slice: quiet label + enemy link (writable) + token display. The token
// PICKER, writing the derived type back to `cardType`, and the ambush guard
// land in the next slice with sync testing.

import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { SKILLS } from '../../utils/constants';
import { inferCardType, wouldBeAmbush } from '../../engine/cardType';
import { TOKENS } from '../../../../src/config/registries/TokenRegistry.js';
import { Settings2, Image, HelpCircle, Skull, Sparkles, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

const TYPE_STYLES = {
  task:    { color: 'var(--color-task)',   bg: 'rgba(52,211,153,0.12)' },
  combat:  { color: 'var(--color-enemy)',  bg: 'rgba(248,113,113,0.12)' },
  action:  { color: '#FFD700',             bg: 'rgba(255,215,0,0.12)' },
  recipe:  { color: 'var(--color-item)',   bg: 'rgba(96,165,250,0.12)' },
  station: { color: 'var(--color-accent)', bg: 'rgba(99,102,241,0.12)' },
};

export default function CardEditor() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const card = useEntityStore((s) => s.tasks[activeId]);
  const updateTask = useEntityStore((s) => s.updateTask);
  const deleteTask = useEntityStore((s) => s.deleteTask);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const enemies = useEntityStore((s) => s.enemies);
  const subskills = useEntityStore((s) => s.subskills);
  const taskUpdates = useSimulationStore((s) => s.taskUpdates) || {};

  if (!card) return <Empty text="Select a card from the sidebar to edit" />;

  const update = (key, value) => updateTask(activeId, { [key]: value });

  // Content edits that can change the derived type also write `cardType`, so a
  // later sync emits the right type. Passive VIEWING never rewrites (so e.g.
  // retired explore cards keep their cardType until deliberately edited).
  const updateContent = (patch) => {
    const next = { ...card, ...patch };
    const t = inferCardType(next).type;
    const extra = { cardType: t };
    // Set preset only for the unambiguous transitions — a mutator/combat card
    // needs the matching preset to work in-game. `task` is left alone because
    // its preset is ambiguous (BASIC_TASK vs CRAFTING_TASK) and must not be
    // clobbered; recipe/station presets are provisional.
    if (t === 'action') extra.preset = 'MUTATOR';
    else if (t === 'combat') extra.preset = 'BASIC_COMBAT';
    // Reverting a former mutator/combat back to a task: drop the type-specific
    // preset. Only touch those two presets, so CRAFTING_TASK/BASIC_TASK cards
    // are never clobbered.
    else if (t === 'task' && (card.preset === 'MUTATOR' || card.preset === 'BASIC_COMBAT')) extra.preset = 'BASIC_TASK';
    updateTask(activeId, { ...patch, ...extra });
  };

  // Pick / clear the token this mutator hands out. Writes the game field
  // (config.tokenId) and the mirror used for inference/display (tokenId).
  const setToken = (newId) => {
    const cfg = { ...(card.config || {}) };
    if (newId) cfg.tokenId = newId; else delete cfg.tokenId;
    updateContent({ tokenId: newId || '', config: cfg });
  };

  const derived = inferCardType(card);
  const style = TYPE_STYLES[derived.type] || TYPE_STYLES.task;
  const isCombat = derived.type === 'combat';
  const isMutator = derived.type === 'action';
  const tokenId = card.tokenId ?? card.config?.tokenId ?? '';
  const token = tokenId ? TOKENS[tokenId] : null;

  // Config fields (skill/tick/xp/energy) are irrelevant for a pure combat card
  // whose subject is the enemy — mirror the old isEncounterOnly behaviour.
  const showEffortFields = !isCombat && !isMutator;
  const relevantSubskills = Object.values(subskills).filter((s) => s.parentSkill === card.skill);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        name={card.name}
        id={card.id}
        sprite={card.background}
        isBackground={true}
        onDelete={() => { deleteTask(activeId); clearActive(); }}
      />

      {/* Quiet derived-type label — small tag, not a banner. Type is read from
          content (§4), never picked. */}
      <div className="flex items-center gap-2 -mt-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider select-none"
          style={{ color: style.color, background: style.bg }}
          title={derived.reason}
        >
          {derived.type === 'combat' && <Skull size={11} />}
          {derived.type === 'action' && <Sparkles size={11} />}
          {derived.label}
          {derived.legacy && <span className="opacity-70 font-normal normal-case">· legacy</span>}
        </span>
        <span className="text-[10px] text-gray-500 truncate">{derived.reason}</span>
      </div>

      {/* Core Configuration */}
      <Section title="Configuration" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name">
            <input type="text" value={card.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="World Area">
            <select value={card.areaId || ''} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">Global / None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          {showEffortFields && (
            <>
              <Field label="Skill">
                <select value={card.skill || ''} onChange={(e) => update('skill', e.target.value)} className="w-full">
                  <option value="">None</option>
                  {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Subskill">
                <select value={card.subskill || ''} onChange={(e) => update('subskill', e.target.value)} className="w-full">
                  <option value="">None / Base</option>
                  {relevantSubskills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Skill Level Requirement">
                <input type="number" min={1} max={99} value={card.skillRequirement || 1} onChange={(e) => update('skillRequirement', Number(e.target.value))} className="w-full" />
              </Field>
              <Field label="Energy Cost">
                <input type="number" value={card.energyCost || 0} onChange={(e) => update('energyCost', Number(e.target.value))} className="w-full" />
              </Field>
              <Field label="Tick Time (s)">
                <input type="number" step="0.1" value={(card.baseTickTime || 0) / 1000} onChange={(e) => update('baseTickTime', Math.round(Number(e.target.value) * 1000))} className="w-full" />
              </Field>
              <Field label="XP Awarded">
                <input type="number" value={card.xpAwarded || 0} onChange={(e) => update('xpAwarded', Number(e.target.value))} className="w-full" />
              </Field>
            </>
          )}

          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = card.background ? resolveSpritePath(card.background) : null;
                  if (resolvedPath) {
                    const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                    return (
                      <>
                        <img src={imgSrc} className="w-full h-full object-cover pixel-art animate-fade-in" alt="Sprite"
                          onError={(e) => { e.target.style.display = 'none'; const fb = e.target.nextElementSibling; if (fb) fb.style.display = 'block'; }} />
                        <HelpCircle size={16} className="text-gray-600" style={{ display: 'none' }} />
                      </>
                    );
                  }
                  return <HelpCircle size={16} className="text-gray-600" />;
                })()}
              </div>
              <input type="text" value={card.background || ''} onChange={(e) => update('background', e.target.value)}
                placeholder="sprite_id or assets/..." className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 h-10" />
              <button type="button" onClick={() => setIsPickerOpen(true)}
                className="btn-ghost px-3 h-10 border border-white/10 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                <Image size={14} /> Choose Sprite
              </button>
            </div>
          </Field>
        </div>
      </Section>

      {/* Combat — an enemy makes this a Combat card (R4). Hard guard (L14/L15):
          a card that already has item outputs cannot be given an enemy (that
          would be a new ambush). Existing legacy ambush cards keep their enemy
          and show the warning; the enemy link is disabled to prevent creating
          more. */}
      {(() => {
        const hasItemOutputs = wouldBeAmbush(card);
        const isLegacyAmbush = !!card.enemyId && hasItemOutputs;
        const enemyDisabled = hasItemOutputs && !card.enemyId;
        return (
          <Section title="Combat" icon={<Skull size={14} />}>
            <Field label="Enemy (linking an enemy makes this a Combat card)">
              <select
                value={card.enemyId || ''}
                disabled={enemyDisabled}
                onChange={(e) => updateContent({ enemyId: e.target.value || null })}
                className={`w-full ${enemyDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">None</option>
                {Object.values(enemies).map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </Field>
            {enemyDisabled && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>This card has item outputs, so an enemy can't be linked — that would be an ambush. Keep cards single-purpose: make combat its own card and vary the deck instead.</span>
              </div>
            )}
            {isLegacyAmbush && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>Legacy ambush — this card gathers items <em>and</em> springs an enemy. Grandfathered in; new ambush cards aren't allowed.</span>
              </div>
            )}
          </Section>
        );
      })()}

      {/* Mutator — a token makes this a Mutator (action) card (R1). The token is
          what this card hands OUT to later cards in the deck sequence (it is not
          applied to this card). Picking a token here makes the card a mutator. */}
      <Section title="Mutator Token" icon={<Sparkles size={14} />}>
        <Field label="Applies token (picking one makes this a Mutator card)">
          <select value={tokenId} onChange={(e) => setToken(e.target.value)} className="w-full">
            <option value="">None</option>
            {/* TOKENS is keyed by id; the value objects carry no `id` field, so
                use the key as the option value (never t.id, which is undefined). */}
            {Object.entries(TOKENS).map(([id, t]) => (
              <option key={id} value={id}>{t.icon ? `${t.icon} ` : ''}{t.name || id}</option>
            ))}
          </select>
        </Field>
        {token && (
          <div className="text-xs text-gray-400 px-1 leading-relaxed">
            {token.description || `Applies the ${token.name} token to later cards in the deck.`}
          </div>
        )}
      </Section>

      {/* Diagnostics */}
      <Section title="Live Diagnostics">
        <div className="grid grid-cols-4 gap-3">
          <Diag label="Current EV" value={card.calculatedEV} color="var(--color-success)" />
          <Diag label="GP/min" value={card.goldPerMinute} color="var(--color-item)" />
          <Diag label="XP/min" value={card.xpPerMinute} color="var(--color-quest)" />
          <Diag label="XP Given" value={taskUpdates[activeId]?.xpAwarded ?? card.xpAwarded} color="var(--color-quest)" />
        </div>
      </Section>

      {isPickerOpen && (
        <SpritePickerModal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onSelect={(spriteKey) => update('background', spriteKey)} />
      )}
    </div>
  );
}

function Diag({ label, value, color }) {
  return (
    <div>
      {label && <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-gray-500">{label}</label>}
      <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-sm font-mono text-center" style={{ color: value != null ? color : 'var(--color-text-muted)' }}>
        {value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : '—'}
      </div>
    </div>
  );
}
