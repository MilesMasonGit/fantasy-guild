import React, { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';

/**
 * Helper to render value in proposal review table safely.
 */
const renderValue = (val) => {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'number') {
    return Number(val.toFixed(4)).toLocaleString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  if (Array.isArray(val)) {
    return val.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const itemId = item.id || item.itemId;
        if (itemId) {
          const qty = item.quantity !== undefined 
            ? `x${item.quantity}` 
            : (item.minQty !== undefined && item.maxQty !== undefined
                ? (item.minQty === item.maxQty ? `x${item.minQty}` : `x${item.minQty}-${item.maxQty}`)
                : '');
          const chance = item.dropChance !== undefined 
            ? `${item.dropChance}%` 
            : (item.chance !== undefined ? `${item.chance}%` : '');
          return `${itemId}${qty ? ' ' + qty : ''}${chance ? ' (' + chance + ')' : ''}`;
        }
        if (item.type === 'CURRENCY' || item.id === 'gold') {
          return `${item.amount} Gold`;
        }
        return JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
};

/**
 * Modal to review and batch-commit ghost value proposals from the simulation.
 */
export const ProposalReviewModal = ({ isOpen, onClose, proposals, onApply }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { updateItem, updateTask, updateRecipe, updateEnemy, updateQuest, getEntity } = useEntityStore();

  if (!isOpen || !proposals) return null;

  const allProposals = [
    ...Object.entries(proposals.tasks || {}).map(([id, patch]) => ({ id, type: 'task', patch })),
    ...Object.entries(proposals.recipes || {}).map(([id, patch]) => ({ id, type: 'recipe', patch })),
    ...Object.entries(proposals.enemies || {}).map(([id, patch]) => ({ id, type: 'enemy', patch })),
    ...Object.entries(proposals.quests || {}).map(([id, patch]) => ({ id, type: 'quest', patch })),
  ];

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleApply = () => {
    const applyCount = { tasks: 0, recipes: 0, enemies: 0, items: 0, quests: 0 };

    allProposals.forEach(({ id, type, patch }) => {
      if (selectedIds.size > 0 && !selectedIds.has(id)) return;

      if (type === 'task') {
        updateTask(id, patch);
        applyCount.tasks++;
      } else if (type === 'recipe') {
        updateRecipe(id, patch);
        applyCount.recipes++;
      } else if (type === 'enemy') {
        updateEnemy(id, patch);
        applyCount.enemies++;
      } else if (type === 'quest') {
        updateQuest(id, patch);
        applyCount.quests++;
      }
    });

    // Handle item trueCost updates if they were part of markups
    if (proposals.items) {
      Object.entries(proposals.items).forEach(([itemId, costDelta]) => {
        const item = getEntity(itemId, 'item');
        if (item) {
          updateItem(itemId, { trueCost: (item.trueCost || 0) + costDelta });
          applyCount.items++;
        }
      });
    }

    onApply(applyCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-[#121214] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Balancing Proposals</h2>
            <p className="text-sm text-gray-400">Review and commit suggested tweaks to reach target EV.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {allProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 text-4xl">✨</div>
              <h3 className="text-lg font-medium text-white">No adjustments needed!</h3>
              <p className="text-sm text-gray-400">All active entities are currently within their Target EV variance.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="pb-3 pl-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-white/10 bg-white/5" 
                      checked={selectedIds.size === allProposals.length}
                      onChange={() => {
                        if (selectedIds.size === allProposals.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(allProposals.map(p => p.id)));
                      }}
                    />
                  </th>
                  <th className="pb-3">Entity</th>
                  <th className="pb-3">Field</th>
                  <th className="pb-3 text-right">Current</th>
                  <th className="pb-3 text-right">Proposed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allProposals.map(({ id, type, patch }) => {
                  const entity = getEntity(id, type);
                  return Object.entries(patch).filter(p => !p[0].startsWith('_')).map(([field, newVal], idx) => (
                    <tr key={`${id}-${field}`} className="group hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-4">
                        {idx === 0 && (
                          <input 
                            type="checkbox" 
                            className="rounded border-white/10 bg-white/5" 
                            checked={selectedIds.has(id)}
                            onChange={() => handleToggleSelect(id)}
                          />
                        )}
                      </td>
                      <td className="py-3">
                        {idx === 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase">{type}</span>
                            <span className="font-medium text-white">{entity?.name || id}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-sm text-gray-300">{field}</td>
                      <td className="py-3 text-right text-sm text-gray-400 line-through">
                        {renderValue(entity?.[field])}
                      </td>
                      <td className="py-3 text-right text-sm font-bold text-emerald-400">
                        {renderValue(newVal)}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 bg-white/5 px-6 py-4">
          <p className="text-sm text-gray-400">
            {selectedIds.size > 0 ? `${selectedIds.size} entities selected` : 'All entities will be updated'}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleApply}
              disabled={allProposals.length === 0}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              Commit Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
