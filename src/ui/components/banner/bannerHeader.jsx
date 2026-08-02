/**
 * The banner header band (the area name) and the two
 * throttled progress bars that float above the hero and enemy cards.
 * Extracted from AreaBannerRow (CR-001).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import {
    Play, Pause, ChevronUp, ChevronDown, Sword, Hammer, Skull, User,
    Layers, AlertTriangle, Utensils, Hourglass, Infinity as InfinityIcon,
    X, Trash2, Plus, Lock, CheckCircle2, Shield, Package, Boxes, CupSoda, Sparkles
} from 'lucide-react';

// ----------------------------------------------------------------------
// Banner header — full-width band on the mat: area name (left) + the active
// card's task progress bar, aligned to sit directly above the active card.
// ----------------------------------------------------------------------

const CONTROL_W = 40;   // ControlPanel w-10
const HERO_PAD = 16;    // HeroSlotCell wrapper px-2
const CENTER_PAD = 8;   // AdventureCenter px-2 (left)

/** Descriptor verb for a task (e.g. "Swimming…"), mirroring TaskStage. */
export const taskVerbFor = (card, template, status) => {
    if (status === 'shuffling') return 'Shuffling…';
    if (status === 'drawing') return 'Drawing…';
    if (status === 'in_combat') return 'Fighting…';
    const skillId = card?.skill || template?.config?.skill || template?.skill;
    let verb = TASK_VERBS[skillId?.toLowerCase()];
    if (!verb) {
        const category = card?.taskCategory || template?.config?.taskCategory || 'Working';
        verb = category.charAt(0).toUpperCase() + category.slice(1);
    }
    return `${verb}…`;
};

/**
 * The on-card ProgressBar module, relocated to the header: the animated bar
 * (driven by `area:progress`, incl. draw/shuffle) plus the descriptor + task
 * time row (`base > modified`, colored), matching TaskStage 1:1.
 */
