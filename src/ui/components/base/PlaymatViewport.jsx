import React, { useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CameraControls from './CameraControls.jsx';
import {
    CARD_WIDTH,
    CARD_HEIGHT,
    PLAYMAT_GAP_X,
    PLAYMAT_GAP_Y,
    PLAYMAT_PADDING as PADDING
} from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * PlaymatViewport - Handles panning and zooming for the grid playmat.
 * Optimized with framer-motion to bypass React render cycle during panning.
 */
const PlaymatViewport = ({ children, gridConfig, activeAreaId }) => {
    const containerRef = useRef(null);

    // Dynamic background resolution for Layer 3 (Deep Background)
    const backgroundId = gridConfig?.backgroundId || 'bg_table_wood_4x4_natural';
    const backgroundPath = resolveSpritePath(backgroundId);

    // Unified physics configuration for high-refresh rate (165Hz+) stability
    const springConfig = { stiffness: 600, damping: 50 };

    // Target Motion Values (The instant "Source of Truth")
    const targetX = useMotionValue(0);
    const targetY = useMotionValue(0);
    const targetScale = useMotionValue(1);

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
        (s) => `${2048 * s}px ${2048 * s}px`
    );

    // Calculate camera boundaries based on grid size and current scale
    const getBounds = useCallback(() => {
        if (!gridConfig || !containerRef.current) return { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
        
        const scale = targetScale.get();
        const vw = containerRef.current.offsetWidth;
        const vh = containerRef.current.offsetHeight;
        
        // Approximate world size of the grid
        const worldW = gridConfig.width * (CARD_WIDTH + PLAYMAT_GAP_X) * scale;
        const worldH = gridConfig.height * (CARD_HEIGHT + PLAYMAT_GAP_Y) * scale;
        
        // Allow panning one viewport width/height away from the grid edge
        return {
            minX: -(worldW) - (vw * 0.5),
            maxX: vw * 0.5,
            minY: -(worldH) - (vh * 0.5),
            maxY: vh * 0.5
        };
    }, [gridConfig, targetScale]);

    const clampPos = useCallback((x, y) => {
        const bounds = getBounds();
        return {
            x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
            y: Math.min(Math.max(y, bounds.minY), bounds.maxY)
        };
    }, [getBounds]);

    const isPanning = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const minScale = 0.1;
    const maxScale = 2;

    const onZoomIn = useCallback(() => targetScale.set(Math.min(targetScale.get() + 0.1, maxScale)), [targetScale]);
    const onZoomOut = useCallback(() => targetScale.set(Math.max(targetScale.get() - 0.1, minScale)), [targetScale]);

    // Center the camera on the hub position initially or when reset
    const centerCamera = useCallback(() => {
        if (!containerRef.current || !gridConfig) return;

        // Re-calculate bounding box offsets to find where the hub physically rendered
        const extents = { minX: 0, minY: 0 };
        if (gridConfig.validCells?.length) {
            extents.minX = Math.min(...gridConfig.validCells.map(c => c.x));
            extents.minY = Math.min(...gridConfig.validCells.map(c => c.y));
        }

        const hubPos = gridConfig.hubPosition || gridConfig.center || { x: 0, y: 0 };
        const visualCenterX = (hubPos.x - extents.minX) * (CARD_WIDTH + PLAYMAT_GAP_X) + (CARD_WIDTH / 2) + PADDING;
        const visualCenterY = (hubPos.y - extents.minY) * (CARD_HEIGHT + PLAYMAT_GAP_Y) + (CARD_HEIGHT / 2) + PADDING;

        const viewportWidth = containerRef.current.offsetWidth;
        const viewportHeight = containerRef.current.offsetHeight;

        if (viewportWidth === 0) return;

        const tx = (viewportWidth / 2) - visualCenterX;
        const ty = (viewportHeight / 2) - visualCenterY;

        targetX.set(tx);
        targetY.set(ty);
        targetScale.set(1);

        // Force springs to snap immediately during recenter to avoid "sliding in" from 0,0
        springX.set(tx);
        springY.set(ty);
        springScale.set(1);
    }, [gridConfig, targetX, targetY, targetScale, springX, springY, springScale]);

    useEffect(() => {
        centerCamera();
        const timer = setTimeout(centerCamera, 100);
        return () => clearTimeout(timer);
    }, [activeAreaId, centerCamera]);

    const handlePointerDown = (e) => {
        // Only ignore pan if we are specifically clicking dynamic UI or active cards
        // Empty slots (GridCell) should NOT block the pan
        if (e.target.closest('button') || e.target.closest('.no-pan') || e.target.closest('.active-card')) return;

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
        const zoomSpeed = 0.001;
        const delta = -e.deltaY * zoomSpeed;

        // Use targetScale.get() instead of visual scale to ensure math is stable
        const prevScale = targetScale.get();
        const nextScale = Math.min(Math.max(prevScale + delta, minScale), maxScale);

        // Zoom into center of viewport
        const viewportWidth = containerRef.current.offsetWidth;
        const viewportHeight = containerRef.current.offsetHeight;
        const focusX = viewportWidth / 2;
        const focusY = viewportHeight / 2;

        const scaleRatio = nextScale / prevScale;

        // Correct Zoom-to-Center math: Target offsets calculated from current target offsets
        const nextX = focusX - (focusX - targetX.get()) * scaleRatio;
        const nextY = focusY - (focusY - targetY.get()) * scaleRatio;

        const clamped = clampPos(nextX, nextY);
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
            {/* Layer 3: Infinite Deep Background - Viewport Static Refactor */}
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
                    willChange: 'transform, scale',
                    zIndex: 1 // Surface above background
                }}
                className="relative"
            >
                {/* Layer 2 Content (Grid) */}
                {children}
            </motion.div>

            <CameraControls
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onRecenter={centerCamera}
                scale={springScale}
            />
        </div>
    );
};

export default React.memo(PlaymatViewport);
