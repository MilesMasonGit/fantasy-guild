import { cn } from '../../utils/cn.js';
import { useState, useEffect, useSyncExternalStore } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import {
    getTokenType, getAllTokenTypes, tokenName, productionRoutes, getProvidedTagsWithTiers,
    outputRange
} from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as PassiveProduction from '../../../systems/board/PassiveProduction.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Fields from '../../../systems/board/Fields.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import * as Landmarks from '../../../systems/board/Landmarks.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { lifecycleLines } from './lifecycleLines.js';
import { LandmarkBlock } from './LandmarkBlock.jsx';
import { InspectBubbles } from './InspectBubbles.jsx';
import { useTokenDetail } from '../board/useTokenDetail.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * TokenInspection: a Token's full detail, styled consistently with ItemInspection.
 * Hero-time is the scarce resource. A player must never have to spend a hero to discover what
 * something does: planning happens before placement, so the same sheet has to be reachable
 * from the Shop and the board alike.
 */
export const TokenInspection = ({
    typeId,
    hideSprite = false,
    // The board Token this panel was opened from, by instance id. Only a Token on the board
    // can be marked 'heroes may not work this'.
    instanceId = null
}) => {
    const def = getTokenType(typeId);
    const marked = !!useTokenDetail(instanceId, def)?.marked;

    // ⚠️ The engine cannot see a sheet open: this tells it, once per Token shown, and the
    // tutorial's "inspect an endgame site" step counts it (`QuestManager`). Only a Token on the
    // mat; a Shop row's sheet has no instance.
    useEffect(() => {
        if (instanceId == null || !typeId) return;
        EventBus.publish(UI_EVENTS.TOKEN_INSPECTED, { instanceId, typeId });
    }, [instanceId, typeId]);

    if (!def) return null;

    const routes = productionRoutes(typeId);
    const enemy = enemyProfileOf(def);


    const rawTags = Array.isArray(def.tags)
        ? def.tags
        : typeof def.tags === 'string'
            ? def.tags.split(',').map(t => t.trim())
            : [];
    // The Token's own tags, and nothing else.
    const allTags = [...new Set(rawTags)].filter(Boolean);

    const isFillerText = (text) => {
        if (!text) return true;
        const lower = text.toLowerCase().trim();
        return (
            lower.includes('a token for the guild playmat') ||
            lower.includes('a token for the playmat') ||
            lower === 'a basic token.' ||
            lower === 'a token.'
        );
    };

    const rules = def.description
        ? def.description
            .split(/(?<=[.!?])\s+|\n+/)
            .map(r => r.replace(/^["']|["']$/g, '').trim())
            .filter(r => Boolean(r) && !isFillerText(r))
        : [];

    // Core skill and XP information. `config` is the ONE place these live:
    // `BoardRunner.completeCycle` takes XP from `config.xp` (widened by the active recipe) and
    // the skill gate from `config.skill` / `config.skillRequired`, and nothing reads a
    // top-level copy. This panel must read `config` and only `config`, so that it and the
    // engine read the same field; a top-level fallback would promise XP the engine cannot
    // award. (`??` stops at 0, so a Token with `config.xp: 0` shows correctly.)
    // A marked Token is demolition work, whatever it was (`StationRecipe.workConfigOf`).
    const work = marked ? Demolition.DEMOLITION_CONFIG : def.config;
    const skillId = work?.skill;
    const skillDef = skillId ? getSkill(skillId) : null;
    const skillName = skillDef?.name || (skillId ? skillId.charAt(0).toUpperCase() + skillId.slice(1) : null);
    const skillReq = work?.skillRequired ?? (skillName ? 1 : 0);

    return (
        <div className="p-4 flex flex-col gap-4 text-xs text-gi-text">
            <div className="flex flex-col items-center text-center">
                {!hideSprite && (
                    <div className="relative group flex items-center justify-center w-32 h-32 mb-1 overflow-hidden">
                        <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.INSPECT} size={128} alt={def.name} />
                    </div>
                )}

                <h3 className="text-base md:leading-[calc(1.75/1.125)] font-bold text-gi-text mt-1 leading-tight select-text">
                    {tokenName(typeId)}
                </h3>
                <div className="flex items-center justify-center gap-1.5 text-xs text-gi-muted uppercase tracking-wider mt-1 select-text">
                    {def.rarity && (
                        <span className={cn('capitalize font-semibold', RARITY_TONE[def.rarity] || 'text-gi-muted')}>
                            {def.rarity}
                        </span>
                    )}
                </div>

                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                        {allTags.map(tag => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 ui-text-body font-medium text-gi-muted uppercase tracking-wider"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {rules.length > 0 && (
                <div className="flex flex-col gap-1 text-left py-1">
                    {rules.map((rule, idx) => (
                        <p key={idx} className="text-xs text-gi-text/85 leading-relaxed select-text font-medium">
                            {rule}
                        </p>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-2 pt-1 border-t border-gi-border/30">
                <LandmarkBlock def={def} />
                {skillName && (
                    <div data-skill-req={skillId} className="flex items-center justify-between gap-2 py-1 text-xs">
                        <div className="flex items-center gap-1.5 text-gi-muted">
                            <span>Skill Req</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-gi-text">
                            <SkillIcon skill={skillDef} skillId={skillId} size={32} />
                            <span>{skillName}</span>
                            <span className="text-gi-primary tabular-nums text-sm">{skillReq > 0 ? skillReq : 1}</span>
                        </div>
                    </div>
                )}

                <InspectBubbles def={def} instanceId={instanceId} />

                {enemy && (
                    <div className="flex items-center justify-between gap-2 py-1 text-xs">
                        <div className="flex items-center gap-1.5 text-gi-muted">
                            <span>Enemy</span>
                        </div>
                        <span className="font-bold text-gi-text">{enemy.name} (Lv {enemy.level})</span>
                    </div>
                )}

                {instanceId != null && <LifecycleLines instanceId={instanceId} />}
                {instanceId != null && <LeaveMatControl instanceId={instanceId} />}
            </div>


            {routes.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                    <span className="ui-text-body font-bold gi-caps tracking-wider text-gi-muted">
                        Production
                    </span>
                    {routes.map((route, i) => (
                        <RouteBlock key={route.id || i} route={route} />
                    ))}
                </div>
            )}

            {def.buff && (
                <div className="py-1">
                    <Label>Buffs {def.buff.target === 'hero' ? 'the hero on it' : 'nearby Tokens'}</Label>
                    <ul className="mt-1 flex flex-col gap-0.5">
                        {def.buff.modifiers.map((m, i) => (
                            <li key={i} className="ui-text-body text-gi-text">
                                {m.type.replace(/_/g, ' ').toLowerCase()}{' '}
                                <span className="text-gi-primary tabular-nums">
                                    {m.bucket === 'percentage'
                                        ? `${m.value > 0 ? '+' : ''}${Math.round(m.value * 100)}%`
                                        : `${m.value > 0 ? '+' : ''}${m.value}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {def.noStackDuplicates && (
                        <p className="mt-1 ui-text-body text-gi-warning">Duplicates do not stack.</p>
                    )}
                </div>
            )}

            {Object.keys(getProvidedTagsWithTiers(def)).length > 0 && <DrivesBlock def={def} />}
        </div>
    );
};

const ACTION_CLS = 'w-full px-3 py-2 border-2 text-xs font-bold transition-colors cursor-pointer';

/**
 * How a board Token leaves the mat at once. A bounty: Dismiss (no reward; a tutorial step never
 * leaves this way). While the dev layout tool is on, a placed Token (a landmark included) can be
 * removed. Disallowing and demolishing are the top bar's map modes, not the card's.
 */
export const LeaveMatControl = ({ instanceId }) => {
    const layoutEditing = useSyncExternalStore(Landmarks.onLayoutEditingChange, Landmarks.isLayoutEditing);
    const view = useGameState(
        () => {
            const instance = BoardState.getTokenById(instanceId);
            if (!instance) return null;
            if (QuestTokens.isQuestToken(instance)) return { id: instance.id, bounty: QuestTokens.canDismiss(instance) };
            const devRemove = layoutEditing && Demolition.canDemolish(instance)
                && BoardState.originOf(instance) === BoardState.ORIGIN.PLACED;
            return devRemove ? { id: instance.id, devRemove } : null;
        },
        [BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [instanceId, layoutEditing] }
    );
    if (!view) return null;

    if ('bounty' in view) {
        if (!view.bounty) return null;
        return (
            <button
                type="button"
                data-dismiss-bounty={view.id}
                title="Take this bounty off the mat. No reward; a new one comes in its place."
                onClick={() => QuestTokens.dismissBounty(view.id)}
                className={cn(ACTION_CLS, 'bg-[#181412] border-white/10 text-gi-muted hover:text-gi-text hover:border-gi-gold/40')}
            >
                Dismiss bounty
            </button>
        );
    }

    return (
        <button
            type="button"
            data-dev-remove={view.id}
            onClick={() => Placement.removePlacedToken(view.id)}
            className={cn(ACTION_CLS, 'bg-[#181412] border-sky-400/40 text-sky-200 hover:border-sky-300')}
        >
            Remove now (layout tool)
        </button>
    );
};

/** How often the lifecycle lines re-read their clocks while the panel is open. */
const LIFECYCLE_REFRESH_MS = 1000;

const LIFECYCLE_TONE = {
    good: 'text-gi-success',
    warning: 'text-gi-warning',
    danger: 'text-gi-danger',
    muted: 'text-gi-muted'
};

/** The live readers `lifecycleLines` takes (it is pure; this is the wiring). */
function liveLifecycleSources() {
    return {
        typeOf: getTokenType,
        tokenName,
        itemName: (itemId) => getItem(itemId)?.name || itemId,
        spawnerStatus: SpawnerSystem.spawnerStatus,
        passive: (instance) => ({ lines: PassiveProduction.linesOf(instance), nextInMs: PassiveProduction.nextInMs(instance) }),
        respawn: Respawn.respawnState,
        growth: TimedChanges.nextGrowth,
        field: Fields.fieldState,
        recipeName: (id) => getRecipe(id)?.name || id,
        recipeOf: getRecipe,
        selectedRecipe: StationRecipe.selectedRecipe,
        poolFor: StationRecipe.poolFor,
        originOf: BoardState.originOf,
        demolishMs: Demolition.DEMOLISH_MS,
        workerOf: BoardState.workerOf,
        dev: !!(import.meta.env?.DEV || (import.meta.env?.MODE === 'perf' && SettingsManager.get('debugMode')))
    };
}

/**
 * Lifecycle lines: a spawner's family, next spawn and upkeep; time to grow, turn or turn back;
 * how it respawns, or how long it rests; a Foundation's build; Passive Production; origin in dev
 * mode. Plain rows; the wording lives in
 * `lifecycleLines.js`. Clocks move without events, so it re-reads every second while open.
 */
const LifecycleLines = ({ instanceId }) => {
    const [, setNow] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setNow(n => n + 1), LIFECYCLE_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);

    const lines = lifecycleLines(BoardState.getTokenById(instanceId), liveLifecycleSources());
    if (!lines.length) return null;

    return (
        <div data-lifecycle-lines className="flex flex-col gap-1 py-1 text-xs">
            {lines.map((line, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                    <span className="text-gi-muted">{line.label}</span>
                    <span className={cn('font-bold text-right tabular-nums', LIFECYCLE_TONE[line.tone] || 'text-gi-text')}>
                        {line.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

const DetailLine = ({ label, value, highlight }) => (
    <div className="flex items-center justify-between gap-2 text-xs md:leading-[calc(1.25/0.875)]">
        <span className="text-gi-muted">{label}</span>
        <span className={cn('font-bold capitalize tabular-nums', highlight || 'text-gi-text')}>{value}</span>
    </div>
);

const RARITY_TONE = {
    common: 'text-gi-muted',
    uncommon: 'text-gi-success',
    rare: 'text-gi-info',
    mythic: 'text-gi-gold'
};

const Label = ({ children }) => (
    <span className="ui-text-body font-bold gi-caps tracking-widest text-gi-muted">{children}</span>
);

/** One way this Token can produce: its cost, its output, and what unlocks it. */
const RouteBlock = ({ route }) => {
    const hasIO = route.inputs.length > 0 || route.outputs.length > 0;
    if (!hasIO) return null;

    return (
        <div className="flex flex-col gap-2">
            {route.requiresContext.length > 0 && (
                <Label>Needs beside it: {route.requiresContext.map(contextName).join(' + ')}</Label>
            )}

            {route.inputs.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="ui-text-body font-bold gi-caps tracking-wider text-gi-danger/80">
                        Inputs:
                    </span>
                    {route.inputs.map((i, idx) => (
                        <EntityRibbon
                            key={`${i.itemId}-${idx}`}
                            kind="item"
                            id={i.itemId}
                            quantity={i.quantity}
                            size="sm"
                            variant="cost"
                        />
                    ))}
                </div>
            )}

            {/* A currency output pays nothing, so it is not listed. */}
            {route.outputs.some(o => !o.currency) && (
                <div className="flex flex-col gap-1">
                    <span className="ui-text-body font-bold gi-caps tracking-wider text-gi-success/80">
                        Outputs:
                    </span>
                    {route.outputs.filter(o => !o.currency).map((o, idx) => (
                        <EntityRibbon
                            key={`${o.itemId}-${idx}`}
                            kind="item"
                            id={o.itemId}
                            quantity={quantityText(o)}
                            chance={o.chance !== undefined ? `${o.chance}%` : '100%'}
                            size="sm"
                            variant="output"
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/** For a context Token: which stations it unlocks, and whether it is a tool. */
const DrivesBlock = ({ def }) => {
    const tags = new Set(Object.keys(getProvidedTagsWithTiers(def)));
    const all = getAllTokenTypes();
    const driven = Object.keys(all).filter(id =>
        productionRoutes(id).some(r => r.requiresContext.some(t => tags.has(t)))
    );

    return (
        <div className="py-1">
            <Label>{def.isTool ? 'Tool — unlocks' : 'Drives'}</Label>
            <p className="mt-1 ui-text-body text-gi-text">
                {driven.length ? driven.map(id => tokenName(id)).join(', ') : 'Nothing yet'}
            </p>
            <p className="mt-1 ui-text-body text-gi-muted">
                {/* Sharing is a rate trade, not free value. */}
                Serves every nearby station, and wears once per cycle it serves.
            </p>
        </div>
    );
};

/** An output's quantity, as "2" or as "2–4". Items only; currency outputs are not shown. */
function quantityText(output) {
    const { min, max } = outputRange(output);
    return min === max ? `${min}` : `${min}–${max}`;
}

/** The Token that supplies a context tag, named rather than shown as an id. */
function contextName(tag) {
    const all = getAllTokenTypes();
    const provider = Object.keys(all).find(id => tag in getProvidedTagsWithTiers(all[id]));
    return provider ? tokenName(provider) : tag;
}

export default TokenInspection;
