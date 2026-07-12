import React from 'react';
import {
    Leaf, Hammer, Sword, Swords, Factory, Apple,
    AlertTriangle, Filter, TrendingUp, TrendingDown, CircleAlert,
    User, Layers, HeartCrack
} from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { BANNER_BADGE_ROW_H } from '../banner/BannerLayout.jsx';

/**
 * CardBadges — round, at-a-glance info badges shown in a row BELOW a card.
 *
 * Two jobs (owner 2026-07-10): (1) convey critical info at a glance, and
 * (2) teach via tooltips on hover. These are PLACEHOLDER round badges until
 * dedicated sprites are drawn. Tooltips are native `title` text for this pass —
 * a richer tooltip (the old build's GUTooltip, if ported) is a deferred
 * follow-up.
 *
 * Every banner card gets a badge row beneath it (owner 2026-07-10) — task cards,
 * plus the Hero and Deck cards. Taxonomy:
 *   - Type (one per card):  Gathering · Crafting · Combat · Station · Consumable
 *                           · Hero · Deck
 *   - Info (stackable):     Combat-encounter · Hazard · Specialized-slot ·
 *                           Boosted · Debuffed · Missing-requirement · Injured
 */

// --- Badge definitions: icon + tone + tutorial copy --------------------------

const DEF = {
    // Type
    gathering:  { icon: Leaf,          tone: 'emerald', label: 'Gathering',   desc: 'Collects raw materials from the wilds. Needs no input items — just a hero to work it.' },
    crafting:   { icon: Hammer,        tone: 'orange',  label: 'Crafting',    desc: 'Turns input materials into a finished item. Keep the inputs stocked in your Bank.' },
    combat:     { icon: Sword,         tone: 'red',     label: 'Combat',      desc: 'An enemy encounter. Assign a well-equipped hero to fight and collect the loot.' },
    station:    { icon: Factory,       tone: 'amber',   label: 'Station',     desc: 'A crafting facility. Switch to the Outpost view to pick a recipe and produce items.' },
    consumable: { icon: Apple,         tone: 'teal',    label: 'Consumable',  desc: 'A one-use item your hero can consume during the loop for a temporary boost.' },
    hero:       { icon: User,          tone: 'sky',     label: 'Hero',        desc: 'The hero assigned to this area. Their HP and Energy are shown on the card.' },
    deck:       { icon: Layers,        tone: 'violet',  label: 'Deck',        desc: 'The area deck. Click it to configure which cards the loop draws from.' },
    // Info
    encounter:  { icon: Swords,        tone: 'red',     label: 'Encounter',   desc: 'This task can trigger a fight — bring a hero who can hold their own.' },
    hazard:     { icon: AlertTriangle, tone: 'orange',  label: 'Hazard',      desc: "An environmental danger that chips away at your hero's HP on every pass." },
    specialized:{ icon: Filter,        tone: 'sky',     label: 'Specialized', desc: 'This slot only accepts cards with a matching tag.' },
    boosted:    { icon: TrendingUp,    tone: 'green',   label: 'Boosted',     desc: 'A bonus is currently speeding up or improving this card.' },
    debuffed:   { icon: TrendingDown,  tone: 'rose',    label: 'Debuffed',    desc: 'A penalty is currently slowing down or weakening this card.' },
    missing:    { icon: CircleAlert,   tone: 'yellow',  label: 'Needs setup', desc: "Can't run yet — it's missing a required tool or input." },
    injured:    { icon: HeartCrack,    tone: 'red',     label: 'Injured',     desc: 'This hero is hurt and must recover at the Outpost before adventuring again.' },
};

// Tone → colour classes for the placeholder round badge (dark disc + coloured ring/icon).
const TONE = {
    emerald: 'border-emerald-400/70 text-emerald-300',
    orange:  'border-orange-400/70 text-orange-300',
    red:     'border-red-400/70 text-red-300',
    amber:   'border-amber-400/70 text-amber-300',
    teal:    'border-teal-400/70 text-teal-300',
    sky:     'border-sky-400/70 text-sky-300',
    green:   'border-green-400/70 text-green-300',
    rose:    'border-rose-400/70 text-rose-300',
    yellow:  'border-yellow-400/70 text-yellow-300',
    violet:  'border-violet-400/70 text-violet-300',
};

