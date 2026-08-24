import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    getTokenType, getAllTokenTypes, tokenName, productionRoutes, getProvidedTagsWithTiers,
    outputRange
} from '../../../config/registries/tokenRegistry.js';
import { managedTypes } from '../../../systems/board/Managers.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { listMaps } from '../../../config/registries/mapRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { ArrowRight, Vault } from 'lucide-react';

import { SellControls } from './SellControls.jsx';

/**
 * TokenInspection — a Token's full detail, styled consistently with ItemInspection.
 *
 * ## Why this is load-bearing rather than a nicety (D-145)
 * Hero-time is the scarce resource. A player must never have to spend a
 * tile and a hero to discover what something does — planning happens before
 * placement, so the same sheet has to be reachable from the Vault, the Tray,
 * the Cartographer's pool and the board alike.
 */
export const TokenInspection = ({
    typeId,
    hideSprite = false,
    showSell = true,
    showAddToTray = true,
    showViewInVault = false
}) => {
    const def = getTokenType(typeId);

    const inVaultCopies = useGameState(
        () => BoardState.tokenBankCopies(typeId),
        ['token_bank_updated', 'state_changed'],
        null,
        { deps: [typeId] }
    ) || [];
    const inVaultCount = inVaultCopies.length;

    const trayFull = useGameState(
        () => BoardState.getTray().length >= BoardState.TRAY_CAPACITY,
        ['token_bank_updated', 'board:tile_changed', 'state_changed']
    );

    if (!def) return null;

    const routes = productionRoutes(typeId);
    const enemy = def.enemyId ? getEnemy(def.enemyId) : null;
    const value = TokenBank.sellValue(typeId);

    const partialCopy = inVaultCopies.find(
        c => c.usesRemaining != null && def.uses != null && c.usesRemaining < def.uses
    );
    const partialCharges = partialCopy?.usesRemaining;

    // Map source discovery
    const sources = listMaps().filter(m => m.pool?.some(e => e.kind === 'token' && e.refId === typeId));
    const foundInText = sources.map(m => m.name).join(', ');

    // Tags extraction
    const rawTags = Array.isArray(def.tags)
        ? def.tags
        : typeof def.tags === 'string'
            ? def.tags.split(',').map(t => t.trim())
            : [];
    const allTags = [...new Set([
        ...rawTags,
        ...(def.theme ? [def.theme] : [])
    ])].filter(Boolean);

    // Rules text: left-adjusted, not in quotes, each rule on its own line, filter out filler
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

    // Core Skill & XP information
    const skillId = def.config?.skill || def.skill;
    const skillDef = skillId ? getSkill(skillId) : null;
    const skillName = skillDef?.name || (skillId ? skillId.charAt(0).toUpperCase() + skillId.slice(1) : null);
    const skillReq = def.config?.skillRequired ?? def.skillRequired ?? (skillName ? 1 : 0);
    const xpAmount = def.config?.xp ?? def.xp ?? def.xpAwarded ?? 0;
    const cycleSec = def.config?.cycleTimeMs ? (def.config.cycleTimeMs / 1000).toFixed(0) : null;

    const handleAddToTray = () => {
        const instance = TokenBank.withdraw(typeId);
        if (!instance) return;
        if (!BoardState.addToTray(instance)) {
            TokenBank.deposit(instance);
            NotificationSystem.warning('No room in the Tray');
        } else {
            NotificationSystem.success(`Moved ${tokenName(typeId)} to Tray`);
        }
    };

    const handleSell = (quantity) => {
        let totalGold = 0;
        let countSold = 0;
        for (let i = 0; i < quantity; i++) {
            const res = TokenBank.sell(typeId);
            if (res.success) {
                totalGold += res.gold;
                countSold++;
            } else {
                break;
            }
        }
        if (countSold > 0) {
            NotificationSystem.success(`Sold ${countSold}× ${tokenName(typeId)} for ${totalGold}g`);
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4 text-xs text-gi-text">
            {/* Header: Centered 128px sprite with hover Add to Tray, name, found in/rarity, tags */}
            <div className="flex flex-col items-center text-center">
                {!hideSprite && (
                    <div className="relative group flex items-center justify-center w-32 h-32 mb-1 rounded-lg overflow-hidden">
                        <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.INSPECT} size={128} alt={def.name} />

                        {/* Add to Tray button on sprite hover */}
                        {showAddToTray && inVaultCount > 0 && (
                            <button
                                onClick={handleAddToTray}
                                disabled={trayFull}
                                title={trayFull ? 'The Tray is full' : 'Move one copy to the Tray'}
                                className={cn(
                                    'absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 p-2 bg-black/75 backdrop-blur-[2px] transition-opacity duration-150',
                                    'opacity-0 group-hover:opacity-100 cursor-pointer active:scale-[0.98]',
                                    trayFull && 'cursor-not-allowed opacity-0 group-hover:opacity-80'
                                )}
                            >
                                <div className="p-1.5 rounded-full bg-gi-primary/20 border border-gi-primary/60 text-gi-primary shadow">
                                    <ArrowRight size={18} />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gi-text text-center leading-tight drop-shadow">
                                    {trayFull ? 'Tray Full' : 'Add to Tray'}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                <h3 className="text-base md:text-lg font-bold text-gi-text mt-1 leading-tight select-text">
                    {tokenName(typeId)}
                </h3>
                <div className="flex items-center justify-center gap-1.5 text-xs text-gi-muted uppercase tracking-wider mt-1 select-text">
                    {foundInText && <span>{foundInText}</span>}
                    {def.rarity && (
                        <span className={cn('capitalize font-semibold', RARITY_TONE[def.rarity] || 'text-gi-muted')}>
                            {def.rarity}
                        </span>
                    )}
                </div>

                {/* Tags underneath */}
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                        {allTags.map(tag => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 rounded border border-gi-border/50 text-[10px] font-medium text-gi-muted uppercase tracking-wider"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Rules Text: Left-adjusted, not in quotes, each rule on its own line (omitted if filler/empty) */}
            {rules.length > 0 && (
                <div className="flex flex-col gap-1 text-left py-1">
                    {rules.map((rule, idx) => (
                        <p key={idx} className="text-xs text-gi-text/85 leading-relaxed select-text font-medium">
                            {rule}
                        </p>
                    ))}
                </div>
            )}

            {/* Core Details Table */}
            <div className="flex flex-col gap-2 pt-1 border-t border-gi-border/30">
                {/* Skill Requirement Badge: Skill Req (Sprite, name, number) */}
                {skillName && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
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

                {/* Split XP and Time badges next to each other */}
                {(xpAmount > 0 || cycleSec) && (
                    <div className="flex items-center gap-2 text-xs">
                        {xpAmount > 0 && (
                            <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                <span className="text-gi-muted">XP</span>
                                <span className="font-bold text-amber-400 tabular-nums">+{xpAmount}</span>
                            </div>
                        )}
                        {cycleSec && (
                            <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                <span className="text-gi-muted">Time</span>
                                <span className="font-bold text-gi-text tabular-nums">{cycleSec}s</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Charges Badge: full width badge */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
                    <span className="text-gi-muted">Charges</span>
                    <div className="font-bold text-gi-text font-mono tabular-nums">
                        {def.uses == null ? (
                            <span className="text-gi-success font-sans">∞</span>
                        ) : (
                            <span>
                                {partialCharges != null ? partialCharges : def.uses}/{def.uses}
                            </span>
                        )}
                    </div>
                </div>

                {enemy && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
                        <div className="flex items-center gap-1.5 text-gi-muted">
                            <span>Enemy</span>
                        </div>
                        <span className="font-bold text-gi-text">{enemy.name} (Lv {enemy.level})</span>
                    </div>
                )}
            </div>

            {/* Production Routes */}
            {routes.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                    <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                        Production
                    </span>
                    {routes.map((route, i) => (
                        <RouteBlock key={route.id || i} route={route} />
                    ))}
                </div>
            )}

            {/* Buffs describe themselves */}
            {def.buff && (
                <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2.5">
                    <Label>Buffs {def.buff.target === 'hero' ? 'the hero on it' : 'adjacent Tokens'}</Label>
                    <ul className="mt-1 flex flex-col gap-0.5">
                        {def.buff.modifiers.map((m, i) => (
                            <li key={i} className="text-[10px] text-gi-text">
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
                        <p className="mt-1 text-[9px] text-gi-warning">Duplicates do not stack.</p>
                    )}
                </div>
            )}

            {Object.keys(getProvidedTagsWithTiers(def)).length > 0 && <DrivesBlock def={def} />}
            {managedTypes(typeId)?.length > 0 && (
                <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2.5">
                    <Label>Restocks from the Vault</Label>
                    <p className="mt-1 text-[10px] text-gi-text">
                        {managedTypes(typeId).map(id => tokenName(id)).join(', ')}
                    </p>
                    <p className="mt-1 text-[9px] text-gi-muted">
                        Covers the 8 surrounding tiles, and never wears out.
                    </p>
                </div>
            )}

            {/* Split Vault and Value badges if SellControls is not shown */}
            {(!showSell || inVaultCount === 0) && !def.cannotLeaveBoard && !def.isGuildHall && inVaultCount > 0 && (
                <div className="flex items-center gap-2 text-xs pt-1">
                    <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                        <span className="text-gi-muted">Vault</span>
                        <span className="font-bold text-gi-text tabular-nums">{inVaultCount}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                        <span className="text-gi-muted">Value</span>
                        <span className="font-bold text-gi-gold tabular-nums">
                            {partialCharges != null && inVaultCount === 1
                                ? `${TokenBank.totalSellValue(typeId, 1)} (${value} full)`
                                : value}
                        </span>
                    </div>
                </div>
            )}

            {/* View in Vault action */}
            {showViewInVault && inVaultCount > 0 && (
                <div className="pt-2 border-t border-gi-border/40">
                    <button
                        onClick={() => EventBus.publish('ui:open_drawer', { tab: 'vault' })}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border font-bold text-xs md:text-sm uppercase tracking-wide transition-colors border-gi-primary/60 bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25 cursor-pointer active:scale-[0.99]"
                    >
                        <Vault size={14} className="text-gi-primary" /> View in Token Vault
                    </button>
                </div>
            )}

            {/* Sell controls — shared SellControls component with Vault/Value badges above quantity */}
            {showSell && inVaultCount > 0 && (
                <SellControls
                    title="Sell Tokens"
                    count={inVaultCount}
                    unitPrice={value}
                    getTotalPrice={(qty) => TokenBank.totalSellValue(typeId, qty)}
                    onSell={handleSell}
                    entityName="Token"
                    topContent={
                        !def.cannotLeaveBoard && !def.isGuildHall && (
                            <div className="flex items-center gap-2 text-xs">
                                <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                    <span className="text-gi-muted">Vault</span>
                                    <span className="font-bold text-gi-text tabular-nums">{inVaultCount}</span>
                                </div>
                                <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                    <span className="text-gi-muted">Value</span>
                                    <span className="font-bold text-gi-gold tabular-nums">
                                        {partialCharges != null && inVaultCount === 1
                                            ? `${TokenBank.totalSellValue(typeId, 1)} (${value} full)`
                                            : value}
                                    </span>
                                </div>
                            </div>
                        )
                    }
                />
            )}
        </div>
    );
};

const DetailLine = ({ label, value, highlight }) => (
    <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
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
    <span className="text-[9px] font-bold gi-caps tracking-widest text-gi-muted">{children}</span>
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
                    <span className="text-[9px] font-bold gi-caps tracking-wider text-gi-danger/80">
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

            {route.outputs.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold gi-caps tracking-wider text-gi-success/80">
                        Outputs:
                    </span>
                    {route.outputs.map((o, idx) => (
                        <EntityRibbon
                            key={`${o.itemId || o.currency}-${idx}`}
                            kind={o.currency ? 'gold' : 'item'}
                            id={o.currency ? 'gold' : o.itemId}
                            name={o.currency ? o.currency : undefined}
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
        <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2">
            <Label>{def.isTool ? 'Tool — unlocks' : 'Drives'}</Label>
            <p className="mt-1 text-[10px] text-gi-text">
                {driven.length ? driven.map(id => tokenName(id)).join(', ') : 'Nothing yet'}
            </p>
            <p className="mt-1 text-[9px] text-gi-muted">
                {/* D-113 + D-157: sharing is a rate trade, not free value. */}
                Serves every adjacent station, and wears once per cycle it serves.
            </p>
        </div>
    );
};

/** An output's quantity, as "2" or as "2–4". Works for items and currency alike. */
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
