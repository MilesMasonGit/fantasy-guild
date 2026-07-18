/**
 * The static pillar cells: run controls, the area info card, and the
 * combatant (hero/enemy) stat panels plus the outpost info card.
 * Extracted from AreaBannerRow (CR-001).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import ProgressBar from '../base/ProgressBar.jsx';
import { TASK_VERBS } from '../card-modules/TaskStage.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { getRecipe, getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useEntityDrag, useEntityDrop, mergeRefs, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import StatusPlacards from '../combat/StatusPlacards.jsx';
import { useCombatFeedback, DamageFloaters } from '../combat/combatFeedback.jsx';
import { RefProgressBar } from './RefProgressBar.jsx';
import { ActiveCardFace } from '../ActiveCardFace.jsx';
import { GICard } from '../base/GICard.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { FocusScaffold } from './FocusScaffold.jsx';
import { AreaMat } from './AreaMat.jsx';
import { BadgeRow, deriveCardBadgeIds, deriveHeroBadgeIds, deriveDeckBadgeIds } from '../card-modules/CardBadges.jsx';
import {
    Play, Pause, ChevronUp, ChevronDown, Sword, Hammer, Skull, User,
    Layers, AlertTriangle, Utensils, Hourglass, Infinity as InfinityIcon,
    X, Trash2, Plus, Lock, CheckCircle2, Shield, Package, Boxes, CupSoda
} from 'lucide-react';
import {
    CardTitle, RowTemplateCard, RowHeroCard, RowDeckCard, RowEmptyCard, RowHazardCard,
    SlotCard, StatRow, VitalBar, FocusDivider, STATUS_LABELS, isConsumableItem
} from './bannerCards.jsx';

// ----------------------------------------------------------------------
// Static pillars
// ----------------------------------------------------------------------

export const ControlPanel = ({ areaId, snap, engine, onCollapse }) => {
    const manuallyPaused = snap.pausedReason === 'manual';
    const canToggleRun = snap.mode === 'adventure' && snap.status !== 'injured' && snap.assignedHeroId;

    const handleRunToggle = () => {
        if (manuallyPaused) engine.LoopRunner.resumeArea(areaId);
        else engine.LoopRunner.pauseArea(areaId);
    };

    return (
        <div className="w-14 shrink-0 self-stretch flex flex-col items-center justify-center gap-2 bg-black/35 border-r border-white/5">
            <button
                onClick={handleRunToggle}
                disabled={!canToggleRun}
                title={manuallyPaused ? 'Start the loop' : 'Stop the loop'}
                className={cn(
                    'p-1.5 rounded border transition-colors',
                    !canToggleRun ? 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                        : manuallyPaused ? 'border-gi-success/50 text-gi-success hover:bg-gi-success/10'
                            : 'border-gi-border text-gi-text hover:border-gi-danger hover:text-gi-danger'
                )}
            >
                {manuallyPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
                onClick={onCollapse}
                title="Hide this area"
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text transition-colors"
            >
                <ChevronUp size={13} />
            </button>
        </div>
    );
};

const STATUS_ICONS = {
    running: <Play size={30} className="text-gi-success" />,
    in_combat: <Sword size={30} className="text-gi-danger" />,
    drawing: <Hourglass size={30} className="text-gi-muted animate-pulse" />,
    shuffling: <Layers size={30} className="text-gi-muted animate-pulse" />,
    injured: <Skull size={30} className="text-gi-danger" />,
    paused: <Pause size={30} className="text-gi-muted" />
};

// Info card — the area's live operational status, on the shared card frame
// (empty-slot styling). Vitals moved to the Hero card (owner decision 2026-07-09).
export const InfoPanel = ({ areaId, snap, engine }) => {
    const { size, width, height } = useCardTier();
    const statusInfo = snap.mode === 'stationed'
        ? (snap.status === 'injured'
            ? STATUS_LABELS.injured
            : { crafting: { label: 'Crafting', color: 'text-gi-gold' }, paused_no_inputs: { label: 'No materials', color: 'text-gi-danger' }, paused_limit_reached: { label: 'Order complete', color: 'text-gi-success' }, idle: { label: 'Idle at Outpost', color: 'text-gi-muted' } }[snap.stationStatus] || STATUS_LABELS.paused)
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
    const energyPaused = snap.pausedReason === 'energy';
    const label = energyPaused ? 'Exhausted' : statusInfo.label;
    const icon = STATUS_ICONS[energyPaused ? 'paused' : snap.status] || STATUS_ICONS.paused;

    return (
        <div className="shrink-0 flex flex-col items-center">
            <BadgeRow ids={[]} size={size} />
            <div
                style={{ width, height }}
                className="rounded-xl border border-dashed border-gi-border bg-black/60 flex flex-col items-center justify-center gap-2 text-center px-4"
            >
                {icon}
                <span className={cn('gi-card-title font-bold tracking-widest uppercase leading-tight', statusInfo.color)}>{label}</span>
                <span className="text-[9px] text-gi-muted normal-case">
                    {snap.assignedHeroId ? (energyPaused ? 'Waiting for energy' : 'Status') : 'No hero assigned'}
                </span>
            </div>
        </div>
    );
};


// ----------------------------------------------------------------------
// Combatant info panels (owner design 2026-07-14): the hero and enemy panels
// share one frame and structure so they stay visually aligned —
//   title/name header → HP bar → Dmg range | Hit % | Crit % row → statuses.
// Out of combat the hero's stat row is replaced by the energy bar.
// ----------------------------------------------------------------------

/** Events that change what the panels display; both panels re-render on them. */
const COMBATANT_PANEL_EVENTS = ['combat_hero_attack', 'combat_enemy_attack', 'status_applied', 'status_dot_tick', 'heroes_updated'];