export const HeaderTaskProgress = ({ areaId, color, activeCard, activeTemplate, status }) => {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        const unsub = EventBus.subscribe(AREA_EVENTS.PROGRESS, (d) => {
            if (d?.areaId === areaId) setPct(d.percent);
        });
        return unsub;
    }, [areaId]);

    // A bright expanding "ping" ring the instant a card completes (motion
    // pass 2026-08-01) — tied to the same CARD_COMPLETED event as the card's
    // own green flash (owner call: keep both, distinct shapes/positions
    // reading as one connected "it's done" beat rather than duplicate noise).
    const [popId, setPopId] = useState(null);
    useEffect(() => {
        return EventBus.subscribe(AREA_EVENTS.CARD_COMPLETED, e => {
            if (e.areaId === areaId) setPopId(Math.random().toString(36).slice(2));
        });
    }, [areaId]);

    const descriptor = taskVerbFor(activeCard, activeTemplate, status);
    const missing = activeCard?.missingRequirements?.[0];
    const isWorking = status === 'running' || status === 'in_combat';
    const inCombat = status === 'in_combat';
    const durationMs = activeCard?.baseTickTime || activeTemplate?.baseTickTime || activeTemplate?.config?.baseTickTime || 0;
    const currentMs = activeCard?.currentTickTime || durationMs;
    // One time value, centered on the bar: the actual (modified) cycle time —
    // the hero's attack speed in combat, the task's tick time otherwise.
    const combatSpeedMs = inCombat ? (activeCard?.combat?.heroAttackSpeed || 0) : 0;
    const showTime = inCombat
        ? combatSpeedMs > 0
        : (durationMs > 0 && status !== 'drawing' && status !== 'shuffling');
    const timeMs = inCombat ? combatSpeedMs : currentMs;
    const timeLabel = showTime ? `${Math.round(timeMs / 100) / 10}s` : '';

    return (
        <div className="relative w-full">
            <ProgressBar current={pct} max={100} color={color || 'task'} size="md" showText={false} innerLabel={timeLabel} />
            <AnimatePresence>
                {popId && (
                    <motion.div
                        key={popId}
                        className="absolute inset-0 rounded-full border-2 border-green-400 pointer-events-none"
                        initial={{ opacity: 0.9, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * HeaderEnemyProgress — the enemy's attack-loop bar, floated above the active
 * combat (enemy) card. The combat counterpart to HeaderTaskProgress: it reads
 * `enemyPercent` off the same throttled `area:progress` event.
 */
export const HeaderEnemyProgress = ({ areaId, activeCard }) => {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        const unsub = EventBus.subscribe(AREA_EVENTS.PROGRESS, (d) => {
            if (d?.areaId === areaId && d.enemyPercent !== undefined) setPct(d.enemyPercent);
        });
        return unsub;
    }, [areaId]);

    const enemyDef = activeCard?.enemyId ? getEnemy(activeCard.enemyId) : null;
    const speedMs = activeCard?.combat?.enemyAttackSpeed || enemyDef?.attackSpeed || 0;
    const timeLabel = speedMs > 0 ? `${Math.round(speedMs / 100) / 10}s` : '';

    return (
        <div className="w-full">
            <ProgressBar current={pct} max={100} color="combat" size="md" showText={false} innerLabel={timeLabel} />
        </div>
    );
};

// Header band: the area name. The Wilds/Outpost toggle is gone — Outposts are
// standalone banners now (D-16), so an area banner has only one face and
// nothing to switch between.
//
// The task progress bar lives in the AdventureCenter, floated directly above
// the active card so it always tracks the card regardless of spacing.
//
// The buy-pack control (right side) mirrors the one in Deck Focus's
// BinderHeader (bannerFocus.jsx) — same control, duplicated here so the
// player doesn't have to open the deck editor just to buy a pack. Outpost
// banners don't pass an areaId/engine, so it simply doesn't render there.
export const BannerHeader = ({ areaName, areaId, engine }) => (
    <div className="relative z-10 flex items-center justify-between gap-3 h-12 px-3">
        <span
            className="font-display font-bold text-white tracking-widest uppercase truncate text-xl md:text-2xl gi-outline-4"
        >
            {areaName}
        </span>
        {areaId && engine && <BannerBuyPack areaId={areaId} engine={engine} />}
    </div>
);

/** Collection progress + the pack-buy button, relocated onto the always-visible banner (D-48 follow-up). */
const BannerBuyPack = ({ areaId, engine }) => {
    // Re-render on gold changes and on binder/collection updates for this area.
    useGameState(
        state => {
            const binder = state.collection?.binders?.[areaId] || {};
            const owned = Object.keys(binder).sort().map(id => `${id}:${binder[id]}`).join(',');
            return `${owned}|${state.currency?.gold ?? 0}`;
        },
        ['collection_updated', 'currency_updated', 'state_changed']
    );

    const { owned, total, complete, cardsOwned, cardsTotal } = BinderManager.getCompletion(areaId);
    if (total === 0) return null;

    const cost = engine.CollectionManager.getPackCost(areaId);
    const gold = engine.GameState.currency?.gold ?? 0;

    if (complete) {
        const mastered = engine.BinderMastery?.isUnlocked(areaId);
        return (
            <span
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gi-primary shrink-0"
                title={mastered ? 'Area Mastery: a permanent bonus for completing this binder' : undefined}
            >
                <CheckCircle2 size={13} /> Binder complete
                {mastered && (
                    <span className="flex items-center gap-1 text-gi-gold border border-gi-gold/40 rounded px-1.5 py-px">
                        <Sparkles size={10} /> Area Mastery
                    </span>
                )}
            </span>
        );
    }

    const buy = () => {
        const r = engine.CollectionManager.buyAreaPack(areaId);
        if (!r.success) {
            const msg = r.error === 'INSUFFICIENT_GOLD' ? 'Not enough gold'
                : r.error === 'SOLD_OUT' ? 'Nothing left to collect here'
                : 'Could not buy a pack';
            engine.EventBus.publish('ui:notify', { message: msg, type: 'error' });
        }
    };

    return (
        <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-gi-muted whitespace-nowrap">
                <span className="text-white font-bold">{cardsOwned}</span>/{cardsTotal} cards
                <span className="mx-1 opacity-40">·</span>
                <span className="text-white font-bold">{owned}</span>/{total} copies
            </span>
            <button
                onClick={buy}
                disabled={gold < cost}
                title={gold < cost ? `Costs ${cost} gold` : `Buy a pack for ${cost} gold`}
                className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors',
                    gold < cost
                        ? 'border-white/10 text-gi-muted cursor-not-allowed'
                        : 'border-gi-primary/60 text-gi-primary hover:bg-gi-primary/10'
                )}
            >
                <Package size={12} /> Pack · {cost}g
            </button>
        </div>
    );
};

/** Skill/task color for the active card's progress bar. */
export const progressColorFor = (template) =>
    template ? (template.skill || template.config?.skill || template.taskCategory || 'task') : 'primary';
