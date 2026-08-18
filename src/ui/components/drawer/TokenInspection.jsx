import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    getTokenType, getAllTokenTypes, tokenName, productionRoutes
} from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { listMaps } from '../../../config/registries/mapRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { Clock, Zap, ArrowRight, Layers, Swords, Map as MapIcon, Vault } from 'lucide-react';

import { SellControls } from './SellControls.jsx';

/**
 * TokenInspection — a Token's full detail, wherever it sits.
 *
 * ## Why this is load-bearing rather than a nicety (D-145)
 * **Hero-time is the scarce resource.** A player must never have to spend a
 * tile *and* a hero to discover what something does — planning happens before
 * placement, so the same sheet has to be reachable from the Vault, the Tray,
 * the Cartographer's pool and the board alike.
 *
 * It carries a second job the design leans on hard: **pairings.** Adjacency's
 * real work is definition, not amplification (D-18) — a Smelter with no Mould
 * beside it makes nothing at all — and a player who cannot see what drives what
 * has no way to discover that except by trial. So a station names the context
 * that unlocks each recipe, and a context Token names what it drives.
 *
 * And a third, from D-159: **where to get another one.** Every Map that pools
 * this Token is listed, which is what turns a depleted board into a shopping
 * list rather than a guess.
 */
export const TokenInspection = ({ typeId, showSell = true, showAddToTray = true, showViewInVault = false }) => {
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
        <div className="p-3 flex flex-col gap-3">
            {/* Identity */}
            <div className="flex items-center gap-3">
                <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.INSPECT} alt={def.name} />
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gi-text truncate">{tokenName(typeId)}</div>
                    <div className="flex items-center gap-2 text-[9px] gi-caps tracking-wider">
                        {/* Rarity means DROP FREQUENCY and nothing else (D-175). */}
                        {def.rarity && (
                            <span className={RARITY_TONE[def.rarity] || RARITY_TONE.common}>{def.rarity}</span>
                        )}
                        {def.theme && <span className="text-gi-muted">{def.theme}</span>}
                    </div>
                </div>
            </div>

            {/* In Vault & Sell Value details */}
            <div className="flex flex-col gap-1.5 pt-1">
                <DetailLine label="In vault" value={inVaultCount.toLocaleString()} />
                <DetailLine
                    label="Sell value"
                    value={
                        partialCharges != null && inVaultCount === 1
                            ? `${TokenBank.totalSellValue(typeId, 1)} gold (${value}g full)`
                            : `${value} gold`
                    }
                />
            </div>

            {/* Charges */}
            <Row icon={Layers} label="Charges">
                {def.uses == null ? (
                    <span className="text-gi-success">Unlimited</span>
                ) : (
                    <>
                        {def.uses.toLocaleString()} uses
                        {partialCharges != null && (
                            <span className="text-gi-warning font-semibold">
                                {' '}· {partialCharges.toLocaleString()} left in partial
                            </span>
                        )}
                    </>
                )}
            </Row>

            {def.config?.cycleTimeMs && (
                <Row icon={Clock} label="Cycle">{(def.config.cycleTimeMs / 1000).toFixed(0)}s</Row>
            )}

            {/* ACCESS — the one hero property that reaches the board (D-67). */}
            {def.config?.skillRequired > 0 && (
                <Row icon={Zap} label="Needs">
                    {def.config.skill} <span className="text-gi-primary">lv {def.config.skillRequired}</span>
                </Row>
            )}

            {def.requiresHero === false && (
                <p className="text-[10px] text-gi-info">
                    Works with no hero — and deliberately far slower than the same job staffed.
                </p>
            )}

            {enemy && (
                <Row icon={Swords} label="Enemy">
                    {enemy.name} <span className="text-gi-muted">lv {enemy.level}</span>
                </Row>
            )}

            {/* What it makes, per route. A station with two recipes shows both. */}
            {routes.map((route, i) => (
                <RouteBlock key={route.id || i} route={route} />
            ))}

            {/* Buffs describe themselves */}
            {def.buff && (
                <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2">
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

            {def.provides?.length > 0 && <DrivesBlock def={def} />}
            {def.manages?.length > 0 && (
                <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2">
                    <Label>Restocks from the Vault</Label>
                    <p className="mt-1 text-[10px] text-gi-text">
                        {def.manages.map(id => tokenName(id)).join(', ')}
                    </p>
                    <p className="mt-1 text-[9px] text-gi-muted">
                        Covers the 8 surrounding tiles, and never wears out.
                    </p>
                </div>
            )}

            <SourceMaps typeId={typeId} />

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

            {/* Add to Tray action */}
            {showAddToTray && inVaultCount > 0 && (
                <div className="pt-2 border-t border-gi-border/40">
                    <button
                        onClick={handleAddToTray}
                        disabled={trayFull}
                        title={trayFull ? 'The Tray is full' : 'Move one copy to the Tray'}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded border font-bold text-xs md:text-sm uppercase tracking-wide transition-colors',
                            trayFull
                                ? 'border-gi-border/40 bg-gi-base/40 text-gi-muted/40 cursor-not-allowed'
                                : 'border-gi-primary/60 bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25 active:scale-[0.99]'
                        )}
                    >
                        <ArrowRight size={14} className="text-gi-primary" /> Add to Tray
                    </button>
                </div>
            )}

            {/* Sell controls — shared SellControls component */}
            {showSell && inVaultCount > 0 && (
                <SellControls
                    title="Sell Tokens"
                    count={inVaultCount}
                    unitPrice={value}
                    getTotalPrice={(qty) => TokenBank.totalSellValue(typeId, qty)}
                    onSell={handleSell}
                    entityName="Token"
                />
            )}
        </div>
    );
};

