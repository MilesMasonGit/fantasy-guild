import React, { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import { 
  Grid, Home, Sparkles, Trash2, Plus, X, ShieldAlert, Award
} from 'lucide-react';

export default function PlaymatGridEditor({ area, onUpdate }) {
  const subskills = useEntityStore((s) => s.subskills);
  
  // Grid config fallback values
  const gridConfig = area.gridConfig || {
    width: 3,
    height: 3,
    max_width: 5,
    max_height: 5,
    hubPosition: { x: 1, y: 1 },
    baseTileTemplate: area.id || 'guild_hall',
    baseTileVariants: 1,
    validCells: [{ x: 1, y: 1 }],
    tileMap: {}
  };

  const [activeTool, setActiveTool] = useState('cell_toggle'); // 'cell_toggle' | 'hub_place' | 'boost_paint'
  const [selectedCell, setSelectedCell] = useState(null); // { x, y } for the boost editor modal
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [paintMode, setPaintMode] = useState(true); // true = make valid, false = make invalid

  const { width = 3, height = 3, validCells = [], hubPosition = { x: 0, y: 0 }, tileMap = {} } = gridConfig;

  // List of parent skills for select options
  const parentSkills = ['nature', 'industry', 'nautical', 'culinary', 'combat', 'occult', 'social', 'crime', 'science'];
  // List of all subskill IDs
  const subskillIds = Object.keys(subskills || {});

  // Resize boundaries with auto-clipping out-of-bounds cells
  const handleResize = (newW, newH) => {
    const w = Math.max(1, Math.min(15, newW));
    const h = Math.max(1, Math.min(15, newH));

    // Clip valid cells
    const newValidCells = validCells.filter(c => c.x < w && c.y < h);

    // Reposition hub if cut off
    const newHub = { ...hubPosition };
    if (newHub.x >= w) newHub.x = Math.max(0, w - 1);
    if (newHub.y >= h) newHub.y = Math.max(0, h - 1);

    // Clip tiles
    const newTileMap = {};
    for (const [key, value] of Object.entries(tileMap)) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);
      if (cx < w && cy < h) {
        newTileMap[key] = value;
      }
    }

    onUpdate('gridConfig', {
      ...gridConfig,
      width: w,
      height: h,
      validCells: newValidCells,
      hubPosition: newHub,
      tileMap: newTileMap
    });
  };

  const isCellValid = (x, y) => validCells.some(c => c.x === x && c.y === y);
  const isCellHub = (x, y) => hubPosition && hubPosition.x === x && hubPosition.y === y;
  const getCellTile = (x, y) => tileMap[`${x},${y}`];

  // Mouse interaction handling (drag to draw active cells)
  const handleCellMouseDown = (x, y) => {
    setIsMouseDown(true);
    if (activeTool === 'cell_toggle') {
      const currentlyValid = isCellValid(x, y);
      setPaintMode(!currentlyValid);
      toggleCellState(x, y, !currentlyValid);
    } else if (activeTool === 'hub_place') {
      if (isCellValid(x, y)) {
        onUpdate('gridConfig', {
          ...gridConfig,
          hubPosition: { x, y }
        });
      }
    } else if (activeTool === 'boost_paint') {
      if (isCellValid(x, y)) {
        setSelectedCell({ x, y });
      }
    }
  };

  const handleCellMouseEnter = (x, y) => {
    if (isMouseDown && activeTool === 'cell_toggle') {
      toggleCellState(x, y, paintMode);
    }
  };

  const toggleCellState = (x, y, shouldBeValid) => {
    let nextCells = [...validCells];
    const key = `${x},${y}`;
    
    if (shouldBeValid) {
      if (!isCellValid(x, y)) {
        nextCells.push({ x, y });
      }
    } else {
      nextCells = nextCells.filter(c => !(c.x === x && c.y === y));
      // Remove any custom tile configured here
      const nextTileMap = { ...tileMap };
      delete nextTileMap[key];
      
      // If hub was removed, reset it to first valid or 0,0
      let nextHub = { ...hubPosition };
      if (isCellHub(x, y)) {
        nextHub = nextCells.length > 0 ? { ...nextCells[0] } : { x: 0, y: 0 };
      }

      onUpdate('gridConfig', {
        ...gridConfig,
        validCells: nextCells,
        tileMap: nextTileMap,
        hubPosition: nextHub
      });
      return;
    }

    onUpdate('gridConfig', {
      ...gridConfig,
      validCells: nextCells
    });
  };

  // Inline boost save handler
  const saveBoosts = (boostList) => {
    if (!selectedCell) return;
    const key = `${selectedCell.x},${selectedCell.y}`;
    const nextTileMap = { ...tileMap };

    if (boostList.length === 0) {
      delete nextTileMap[key];
    } else {
      nextTileMap[key] = { boosts: boostList };
    }

    onUpdate('gridConfig', {
      ...gridConfig,
      tileMap: nextTileMap
    });
    setSelectedCell(null);
  };

  return (
    <div className="space-y-4" onMouseUp={() => setIsMouseDown(false)} onMouseLeave={() => setIsMouseDown(false)}>
      {/* Grid Settings Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex gap-4">
          <div>
            <label className="block text-[10px] uppercase font-black tracking-wider text-gray-500 mb-1">Grid Width</label>
            <input 
              type="number" 
              min="1" 
              max="15" 
              value={width} 
              onChange={(e) => handleResize(Number(e.target.value), height)} 
              className="w-16 text-center font-mono font-bold bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-black tracking-wider text-gray-500 mb-1">Grid Height</label>
            <input 
              type="number" 
              min="1" 
              max="15" 
              value={height} 
              onChange={(e) => handleResize(width, Number(e.target.value))} 
              className="w-16 text-center font-mono font-bold bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white"
            />
          </div>
        </div>

        {/* Toolbar Modes */}
        <div className="flex gap-1.5 p-1 rounded-lg bg-black/50 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTool('cell_toggle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'cell_toggle' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Grid size={13} /> Grid Paint
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('hub_place')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'hub_place' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Home size={13} /> Place Hub
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('boost_paint')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'boost_paint' ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Sparkles size={13} /> Paint Boosts
          </button>
        </div>
      </div>

      {/* Playmat Grid Render */}
      <div className="p-4 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center overflow-auto max-h-[400px]">
        <div 
          className="grid gap-1 bg-black/30 p-2 rounded-lg border border-white/5 select-none"
          style={{
            gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
            width: `${Math.min(480, width * 60)}px`
          }}
        >
          {Array.from({ length: height }).map((_, y) => 
            Array.from({ length: width }).map((_, x) => {
              const isValid = isCellValid(x, y);
              const isHub = isCellHub(x, y);
              const tile = getCellTile(x, y);

              // Determine color class depending on configured boosts
              let colorClass = 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]';
              if (isValid) {
                if (isHub) {
                  colorClass = 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.1)]';
                } else if (tile && tile.boosts && tile.boosts.length > 0) {
                  const hasSubskill = tile.boosts.some(b => b.type === 'subskill');
                  colorClass = hasSubskill
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-400 hover:bg-violet-500/25 cursor-pointer shadow-[0_0_8px_rgba(139,92,246,0.1)]'
                    : 'bg-sky-500/15 border-sky-500/40 text-sky-400 hover:bg-sky-500/25 cursor-pointer shadow-[0_0_8px_rgba(14,165,233,0.1)]';
                } else {
                  colorClass = 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 cursor-pointer';
                }
              }

              return (
                <div
                  key={`${x}-${y}`}
                  onMouseDown={() => handleCellMouseDown(x, y)}
                  onMouseEnter={() => handleCellMouseEnter(x, y)}
                  className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center transition-all ${colorClass}`}
                  title={`Coordinate: ${x},${y}`}
                >
                  <span className="text-[9px] font-mono opacity-25">{x},{y}</span>
                  {isValid && (
                    <div className="mt-0.5 text-base leading-none">
                      {isHub && '🏰'}
                      {!isHub && tile && tile.boosts && tile.boosts.length > 0 && '✨'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Visual legend info */}
      <div className="flex gap-4 justify-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-emerald-500/30" /> Active Cell</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/10 border border-amber-500/30" /> Area Hub</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500/10 border border-sky-500/30" /> Skill Boost</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-violet-500/10 border border-violet-500/30" /> Subskill Boost</span>
      </div>

      {/* Boost Configurator Modal Overlay */}
      {selectedCell && (
        <BoostModal
          cell={selectedCell}
          initialBoosts={tileMap[`${selectedCell.x},${selectedCell.y}`]?.boosts || []}
          parentSkills={parentSkills}
          subskillIds={subskillIds}
          subskills={subskills}
          onClose={() => setSelectedCell(null)}
          onSave={saveBoosts}
        />
      )}
    </div>
  );
}

// Sub-component for coordinate boosts edit overlay modal
function BoostModal({ cell, initialBoosts, parentSkills, subskillIds, subskills, onClose, onSave }) {
  const [boosts, setBoosts] = useState(initialBoosts);

  const addBoost = () => {
    setBoosts([...boosts, { type: 'skill', target: 'nature', pct: 10 }]);
  };

  const removeBoost = (idx) => {
    setBoosts(boosts.filter((_, i) => i !== idx));
  };

  const updateBoost = (idx, patch) => {
    setBoosts(boosts.map((b, i) => i === idx ? { ...b, ...patch } : b));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Playmat Tile Editor</span>
            <h3 className="text-sm font-bold text-white">Configure Tile at {cell.x},{cell.y}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Boost lists */}
        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
          {boosts.length === 0 && (
            <div className="p-4 text-center rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-500 italic">
              No custom speed or yield boosts configured on this tile.
            </div>
          )}
          {boosts.map((b, idx) => (
            <div key={idx} className="flex gap-2 items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  {/* Type Selector */}
                  <select
                    value={b.type}
                    onChange={(e) => updateBoost(idx, { type: e.target.value, target: e.target.value === 'skill' ? 'nature' : (subskillIds[0] || '') })}
                    className="flex-1 text-[11px] font-bold uppercase tracking-wider bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value="skill">Skill Boost</option>
                    <option value="subskill">Subskill Boost</option>
                  </select>

                  {/* Target Selector */}
                  <select
                    value={b.target}
                    onChange={(e) => updateBoost(idx, { target: e.target.value })}
                    className="flex-1 text-[11px] font-semibold bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white"
                  >
                    {b.type === 'skill' 
                      ? parentSkills.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)
                      : subskillIds.map(id => {
                          const name = subskills[id]?.name || id.charAt(0).toUpperCase() + id.slice(1);
                          return <option key={id} value={id}>{name}</option>;
                        })
                    }
                  </select>
                </div>

                {/* Percentage modifier slider / input */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Percent</span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={b.pct}
                    onChange={(e) => updateBoost(idx, { pct: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={b.pct}
                    onChange={(e) => updateBoost(idx, { pct: Number(e.target.value) })}
                    className="w-16 text-center text-xs font-mono font-bold bg-black/40 border border-white/10 rounded-lg py-1 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs font-bold text-white">%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeBoost(idx)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Modal actions */}
        <div className="flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={addBoost}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus size={12} /> Add Boost
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/5 text-gray-400 text-xs font-bold hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(boosts)}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
