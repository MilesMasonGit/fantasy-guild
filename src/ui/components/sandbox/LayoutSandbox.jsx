import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import GICard from '../base/GICard.jsx';

/**
 * LayoutSandbox - Refactored as "Sizing Forge"
 * Precise tool for Card-to-Slot-to-Icon ratios.
 * Features: Fixed Ratio (256:320), Icon Stacking, Scaling Toggles.
 */
const LayoutSandbox = () => {
    // 1. Core Environment State
    const [cardScale, setCardScale] = useState(0.85); // 1.0 = 256x320
    const [innerArtRes, setInnerArtRes] = useState('high'); // high (512) | native
    const [bgOpacity, setBgOpacity] = useState(0.7);
    const [bgAsset, setBgAsset] = useState('bg_table_dark_antimoire.png');

    // 2. Icon Controls
    const [iconSize, setIconSize] = useState(32); // 32 | 64
    const [iconCount, setIconCount] = useState(1);
    const [iconSpacing, setIconSpacing] = useState(8);

    // 3. Reference Constants
    const SLOT_SIZE = 512;
    const RAW_ART_URL = '/assets/backgrounds/interiors/';

    // Base card dimensions (Strict Task Standard)
    const BASE_W = 256;
    const BASE_H = 320;

    // Derived dimensions (Fixed Ratio)
    const currentW = Math.round(BASE_W * cardScale);
    const currentH = Math.round(BASE_H * cardScale);

    // 4. Side-car Icon Logic (Halfway to boundary)
    const cardLeftX = (SLOT_SIZE - currentW) / 2;
    const cardRightX = cardLeftX + currentW;

    const iconLeftCenter = cardLeftX / 2;
    const iconRightCenter = cardRightX + (SLOT_SIZE - cardRightX) / 2;

    // Helper to render an icon stack
    const renderIconStack = (label, pos, asset = 'icon_wood_oak.png') => {
        return (
            <div
                className="absolute z-20 flex flex-col items-center"
                style={{
                    left: `${pos}px`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    gap: `${iconSpacing}px`
                }}
            >
                {Array.from({ length: iconCount }).map((_, i) => (
                    <div
                        key={i}
                        className="relative bg-[#111]/90 rounded border border-white/10 flex items-center justify-center shadow-2xl ring-1 ring-white/10 group transition-all duration-200"
                        style={{
                            width: `${iconSize + 8}px`,
                            height: `${iconSize + 8}px`
                        }}
                    >
                        <img
                            src={`/assets/icons/items/${asset}`}
                            alt=""
                            className="object-contain pixelated opacity-80"
                            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                        />
                    </div>
                ))}
                <div className="px-1.5 py-0.5 bg-black/60 rounded text-[7px] text-gi-muted border border-white/5 tracking-tighter uppercase whitespace-nowrap mt-1">
                    {label} ({iconSize}px)
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#070707] flex p-8 gap-8 overflow-hidden items-start text-white font-pixel select-none">
            {/* Control Panel */}
            <div className="w-80 bg-gi-surface border border-white/10 p-6 rounded-xl flex flex-col gap-8 shadow-2xl overflow-y-auto max-h-full z-10 shrink-0">
                <div className="border-b border-white/10 pb-4">
                    <h2 className="text-xl text-gi-primary font-bold">Sizing Forge</h2>
                    <p className="text-[10px] text-gi-muted uppercase tracking-widest mt-1">Slot: 512px | Ratio: 256:320</p>
                </div>

                {/* Card Dimension Sizing */}
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-end">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px]">Card Dimensions</label>
                        <div className="text-gi-primary font-bold text-sm tracking-tighter">{currentW} x {currentH} px</div>
                    </div>
                    <input
                        type="range" min="0.3" max="1.5" step="0.01" value={cardScale}
                        onChange={(e) => setCardScale(Number(e.target.value))}
                        className="w-full accent-gi-primary cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[8px] text-gi-muted uppercase opacity-40">
                        <span>Min</span>
                        <span>Scale: {Math.round(cardScale * 100)}%</span>
                        <span>Max</span>
                    </div>
                </div>

                {/* Icon Advanced Controls */}
                <div className="flex flex-col gap-5 border border-white/5 bg-black/20 p-4 rounded-lg">
                    <div className="flex flex-col gap-3">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px]">Side-car Icon Size</label>
                        <div className="flex bg-black/40 rounded-lg p-1 gap-1 border border-white/5">
                            {[32, 64].map(size => (
                                <button
                                    key={size}
                                    onClick={() => setIconSize(size)}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] rounded transition-all uppercase",
                                        iconSize === size ? "bg-gi-primary text-black font-bold" : "hover:bg-white/5 text-gi-muted"
                                    )}
                                >
                                    {size}px
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px] flex justify-between">
                            Stack Count <span>{iconCount}</span>
                        </label>
                        <input
                            type="range" min="1" max="5" step="1" value={iconCount}
                            onChange={(e) => setIconCount(Number(e.target.value))}
                            className="w-full accent-gi-primary cursor-pointer"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px] flex justify-between">
                            Stack Spacing <span>{iconSpacing}px</span>
                        </label>
                        <input
                            type="range" min="0" max="48" step="1" value={iconSpacing}
                            onChange={(e) => setIconSpacing(Number(e.target.value))}
                            className="w-full accent-gi-primary cursor-pointer"
                        />
                    </div>
                </div>

                {/* Inner Art resolution */}
                <div className="flex flex-col gap-3">
                    <label className="text-gi-muted uppercase tracking-wider text-[11px]">Static Inner Art (512x512)</label>
                    <div className="flex bg-black/40 rounded-lg p-1 gap-1 border border-white/5">
                        <button
                            onClick={() => setInnerArtRes('native')}
                            className={cn(
                                "flex-1 py-2 text-[10px] rounded transition-all uppercase",
                                innerArtRes === 'native' ? "bg-gi-primary text-black font-bold" : "hover:bg-white/5 text-gi-muted"
                            )}
                        >
                            Native
                        </button>
                        <button
                            onClick={() => setInnerArtRes('high')}
                            className={cn(
                                "flex-1 py-2 text-[10px] rounded transition-all uppercase",
                                innerArtRes === 'high' ? "bg-gi-primary text-black font-bold" : "hover:bg-white/5 text-gi-muted"
                            )}
                        >
                            Doubled
                        </button>
                    </div>
                </div>

                {/* Background Selector */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px]">Slot Background</label>
                        <div className="grid grid-cols-1 gap-1.5">
                            {['bg_table_dark.png', 'bg_table_dark_antimoire.png', 'bg_table_chaotic.png'].map(asset => (
                                <button
                                    key={asset}
                                    onClick={() => setBgAsset(asset)}
                                    className={cn(
                                        "text-[9px] p-2 text-left rounded border transition-all truncate font-display",
                                        bgAsset === asset ? "bg-gi-primary/20 border-gi-primary text-gi-primary" : "bg-black/20 border-white/10 text-gi-muted hover:border-white/30"
                                    )}
                                >
                                    {asset}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gi-muted uppercase tracking-wider text-[11px] flex justify-between">
                            BG Opacity <span>{Math.round(bgOpacity * 100)}%</span>
                        </label>
                        <input
                            type="range" min="0" max="1" step="0.05" value={bgOpacity}
                            onChange={(e) => setBgOpacity(Number(e.target.value))}
                            className="w-full accent-gi-primary cursor-pointer"
                        />
                    </div>
                </div>

                <div className="mt-auto border-t border-white/5 pt-4 text-[9px] text-gi-muted leading-relaxed opacity-40 italic">
                    <p>• Fixed Aspect Ratio (0.8)</p>
                    <p>• Empty Card UI (Art Only)</p>
                    <p>• Icons Halfway to Boundary</p>
                </div>
            </div>

            {/* Render Area */}
            <div className="flex-1 h-full flex items-center justify-center relative bg-black/60 rounded-3xl border border-white/5 shadow-2xl p-12 overflow-hidden">

                {/* Visual Context Information */}
                <div className="absolute top-8 left-8 flex flex-col gap-1 text-[10px] text-gi-muted uppercase tracking-widest pointer-events-none opacity-40 font-pixel">
                    <div>Fixed Canvas: {SLOT_SIZE}x{SLOT_SIZE} px</div>
                </div>

                {/* The Grid Slot Container (512px) */}
                <div
                    className="relative shrink-0 shadow-[0_60px_150px_rgba(0,0,0,0.9)] border border-white/10 ring-1 ring-white/5 overflow-hidden flex items-center justify-center"
                    style={{
                        width: `${SLOT_SIZE}px`,
                        height: `${SLOT_SIZE}px`,
                        backgroundColor: '#111'
                    }}
                >
                    {/* The Background Wood Texture */}
                    <div
                        className="absolute inset-0 bg-no-repeat bg-cover pointer-events-none transition-opacity duration-300 pointer-events-none"
                        style={{
                            backgroundImage: `url(${RAW_ART_URL}${bgAsset})`,
                            opacity: bgOpacity,
                            imageRendering: 'pixelated'
                        }}
                    />

                    {/* Side-car Icon Left (Halfway point) */}
                    {renderIconStack('Input Stack', iconLeftCenter, 'icon_wood_oak.png')}

                    {/* The Minimal Task Card */}
                    <div
                        className="relative z-10 transition-all duration-150 ease-out flex items-center justify-center overflow-hidden border border-white/20 shadow-[-20px_0_60px_rgba(0,0,0,0.5),20px_0_60px_rgba(0,0,0,0.5)] rounded-lg"
                        style={{
                            width: `${currentW}px`,
                            height: `${currentH}px`,
                            backgroundColor: '#151515'
                        }}
                    >
                        {/* Static Art Layer: Always 512px, centered in card */}
                        <div
                            className="absolute inset-x-0 top-0 h-full w-full pointer-events-none transition-all duration-300"
                            style={{
                                backgroundImage: `url(${innerArtRes === 'high' ? '/assets/backgrounds/interiors/bg_alchemy_lab.png' : '/assets/backgrounds/interiors/bg_tavern_q64.png'})`,
                                backgroundSize: '512px 512px',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                imageRendering: 'pixelated',
                                opacity: 0.9
                            }}
                        />

                        {/* Empty/Minimal Frame Overlay */}
                        <div className="absolute inset-0 border-[6px] border-black/40 rounded-lg pointer-events-none" />
                        <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none" />
                    </div>

                    {/* Side-car Icon Right (Halfway point) */}
                    {renderIconStack('Output Stack', iconRightCenter, 'icon_apple.png')}

                    {/* Proportional Verification Guides */}
                    <div className="absolute inset-0 pointer-events-none opacity-10">
                        {/* Center Axis */}
                        <div className="absolute top-1/2 inset-x-0 h-px bg-gi-primary" />
                        <div className="absolute left-1/2 inset-y-0 w-px bg-gi-primary" />
                    </div>
                </div>

                {/* Sizing Label */}
                <div className="absolute bottom-8 right-8 text-[11px] font-bold text-gi-primary/60 uppercase tracking-widest pointer-events-none">
                    Forge Active • {currentW}x{currentH}
                </div>
            </div>
        </div>
    );
};

export default LayoutSandbox;