const DetailLine = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
        <span className="text-gi-muted">{label}</span>
        <span className="text-gi-text font-bold capitalize tabular-nums">{value}</span>
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

const Row = ({ icon: Icon, label, children }) => (
    <div className="flex items-baseline gap-2 text-[10px]">
        <Icon size={11} className="text-gi-primary shrink-0 translate-y-0.5" />
        <span className="text-gi-muted w-14 shrink-0">{label}</span>
        <span className="text-gi-text">{children}</span>
    </div>
);

/** One way this Token can produce: its cost, its output, and what unlocks it. */
const RouteBlock = ({ route }) => {
    const hasIO = route.inputs.length > 0 || route.outputs.length > 0;
    if (!hasIO) return null;

    return (
        <div className="rounded border border-gi-border/40 bg-gi-base/40 p-2">
            {route.requiresContext.length > 0 ? (
                <Label>Needs beside it: {route.requiresContext.map(contextName).join(' + ')}</Label>
            ) : (
                <Label>{route.id ? `Recipe: ${route.id}` : 'Produces'}</Label>
            )}

            <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[10px]">
                {route.inputs.length > 0 && (
                    <span className="text-gi-danger/90">
                        {route.inputs.map(i => `${i.quantity}× ${itemName(i.itemId)}`).join(', ')}
                    </span>
                )}
                {route.inputs.length > 0 && route.outputs.length > 0 && (
                    <ArrowRight size={10} className="text-gi-muted shrink-0" />
                )}
                <span className="text-gi-success">
                    {route.outputs.map(o => (
                        o.currency
                            ? `${o.quantity} gold`
                            : `${o.quantity}× ${itemName(o.itemId)}${o.chance < 100 ? ` (${o.chance}%)` : ''}`
                    )).join(', ')}
                </span>
            </div>

            {route.inputs.length === 0 && route.outputs.length > 0 && (
                <p className="mt-1 text-[9px] text-gi-muted">Costs nothing to run.</p>
            )}
        </div>
    );
};

/** For a context Token: which stations it unlocks, and whether it is a tool. */
const DrivesBlock = ({ def }) => {
    const tags = new Set(def.provides);
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

/**
 * Which Maps yield this Token (D-159).
 */
const SourceMaps = ({ typeId }) => {
    const sources = listMaps().filter(m => m.pool.some(e => e.kind === 'token' && e.refId === typeId));
    if (!sources.length) return null;

    return (
        <div className="flex items-baseline gap-2 text-[10px] pt-1 border-t border-gi-border/30">
            <MapIcon size={11} className="text-gi-primary shrink-0 translate-y-0.5" />
            <span className="text-gi-muted w-14 shrink-0">Found in</span>
            <span className="text-gi-text">{sources.map(m => m.name).join(', ')}</span>
        </div>
    );
};

const itemName = (itemId) => getItem(itemId)?.name || itemId;

/** The Token that supplies a context tag, named rather than shown as an id. */
function contextName(tag) {
    const all = getAllTokenTypes();
    const provider = Object.keys(all).find(id => (all[id].provides || []).includes(tag));
    return provider ? tokenName(provider) : tag;
}

export default TokenInspection;