export const useCombatantPanelTicks = () => {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const bump = () => forceUpdate(n => n + 1);
        const unsubs = COMBATANT_PANEL_EVENTS.map(e => EventBus.subscribe(e, bump));
        return () => unsubs.forEach(u => u());
    }, []);
};

/** The shared card-sized frame both combatant panels render into. */
export const CombatantPanelFrame = ({ tone = 'hero', title, name, actionText = null, actionTone = 'text-gi-muted', children }) => {
    const { size, width, height } = useCardTier();
    const enemy = tone === 'enemy';
    return (
        <div className="shrink-0 flex flex-col items-center">
            <BadgeRow ids={[]} size={size} />
            <div
                style={{ width, height }}
                className={cn(
                    'rounded-xl border border-dashed flex flex-col gap-1.5 text-left p-2.5 overflow-hidden bg-black/60',
                    enemy ? 'border-gi-danger text-gi-danger' : 'border-gi-border text-gi-text'
                )}
            >
                <div className="flex flex-col items-center text-center shrink-0">
                    <span className={cn(
                        'gi-card-title font-bold tracking-widest uppercase leading-tight text-xs',
                        enemy ? 'text-gi-danger' : 'text-white'
                    )}>
                        {title}
                    </span>
                    <span className="text-[9px] text-gi-muted normal-case truncate max-w-full px-1">{name}</span>
                    {actionText && <span className={cn('text-[8px] uppercase tracking-widest truncate max-w-full font-bold', actionTone)}>{actionText}</span>}
                </div>
                {children}
            </div>
        </div>
    );
};

/** Compact three-cell stat row: damage range, chance to hit, crit chance. */
export const CombatStatRow = ({ dmgMin, dmgMax, hitPct, critPct }) => (
    <div className="flex gap-1 w-full shrink-0">
        {[
            ['Dmg', `${dmgMin}–${dmgMax}`],
            ['Hit', `${Math.round(hitPct)}%`],
            ['Crit', `${Math.round(critPct)}%`]
        ].map(([label, value]) => (
            <div key={label} className="flex-1 min-w-0 flex flex-col items-center bg-black/30 rounded px-0.5 py-0.5">
                <span className="text-[8px] uppercase tracking-wider text-gi-muted leading-none">{label}</span>
                <span className="text-[10px] font-bold tabular-nums text-gi-text leading-tight truncate">{value}</span>
            </div>
        ))}
    </div>
);

