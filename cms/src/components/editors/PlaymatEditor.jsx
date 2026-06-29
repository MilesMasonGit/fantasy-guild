import React, { useState, useEffect } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { 
  Grid, Home, Sparkles, Paintbrush, Eraser, Trash2, 
  Settings, ChevronRight, HelpCircle, Layers, MapPin
} from 'lucide-react';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';
import { TILE_TYPES } from '../../../../src/config/registries/tileRegistry.js';

export default function PlaymatEditor() {
  const areas = useEntityStore((s) => s.areas || {});
  const updateArea = useEntityStore((s) => s.updateArea);
  
  // Local active area state
  const [activeAreaId, setActiveAreaId] = useState('');
  
  // Set default active area on mount
  useEffect(() => {
    const areaKeys = Object.keys(areas);
    if (areaKeys.length > 0 && !activeAreaId) {
      setActiveAreaId(areaKeys[0]);
    }
  }, [areas, activeAreaId]);

  const area = areas[activeAreaId];
  const update = (key, value) => {
    if (activeAreaId) updateArea(activeAreaId, { [key]: value });
  };

  // Grid configuration setup
  const gridConfig = area?.gridConfig || {
    width: 5,
    height: 5,
    max_width: 5,
    max_height: 5,
    hubPosition: { x: 2, y: 2 },
    baseTileTemplate: activeAreaId || 'guild_hall',
    baseTileVariants: 5,
    validCells: [{ x: 2, y: 2 }],
    tileMap: {},
    propsMap: {}
  };

  const { width = 5, height = 5, validCells = [], hubPosition = { x: 2, y: 2 }, tileMap = {}, propsMap = {} } = gridConfig;

  // Painting tool selections
  const [activeTool, setActiveTool] = useState('cell_valid'); // 'cell_valid' | 'cell_invalid' | 'hub_place' | 'tile_paint'
  const [selectedTileId, setSelectedTileId] = useState('plains'); // Which tile ID to paint when tool is 'tile_paint'
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Group tile types by category
  const floorTiles = Object.values(TILE_TYPES).filter(t => t.id === 'plains' || t.id.includes('_board_'));
  const propTiles = [
    { id: 'clear_prop', name: 'Remove Prop', icon: '❌', sprite: null, propSprite: null },
    ...Object.values(TILE_TYPES).filter(t => t.id.includes('_boost') || t.id === 'forest' || t.id === 'ocean')
  ];

  // Resize boundaries with auto-clipping out-of-bounds cells
  const handleResize = (newW, newH) => {
    const w = Math.max(1, Math.min(15, newW));
    const h = Math.max(1, Math.min(15, newH));

    const newValidCells = validCells.filter(c => c.x < w && c.y < h);
    const newHub = { ...hubPosition };
    if (newHub.x >= w) newHub.x = Math.max(0, w - 1);
    if (newHub.y >= h) newHub.y = Math.max(0, h - 1);

    const newTileMap = {};
    for (const [key, value] of Object.entries(tileMap)) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);
      if (cx < w && cy < h) {
        newTileMap[key] = value;
      }
    }

    const newPropsMap = {};
    for (const [key, value] of Object.entries(propsMap)) {
      const [xStr, yStr] = key.split(',');
      const cx = parseInt(xStr, 10);
      const cy = parseInt(yStr, 10);
      if (cx < w && cy < h) {
        newPropsMap[key] = value;
      }
    }

    update('gridConfig', {
      ...gridConfig,
      width: w,
      height: h,
      validCells: newValidCells,
      hubPosition: newHub,
      tileMap: newTileMap,
      propsMap: newPropsMap
    });
  };

  const isCellValid = (x, y) => validCells.some(c => c.x === x && c.y === y);
  const isCellHub = (x, y) => hubPosition && hubPosition.x === x && hubPosition.y === y;
  
  const getCellTileId = (x, y) => {
    const val = tileMap[`${x},${y}`];
    return typeof val === 'string' ? val : (val?.id || 'plains');
  };

  const getCellPropId = (x, y) => {
    const val = propsMap[`${x},${y}`];
    if (val) return typeof val === 'string' ? val : val.id;
    // Fallback: check if the tile in tileMap is a prop (for backward compatibility)
    const baseTileId = getCellTileId(x, y);
    const baseTile = TILE_TYPES[baseTileId];
    if (baseTile && (baseTile.propSprite || baseTile.id.endsWith('_boost') || baseTile.id === 'forest' || baseTile.id === 'ocean')) {
      return baseTileId;
    }
    return null;
  };

  const handleCellInteraction = (x, y) => {
    const key = `${x},${y}`;
    const nextGrid = { ...gridConfig };
    nextGrid.validCells = [...validCells];
    nextGrid.tileMap = { ...tileMap };
    nextGrid.propsMap = { ...propsMap };

    if (activeTool === 'cell_valid') {
      // Add valid cell
      if (!isCellValid(x, y)) {
        nextGrid.validCells.push({ x, y });
      }
    } else if (activeTool === 'cell_invalid') {
      // Remove valid cell
      nextGrid.validCells = nextGrid.validCells.filter(c => !(c.x === x && c.y === y));
      delete nextGrid.tileMap[key];
      delete nextGrid.propsMap[key];
      if (hubPosition.x === x && hubPosition.y === y) {
        nextGrid.hubPosition = nextGrid.validCells.length > 0 ? { ...nextGrid.validCells[0] } : { x: 0, y: 0 };
      }
    } else if (activeTool === 'hub_place') {
      // Place hub (must be a valid cell)
      if (isCellValid(x, y)) {
        nextGrid.hubPosition = { x, y };
      }
    } else if (activeTool === 'tile_paint') {
      if (selectedTileId === 'clear_prop') {
        delete nextGrid.propsMap[key];
      } else {
        const tile = TILE_TYPES[selectedTileId];
        const isProp = tile && (tile.propSprite || tile.id.endsWith('_boost') || tile.id === 'forest' || tile.id === 'ocean');
        
        if (isProp) {
          nextGrid.propsMap[key] = selectedTileId;
        } else {
          if (selectedTileId === 'plains') {
            delete nextGrid.tileMap[key];
          } else {
            nextGrid.tileMap[key] = selectedTileId;
          }
        }
      }
    }

    update('gridConfig', nextGrid);
  };

  const handleCellMouseDown = (x, y) => {
    setIsMouseDown(true);
    handleCellInteraction(x, y);
  };

  const handleCellMouseEnter = (x, y) => {
    if (isMouseDown) {
      handleCellInteraction(x, y);
    }
  };

  const clearGrid = () => {
    if (window.confirm("Are you sure you want to clear all painted tiles and set all cells to Plains?")) {
      update('gridConfig', {
        ...gridConfig,
        tileMap: {},
        propsMap: {}
      });
    }
  };

  if (!area) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-zinc-500">
        <Layers size={48} className="mb-4 opacity-50" />
        <h3 className="font-bold text-lg text-white mb-2">No Areas Available</h3>
        <p className="text-sm">Create an area in the sidebar/editor first to configure playmats.</p>
      </div>
    );
  }

  // Get preview path for a cell
  const getCellArtPath = (x, y, tileId) => {
    const tile = TILE_TYPES[tileId] || TILE_TYPES.plains;
    let path = null;

    if (tile && (tile.propSprite || tile.id.endsWith('_boost') || !tile.sprite) && gridConfig.baseTileTemplate) {
      const variant = ((x * 17 + y * 31) % (gridConfig.baseTileVariants || 1)) + 1;
      path = resolveSpritePath(`pm_board_${gridConfig.baseTileTemplate}_${variant}`);
    } else if (tile && tile.sprite) {
      path = resolveSpritePath(tile.sprite);
    }
    return path;
  };

  return (
    <div className="flex h-[calc(100vh-84px)] gap-4 select-none" onMouseUp={() => setIsMouseDown(false)} onMouseLeave={() => setIsMouseDown(false)}>
      
      {/* 1. Left Sidebar: Tile Palette Selection */}
      <div className="w-80 flex flex-col rounded-xl border border-white/5 bg-zinc-950 p-4 overflow-y-auto space-y-6">
        
        {/* Selector Area Dropdown */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Selected Playmat Area</label>
          <select
            value={activeAreaId}
            onChange={(e) => {
              setActiveAreaId(e.target.value);
              setSelectedTileId('plains');
            }}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
          >
            {Object.values(areas).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
            ))}
          </select>
        </div>

        {/* Brush Actions */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Brush Action</label>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-black/60 border border-white/5">
            <button
              onClick={() => setActiveTool('cell_valid')}
              className={`flex flex-col items-center justify-center p-2 rounded-md transition-all text-[10px] font-bold ${
                activeTool === 'cell_valid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <Paintbrush size={14} className="mb-1" />
              Paint Grid
            </button>
            <button
              onClick={() => setActiveTool('cell_invalid')}
              className={`flex flex-col items-center justify-center p-2 rounded-md transition-all text-[10px] font-bold ${
                activeTool === 'cell_invalid' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <Eraser size={14} className="mb-1" />
              Erase Grid
            </button>
            <button
              onClick={() => setActiveTool('hub_place')}
              className={`flex flex-col items-center justify-center p-2 rounded-md transition-all text-[10px] font-bold ${
                activeTool === 'hub_place' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <Home size={14} className="mb-1" />
              Set Hub
            </button>
          </div>
        </div>

        {/* Floor Sprites Palette */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Paintable Floor Tiles</label>
          <div className="grid grid-cols-2 gap-2">
            {floorTiles.map((t) => {
              const isSelected = activeTool === 'tile_paint' && selectedTileId === t.id;
              const previewSrc = resolveSpritePath(t.sprite);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTool('tile_paint');
                    setSelectedTileId(t.id);
                  }}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                    isSelected ? 'bg-emerald-500/10 border-emerald-500 shadow-md scale-105' : 'bg-black/30 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded border border-white/5 overflow-hidden flex items-center justify-center bg-black/40">
                    {previewSrc ? (
                      <img src={`/${previewSrc}`} alt={t.name} className="w-full h-full object-cover pixel-art" />
                    ) : (
                      <HelpCircle size={16} className="text-zinc-600" />
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-white mt-1.5 truncate w-full text-center">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Special Shrines / Props Palette */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Special Props & Shrines</label>
          <div className="grid grid-cols-2 gap-2">
            {propTiles.map((t) => {
              const isSelected = activeTool === 'tile_paint' && selectedTileId === t.id;
              const previewSrc = resolveSpritePath(t.propSprite || t.sprite);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTool('tile_paint');
                    setSelectedTileId(t.id);
                  }}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                    isSelected ? 'bg-emerald-500/10 border-emerald-500 shadow-md scale-105' : 'bg-black/30 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded border border-white/5 overflow-hidden flex items-center justify-center bg-black/40 relative">
                    {previewSrc ? (
                      <>
                        <span className="absolute top-0.5 right-1.5 text-xs">{t.icon}</span>
                        <img src={`/${previewSrc}`} alt={t.name} className="w-8 h-8 object-contain pixel-art mt-1" />
                      </>
                    ) : (
                      <span className="text-lg font-bold">{t.icon || '❓'}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-white mt-1.5 truncate w-full text-center">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 2. Center: Large Interactive Canvas */}
      <div className="flex-1 flex flex-col rounded-xl border border-white/5 bg-zinc-950 p-4">
        
        {/* Canvas Toolbar Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded">
              Active brush
            </span>
            <span className="text-xs font-semibold text-white font-mono uppercase">
              {activeTool === 'tile_paint' ? `Paint: ${TILE_TYPES[selectedTileId]?.name || selectedTileId}` : activeTool.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={clearGrid}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 size={12} /> Clear Board Tiles
          </button>
        </div>

        {/* Large Grid Preview container */}
        <div className="flex-1 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center p-6 overflow-auto max-h-[500px]">
          <div 
            className="grid gap-1.5 bg-black/30 p-3 rounded-xl border border-white/5"
            style={{
              gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
              width: `${Math.min(600, width * 68)}px`
            }}
          >
            {Array.from({ length: height }).map((_, y) => 
              Array.from({ length: width }).map((_, x) => {
                const isValid = isCellValid(x, y);
                const isHub = isCellHub(x, y);
                const cellTileId = getCellTileId(x, y);
                const cellPropId = getCellPropId(x, y);
                const cellTile = TILE_TYPES[cellTileId] || TILE_TYPES.plains;
                const cellPropTile = TILE_TYPES[cellPropId];

                // Load preview path
                const artPath = getCellArtPath(x, y, cellTileId);
                const propPath = cellPropTile?.propSprite ? resolveSpritePath(cellPropTile.propSprite) : null;

                let borderStyle = 'border-white/5 bg-zinc-900/20';
                if (isValid) {
                  if (isHub) {
                    borderStyle = 'border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)] bg-amber-500/5';
                  } else if (cellTileId !== 'plains') {
                    borderStyle = 'border-emerald-500/30 bg-emerald-500/[0.02]';
                  } else {
                    borderStyle = 'border-white/20 bg-white/[0.02]';
                  }
                }

                return (
                  <div
                    key={`${x}-${y}`}
                    onMouseDown={() => handleCellMouseDown(x, y)}
                    onMouseEnter={() => handleCellMouseEnter(x, y)}
                    className={`w-14 h-14 rounded-lg border relative flex flex-col items-center justify-center cursor-crosshair overflow-hidden transition-all group/grid ${borderStyle}`}
                  >
                    {/* Floor Image Layer */}
                    {isValid && artPath && (
                      <img 
                        src={`/${artPath}`} 
                        alt="floor" 
                        className="absolute inset-0 w-full h-full object-cover pixel-art pointer-events-none select-none brightness-[0.7]" 
                      />
                    )}

                    {/* Prop overlay (Render regardless of cell validity) */}
                    {propPath && (
                      <img 
                        src={`/${propPath}`} 
                        alt="prop" 
                        className="w-8 h-8 object-contain pixel-art z-10 pointer-events-none select-none animate-fade-in" 
                      />
                    )}

                    {/* Coordinate Badge */}
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono text-white/20 z-20 leading-none group-hover/grid:text-white/60 transition-colors">
                      {x},{y}
                    </span>

                    {/* Hub Identifier */}
                    {isHub && (
                      <div className="absolute inset-0 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-center justify-center z-20 pointer-events-none">
                        <span className="text-xl">🏰</span>
                      </div>
                    )}

                    {/* Wilderness shroud */}
                    {!isValid && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center border border-dashed border-white/5">
                        <span className="text-[8px] font-black tracking-widest text-zinc-600 uppercase">Wld</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 3. Right Sidebar: Settings & Dimensions */}
      <div className="w-80 flex flex-col rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-6 overflow-y-auto">
        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-1.5">
          <Settings size={12} /> Playmat Grid Settings
        </label>

        {/* Resizers */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-zinc-400">Grid Width</span>
              <span className="font-mono text-emerald-400">{width} columns</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="15" 
              value={width} 
              onChange={(e) => handleResize(Number(e.target.value), height)}
              className="w-full accent-emerald-500" 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-zinc-400">Grid Height</span>
              <span className="font-mono text-emerald-400">{height} rows</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="15" 
              value={height} 
              onChange={(e) => handleResize(width, Number(e.target.value))}
              className="w-full accent-emerald-500" 
            />
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Tile template variables */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-400">Base Tile Template</label>
            <input
              type="text"
              value={gridConfig.baseTileTemplate || ''}
              onChange={(e) => {
                const nextGrid = { ...gridConfig };
                nextGrid.baseTileTemplate = e.target.value;
                update('gridConfig', nextGrid);
              }}
              placeholder="e.g. forest, guild_hall, mountain"
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-zinc-600 leading-tight">
              Defines the naming pattern (e.g. <code>pm_board_[name]_[1-N]</code>) the game uses to pull board variants automatically.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-400">Base Tile Variants Count</label>
            <input
              type="number"
              min="1"
              value={gridConfig.baseTileVariants != null ? gridConfig.baseTileVariants : 1}
              onChange={(e) => {
                const nextGrid = { ...gridConfig };
                nextGrid.baseTileVariants = Number(e.target.value);
                update('gridConfig', nextGrid);
              }}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[10px] text-zinc-600 leading-tight">
              Tells the game how many random visual variants exist on disk for the default base floor.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
