import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { Package, ArrowUpCircle } from 'lucide-react';
import ProgressBar from '../base/ProgressBar.jsx';
import ItemIcon from '../base/ItemIcon.jsx';
import { cn } from '../../utils/cn.js';
import { getItem, getCard } from '../../../config/registries/index.js';
// import { InventoryManager } from '../../../systems/inventory/InventoryManager.js'; // Decoupled: now passed as props

/**
 * Helper: Map simple requirement object to progress object structure
 * (Handles the 'zero progress' initial state)
 */
function mapRequirementsToZero(requirements) {
    if (!requirements) return {};
    const result = {};
    for (const [key, req] of Object.entries(requirements)) {
        result[key] = { current: 0, required: req };
    }
    return result;
}

/**
 * Predefined fallback icons based on generic tag types
 */
const getTagIconUrl = (tag) => {
    const icons = {
        'ore': '⛏️', 'fuel': '🔥', 'wood': '🪵', 'stone': '🪨',
        'metal': '⚙️', 'key': '🗝️'
    };
    return icons[tag] || null;
};

/**
 * Renders a single resource progress bar row
 */
const ProgressRow = ({ itemKey, data, getInventoryCount, getItemDef }) => {
    const required = data.required !== undefined ? data.required : data;
    const current = data.current || 0;

    let itemName = itemKey;
    let icon;

    // Resolve Name
    if (itemKey.startsWith('tag:')) {
        const tag = itemKey.substring(4);
        itemName = `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
        const fallbackStr = getTagIconUrl(tag);
        icon = <ItemIcon item={fallbackStr || '📦'} size={16} />;
    } else {
        const itemDef = getItemDef ? getItemDef(itemKey) : null;
        if (itemDef) {
            itemName = itemDef.name || itemKey;
        }
        icon = <ItemIcon item={itemDef || itemKey} size={16} />;
    }

    const isComplete = current >= required;
    const inventoryCount = getInventoryCount ? getInventoryCount(itemKey) : 0;

    return (
        <div className={cn(
            "flex flex-col gap-1 p-2 rounded-md border",
            isComplete ? "bg-gi-accent/10 border-gi-accent/30 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "bg-black/20 border-white/5"
        )}>
            {/* Header: Icon + Name ... Current / Required */}
            <div className="flex justify-between items-center text-pixel-base">
                <div className="flex items-center gap-1.5 font-pixel text-gray-200">
                    <div className="w-4 h-4 flex items-center justify-center bg-black/40 rounded-sm">
                        {icon}
                    </div>
                    <span className="truncate max-w-[100px] uppercase font-bold" title={itemName}>{itemName}</span>
                </div>
                <span className={cn(
                    "font-mono",
                    isComplete ? "text-gi-accent font-bold" : "text-gray-400"
                )}>
                    {current}/{required}
                </span>
            </div>

            {/* The Actual Progress Bar */}
            <ProgressBar
                current={current}
                max={required}
                // When complete, switch to success (emerald), otherwise standard primary cyan
                color={isComplete ? 'success' : 'primary'}
                size="sm"
                showText={false}
                showBitDrift={false}
            />

            {/* Reference Data */}
            <div className="text-pixel-sm text-gray-500 italic mt-0.5">
                In inventory: {inventoryCount}
            </div>
        </div>
    );
};

/**
 * ProjectProgressModule
 * 
 * Renders a list of gradual progress bars for resource contributions in Project/Exploration cards, tracking `{current}/{required}` state per resource.
 *
 * @param {Object} props
 * @param {Object} props.progressData - { inputProgress: {}, requirements: {}, percentComplete: Number }
 * @param {Boolean} props.showTitle - Show the overall progress header?
 * @param {Function} props.getInventoryCount - Decoupled callback: (itemKey) => Number
 * @param {Function} props.getItemDef - Decoupled callback: (itemId) => Object
 */
export const ProjectProgressModule = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const engine = useEngine();

    // Support both direct props and registry-injected props
    const progressData = props.progressData || trait?.progressData || card?.progressData || trait;
    const showTitle = props.showTitle !== undefined ? props.showTitle : true;
    const className = props.className;

    // Use engine callbacks if not provided via props
    const getInventoryCount = props.getInventoryCount || ((itemKey) => {
        const itemId = itemKey.startsWith('tag:') ? null : itemKey;
        if (itemId) return engine.InventoryManager.getItemCount(itemId);
        return 0; // Tags hard to check without domain knowledge here
    });

    const getItemDef = props.getItemDef || ((itemId) => {
        return getItem(itemId);
    });

    // --- Tiered Project Logic ---
    const template = getCard(card.templateId);
    const projectState = engine.GameState.state.progress.projects?.[card.templateId] || { level: 0, inputProgress: {} };
    
    // Fallback for non-tiered projects or missing data
    if (!template?.tiers) {
        if (!progressData) return null;
        
        const { inputProgress, requirements, percentComplete = 0 } = progressData;
        const entrySource = (Object.keys(inputProgress || {}).length > 0)
            ? inputProgress
            : mapRequirementsToZero(requirements);
            
        const keys = Object.keys(entrySource);
        if (keys.length === 0) return null;

        return (
            <ProjectLayout 
                showTitle={showTitle} 
                percentComplete={percentComplete} 
                className={className} 
                keys={keys}
                entrySource={entrySource}
                getInventoryCount={getInventoryCount}
                getItemDef={getItemDef}
                currentLevel={0}
                totalTiers={1}
            />
        );
    }

    // --- Hybrid State Logic ---
    // Read directly from card mirror instead of reaching out to global state
    const inputProgress = card.inputProgress || {};
    const isReadyForUpgrade = !!card.isReadyForUpgrade;

    const currentLevel = (card.level !== undefined) ? card.level : 0;
    const currentTier = template.tiers[currentLevel];
    if (!currentTier) return null;

    const requirements = currentTier.requirements || {};

    // Map to UI source
    const entrySource = {};
    let totalGot = 0;
    let totalReq = 0;

    for (const [itemId, reqQty] of Object.entries(requirements)) {
        const gotQty = inputProgress[itemId] || 0;
        entrySource[itemId] = { current: gotQty, required: reqQty };
        totalGot += Math.min(gotQty, reqQty);
        totalReq += reqQty;
    }

    const percentComplete = totalReq > 0 ? Math.floor((totalGot / totalReq) * 100) : 0;
    const keys = Object.keys(entrySource);

    const handleUpgrade = () => {
        if (engine.ProjectManager?.levelUpProject) {
            engine.ProjectManager.levelUpProject(card.templateId);
        }
    };

    return (
        <ProjectLayout 
            showTitle={showTitle} 
            percentComplete={percentComplete} 
            className={className} 
            keys={keys}
            entrySource={entrySource}
            getInventoryCount={getInventoryCount}
            getItemDef={getItemDef}
            label={currentTier.label || `Level ${currentLevel}`}
            isReadyForUpgrade={isReadyForUpgrade}
            onUpgrade={handleUpgrade}
            nextLevel={currentLevel + 1}
            currentLevel={currentLevel}
            totalTiers={Object.keys(template.tiers || {}).length}
        />
    );
});

/**
 * Shared Layout for Project Progress
 */
const ProjectLayout = ({ showTitle, percentComplete, className, keys, entrySource, getInventoryCount, getItemDef, label, isReadyForUpgrade, onUpgrade, nextLevel, currentLevel, totalTiers }) => (
    <div className={cn("flex flex-col gap-2 w-full mt-1", className)}>
        {showTitle && (
            <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
                <span className="text-pixel-base uppercase font-bold tracking-widest text-[#6B7280]">
                    Tier {currentLevel + 1} out of {totalTiers}
                </span>
            </div>
        )}

        <div className="flex flex-col gap-1.5 w-full">
            {isReadyForUpgrade ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgrade) onUpgrade();
                    }}
                    className={cn(
                        "w-full py-4 px-2 rounded-lg border-2 border-yellow-400 group relative overflow-hidden transition-all active:scale-95 animate-pulse",
                        "bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-700 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
                        "flex flex-col items-center justify-center gap-1"
                    )}
                >
                    {/* Retro Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle className="text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" size={24} />
                        <span className="text-white font-pixel text-lg font-bold uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                            Upgrade Project
                        </span>
                    </div>
                    <span className="text-yellow-100 font-pixel text-[10px] uppercase tracking-tighter opacity-80">
                        Unlock Tier {nextLevel}
                    </span>
                </button>
            ) : (
                keys.map((key) => (
                    <ProgressRow
                        key={key}
                        itemKey={key}
                        data={entrySource[key]}
                        getInventoryCount={getInventoryCount}
                        getItemDef={getItemDef}
                    />
                ))
            )}
        </div>
    </div>
);

export default ProjectProgressModule;