/**
 * Hero info panel — always shown while a hero is assigned. In combat the
 * energy bar gives way to the Dmg/Hit/Crit row against the current enemy.
 */
export const HeroInfoPanel = ({ areaId, snap, engine }) => {
    useCombatantPanelTicks();

    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    if (!hero) return null;

    const inCombat = snap.status === 'in_combat';
    const activeCard = inCombat ? engine.LoopRunner.getActiveCardForArea(areaId) : null;
    const enemyDef = activeCard?.enemyId ? getEnemy(activeCard.enemyId) : null;

    let statRow = null;
    if (inCombat && enemyDef) {
        const combat = activeCard.combat || {};
        const style = CombatFormulas.getHeroCombatStyle(hero);
        const weapon = hero.equipment?.weapon ? getItem(hero.equipment.weapon) : null;
        const dmg = CombatFormulas.getHeroDamageRange(hero, enemyDef, weapon, combat.stats?.damageBonus || 0, style, combat.enemyStatuses);
        const hit = CombatFormulas.calculateHitChance(
            CombatFormulas.getHeroCombatSkill(hero, style), enemyDef.defenceSkill,
            style, enemyDef.combatType || 'melee', hero, enemyDef
        );
        statRow = <CombatStatRow dmgMin={dmg.min} dmgMax={dmg.max} hitPct={hit} critPct={CombatFormulas.getCritChance(hero)} />;
    }

    return (
        <CombatantPanelFrame tone="hero" title="Hero Stats" name={hero.name}>
            <VitalBar label="HP" value={Math.round(hero.hp?.current ?? 0)} max={hero.hp?.max ?? 100} barClass="bg-gi-danger" />
            {statRow || <VitalBar label="EN" value={Math.round(hero.energy?.current ?? 0)} max={hero.energy?.max ?? 100} barClass="bg-gi-gold" />}
            <StatusPlacards statuses={hero.statuses} className="justify-start content-start flex-1 overflow-hidden" />
        </CombatantPanelFrame>
    );
};

/** Enemy info panel — the combat-only mirror of the hero panel. */
export const EnemyInfoPanel = ({ areaId, snap, engine }) => {
    useCombatantPanelTicks();

    const activeCard = engine.LoopRunner.getActiveCardForArea(areaId);
    const enemyDef = activeCard?.enemyId ? getEnemy(activeCard.enemyId) : null;
    if (!enemyDef) return null;

    const combat = activeCard.combat || {};
    const enemyHp = combat.enemyHp || { current: enemyDef.hp || 100, max: enemyDef.hp || 100 };
    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    const heroStyle = hero ? CombatFormulas.getHeroCombatStyle(hero) : 'melee';
    const dmg = CombatFormulas.getEnemyDamageRange(enemyDef, hero, heroStyle);
    const hit = CombatFormulas.calculateHitChance(
        enemyDef.attackSkill, hero ? CombatFormulas.getHeroDefenseSkill(hero) : 1,
        enemyDef.combatType || 'melee', heroStyle, enemyDef, hero
    );

    return (
        <CombatantPanelFrame tone="enemy" title="Enemy Stats" name={enemyDef.name} actionText="Attacking…" actionTone="text-red-400">
            <VitalBar label="HP" value={Math.floor(enemyHp.current)} max={enemyHp.max} barClass="bg-gi-danger" />
            <CombatStatRow dmgMin={dmg.min} dmgMax={dmg.max} hitPct={hit} critPct={CombatFormulas.getCritChance(enemyDef)} />
            <StatusPlacards statuses={combat.enemyStatuses} className="justify-start content-start flex-1 overflow-hidden" />
        </CombatantPanelFrame>
    );
};

/**
 * Production run-count controls (infinite / limited), shown inside the
 * outpost info card (owner design 2026-07-16).
 */