// --- Derivation --------------------------------------------------------------

/**
 * Derive the badge id list for a task/station/combat/consumable card from its
 * template (+ live instance state). Reworked from the previous build's
 * BadgeGutter heuristics. Returns an ordered array (type first, then info).
 */
export function deriveCardBadgeIds(template, cardState = null) {
    if (!template) return [];
    const ids = [];
    const traits = template.traits || [];
    const configOutputs = template.config?.outputs || [];

    const isStation = template.cardType === 'station'
        || traits.some(t => t.type === 'recipe_selector' || t.type === 'dynamic_inputslots');
    const isConsumable = template.cardType === 'consumable';
    const hasInputs = traits.some(t => t.type === 'inputslot') || (template.inputs?.length > 0);
    const hasEncounter = traits.some(t => t.type === 'combat')
        || !!template.config?.enemyId
        || configOutputs.some(o => o.type === 'combat_trigger' || o.type === 'encounter' || o.type === 'enemy');
    const isPureCombat = template.cardType === 'combat'
        || !!template.config?.enemyId
        || configOutputs.some(o => o.type === 'combat_trigger' && (o.chance ?? 100) >= 100);
    const hasNonEncounterOutputs = (template.outputs || configOutputs).some(o => o.type !== 'combat_trigger' && o.type !== 'encounter' && o.type !== 'enemy')
        || traits.some(t => t.type === 'loot' || t.type === 'yield' || t.type === 'production');
    const isCrafting = hasInputs && !isStation;
    const isGathering = !hasInputs && !isStation && !isPureCombat && hasNonEncounterOutputs;

    // Primary type — exactly one, by priority.
    if (isStation) ids.push('station');
    else if (isPureCombat) ids.push('combat');
    else if (isConsumable) ids.push('consumable');
    else if (isCrafting) ids.push('crafting');
    else if (isGathering) ids.push('gathering');

    // Info — stackable.
    if (hasEncounter && !isPureCombat) ids.push('encounter');
    if (template.cardType === 'hazard' || template.isHazard || traits.some(t => t.type === 'hazard')) ids.push('hazard');
    if (cardState?.specializedTags?.length || template.specializedTags?.length) ids.push('specialized');
    // Boosted / Debuffed come from the area modifier aggregator — wired in a
    // later pass when that context is threaded to the card (owner-deferred).
    if (cardState?.missingRequirements?.length) ids.push('missing');

    return ids;
}

/** Badge ids for the Hero card. */
export function deriveHeroBadgeIds({ injured = false } = {}) {
    return ['hero', ...(injured ? ['injured'] : [])];
}

/** Badge ids for the area Deck card. */
export function deriveDeckBadgeIds({ hasHazard = false } = {}) {
    return ['deck', ...(hasHazard ? ['hazard'] : [])];
}

// --- Components --------------------------------------------------------------

const SIZE_PX = { sm: 22, md: 30, lg: 36 };

/** A single round placeholder badge (dark disc + coloured ring + icon). */
export const CardBadge = ({ def, px = 30 }) => {
    const Icon = def.icon;
    const tone = TONE[def.tone] || TONE.emerald;
    return (
        <div
            title={`${def.label} — ${def.desc}`}
            style={{ width: px, height: px }}
            className={cn(
                'rounded-full bg-black/75 border-2 flex items-center justify-center shadow-md pointer-events-auto shrink-0',
                tone
            )}
        >
            <Icon size={Math.round(px * 0.55)} strokeWidth={2.25} />
        </div>
    );
};

/**
 * BadgeRow — the horizontal strip of badges rendered directly below a card.
 * Fixed height (BANNER_BADGE_ROW_H) so every card cell stays the same size and
 * the regular row / focus views keep matching heights. `size` is the card tier
 * ('sm' | 'md' | 'lg') so badges scale with the card.
 */
export const BadgeRow = ({ ids = [], size = 'md' }) => {
    const px = SIZE_PX[size] || SIZE_PX.md;
    return (
        <div
            className="flex items-center justify-center gap-1.5 pt-1.5 shrink-0"
            style={{ height: BANNER_BADGE_ROW_H }}
        >
            {ids.map(id => DEF[id] && <CardBadge key={id} def={DEF[id]} px={px} />)}
        </div>
    );
};

export default BadgeRow;
