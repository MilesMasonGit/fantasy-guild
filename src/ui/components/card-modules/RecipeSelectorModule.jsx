import React, { useState } from 'react';
import { getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { Search, ArrowRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { cn } from '../../utils/cn.js';

export const RecipeSelectorModule = React.memo(({ card, trait }) => {
    const engine = useEngine();
    const [search, setSearch] = useState('');
    const [expandedRecipeId, setExpandedRecipeId] = useState(null);

    // Get station's subskillId and skillCap
    const subskillId = trait?.recipeGroup || card?.config?.recipeGroup;
    const skillCap = card?.config?.skillCap || 90;
    
    // Fetch all recipes for this subskill
    const recipes = getRecipesBySubskill(subskillId);

    // Read the hero's subskill level to display warnings / constraints
    const assignedHeroId = card?.assignedHeroId;
    const hero = useGameState(
        state => (state.heroes || []).find(h => h.id === assignedHeroId),
        ['heroes_updated']
    );
    
    // Find hero level in this specific subskill (or fallback to parent skill)
    const heroSkillLevel = hero ? (hero.skills?.[subskillId] || hero.skills?.[card?.config?.skill] || 1) : 1;

    // Filter recipes based on search
    const filteredRecipes = recipes.filter(recipe => {
        return recipe.name.toLowerCase().includes(search.toLowerCase());
    });

    const handleAutoFillIngredients = (recipe, e) => {
        e.stopPropagation();
        if (!engine || !engine.CardManager) return;

        // Reset current slot assignments
        if (card.assignedItems) {
            Object.keys(card.assignedItems).forEach(slotIndex => {
                engine.CardManager.unassignItemFromSlot(card.id, slotIndex);
            });
        }

        // Auto fill inputs for this recipe
        const inputs = recipe.inputs || [];
        inputs.forEach((input, index) => {
            const itemId = input.itemId;
            const qty = input.quantity || 1;
            if (itemId) {
                engine.CardManager.assignItemToSlot(card.id, index, itemId);
                // Also update the quantity in state if needed
                const cardRef = engine.CardManager.getCard(card.id);
                if (cardRef && cardRef.assignedItems?.[index]) {
                    cardRef.assignedItems[index].amount = qty;
                }
            }
        });
        
        // Mark selected recipe
        engine.CardManager.publishCardUpdate(card.id, {
            selectedRecipeId: recipe.id,
            activeRecipe: recipe
        });

        engine.EventBus?.publish('audio:play', { clip: 'assign', type: 'ui' });
    };

    return (
        <div className="flex flex-col gap-2 w-full mt-1 max-h-[220px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Search Bar */}
            <div className="relative flex items-center bg-black/40 border border-white/10 rounded-lg px-2 py-1 flex-shrink-0">
                <Search className="w-3.5 h-3.5 text-gi-muted mr-1.5" />
                <input 
                    type="text" 
                    placeholder="Search recipes..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent border-none text-[11px] text-white outline-none w-full placeholder-gi-muted p-0"
                />
            </div>

            {/* Recipes List */}
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-1">
                {filteredRecipes.length === 0 ? (
                    <div className="text-center text-[10px] text-gi-muted py-4">No recipes found.</div>
                ) : (
                    filteredRecipes.map(recipe => {
                        const isOverCap = recipe.levelRequirement > skillCap;
                        const isHeroUnderLevel = recipe.levelRequirement > heroSkillLevel;
                        const isExpanded = expandedRecipeId === recipe.id;
                        
                        // Get output item definition
                        const outputItem = recipe.outputs?.[0] ? getItem(recipe.outputs[0].itemId) : null;
                        const isSelected = card.selectedRecipeId === recipe.id;

                        return (
                            <div 
                                key={recipe.id}
                                className={cn(
                                    "flex flex-col border rounded-lg bg-black/30 overflow-hidden transition-all duration-200",
                                    isSelected ? "border-amber-500/60 bg-amber-500/5" : "border-white/5 hover:border-white/15",
                                    isOverCap ? "opacity-60" : ""
                                )}
                            >
                                {/* Main entry bar */}
                                <div 
                                    onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                                    className="flex items-center justify-between p-1.5 cursor-pointer"
                                >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <ItemIcon item={outputItem || recipe.outputs?.[0]?.itemId} size={28} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold text-white truncate leading-tight">
                                                {recipe.name}
                                            </span>
                                            <span className="text-[9px] text-gi-muted leading-none">
                                                Req. Lvl {recipe.levelRequirement}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        {!isOverCap && (
                                            <button
                                                onClick={(e) => handleAutoFillIngredients(recipe, e)}
                                                className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 text-[10px] font-bold flex items-center gap-0.5"
                                                title="Auto fill ingredients"
                                            >
                                                <span>Fill</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gi-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-gi-muted" />}
                                    </div>
                                </div>

                                {/* Ingredient details (Collapsible) */}
                                {isExpanded && (
                                    <div className="px-2 pb-2 pt-1 border-t border-white/5 bg-black/20 flex flex-col gap-1.5">
                                        <div className="text-[9px] uppercase tracking-wider text-gi-muted font-bold">Ingredients:</div>
                                        <div className="flex flex-col gap-1">
                                            {(recipe.inputs || []).map((input, idx) => {
                                                const ingredient = input.itemId ? getItem(input.itemId) : null;
                                                const label = ingredient ? ingredient.name : (input.tag || "Unknown");
                                                return (
                                                    <div key={idx} className="flex items-center justify-between text-[10px]">
                                                        <div className="flex items-center gap-1 text-white">
                                                            <span>•</span>
                                                            <span>{label}</span>
                                                        </div>
                                                        <span className="text-gi-primary font-bold">x{input.quantity}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {isOverCap && (
                                            <div className="flex items-center gap-1 text-[9px] text-red-400 mt-1">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                <span>Exceeds station cap ({skillCap})</span>
                                            </div>
                                        )}
                                        {isHeroUnderLevel && !isOverCap && hero && (
                                            <div className="flex items-center gap-1 text-[9px] text-amber-400 mt-1">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                <span>Hero level too low ({heroSkillLevel} / {recipe.levelRequirement})</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Skill Cap Warning Footer */}
            <div className="p-1.5 border-t border-white/5 bg-black/40 text-[9px] text-amber-500/80 flex items-center gap-1 flex-shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Supports {subskillId?.replace('subskill_', '')?.toUpperCase()} up to level {skillCap}.</span>
            </div>
        </div>
    );
});

export default RecipeSelectorModule;