export const ProductionControls = ({ areaId, snap, engine }) => {
    const [limitDraft, setLimitDraft] = useState(String(snap.productionLimit || 10));
    const limited = snap.productionMode === 'limited';
    const commitLimit = () => engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0);
    return (
        <div className="flex flex-col gap-1 w-full">
            <span className="text-[8px] uppercase tracking-widest text-gi-muted">Production</span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => engine.StationSlotManager.setProductionMode(areaId, 'infinite')}
                    title="Craft forever"
                    className={cn('flex-1 py-1 rounded border text-[10px] font-bold uppercase flex items-center justify-center transition-colors',
                        !limited ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                >
                    <InfinityIcon size={12} />
                </button>
                <button
                    onClick={commitLimit}
                    title="Craft a set amount"
                    className={cn('flex-1 py-1 rounded border text-[9px] font-bold uppercase transition-colors',
                        limited ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                >
                    Limit
                </button>
                <input
                    type="number" min="1" value={limitDraft}
                    onChange={e => setLimitDraft(e.target.value)}
                    onFocus={() => !limited && engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0)}
                    onBlur={() => limited && commitLimit()}
                    className={cn('w-10 bg-black/40 border rounded px-1 py-1 text-[11px] text-center text-gi-text outline-none tabular-nums transition-colors',
                        limited ? 'border-gi-gold/60' : 'border-gi-border opacity-60')}
                />
            </div>
            {limited && (
                <span className="text-[8px] uppercase tracking-widest text-gi-muted text-center">{snap.producedCount}/{snap.productionLimit} done</span>
            )}
        </div>
    );
};

/**
 * Station Drink slot (owner design 2026-07-16) — an area-level card that holds
 * a drink, auto-sipped by StationManager to keep a low-energy hero crafting.
 * Drop a drink item from the Bank; click to clear. Lives right after the Hero
 * slot in the outpost row.
 */


const STATION_STATUS_LABELS = {
    crafting: { label: 'Crafting', color: 'text-gi-gold' },
    paused_no_inputs: { label: 'No materials', color: 'text-gi-danger' },
    paused_no_energy: { label: 'Out of energy', color: 'text-gi-danger' },
    paused_limit_reached: { label: 'Order complete', color: 'text-gi-success' },
    idle: { label: 'Idle at Outpost', color: 'text-gi-muted' }
};

/**
 * Outpost info card (owner design 2026-07-16) — sits left of the Hero slot in
 * Stationed Mode, replacing the combat-focused HeroInfoPanel (irrelevant at the
 * outpost). Shows station status, the hero's HP/EN (energy now drives
 * crafting), and the production run-count controls.
 */
export const StationInfoCard = ({ areaId, snap, engine }) => {
    const { size, width, height } = useCardTier();
    useCombatantPanelTicks(); // re-render on hero HP/energy changes
    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    const info = snap.status === 'injured'
        ? { label: 'Injured', color: 'text-gi-danger' }
        : (STATION_STATUS_LABELS[snap.stationStatus] || STATION_STATUS_LABELS.idle);
    return (
        <div className="shrink-0 flex flex-col items-center">
            <BadgeRow ids={[]} size={size} />
            <div
                style={{ width, height }}
                className="rounded-xl border border-dashed border-gi-border bg-black/60 flex flex-col gap-2 p-2.5 overflow-hidden"
            >
                <div className="text-center shrink-0">
                    <span className="gi-card-title font-bold tracking-widest uppercase text-xs text-white block leading-tight">Outpost</span>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', info.color)}>{info.label}</span>
                </div>
                {hero ? (
                    <>
                        <VitalBar label="HP" value={Math.round(hero.hp?.current ?? 0)} max={hero.hp?.max ?? 100} barClass="bg-gi-danger" />
                        <VitalBar label="EN" value={Math.round(hero.energy?.current ?? 0)} max={hero.energy?.max ?? 100} barClass="bg-gi-gold" />
                    </>
                ) : (
                    <span className="text-[9px] text-gi-muted italic text-center px-1">Assign a hero to craft.</span>
                )}
                {snap.stationCardId && (
                    <div className="mt-auto">
                        <ProductionControls areaId={areaId} snap={snap} engine={engine} />
                    </div>
                )}
            </div>
        </div>
    );
};

/** Input displays card — the recipe's ingredients with live bank counts (§11.B.2). */