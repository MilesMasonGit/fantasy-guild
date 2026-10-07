import { useState, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, X, RotateCcw, Grid, Move, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const ROW_MAP = {
    idle: { index: 0, label: 'Idle', color: 'text-blue-400' },
    walk: { index: 1, label: 'Walk', color: 'text-amber-400' },
    active: { index: 2, label: 'Active', color: 'text-emerald-400' }
};

const FPS_PRESETS = [4, 6, 8, 10, 12, 16];
const ZOOM_PRESETS = [1, 2, 3, 4, 6, 8];

/**
 * AnimationStudioModal: Developer & Visual QA tool for inspecting hero animation cycles.
 * Supports real-time playback, frame-by-frame scrubbing, floor/center alignment guides, onion
 * skinning, and interactive full-sheet frame mapping.
 */
export const AnimationStudioModal = ({ isOpen, onClose }) => {
    const [sheetPath, setSheetPath] = useState('/assets/heroes/animations/ani_recruit_0.png');
    const [action, setAction] = useState('idle'); // 'idle' | 'walk' | 'active' | 'all'
    const [frame, setFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [fps, setFps] = useState(8);
    const [flipH, setFlipH] = useState(false);

    const [zoom, setZoom] = useState(4);
    const [showGrid, setShowGrid] = useState(true);
    const [showCenter, setShowCenter] = useState(true);
    const [showFloor, setShowFloor] = useState(true);
    const [floorY, setFloorY] = useState(58); // default anchor baseline in a 64px cell
    const [showOnion, setShowOnion] = useState(false);
    const [bgMode, setBgMode] = useState('dark'); // 'dark' | 'grid' | 'wood'

    const [motionRunway, setMotionRunway] = useState(false);
    const [runwayPos, setRunwayPos] = useState(50); // percentage 0..100

    useEffect(() => {
        if (!isOpen || !isPlaying) return;

        const interval = 1000 / fps;
        const timer = setInterval(() => {
            setFrame(prev => (prev + 1) % 8);
        }, interval);

        return () => clearInterval(timer);
    }, [isOpen, isPlaying, fps]);

    useEffect(() => {
        if (!isOpen || !isPlaying || !motionRunway) return;

        let animId;
        let lastTime = performance.now();
        const speed = 25; // % per second across the track

        const step = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            setRunwayPos(prev => {
                const next = prev + (flipH ? -speed : speed) * dt;
                if (next > 95) return 5;
                if (next < 5) return 95;
                return next;
            });
            animId = requestAnimationFrame(step);
        };

        animId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animId);
    }, [isOpen, isPlaying, motionRunway, flipH]);

    // Keyboard navigation (Space to toggle play, Arrow keys to step frames, Esc to close)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(p => !p);
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                setIsPlaying(false);
                setFrame(f => (f - 1 + 8) % 8);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                setIsPlaying(false);
                setFrame(f => (f + 1) % 8);
            } else if (e.code === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentFrame = frame % 8;
    const prevFrame = (currentFrame - 1 + 8) % 8;

    const renderFrameView = (actKey, customZoom = zoom) => {
        const row = ROW_MAP[actKey]?.index ?? 0;
        const size = 64 * customZoom;
        const sheetW = 512 * customZoom;
        const sheetH = 192 * customZoom;
        const offsetX = currentFrame * 64 * customZoom;
        const offsetY = row * 64 * customZoom;
        const onionOffsetX = prevFrame * 64 * customZoom;

        return (
            <div
                className="relative overflow-hidden select-none"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: flipH ? 'scaleX(-1)' : 'none'
                }}
            >
                {showOnion && (
                    <img
                        src={sheetPath}
                        alt=""
                        draggable={false}
                        className="absolute pointer-events-none"
                        style={{
                            width: `${sheetW}px`,
                            height: `${sheetH}px`,
                            maxWidth: 'none',
                            maxHeight: 'none',
                            imageRendering: 'pixelated',
                            transform: `translate(-${onionOffsetX}px, -${offsetY}px)`,
                            opacity: 0.35,
                            filter: 'hue-rotate(180deg) saturate(200%)'
                        }}
                    />
                )}

                <img
                    src={sheetPath}
                    alt=""
                    draggable={false}
                    className="absolute pointer-events-none"
                    style={{
                        width: `${sheetW}px`,
                        height: `${sheetH}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        imageRendering: 'pixelated',
                        transform: `translate(-${offsetX}px, -${offsetY}px)`
                    }}
                />

                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform: flipH ? 'scaleX(-1)' : 'none' }}
                >
                    {showGrid && (
                        <div className="absolute inset-0 border border-white/20 ring-1 ring-black/40" />
                    )}

                    {showCenter && (
                        <>
                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-400/40 -translate-x-1/2 shadow-[0_0_2px_cyan]" />
                            <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-400/40 -translate-y-1/2 shadow-[0_0_2px_cyan]" />
                        </>
                    )}

                    {showFloor && (
                        <div
                            className="absolute left-0 right-0 h-px bg-amber-400 shadow-[0_0_3px_orange]"
                            style={{ top: `${(floorY / 64) * 100}%` }}
                        >
                            <span className="absolute right-1 bottom-0.5 text-[9px] font-mono text-amber-300 font-bold bg-black/70 px-1 rounded">
                                Y:{floorY}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 pointer-events-auto select-none">
            <div className="w-[1100px] max-w-full max-h-[92vh] bg-gi-surface border-2 border-gi-primary/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gi-text">
                
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-gi-border bg-gi-base/80">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gi-primary/20 border border-gi-primary/40 flex items-center justify-center text-gi-primary font-bold">
                            🎞️
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-lg text-gi-primary leading-none flex items-center gap-2">
                                Sprite Animation Studio
                                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-gi-primary/15 text-gi-primary border border-gi-primary/30">
                                    8-Frame Inspector
                                </span>
                            </h2>
                            <p className="text-xs text-gi-muted mt-0.5">
                                Frame alignment, floor baseline calibration & speed tuning
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center bg-gi-surface/90 border border-gi-border rounded-lg p-1 gap-1">
                        {['idle', 'walk', 'active'].map(act => (
                            <button
                                key={act}
                                onClick={() => setAction(act)}
                                className={cn(
                                    'px-3 py-1 rounded text-xs font-bold transition-all uppercase tracking-wider',
                                    action === act
                                        ? 'bg-gi-primary text-black shadow-md'
                                        : 'text-gi-muted hover:text-gi-text hover:bg-white/5'
                                )}
                            >
                                {ROW_MAP[act].label}
                            </button>
                        ))}
                        <button
                            onClick={() => setAction('all')}
                            className={cn(
                                'px-3 py-1 rounded text-xs font-bold transition-all uppercase tracking-wider',
                                action === 'all'
                                    ? 'bg-gi-accent text-white shadow-md'
                                    : 'text-gi-muted hover:text-gi-text hover:bg-white/5'
                            )}
                        >
                            Trio View
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gi-danger/20 hover:text-gi-danger rounded-lg text-gi-muted transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    
                    <div className="flex-1 flex flex-col bg-black/40 border-r border-gi-border relative overflow-hidden">
                        
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gi-border/60 bg-gi-surface/40 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="text-gi-muted font-bold">Surface:</span>
                                <button
                                    onClick={() => setBgMode('dark')}
                                    className={cn('px-2 py-0.5 rounded border text-[11px]', bgMode === 'dark' ? 'border-gi-primary bg-gi-primary/20 text-gi-primary' : 'border-white/10 text-gi-muted')}
                                >
                                    Dark
                                </button>
                                <button
                                    onClick={() => setBgMode('grid')}
                                    className={cn('px-2 py-0.5 rounded border text-[11px]', bgMode === 'grid' ? 'border-gi-primary bg-gi-primary/20 text-gi-primary' : 'border-white/10 text-gi-muted')}
                                >
                                    Checker
                                </button>
                                <button
                                    onClick={() => setBgMode('wood')}
                                    className={cn('px-2 py-0.5 rounded border text-[11px]', bgMode === 'wood' ? 'border-gi-primary bg-gi-primary/20 text-gi-primary' : 'border-white/10 text-gi-muted')}
                                >
                                    Table Wood
                                </button>
                            </div>

                            <div className="flex items-center gap-1">
                                <span className="text-gi-muted font-bold mr-1">Zoom:</span>
                                {ZOOM_PRESETS.map(z => (
                                    <button
                                        key={z}
                                        onClick={() => setZoom(z)}
                                        className={cn(
                                            'px-2 py-0.5 rounded text-[11px] font-mono transition-colors',
                                            zoom === z
                                                ? 'bg-gi-primary text-black font-bold'
                                                : 'text-gi-muted hover:bg-white/5'
                                        )}
                                    >
                                        {z}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div
                            className={cn(
                                'flex-1 relative flex items-center justify-center overflow-auto p-6 transition-colors',
                                bgMode === 'dark' && 'bg-[#0f1115]',
                                bgMode === 'grid' && 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a1c23]',
                                bgMode === 'wood' && 'bg-[#2a1d17]'
                            )}
                        >
                            {motionRunway && action !== 'all' ? (
                                <div className="w-full max-w-2xl h-64 border border-white/10 rounded-xl relative overflow-hidden bg-black/30 flex items-center">
                                    <div className="absolute bottom-12 left-0 right-0 h-1 bg-white/20 border-b border-amber-400/50" />
                                    <div
                                        className="absolute -bottom-2 transition-all duration-75"
                                        style={{ left: `${runwayPos}%`, transform: 'translateX(-50%)' }}
                                    >
                                        {renderFrameView(action, 3)}
                                    </div>
                                    <div className="absolute top-2 left-3 text-[11px] font-mono text-gi-muted">
                                        Walking Track Simulator ({runwayPos.toFixed(0)}%)
                                    </div>
                                </div>
                            ) : action === 'all' ? (
                                <div className="flex items-center justify-center gap-8 flex-wrap">
                                    {['idle', 'walk', 'active'].map(act => (
                                        <div key={act} className="flex flex-col items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className={cn('text-xs font-bold uppercase tracking-wider', ROW_MAP[act].color)}>
                                                    {ROW_MAP[act].label}
                                                </span>
                                                <span className="text-[10px] font-mono text-gi-muted">
                                                    Row {ROW_MAP[act].index}
                                                </span>
                                            </div>
                                            <div className="p-3 bg-black/40 rounded-xl border border-white/10 shadow-xl">
                                                {renderFrameView(act, Math.min(zoom, 4))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 bg-black/50 rounded-2xl border border-gi-border shadow-2xl relative group">
                                        {renderFrameView(action, zoom)}
                                    </div>
                                    <div className="flex items-center gap-3 bg-gi-surface/80 border border-gi-border px-3 py-1.5 rounded-full text-xs font-mono">
                                        <span className={cn('font-bold uppercase', ROW_MAP[action]?.color)}>
                                            {ROW_MAP[action]?.label}
                                        </span>
                                        <span className="text-white/20">•</span>
                                        <span className="text-gi-primary font-bold">
                                            Frame {currentFrame} / 7
                                        </span>
                                        <span className="text-white/20">•</span>
                                        <span className="text-gi-muted">
                                            Cell: X[{currentFrame * 64}..{(currentFrame + 1) * 64}] Y[{ROW_MAP[action]?.index * 64}..{(ROW_MAP[action]?.index + 1) * 64}]
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-2 border-t border-gi-border/60 bg-gi-surface/40 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-gi-text">
                                    <input
                                        type="checkbox"
                                        checked={motionRunway}
                                        onChange={e => setMotionRunway(e.target.checked)}
                                        className="accent-gi-primary rounded"
                                    />
                                    <span>Simulate Walking Track</span>
                                </label>
                                {motionRunway && (
                                    <button
                                        onClick={() => setRunwayPos(50)}
                                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] text-gi-muted"
                                    >
                                        Reset Position
                                    </button>
                                )}
                            </div>
                            <span className="text-gi-muted text-[11px]">
                                Shortcuts: <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">Space</kbd> Play/Pause, <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">←</kbd> <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">→</kbd> Step Frame
                            </span>
                        </div>
                    </div>

                    <div className="w-80 flex flex-col bg-gi-surface p-5 gap-5 overflow-y-auto custom-scrollbar border-l border-gi-border">
                        
                        <div className="bg-gi-base/60 border border-gi-border rounded-xl p-4 flex flex-col gap-3.5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-gi-muted">
                                    Playback
                                </span>
                                <span className="font-mono text-xs font-bold text-gi-primary">
                                    {fps} FPS ({Math.round(1000 / fps)}ms/f)
                                </span>
                            </div>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => {
                                        setIsPlaying(false);
                                        setFrame(f => (f - 1 + 8) % 8);
                                    }}
                                    className="p-2 rounded-lg bg-gi-surface hover:bg-gi-primary/20 border border-gi-border text-gi-text hover:text-gi-primary transition-colors"
                                    title="Previous Frame (Left Arrow)"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <button
                                    onClick={() => setIsPlaying(p => !p)}
                                    className={cn(
                                        'px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all',
                                        isPlaying
                                            ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                            : 'bg-gi-primary hover:bg-gi-primary-hover text-black'
                                    )}
                                >
                                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsPlaying(false);
                                        setFrame(f => (f + 1) % 8);
                                    }}
                                    className="p-2 rounded-lg bg-gi-surface hover:bg-gi-primary/20 border border-gi-border text-gi-text hover:text-gi-primary transition-colors"
                                    title="Next Frame (Right Arrow)"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gi-muted">Scrubber</span>
                                    <span className="font-mono font-bold text-gi-text">Frame #{currentFrame}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={7}
                                    value={currentFrame}
                                    onChange={e => {
                                        setIsPlaying(false);
                                        setFrame(Number(e.target.value));
                                    }}
                                    className="w-full accent-gi-primary cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] font-mono text-gi-muted px-0.5">
                                    {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                                        <span
                                            key={num}
                                            onClick={() => {
                                                setIsPlaying(false);
                                                setFrame(num);
                                            }}
                                            className={cn(
                                                'cursor-pointer hover:text-gi-primary',
                                                num === currentFrame && 'text-gi-primary font-bold scale-125'
                                            )}
                                        >
                                            {num}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5 pt-2 border-t border-gi-border/60">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gi-muted">Framerate</span>
                                    <div className="flex gap-1">
                                        {FPS_PRESETS.map(preset => (
                                            <button
                                                key={preset}
                                                onClick={() => setFps(preset)}
                                                className={cn(
                                                    'px-1.5 py-0.5 rounded text-[10px] font-mono',
                                                    fps === preset
                                                        ? 'bg-gi-primary text-black font-bold'
                                                        : 'bg-gi-surface text-gi-muted hover:text-gi-text'
                                                )}
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
                                    onChange={e => setFps(Number(e.target.value))}
                                    className="w-full accent-gi-primary cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="bg-gi-base/60 border border-gi-border rounded-xl p-4 flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-gi-muted">
                                Alignment Guides
                            </span>

                            <div className="space-y-2 text-xs">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <Grid className="w-3.5 h-3.5 text-gi-muted" />
                                        64×64 Cell Outline
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={showGrid}
                                        onChange={e => setShowGrid(e.target.checked)}
                                        className="accent-gi-primary"
                                    />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <Move className="w-3.5 h-3.5 text-cyan-400" />
                                        Center Crosshairs (32, 32)
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={showCenter}
                                        onChange={e => setShowCenter(e.target.checked)}
                                        className="accent-gi-primary"
                                    />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                        Onion Skinning (Prev Frame)
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={showOnion}
                                        onChange={e => setShowOnion(e.target.checked)}
                                        className="accent-gi-primary"
                                    />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                        Flip Horizontal (Facing Left)
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={flipH}
                                        onChange={e => setFlipH(e.target.checked)}
                                        className="accent-gi-primary"
                                    />
                                </label>
                            </div>

                            <div className="pt-2 border-t border-gi-border/60 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-400">
                                        <input
                                            type="checkbox"
                                            checked={showFloor}
                                            onChange={e => setShowFloor(e.target.checked)}
                                            className="accent-amber-400"
                                        />
                                        Floor Baseline
                                    </label>
                                    <span className="font-mono font-bold text-amber-300">Y: {floorY}px</span>
                                </div>
                                <input
                                    type="range"
                                    min={32}
                                    max={63}
                                    value={floorY}
                                    onChange={e => setFloorY(Number(e.target.value))}
                                    disabled={!showFloor}
                                    className="w-full accent-amber-400 cursor-pointer disabled:opacity-30"
                                />
                                <span className="text-[10px] text-gi-muted">
                                    Align the bottom of the hero's feet to this line to prevent ground jitter.
                                </span>
                            </div>
                        </div>

                        <div className="bg-gi-base/60 border border-gi-border rounded-xl p-4 flex flex-col gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-gi-muted">
                                Active Sprite Sheet
                            </span>
                            <input
                                type="text"
                                value={sheetPath}
                                onChange={e => setSheetPath(e.target.value)}
                                className="w-full bg-gi-surface border border-gi-border rounded px-2.5 py-1.5 text-xs font-mono text-gi-text focus:border-gi-primary outline-none"
                                placeholder="/assets/heroes/animations/ani_recruit_0.png"
                            />
                            <div className="flex gap-1 mt-1">
                                <button
                                    onClick={() => setSheetPath('/assets/heroes/animations/ani_recruit_0.png')}
                                    className="text-[10px] px-2 py-0.5 rounded bg-gi-surface hover:bg-gi-primary/20 text-gi-primary border border-gi-border"
                                >
                                    Default: ani_recruit_0
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="border-t border-gi-border bg-gi-base/90 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs px-1">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gi-primary uppercase tracking-wider">
                                Master Sheet Frame Map
                            </span>
                            <span className="text-gi-muted font-mono text-[11px]">
                                (512 × 192 px • 3 Rows × 8 Frames • Click any frame to inspect)
                            </span>
                        </div>
                        <span className="text-gi-muted text-[11px]">
                            Selected: <strong className="text-gi-primary font-mono">{ROW_MAP[action]?.label || 'Idle'} #{currentFrame}</strong>
                        </span>
                    </div>

                    <div className="relative border border-white/10 rounded-lg overflow-hidden bg-black/60 mx-auto select-none">
                        <img
                            src={sheetPath}
                            alt="Sprite Sheet"
                            draggable={false}
                            className="block"
                            style={{
                                width: '512px',
                                height: '192px',
                                imageRendering: 'pixelated'
                            }}
                        />

                        <div className="absolute inset-0 grid grid-cols-8 grid-rows-3 pointer-events-auto">
                            {['idle', 'walk', 'active'].map((actKey, _rIndex) => (
                                Array.from({ length: 8 }).map((_, fIndex) => {
                                    const isCurrent = (action === actKey || action === 'all') && currentFrame === fIndex;
                                    return (
                                        <button
                                            key={`${actKey}-${fIndex}`}
                                            onClick={() => {
                                                setAction(actKey);
                                                setFrame(fIndex);
                                                setIsPlaying(false);
                                            }}
                                            className={cn(
                                                'relative border border-white/5 hover:border-gi-primary/70 transition-all flex flex-col justify-between p-1 text-left group',
                                                isCurrent && 'border-2 border-gi-primary bg-gi-primary/25 shadow-[inset_0_0_8px_rgba(234,179,8,0.5)]'
                                            )}
                                            title={`${ROW_MAP[actKey].label} Frame ${fIndex}`}
                                        >
                                            <span className={cn(
                                                'text-[8px] font-mono leading-none font-bold px-1 py-0.5 rounded bg-black/60',
                                                isCurrent ? 'text-gi-primary bg-black/90' : 'text-white/40 group-hover:text-white'
                                            )}>
                                                {fIndex}
                                            </span>
                                            {isCurrent && (
                                                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-gi-primary animate-ping" />
                                            )}
                                        </button>
                                    );
                                })
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AnimationStudioModal;
