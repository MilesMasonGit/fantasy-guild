import React, { useMemo } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import * as CardManager from '../../systems/cards/CardManager.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';

/**
 * DropTableModal
 * Shows the % chance of tasks firing in a specific biome/area.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Is modal open?
 * @param {Function} props.onClose - Triggered when closed.
 * @param {string} props.cardId - The ID of the live area card.
 */
export const DropTableModal = ({ isOpen, onClose, cardId }) => {

    // Memoize the table calculations
    const { biome, tableData, titleStr } = useMemo(() => {
        if (!isOpen || !cardId) return { biome: null, tableData: [], titleStr: '' };

        const card = CardManager.getCard(cardId);
        if (!card || !card.biomeId) return { biome: null, tableData: [], titleStr: '' };

        const biomeDef = getBiome(card.biomeId);
        if (!biomeDef || !biomeDef.taskPool) return { biome: null, tableData: [], titleStr: '' };

        const totalWeight = biomeDef.taskPool.reduce((sum, entry) => sum + entry.weight, 0);

        const tableData = biomeDef.taskPool.map(entry => {
            const taskDef = getCard(entry.taskId);
            const chance = ((entry.weight / totalWeight) * 100).toFixed(0);

            if (!taskDef) {
                return {
                    id: entry.taskId,
                    icon: '?',
                    name: entry.taskId,
                    skill: 'Unknown',
                    outputsStr: 'Unknown',
                    chance
                };
            }

            const outputsStr = taskDef.outputs?.length > 0
                ? taskDef.outputs.map(o => `${o.quantity}x ${o.itemId}`).join(', ')
                : 'None';

            return {
                id: entry.taskId,
                icon: taskDef.icon || '📋',
                name: taskDef.name,
                skill: taskDef.skill || 'General',
                outputsStr,
                chance
            };
        });

        // Add modifier if present
        const titleStr = `${card.modifierName ? card.modifierName + ' ' : ''}${biomeDef.name} - Area Tasks`;

        return { biome: biomeDef, tableData, titleStr };
    }, [isOpen, cardId]);

    // Render nothing if not ready or not open
    // Since GIModal takes care of !isOpen returning null, we still need to pass it
    if (!isOpen) return null;

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title={titleStr || "Drop Table"}
            className="w-full max-w-2xl bg-gray-900 border-gi-primary/50 text-white"
        >
            {!biome ? (
                <div className="text-center text-gray-500 py-4">No drop table data available.</div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-gi-primary tracking-widest border-b border-white/10 pb-2 mb-2 px-2">
                        <div className="col-span-1 text-center">Icon</div>
                        <div className="col-span-4">Task</div>
                        <div className="col-span-5">Outputs</div>
                        <div className="col-span-2 text-right">Chance</div>
                    </div>

                    <div className="flex flex-col gap-1 w-full max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {tableData.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 p-2 items-center bg-black/40 rounded border border-white/5 hover:border-white/10 hover:bg-black/60 transition-colors text-xs font-pixel">
                                <div className="col-span-1 text-lg text-center drop-shadow-md">{row.icon}</div>
                                <div className="col-span-4 flex flex-col">
                                    <span className="font-bold text-white tracking-wide">{row.name}</span>
                                    <span className="text-[9px] text-gray-500 uppercase">Skill: {row.skill}</span>
                                </div>
                                <div className="col-span-5 text-gray-400 text-[10px]">
                                    {row.outputsStr !== 'None' && <span className="text-gi-secondary">→ </span>}
                                    {row.outputsStr}
                                </div>
                                <div className="col-span-2 text-right font-bold text-white text-sm">
                                    {row.chance}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </GIModal>
    );
};

export default DropTableModal;
