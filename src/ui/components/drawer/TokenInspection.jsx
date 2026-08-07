import React from 'react';
import { cn } from '../../utils/cn.js';
import {
    getTokenType, getAllTokenTypes, tokenName, tokenSpritePath, productionRoutes
} from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { listMaps } from '../../../config/registries/mapRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { Clock, Zap, Package, ArrowRight, Layers, Swords, Map as MapIcon } from 'lucide-react';

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
export const TokenInspection = ({ typeId }) => {
    const def = getTokenType(typeId);
    if (!def) return null;

    const routes = productionRoutes(typeId);
    const art = tokenSpritePath(typeId);
    const enemy = def.enemyId ? getEnemy(def.enemyId) : null;

    return (
        <div className="p-3 flex flex-col gap-3">
            {/* Identity */}
            <div className="flex items-center gap-3">
                {art && (
                    <img
                        src={art}
                        alt={def.name}
                        draggable={false}
                        style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
                    />
                )}
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gi-text truncate">{tokenName(typeId)}</div>
                    <div className="flex items-center gap-2 text-[9px] gi-caps tracking-wider">
                        {/* Rarity means DROP FREQUENCY and nothing else (D-175).
                            Never a power tier — a Common Riverlands producer far
                            outproduces a Rare Woodland one. */}
                        {def.rarity && (
                            <span className={RARITY_TONE[def.rarity] || RARITY_TONE.common}>{def.rarity}</span>
                        )}
                        {def.theme && <span className="text-gi-muted">{def.theme}</span>}
                    </div>
                </div>
            </div>

            {/* Charges — a statement about unattended runtime, not durability. */}
            <Row icon={Layers} label="Charges">
                {def.uses == null
                    ? <span className="text-gi-success">Unlimited</span>
                    : <>{def.uses.toLocaleString()} uses{cycleHours(def) && <span className="text-gi-muted"> · ~{cycleHours(def)} unattended</span>}</>}
            </Row>

            {def.config?.cycleTimeMs && (
                <Row icon={Clock} label="Cycle">{(def.config.cycleTimeMs / 1000).toFixed(0)}s</Row>
            )}

            {/* ACCESS — the one hero property that reaches the board (D-67).
                Stated plainly because it is the only thing that can refuse a
                hero outright, and a player needs to know before they place. */}
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

            {/* What it makes, per route. A station with two recipes shows both,
                each with the context that unlocks it. */}
            {routes.map((route, i) => (
                <RouteBlock key={route.id || i} route={route} />
            ))}

            {/* Buffs describe themselves — the numbers are deliberately tiny
                (D-119/D-120), so saying so avoids the player hunting for a
                bigger effect that was never there. */}
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
        </div>
    );
};

/** Roughly how long this Token's charges last if worked continuously. */
function cycleHours(def) {
    const cycle = def.config?.cycleTimeMs;
    if (!cycle || def.uses == null) return null;
    const hours = (def.uses * cycle) / 3600000;
    return hours >= 1 ? `${Math.round(hours)}h` : `${Math.round(hours * 60)}m`;
}

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
 *
 * The half of the design that turns a depleted board into a shopping list: a
 * player short of Groves can see exactly which Map to buy, which is the main
 * answer to bursts being random with no reliability guarantee (D-154).
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
