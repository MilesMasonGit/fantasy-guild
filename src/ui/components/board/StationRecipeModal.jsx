import React from 'react';
import { Lock, Users, Check } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { GIModal } from '../base/GIModal.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { BAND } from '../../../systems/board/RecipeBands.js';

/** An item's display name, falling back to its id so an unauthored item still reads. */
export const itemLabel = (itemId) => getItem(itemId)?.name || itemId;

/** A skill's display name, falling back to its id. */
export const skillLabel = (skillId) => getSkill(skillId)?.name || skillId || 'Unknown';

/** "2× Oak Wood, 1× Wheat" — a recipe's item inputs in one line, or null. */
export function inputSummary(recipe) {
    const parts = (recipe?.inputs || []).map(i => `${i.quantity ?? 1}× ${itemLabel(i.itemId)}`);
    return parts.length ? parts.join(', ') : null;
}

/** "Anvil (tier 1)" — the context Tokens a recipe needs beside it, or null. */
export function contextSummary(recipe) {
    const parts = (recipe?.requiresContext || []).map(c => (
        c.minTier ? `${c.tag} (tier ${c.minTier})` : c.tag
    ));
    return parts.length ? parts.join(', ') : null;
}

/** "1× Charcoal" — a recipe's outputs, chances included when they are not certain. */
export function outputSummary(recipe) {
    const parts = (recipe?.outputs || []).map(o => {
        const min = o.minQty ?? 1;
        const max = o.maxQty ?? min;
        const qty = min === max ? `${min}` : `${min}–${max}`;
        const chance = (o.chance == null || o.chance >= 100) ? '' : ` (${o.chance}%)`;
        return `${qty}× ${itemLabel(o.itemId)}${chance}`;
    });
    return parts.length ? parts.join(', ') : null;
}

/** A horizontal rule naming a level threshold, between two bands. */
const ThresholdMarker = ({ label, level, tone }) => (
    <div className="flex items-center gap-2 py-1" data-threshold={tone}>
        <div className={cn('h-px flex-1', tone === 'worker' ? 'bg-gi-primary/50' : 'bg-gi-muted/40')} />
        <span className={cn(
            'text-[10px] uppercase tracking-wide font-bold whitespace-nowrap',
            tone === 'worker' ? 'text-gi-primary' : 'text-gi-muted'
        )}>
            {label} · level {level}
        </span>
        <div className={cn('h-px flex-1', tone === 'worker' ? 'bg-gi-primary/50' : 'bg-gi-muted/40')} />
    </div>
);

/** One recipe line. Disabled only in the locked band — see `BAND`. */
const RecipeRow = ({ row, isSelected, onSelect }) => {
    const { recipe, band, level, selectable } = row;
    const inputs = inputSummary(recipe);
    const context = contextSummary(recipe);
    const outputs = outputSummary(recipe);
    const firstOutput = recipe.outputs?.[0]?.itemId;

    return (
        <button
            type="button"
            disabled={!selectable}
            data-recipe-id={recipe.id}
            data-recipe-band={band}
            onClick={() => selectable && onSelect?.(recipe.id)}
            className={cn(
                'w-full flex items-start gap-3 p-2 rounded border text-left transition-colors',
                isSelected
                    ? 'border-gi-primary bg-gi-primary/10'
                    : 'border-gi-border/60 bg-gi-surface/30',
                selectable ? 'hover:border-gi-primary/70 cursor-pointer' : 'opacity-50 cursor-not-allowed'
            )}
        >
            {firstOutput && <ItemIcon item={firstOutput} size={32} className="shrink-0" />}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gi-text text-sm truncate">{recipe.name || recipe.id}</span>
                    <span className="text-[10px] text-gi-muted whitespace-nowrap">Lv {level}</span>
                    {isSelected && <Check size={14} className="text-gi-primary shrink-0" />}
                </div>
                <div className="text-[11px] text-gi-muted truncate">
                    {outputs ? `Makes ${outputs}` : 'Makes nothing'}
                    {inputs ? ` · Needs ${inputs}` : ''}
                    {context ? ` · Beside ${context}` : ''}
                </div>
                {band === BAND.GUILD && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-300 mt-0.5">
                        <Users size={11} /> A more skilled guild member can run this
                    </div>
                )}
                {band === BAND.LOCKED && (
                    <div className="flex items-center gap-1 text-[10px] text-gi-muted mt-0.5">
                        <Lock size={11} /> Requires level {level} — no one in the guild has it yet
                    </div>
                )}
            </div>
        </button>
    );
};

/**
 * The station recipe picker (concept §2.2).
 *
 * Rows come banded and level-ordered from `RecipeBands.bandStationRecipes`; the
 * two threshold markers are drawn between the bands regardless of whether the
 * bands around them have rows, so the worker's and the guild's levels are
 * always legible — with the three-recipe corpus most bands are empty, and a
 * marker that vanished with its band would leave nothing to read.
 */
export const StationRecipeModal = ({ isOpen, onClose, tokenName, banding, selectedRecipeId, onSelect }) => {
    const { skill, workerLevel, guildLevel, rows } = banding || { rows: [] };
    const byBand = (band) => (rows || []).filter(r => r.band === band);

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title={tokenName || 'Station'} maxWidth="max-w-lg">
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1" data-recipe-modal>
                <div className="text-xs text-gi-muted">
                    {skillLabel(skill)} recipes
                </div>

                {!rows?.length ? (
                    <div className="text-sm text-gi-muted py-6 text-center" data-recipe-empty>
                        No {skillLabel(skill)} recipes have been authored yet. This station
                        has nothing to select.
                    </div>
                ) : (
                    <>
                        {byBand(BAND.WORKER).map(row => (
                            <RecipeRow key={row.recipe.id} row={row} isSelected={row.recipe.id === selectedRecipeId} onSelect={onSelect} />
                        ))}
                        <ThresholdMarker label="Worker" level={workerLevel} tone="worker" />
                        {byBand(BAND.GUILD).map(row => (
                            <RecipeRow key={row.recipe.id} row={row} isSelected={row.recipe.id === selectedRecipeId} onSelect={onSelect} />
                        ))}
                        <ThresholdMarker label="Guild best" level={guildLevel} tone="guild" />
                        {byBand(BAND.LOCKED).map(row => (
                            <RecipeRow key={row.recipe.id} row={row} isSelected={row.recipe.id === selectedRecipeId} onSelect={onSelect} />
                        ))}
                    </>
                )}
            </div>
        </GIModal>
    );
};

export default StationRecipeModal;
