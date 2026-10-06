import { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Upload, Trash2, Grid, Move, Sparkles, RotateCcw, Check } from 'lucide-react';

const HERO_PRESETS = [
  { name: 'ani_recruit_0', path: '/assets/heroes/animations/ani_recruit_0.png', label: 'Recruit', type: 'hero' },
  { name: 'ani_fighter_0', path: '/assets/heroes/animations/ani_fighter_0.png', label: 'Fighter', type: 'hero' },
  { name: 'ani_ranger_0', path: '/assets/heroes/animations/ani_ranger_0.png', label: 'Ranger', type: 'hero' },
  { name: 'ani_rogue_0', path: '/assets/heroes/animations/ani_rogue_0.png', label: 'Rogue', type: 'hero' },
  { name: 'ani_wizard_0', path: '/assets/heroes/animations/ani_wizard_0.png', label: 'Wizard', type: 'hero' }
];

const ENEMY_PRESETS = [
  { name: 'ani_cow', path: '/assets/enemies/animal/anim/ani_cow.png', label: 'Cow (Enemy)', type: 'enemy' }
];

const FPS_PRESETS = [4, 6, 8, 10, 12, 16];
const ZOOM_PRESETS = [1, 2, 3, 4, 6, 8];

export default function AnimationEditor() {
  const [imageSrc, setImageSrc] = useState('/assets/heroes/animations/ani_recruit_0.png');
  const [imageName, setImageName] = useState('ani_recruit_0');
  const [sheetDims, setSheetDims] = useState({ width: 512, height: 192 });
  const [archetype, setArchetype] = useState('hero');

  const [action, setAction] = useState('active');
  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(8);
  const [flipH, setFlipH] = useState(false);

  const [zoom, setZoom] = useState(4);
  const [showGrid, setShowGrid] = useState(false);
  const [showCenter, setShowCenter] = useState(false);
  const [showFloor, setShowFloor] = useState(false);
  const [floorY, setFloorY] = useState(58);
  const [showOnion, setShowOnion] = useState(false);
  const [bgMode, setBgMode] = useState('dark');

  const [motionRunway, setMotionRunway] = useState(false);
  const [runwayPos, setRunwayPos] = useState(50);
  const [runwayDir, setRunwayDir] = useState('right');

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  const cols = archetype === 'enemy' ? 4 : 8;
  const rows = archetype === 'enemy' ? 4 : 3;
  const cellW = sheetDims.width ? Math.round(sheetDims.width / cols) : 64;
  const cellH = sheetDims.height ? Math.round(sheetDims.height / rows) : 64;

  const handleLoadImageFromUrl = (url, name = 'sprite_sheet', forcedType = null) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setSheetDims({ width: w, height: h });
      setImageSrc(url);
      setImageName(name);

      let detected = forcedType;
      if (!detected) {
        if (w === 256 || h >= 256 || name.toLowerCase().includes('enemy') || name.toLowerCase().includes('cow')) {
          detected = 'enemy';
        } else {
          detected = 'hero';
        }
      }
      setArchetype(detected);
      setRunwayDir(detected === 'enemy' ? 'left' : 'right');
      setAction('active');
      setFrame(0);
      setFloorY(detected === 'enemy' ? Math.round((h / 4) * 0.9) : 58);
    };
    img.src = url;
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const loadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      handleLoadImageFromUrl(event.target.result, baseName);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageSrc(null);
    setImageName('');
    setSheetDims({ width: 0, height: 0 });
  };

  // Listeners on window so drag and drop works anywhere in the tab.
  useEffect(() => {
    const onWindowDragOver = (e) => {
      e.preventDefault();
    };
    const onWindowDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        loadFile(file);
        setIsDraggingOver(false);
      }
    };
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, []);

  useEffect(() => {
    if (!imageSrc || !isPlaying) return;
    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % 8);
    }, interval);
    return () => clearInterval(timer);
  }, [imageSrc, isPlaying, fps]);

  useEffect(() => {
    if (!imageSrc || !isPlaying || !motionRunway) return;
    let animId;
    let last = performance.now();
    const speed = 25;

    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setRunwayPos((prev) => {
        const dir = runwayDir === 'left' ? -1 : 1;
        const next = prev + dir * speed * dt;
        if (next > 95) return 5;
        if (next < 5) return 95;
        return next;
      });
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [imageSrc, isPlaying, motionRunway, runwayDir]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setFrame((f) => (f - 1 + 8) % 8);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setFrame((f) => (f + 1) % 8);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentFrame = frame % 8;
  const prevFrame = (currentFrame - 1 + 8) % 8;

  // Hero sheet: 8 cols x 3 rows (Active, Walk, Idle). Enemy sheet: 4 cols x 4 rows, two rows per animation.
  const getFrameCoords = (actKey, fIdx) => {
    if (archetype === 'enemy') {
      const baseRow = actKey === 'active' ? 0 : 2;
      const subRow = Math.floor(fIdx / 4);
      const row = baseRow + subRow;
      const col = fIdx % 4;
      return { col, row };
    } else {
      let row = 0;
      if (actKey === 'active') row = 0;
      else if (actKey === 'walk') row = 1;
      else if (actKey === 'idle') row = 2;
      return { col: fIdx, row };
    }
  };

  const renderFrameView = (actKey, customZoom = zoom) => {
    const { col, row } = getFrameCoords(actKey, currentFrame);
    const { col: prevCol, row: prevRow } = getFrameCoords(actKey, prevFrame);

    const sizeW = cellW * customZoom;
    const sizeH = cellH * customZoom;
    const scaledSheetW = sheetDims.width * customZoom;
    const scaledSheetH = sheetDims.height * customZoom;

    const offsetX = col * cellW * customZoom;
    const offsetY = row * cellH * customZoom;
    const onionX = prevCol * cellW * customZoom;
    const onionY = prevRow * cellH * customZoom;

    return (
      <div
        className="relative overflow-hidden select-none"
        style={{
          width: `${sizeW}px`,
          height: `${sizeH}px`,
          transform: flipH ? 'scaleX(-1)' : 'none'
        }}
      >
        {showOnion && (
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              width: `${scaledSheetW}px`,
              height: `${scaledSheetH}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              imageRendering: 'pixelated',
              transform: `translate(-${onionX}px, -${onionY}px)`,
              opacity: 0.35,
              filter: 'hue-rotate(180deg) saturate(200%)'
            }}
          />
        )}

        <img
          src={imageSrc}
          alt=""
          draggable={false}
          className="absolute pointer-events-none"
          style={{
            width: `${scaledSheetW}px`,
            height: `${scaledSheetH}px`,
            maxWidth: 'none',
            maxHeight: 'none',
            imageRendering: 'pixelated',
            transform: `translate(-${offsetX}px, -${offsetY}px)`
          }}
        />

        <div className="absolute inset-0 pointer-events-none">
          {showGrid && (
            <div className="absolute inset-0 border border-white/20 ring-1 ring-black/40" />
          )}
          {showCenter && (
            <>
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-400/50 -translate-x-1/2 shadow-[0_0_2px_cyan]" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-400/50 -translate-y-1/2 shadow-[0_0_2px_cyan]" />
            </>
          )}
          {showFloor && (
            <div
              className="absolute left-0 right-0 h-px bg-amber-400 shadow-[0_0_3px_orange]"
              style={{ top: `${(floorY / cellH) * 100}%` }}
            >
              <span className="absolute right-1 bottom-0.5 text-[9px] font-mono text-amber-300 font-bold bg-black/80 px-1 rounded">
                Y:{floorY}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentCoords = getFrameCoords(action === 'all' ? 'active' : action, currentFrame);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex flex-col h-[calc(100vh-68px)] gap-3 overflow-hidden text-sm select-none"
      style={{ color: 'var(--color-text-primary)' }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg"
        className="hidden"
      />

      {isDraggingOver && (
        <div className="absolute inset-0 z-[100] bg-indigo-950/85 border-4 border-dashed border-indigo-400 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center pointer-events-none gap-4 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 animate-bounce">
            <Upload size={40} />
          </div>
          <div className="text-center">
            <span className="text-xl font-bold text-white block">Drop Sprite Sheet to Load</span>
            <span className="text-xs text-indigo-200 mt-1 block">Supports Hero (512×192) & Enemy (256×256 / 256×264) sheets</span>
          </div>
        </div>
      )}

      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl border shrink-0"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🎞️</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                Animation Studio
              </h2>
              {imageSrc && (
                <span
                  className="text-[11px] font-mono px-2 py-0.5 rounded border"
                  style={{
                    background: archetype === 'enemy' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    borderColor: archetype === 'enemy' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                    color: archetype === 'enemy' ? '#f87171' : 'var(--color-accent-hover)'
                  }}
                >
                  {archetype === 'enemy' ? 'Enemy (4×4, 2 Rows/Cycle)' : 'Hero (8×3, 1 Row/Cycle)'}
                </span>
              )}
            </div>
            {imageSrc && (
              <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {imageName}.png • {sheetDims.width} × {sheetDims.height} px • Cell: {cellW} × {cellH} px
              </p>
            )}
          </div>
        </div>

        {imageSrc && (
          <div className="flex items-center gap-3">
            <div className="flex items-center p-0.5 rounded-lg border" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <button
                onClick={() => {
                  setArchetype('hero');
                  if (action === 'all' || action === 'idle' || action === 'walk' || action === 'active') {
                    // keep
                  } else {
                    setAction('active');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${archetype === 'hero' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Hero (8×3)
              </button>
              <button
                onClick={() => {
                  setArchetype('enemy');
                  if (action === 'walk') setAction('idle');
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${archetype === 'enemy' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Enemy (4×4)
              </button>
            </div>

            <div className="flex items-center p-0.5 rounded-lg border gap-1" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <button
                onClick={() => setAction('active')}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${action === 'active' ? 'bg-amber-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Active
              </button>
              {archetype === 'hero' && (
                <button
                  onClick={() => setAction('walk')}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${action === 'walk' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  Walk
                </button>
              )}
              <button
                onClick={() => setAction('idle')}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${action === 'idle' ? 'bg-emerald-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
              >
                Idle
              </button>
              <button
                onClick={() => setAction('all')}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${action === 'all' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                {archetype === 'hero' ? 'Trio View' : 'Duo View'}
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all"
              title="Upload or replace sprite sheet"
            >
              <Upload size={13} />
              <span>Upload Sheet</span>
            </button>

            <button
              onClick={clearImage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
              title="Eject / Clear Current Sheet"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {!imageSrc ? (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:bg-white/5 transition-all p-8 gap-4"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Upload size={32} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-white">Drag & drop your Sprite Sheet here</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Supports 512×192 Hero sheets, 256×256 / 256×264 Enemy sheets, or any custom PNG
              </p>
            </div>
            <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all">
              Browse Files...
            </button>
          </div>

          <div
            className="w-full md:w-96 flex flex-col p-4 rounded-xl border overflow-y-auto"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
          >
            <span className="text-xs font-bold uppercase tracking-wider mb-3 text-indigo-400">
              Game Sprite Sheets Library
            </span>

            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                  Heroes (8-Frame • 3 Rows)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {HERO_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleLoadImageFromUrl(preset.path, preset.name, 'hero')}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 hover:border-indigo-500/50 hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                          <img
                            src={preset.path}
                            alt=""
                            className="w-8 h-8 object-cover object-left-top"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white group-hover:text-indigo-300 block">
                            {preset.label}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">{preset.name}.png</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                        512×192
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block mb-2">
                  Enemies (8-Frame • 2 Rows/Anim)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {ENEMY_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleLoadImageFromUrl(preset.path, preset.name, 'enemy')}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 hover:border-red-500/50 hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                          <img
                            src={preset.path}
                            alt=""
                            className="w-8 h-8 object-cover object-left-top"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white group-hover:text-red-300 block">
                            {preset.label}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">{preset.name}.png</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                        256×256
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden">
          
          <div
            className="flex-1 flex flex-col rounded-xl border relative overflow-hidden"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b shrink-0 text-xs"
              style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-bold">Surface:</span>
                <button
                  onClick={() => setBgMode('dark')}
                  className={`px-2 py-0.5 rounded border text-[11px] font-medium ${bgMode === 'dark' ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-white/10 text-gray-400'}`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setBgMode('grid')}
                  className={`px-2 py-0.5 rounded border text-[11px] font-medium ${bgMode === 'grid' ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-white/10 text-gray-400'}`}
                >
                  Checker
                </button>
                <button
                  onClick={() => setBgMode('wood')}
                  className={`px-2 py-0.5 rounded border text-[11px] font-medium ${bgMode === 'wood' ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-white/10 text-gray-400'}`}
                >
                  Table Wood
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-gray-400 font-bold mr-1">Zoom:</span>
                {ZOOM_PRESETS.map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${zoom === z ? 'bg-indigo-600 text-white font-bold shadow' : 'text-gray-400 hover:bg-white/5'}`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`flex-1 relative flex items-center justify-center overflow-auto p-6 transition-colors ${
                bgMode === 'dark' ? 'bg-[#0f1115]' :
                bgMode === 'grid' ? 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a1c23]' :
                'bg-[#2a1d17]'
              }`}
            >
              {motionRunway && action !== 'all' ? (
                <div className="w-full max-w-2xl h-64 border border-white/10 rounded-xl relative overflow-hidden bg-black/40 flex items-center">
                  <div className="absolute bottom-12 left-0 right-0 h-1 bg-white/20 border-b border-amber-400/50" />
                  <div
                    className="absolute -bottom-2 transition-all duration-75"
                    style={{ left: `${runwayPos}%`, transform: 'translateX(-50%)' }}
                  >
                    {renderFrameView(action, 3)}
                  </div>
                  <div className="absolute top-2 left-3 text-[11px] font-mono text-gray-400">
                    Walking Track Simulator ({runwayPos.toFixed(0)}%)
                  </div>
                  <div className="flex items-center gap-2 absolute top-2 right-3">
                    <button
                      onClick={() => setFlipH((f) => !f)}
                      className={`px-2.5 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1.5 backdrop-blur-md shadow-lg ${
                        flipH
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md'
                          : 'bg-black/70 border-white/20 text-gray-300 hover:text-white'
                      }`}
                      title="Mirror / Flip the sprite horizontally without affecting walk direction"
                    >
                      <RotateCcw size={12} className={flipH ? 'scale-x-[-1]' : ''} />
                      <span>{flipH ? 'Sprite: Flipped (scaleX -1)' : 'Sprite: Natural (scaleX 1)'}</span>
                    </button>
                    <button
                      onClick={() => setRunwayDir((d) => (d === 'right' ? 'left' : 'right'))}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1 backdrop-blur-md ${
                        runwayDir === 'left'
                          ? 'bg-blue-500/25 border-blue-400 text-blue-300'
                          : 'bg-indigo-500/25 border-indigo-400 text-indigo-300'
                      }`}
                      title="Change walk direction"
                    >
                      <span>Walk: {runwayDir === 'left' ? '◄ Left' : '► Right'}</span>
                    </button>
                  </div>
                </div>
              ) : action === 'all' ? (
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  {(archetype === 'hero' ? ['active', 'walk', 'idle'] : ['active', 'idle']).map((act) => (
                    <div key={act} className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          act === 'active' ? 'text-amber-400' : act === 'walk' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {act}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">
                          {archetype === 'enemy' ? (act === 'active' ? 'Rows 0-1' : 'Rows 2-3') : `Row ${act === 'active' ? 0 : act === 'walk' ? 1 : 2}`}
                        </span>
                      </div>
                      <div className="p-3 bg-black/50 rounded-xl border border-white/10 shadow-xl">
                        {renderFrameView(act, Math.min(zoom, 4))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-black/50 rounded-2xl border border-white/10 shadow-2xl relative">
                    {renderFrameView(action, zoom)}
                  </div>
                  <div className="flex items-center gap-3 bg-black/60 border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-mono">
                    <span className={`font-bold uppercase ${
                      action === 'active' ? 'text-amber-400' : action === 'walk' ? 'text-blue-400' : 'text-emerald-400'
                    }`}>
                      {action}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="text-indigo-400 font-bold">Frame {currentFrame} / 7</span>
                    <span className="text-white/20">•</span>
                    <span className="text-gray-400">
                      Cell: Row {currentCoords.row}, Col {currentCoords.col} (X:{currentCoords.col * cellW}, Y:{currentCoords.row * cellH})
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div
              className="px-4 py-2 border-t shrink-0 flex items-center justify-between text-xs"
              style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-white">
                  <input
                    type="checkbox"
                    checked={motionRunway}
                    onChange={(e) => setMotionRunway(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Simulate Ground Runway</span>
                </label>
                {motionRunway && (
                  <>
                    <button
                      onClick={() => setFlipH((f) => !f)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
                        flipH
                          ? 'bg-amber-500/25 border-amber-500/50 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                      }`}
                      title="Mirror sprite horizontally without changing movement direction"
                    >
                      <RotateCcw size={13} className={flipH ? 'scale-x-[-1]' : ''} />
                      <span>Sprite Flip: {flipH ? 'Mirrored (scaleX -1)' : 'Natural (scaleX 1)'}</span>
                    </button>
                    <button
                      onClick={() => setRunwayDir((d) => (d === 'right' ? 'left' : 'right'))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
                        runwayDir === 'left'
                          ? 'bg-blue-500/25 border-blue-400 text-blue-300'
                          : 'bg-indigo-500/25 border-indigo-400 text-indigo-300'
                      }`}
                      title="Change travel path direction"
                    >
                      <span>Walk Path: {runwayDir === 'left' ? '◄ Towards Left' : '► Towards Right'}</span>
                    </button>
                    <button
                      onClick={() => setRunwayPos(50)}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-gray-400 border border-white/10"
                    >
                      Reset Position
                    </button>
                  </>
                )}
              </div>

              <span className="text-gray-500 text-[11px]">
                Shortcuts: <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">Space</kbd> Play/Pause, <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">←</kbd> <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">→</kbd> Step Frame
              </span>
            </div>
          </div>

          <div
            className="w-80 flex flex-col p-4 gap-4 overflow-y-auto rounded-xl border"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
          >
            <div className="p-3.5 rounded-xl border flex flex-col gap-3" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Playback Controls
                </span>
                <span className="font-mono text-xs font-bold text-indigo-400">
                  {fps} FPS ({Math.round(1000 / fps)}ms)
                </span>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setFrame((f) => (f - 1 + 8) % 8);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
                  title="Previous Frame (Arrow Left)"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                    isPlaying ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setFrame((f) => (f + 1) % 8);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
                  title="Next Frame (Arrow Right)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Frame Scrubber</span>
                  <span className="font-mono font-bold text-white">#{currentFrame}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={7}
                  value={currentFrame}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setFrame(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-gray-500 px-0.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <span
                      key={num}
                      onClick={() => {
                        setIsPlaying(false);
                        setFrame(num);
                      }}
                      className={`cursor-pointer hover:text-indigo-400 ${num === currentFrame ? 'text-indigo-400 font-bold scale-125' : ''}`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Speed (FPS)</span>
                  <div className="flex gap-1">
                    {FPS_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setFps(preset)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          fps === preset ? 'bg-indigo-600 text-white font-bold' : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border flex flex-col gap-3" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Alignment Guides
              </span>

              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-gray-300">
                    <Grid size={14} className="text-gray-400" />
                    {cellW}×{cellH} Cell Outline
                  </span>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="accent-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-cyan-300">
                    <Move size={14} className="text-cyan-400" />
                    Center Crosshairs ({Math.round(cellW / 2)}, {Math.round(cellH / 2)})
                  </span>
                  <input
                    type="checkbox"
                    checked={showCenter}
                    onChange={(e) => setShowCenter(e.target.checked)}
                    className="accent-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-purple-300">
                    <Sparkles size={14} className="text-purple-400" />
                    Onion Skinning (Prev Frame)
                  </span>
                  <input
                    type="checkbox"
                    checked={showOnion}
                    onChange={(e) => setShowOnion(e.target.checked)}
                    className="accent-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-amber-300">
                    <RotateCcw size={14} className="text-amber-400" />
                    Flip Horizontal (Facing Left)
                  </span>
                  <input
                    type="checkbox"
                    checked={flipH}
                    onChange={(e) => setFlipH(e.target.checked)}
                    className="accent-indigo-500"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-400">
                    <input
                      type="checkbox"
                      checked={showFloor}
                      onChange={(e) => setShowFloor(e.target.checked)}
                      className="accent-amber-400"
                    />
                    Floor Baseline
                  </label>
                  <span className="font-mono font-bold text-amber-300">Y: {floorY}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={cellH}
                  value={floorY}
                  onChange={(e) => setFloorY(Number(e.target.value))}
                  disabled={!showFloor}
                  className="w-full accent-amber-400 cursor-pointer disabled:opacity-30"
                />
                <span className="text-[10px] text-gray-500">
                  Align foot contact to this line to eliminate ground wobble.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border flex flex-col gap-2" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Switch Sheet
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {HERO_PRESETS.slice(0, 4).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleLoadImageFromUrl(p.path, p.name, 'hero')}
                    className="px-2 py-1.5 rounded border border-white/5 hover:border-indigo-500/50 hover:bg-white/5 text-[11px] font-bold text-left truncate text-gray-300 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
                {ENEMY_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleLoadImageFromUrl(p.path, p.name, 'enemy')}
                    className="px-2 py-1.5 rounded border border-white/5 hover:border-red-500/50 hover:bg-white/5 text-[11px] font-bold text-left truncate text-red-400 hover:text-red-300"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {imageSrc && (
        <div
          className="p-3 rounded-xl border shrink-0 flex flex-col gap-2"
          style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-400 uppercase tracking-wider">
                Master Sprite Sheet Grid
              </span>
              <span className="text-gray-500 font-mono text-[11px]">
                ({sheetDims.width} × {sheetDims.height} px • {cols} Cols × {rows} Rows • Click any cell to inspect)
              </span>
            </div>
            <span className="text-gray-400 text-[11px]">
              Inspecting: <strong className="text-amber-400 uppercase font-mono">{action}</strong> Frame <strong className="text-indigo-400 font-mono">#{currentFrame}</strong>
            </span>
          </div>

          <div className="relative border border-white/10 rounded-lg overflow-hidden bg-black/60 mx-auto select-none">
            <img
              src={imageSrc}
              alt="Sprite Sheet"
              draggable={false}
              className="block"
              style={{
                width: `${Math.min(sheetDims.width, 512)}px`,
                height: `${Math.min(sheetDims.height, 256)}px`,
                imageRendering: 'pixelated'
              }}
            />

            <div
              className="absolute inset-0 grid pointer-events-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
              }}
            >
              {Array.from({ length: rows }).map((_, rIdx) =>
                Array.from({ length: cols }).map((__, cIdx) => {
                  const isCurrent = currentCoords.row === rIdx && currentCoords.col === cIdx;
                  
                  let cellLabel = '';
                  if (archetype === 'enemy') {
                    if (rIdx <= 1) cellLabel = `Active ${rIdx * 4 + cIdx}`;
                    else cellLabel = `Idle ${(rIdx - 2) * 4 + cIdx}`;
                  } else {
                    if (rIdx === 0) cellLabel = `Active ${cIdx}`;
                    else if (rIdx === 1) cellLabel = `Walk ${cIdx}`;
                    else cellLabel = `Idle ${cIdx}`;
                  }

                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => {
                        setIsPlaying(false);
                        if (archetype === 'enemy') {
                          if (rIdx <= 1) {
                            setAction('active');
                            setFrame(rIdx * 4 + cIdx);
                          } else {
                            setAction('idle');
                            setFrame((rIdx - 2) * 4 + cIdx);
                          }
                        } else {
                          if (rIdx === 0) setAction('active');
                          else if (rIdx === 1) setAction('walk');
                          else setAction('idle');
                          setFrame(cIdx);
                        }
                      }}
                      className={`relative border border-white/5 hover:border-indigo-400/80 transition-all flex flex-col justify-between p-1 text-left group ${
                        isCurrent ? 'border-2 border-amber-400 bg-amber-400/25 shadow-[inset_0_0_8px_rgba(251,191,36,0.5)]' : ''
                      }`}
                      title={cellLabel}
                    >
                      <span className={`text-[8px] font-mono leading-none font-bold px-1 py-0.5 rounded bg-black/60 ${
                        isCurrent ? 'text-amber-300 bg-black/90' : 'text-white/40 group-hover:text-white'
                      }`}>
                        {archetype === 'enemy' ? (rIdx % 2) * 4 + cIdx : cIdx}
                      </span>
                      {isCurrent && (
                        <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
