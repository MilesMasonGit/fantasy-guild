import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useViewport } from '../../context/ViewportContext.jsx';
import CameraControls from './CameraControls.jsx';
import { EventBus } from '../../../systems/core/EventBus.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import {
    CARD_WIDTH,
    CARD_HEIGHT,
    PLAYMAT_GAP_X,
    PLAYMAT_GAP_Y,
    PLAYMAT_PADDING as PADDING,
    getAreaSet
} from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { cn } from '../../utils/cn.js';
import { USE_DECK_LOOP } from '../../../config/featureFlags.js';

/**
 * PlaymatViewport - Handles panning and zooming for the grid playmat.
 * Optimized with framer-motion to bypass React render cycle during panning.
 * Gated under the deck loop rework (Phase 1). USE_DECK_LOOP is a module
 * constant, so the early return never changes hook order between renders.
 */
const PlaymatViewport = ({ children, gridConfig, activeAreaId, leftVisible = true, rightVisible = true, isTavernOpen = false }) => {
    if (USE_DECK_LOOP) return null;

    const containerRef = useRef(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    // Shared Motion Values (Instant "Source of Truth" from context)
    const { targetX, targetY, targetScale } = useViewport();

    const [zoomToCursor, setZoomToCursor] = useState(SettingsManager.get('ui.zoomToCursor') ?? true);

    // Calculate dynamic extents of the grid (including gutter tiles)
    const extents = useMemo(() => {
        if (!gridConfig?.validCells?.length) {
            return { minX: 0, maxX: gridConfig?.width || 8, minY: 0, maxY: gridConfig?.height || 8 };
        }
        const xs = gridConfig.validCells.map(c => c.x);
        const ys = gridConfig.validCells.map(c => c.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }, [gridConfig]);

    const gridWidth = extents.maxX - extents.minX + 1;
    const gridHeight = extents.maxY - extents.minY + 1;

    // Track container dimensions to react to window resizing
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setViewportSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Calculate dynamic minimum scale: The board (tiles only) must fit the screen
    const minScale = useMemo(() => {
        if (!gridConfig || viewportSize.width === 0) return 0.1;

        const GRID_PITCH = 512;
        // We only care about fitting the tiles, not the internal padding
        const paddedWidth = gridWidth * GRID_PITCH;
        const paddedHeight = gridHeight * GRID_PITCH;

        const scaleX = viewportSize.width / paddedWidth;
        const scaleY = viewportSize.height / paddedHeight;

        return Math.max(Math.min(scaleX, scaleY), 0.1);
    }, [gridWidth, gridHeight, viewportSize]);

    const maxScale = 2;

    // Define the stepped zoom levels
    const zoomLevels = useMemo(() => {
        // Core levels: 0.5, 1.0, 1.5, 2.0
        const steps = [0.5, 1.0, 1.5, 2.0].filter(s => s >= minScale && s <= maxScale);
        
        // Ensure bounds are always included
        const levels = [minScale, ...steps, maxScale];
        
        // Sort and deduplicate (in case minScale is exactly 0.5 etc)
        return [...new Set(levels)].sort((a, b) => a - b);
    }, [minScale, maxScale]);

    // Enforce minScale if area changes or viewport shrinks
    useEffect(() => {
        if (targetScale.get() < minScale) {
            targetScale.set(minScale);
        }
    }, [minScale, targetScale]);

    // Dynamic background resolution for Layer 0 (The Table)
    const activeArea = getAreaSet(activeAreaId);
    const backgroundId = activeArea?.backgroundImage || 'pm_table_wood_spruce';
    const backgroundPath = resolveSpritePath(backgroundId);

    // Unified physics configuration for high-refresh rate (165Hz+) stability
    const springConfig = { stiffness: 600, damping: 50 };

    // Visual Springs (Derived from targets, used for rendering)
    const springX = useSpring(targetX, springConfig);
    const springY = useSpring(targetY, springConfig);
    const springScale = useSpring(targetScale, springConfig);

    // Transform motion values into infinite repeating background properties
    // This allows the background to pan and zoom with the grid while filling the viewport.
    const bgPosition = useTransform(
        [springX, springY],
        ([x, y]) => `${x}px ${y}px`
    );
    const bgSize = useTransform(
        springScale,
        (s) => `${512 * s}px ${512 * s}px`
    );

    // Calculate camera boundaries based on grid size and current scale
    const getBounds = useCallback((overrideScale = null) => {
        if (!gridConfig || !containerRef.current) return { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };

        const scale = overrideScale ?? targetScale.get();
        const vw = viewportSize.width || containerRef.current.offsetWidth;
        const vh = viewportSize.height || containerRef.current.offsetHeight;

        const boardW = gridWidth * 512 * scale;
        const boardH = gridHeight * 512 * scale;
        
        // The tile's physical edge starts at PLAYMAT_PADDING (512) - GRID_PITCH/2 (256) = 256px
        const edge_pad = 256 * scale;

        let maxX, minX, maxY, minY;

        // Horizontal Bounds
        if (boardW <= vw) {
            // Board fits: Center it
            const offset = (vw - boardW) / 2;
            maxX = offset - edge_pad;
            minX = offset - edge_pad;
        } else {
            // Board is larger: Allow panning between edges
            maxX = -edge_pad;
            minX = vw - boardW - edge_pad;
        }

        // Vertical Bounds
        if (boardH <= vh) {
            // Board fits: Center it
            const offset = (vh - boardH) / 2;
            maxY = offset - edge_pad;
            minY = offset - edge_pad;
        } else {
            // Board is larger: Allow panning between edges
            maxY = -edge_pad;
            minY = vh - boardH - edge_pad;
        }

        return { minX, maxX, minY, maxY };
    }, [gridWidth, gridHeight, targetScale, viewportSize]);

    const clampPos = useCallback((x, y, scale = null) => {
        const bounds = getBounds(scale);
        return {
            x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
            y: Math.min(Math.max(y, bounds.minY), bounds.maxY)
        };
    }, [getBounds]);

    useEffect(() => {
        const cleanupSettings = EventBus.subscribe('settings_updated', (newSettings) => {
            setZoomToCursor(newSettings.ui?.zoomToCursor ?? true);
        });

        const cleanupFocus = EventBus.subscribe('focus_camera', (data) => {
            const viewportWidth = containerRef.current?.offsetWidth || 0;
            const viewportHeight = containerRef.current?.offsetHeight || 0;
            if (viewportWidth === 0 || viewportHeight === 0) return;

            const ts = 1.0;
            const worldX = (data.x - extents.minX) * 512 + 512;
            const worldY = (data.y - extents.minY) * 512 + 512;

            const tx = (viewportWidth / 2) - worldX * ts;
            const ty = (viewportHeight / 2) - worldY * ts;

            const clamped = clampPos(tx, ty, ts);
            targetX.set(clamped.x);
            targetY.set(clamped.y);
            targetScale.set(ts);
        });

        return () => {
            cleanupSettings();
            cleanupFocus();
        };
    }, [extents, clampPos, targetX, targetY, targetScale]);

    const isPanning = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const lastDragStartTime = useRef(0);


    const onZoomIn = useCallback(() => {
        const current = targetScale.get();
        // Find the first level greater than current (with a tiny epsilon for float safety)
        const nextScale = zoomLevels.find(l => l > current + 0.01) || maxScale;
        
        const clamped = clampPos(targetX.get(), targetY.get(), nextScale);
        targetX.set(clamped.x);
        targetY.set(clamped.y);
        targetScale.set(nextScale);
    }, [targetScale, targetX, targetY, clampPos, zoomLevels, maxScale]);

    const onZoomOut = useCallback(() => {
        const current = targetScale.get();
        // Find the last level smaller than current
        const reversed = [...zoomLevels].reverse();
        const nextScale = reversed.find(l => l < current - 0.01) || minScale;

        const clamped = clampPos(targetX.get(), targetY.get(), nextScale);
        targetX.set(clamped.x);
        targetY.set(clamped.y);
        targetScale.set(nextScale);
    }, [targetScale, targetX, targetY, clampPos, zoomLevels, minScale]);

    // Physics-Stable Centering: Only fires if dimensions are valid and world is not being dragged.
    const centerCamera = useCallback((force = false) => {
        const isDragging = document.body.hasAttribute('data-dragging-type');
        const isLocallyLocked = Date.now() - lastDragStartTime.current < 500; // Lockout for 500ms
        if (!containerRef.current || !gridConfig || ((isDragging || isLocallyLocked) && !force)) return;

        const viewportWidth = containerRef.current.offsetWidth || 0;
        const viewportHeight = containerRef.current.offsetHeight || 0;
        if (viewportWidth === 0 || viewportHeight === 0) return;

        // Calculate world center based on the full tile footprint
        // The center of the board is the midpoint between the first and last tile centers
        const visualCenterX = ((gridWidth - 1) * 512) / 2 + 512;
        const visualCenterY = ((gridHeight - 1) * 512) / 2 + 512;

        const tx = (viewportWidth / 2) - visualCenterX;
        const ty = (viewportHeight / 2) - visualCenterY;

        const clamped = clampPos(tx, ty);
        targetX.set(clamped.x); targetY.set(clamped.y); targetScale.set(1);
        springX.set(clamped.x); springY.set(clamped.y); springScale.set(1);
    }, [gridWidth, gridHeight, clampPos, targetX, targetY, targetScale, springX, springY, springScale]);

    // AUTO-CENTER: Only triggers on Biome (Area) change, never during a drag.
    useEffect(() => {
        centerCamera();
        const timer = setTimeout(() => centerCamera(), 100);
        return () => clearTimeout(timer);
    }, [activeAreaId, centerCamera]);

    const handlePointerDown = (e) => {
        // Only ignore pan if we are specifically clicking dynamic UI or active cards
        // Empty slots (GridCell) should NOT block the pan
        const isDndTarget = e.target.closest('.dnd-target');
        const isGridCell = e.target.closest('[data-type="grid-cell"]');
        const isCard = (isDndTarget && !isGridCell) || e.target.closest('.active-card');

        const isButton = e.target.closest('button');
        const isNoPan = e.target.closest('.no-pan');
        const isDragging = document.body.hasAttribute('data-dragging-type');

        if (isCard || isButton || isNoPan || isDragging) {
            if (isCard) lastDragStartTime.current = Date.now();
            return;
        }

        // Capture pointer on the container to ensure we receive all events reliably
        if (containerRef.current) {
            containerRef.current.setPointerCapture(e.pointerId);
        }

        isPanning.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e) => {
        if (!isPanning.current) return;

        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;

        const next = clampPos(targetX.get() + dx, targetY.get() + dy);
        targetX.set(next.x);
        targetY.set(next.y);

        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
        if (isPanning.current && containerRef.current) {
            try {
                containerRef.current.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Silently handle cases where pointer was already released or stolen
            }
        }
        isPanning.current = false;
    };

    // Fail-safe: Release panning if browser steals focus or right-click interrupts
    const handleLostCapture = () => {
        isPanning.current = false;
    };

    const handleWheel = (e) => {
        if (e.ctrlKey) return;
        
        // Use a threshold to prevent tiny scrolls from triggering jumps too fast
        if (Math.abs(e.deltaY) < 10) return;

        const current = targetScale.get();
        let nextScale;

        if (e.deltaY < 0) {
            // Scrolling Up -> Zoom In
            nextScale = zoomLevels.find(l => l > current + 0.01) || maxScale;
        } else {
            // Scrolling Down -> Zoom Out
            const reversed = [...zoomLevels].reverse();
            nextScale = reversed.find(l => l < current - 0.01) || minScale;
        }

        if (nextScale === current) return;

        // Zoom into center of viewport or cursor
        const viewportWidth = containerRef.current.offsetWidth;
        const viewportHeight = containerRef.current.offsetHeight;
        
        let focusX = viewportWidth / 2;
        let focusY = viewportHeight / 2;

        if (zoomToCursor) {
            const rect = containerRef.current.getBoundingClientRect();
            focusX = e.clientX - rect.left;
            focusY = e.clientY - rect.top;
        }

        const prevScale = current;
        const scaleRatio = nextScale / prevScale;

        // Correct Zoom-to-Center math
        const nextX = focusX - (focusX - targetX.get()) * scaleRatio;
        const nextY = focusY - (focusY - targetY.get()) * scaleRatio;

        const clamped = clampPos(nextX, nextY, nextScale);
        targetX.set(clamped.x);
        targetY.set(clamped.y);
        targetScale.set(nextScale);
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative cursor-default touch-none select-none bg-[#0a0a0a]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handleLostCapture}
            onWheel={handleWheel}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {/* Layer 0: The Table */}
            {backgroundPath && (
                <motion.div
                    className="absolute inset-0 pointer-events-none select-none"
                    style={{
                        zIndex: 0,
                        backgroundImage: `url("${backgroundPath}")`,
                        backgroundPosition: bgPosition,
                        backgroundSize: bgSize,
                        backgroundRepeat: 'repeat',
                        imageRendering: 'pixelated',
                        opacity: 0.8 // Subtle dimming for better tile contrast
                    }}
                />
            )}

            <motion.div
                style={{
                    x: springX,
                    y: springY,
                    scale: springScale,
                    transformOrigin: '0 0',
                    zIndex: 1 // Surface above background
                }}
                className="relative"
            >
                {/* Layer 2 Content (Grid) */}
                {children}
            </motion.div>

            {/* Global Viewport HUD Layer (Moves to avoid panels) */}
            <div className={cn(
                "absolute inset-y-0 z-[100] pointer-events-none transition-all duration-300 ease-in-out",
                !leftVisible ? "left-0" : (isTavernOpen ? "left-[34rem]" : "left-64"),
                rightVisible ? "right-64" : "right-0"
            )}>
                <div className="relative w-full h-full">
                    <CameraControls
                        onZoomIn={onZoomIn}
                        onZoomOut={onZoomOut}
                        onRecenter={() => centerCamera(true)}
                        scale={springScale}
                    />
                </div>
            </div>

        </div>
    );
};

export default React.memo(PlaymatViewport);
