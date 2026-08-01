/**
 * The banner header band (the area name) and the two
 * throttled progress bars that float above the hero and enemy cards.
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
        <div className="w-full">
            <ProgressBar current={pct} max={100} color={color || 'task'} size="md" showText={false} innerLabel={timeLabel} />
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
export const BannerHeader = ({ areaName }) => (
    <div className="relative z-10 flex items-center justify-between gap-3 h-12 px-3">
        <span
            className="font-display font-bold text-white tracking-widest uppercase truncate text-xl md:text-2xl gi-outline-4"
        >
            {areaName}
        </span>
    </div>
);

/** Skill/task color for the active card's progress bar. */
export const progressColorFor = (template) =>
    template ? (template.skill || template.config?.skill || template.taskCategory || 'task') : 'primary';
