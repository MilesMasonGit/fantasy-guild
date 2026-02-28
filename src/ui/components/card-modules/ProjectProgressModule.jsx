import React from 'react';
import { Package } from 'lucide-react';
import GIProgressBar from '../base/GIProgressBar.jsx';
import { cn } from '../../utils/cn.js';
// import { getItem } from '../../../config/registries/itemRegistry.js'; // Will be used in production
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
    let icon = <Package size={14} className="text-gray-400" />;

    // Resolve Name and Icon (Specific Item vs Tag)
    if (itemKey.startsWith('tag:')) {
        const tag = itemKey.substring(4);
        itemName = `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
        const fallbackStr = getTagIconUrl(tag);
        if (fallbackStr) {
            icon = <span className="text-[14px] leading-none">{fallbackStr}</span>;
        }
    } else {
        const itemDef = getItemDef ? getItemDef(itemKey) : null;
        if (itemDef) {
            itemName = itemDef.name || itemKey;
            // Native fallback for when asset paths aren't loaded in test module
            icon = itemDef.icon ? <span className="text-[14px] leading-none">{itemDef.icon}</span> : icon;
        }
    }

    const isComplete = current >= required;
    const inventoryCount = getInventoryCount ? getInventoryCount(itemKey) : 0;

    return (
        <div className={cn(
            "flex flex-col gap-1 p-2 rounded-md border",
            isComplete ? "bg-gi-accent/10 border-gi-accent/30 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "bg-black/20 border-white/5"
        )}>
            {/* Header: Icon + Name ... Current / Required */}
            <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-1.5 font-pixel text-gray-200">
                    <div className="w-4 h-4 flex items-center justify-center bg-black/40 rounded-sm">
                        {icon}
                    </div>
                    <span className="truncate max-w-[100px]" title={itemName}>{itemName}</span>
                </div>
                <span className={cn(
                    "font-mono",
                    isComplete ? "text-gi-accent font-bold" : "text-gray-400"
                )}>
                    {current}/{required}
                </span>
            </div>

            {/* The Actual Progress Bar */}
            <GIProgressBar
                current={current}
                max={required}
                // When complete, switch to accent (yellow 'gold'), otherwise standard primary cyan
                color={isComplete ? 'accent' : 'primary'}
                height="sm"
                showText={false}
            />

            {/* Reference Data */}
            <div className="text-[9px] text-gray-500 italic mt-0.5">
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
export const ProjectProgressModule = ({
    progressData,
    showTitle = true,
    getInventoryCount,
    getItemDef,
    className
}) => {
    if (!progressData) return null;

    const { inputProgress, requirements, percentComplete = 0 } = progressData;

    // Resolve what to map. Progress data overrides raw requirements.
    const itemsToRender = inputProgress || {};
    const entrySource = (Object.keys(itemsToRender).length > 0)
        ? itemsToRender
        : mapRequirementsToZero(requirements);

    const keys = Object.keys(entrySource);
    if (keys.length === 0) return null;

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-1", className)}>
            {showTitle && (
                <div className="flex justify-between items-center border-b border-white/10 pb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                        Project Goals
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gi-primary">
                        Progress: {percentComplete}%
                    </span>
                </div>
            )}

            <div className="flex flex-col gap-1.5 w-full">
                {keys.map((key) => (
                    <ProgressRow
                        key={key}
                        itemKey={key}
                        data={entrySource[key]}
                        getInventoryCount={getInventoryCount}
                        getItemDef={getItemDef}
                    />
                ))}
            </div>
        </div>
    );
};

export default ProjectProgressModule;
