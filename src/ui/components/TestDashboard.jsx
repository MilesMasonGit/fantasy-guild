import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getAllAreaSets } from '../../config/registries/areaSetRegistry.js';
import { Bug, Plus, X } from 'lucide-react';
import { useBannerCardWidth, setBannerCardWidth, BANNER_WIDTH_MIN, BANNER_WIDTH_MAX } from '../dev/cardSizeStore.js';

/**
 * TestDashboard: A temporary developer QA tool for spawning test data
 * and verifying React data-binding reactivity against the Vanilla Engine.
 */
export const TestDashboard = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [showFontTest, setShowFontTest] = useState(false);
    const cardWidth = useBannerCardWidth();

    if (!engine) return null;

    const testActions = [
        {
            label: "🔤 Test Typography Scales",
            onClick: () => {
                setShowFontTest(true);
            }
        },
        {
            label: "✨ Spawn Cards/Items...",
            onClick: () => {
                engine.EventBus.publish('dev:open-spawn-item');
            }
        },
        {
            label: "Add 1k Gold",
            onClick: () => {
                engine.GameState.state.currency.gold += 1000;
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "Add 100 Renown",
            onClick: () => {
                engine.GameState.state.currency.influence += 100;
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "Toggle Threat",
            onClick: () => {
                const threats = engine.GameState.state.threats.activeInvasions;
                if (threats.length > 0) {
                    engine.GameState.state.threats.activeInvasions = [];
                } else {
                    engine.GameState.state.threats.activeInvasions.push({ id: 'test_invasion', name: 'Goblin Raid' });
                }
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "Hire Random Hero",
            onClick: () => {
                const hero = generateHero();
                engine.HeroManager.addHero(hero);
            }
        },
        {
            label: "🛠️ Toggle Layout Sandbox",
            onClick: () => {
                engine.EventBus.publish('dev:toggle-sandbox');
            }
        },
        // === Area Rework Dev Tools ===
        {
            label: "🎴 Buy Unified Pack",
            onClick: () => {
                const result = engine.CollectionManager.buyUnifiedPack();
                console.log('[Dev] Buy unified pack result:', result);
                if (result.success) {
                    engine.EventBus.publish('ui:open_pack_overlay', { options: result.options, unified: true });
                }
            }
        },
        {
            label: "🌲 Unlock Forest",
            onClick: () => {
                const collection = engine.GameState.state.collection;
                if (!collection.unlockedAreaSets.includes('area_whispering_woods')) {
                    collection.unlockedAreaSets.push('area_whispering_woods');
                }
                if (!engine.GameState.state.mapFragments) {
                    engine.GameState.state.mapFragments = {};
                }
                engine.GameState.state.mapFragments['area_whispering_woods'] = 999;
                engine.EventBus.publish('state_changed');
                console.log('[Dev] Forest unlocked');
            }
        },
        {
            label: "🌍 Unlock All Areas",
            onClick: () => {
                const allAreas = getAllAreaSets();
                const collection = engine.GameState.state.collection;
                if (!engine.GameState.state.mapFragments) {
                    engine.GameState.state.mapFragments = {};
                }
                Object.values(allAreas).forEach(area => {
                    if (!collection.unlockedAreaSets.includes(area.id)) {
                        collection.unlockedAreaSets.push(area.id);
                    }
                    engine.GameState.state.mapFragments[area.id] = 999;
                });
                engine.EventBus.publish('state_changed');
                console.log('[Dev] All areas unlocked');
            }
        },
        {
            label: "🗺️ Toggle World Map",
            onClick: () => {
                engine.EventBus.publish('ui:toggle-world-map');
            }
        },
        {
            label: "🌧️ Spawn Rainfall",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'forest';
                engine.EventBus.publish('spawn_area_event', { 
                    areaId: activeAreaId, 
                    eventId: 'rainfall' 
                });
                console.log('[Dev] Rainfall spawn triggered');
            }
        },
        {
            label: "⚡ Chaos +250",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'area_guild_hall';
                const areaState = engine.GameState.state.areaStates[activeAreaId];
                if (areaState) {
                    areaState.chaosPoints = Math.min(1000, (areaState.chaosPoints || 0) + 250);
                    engine.EventBus.publish('chaos_updated', { areaId: activeAreaId, points: areaState.chaosPoints });
                    console.log('[Dev] Chaos increased to:', areaState.chaosPoints);
                }
            }
        },
        {
            label: "🐔 Spawn Hostile Hens",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'area_guild_hall';
                engine.EventBus.publish('spawn_invasion', { 
                    areaId: activeAreaId, 
                    invasionId: 'hostile_hens' 
                });
                console.log('[Dev] Hostile Hens invasion triggered');
            }
        },
        {
            label: "🩸 Drain 9 HP (All)",
            onClick: () => {
                const heroes = engine.GameState.state.heroes;
                heroes.forEach(h => {
                    if (h.hp) {
                        h.hp.current = Math.max(0, h.hp.current - 9);
                    }
                });
                engine.EventBus.publish('heroes_updated');
                console.log('[Dev] Drained 9 HP from all heroes');
            }
        },
        {
            label: "🧪 Drain 9 NRJ (All)",
            onClick: () => {
                const heroes = engine.GameState.state.heroes;
                heroes.forEach(h => {
                    if (h.energy) {
                        h.energy.current = Math.max(0, h.energy.current - 9);
                    }
                });
                engine.EventBus.publish('heroes_updated');
                console.log('[Dev] Drained 9 Energy from all heroes');
            }
        },
    ];

    return (
        <>
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 right-4 z-[9999] p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold font-display"
                    title="Open QA Dashboard"
                >
                    <Bug className="w-5 h-5" /> QA
                </button>
            ) : (
                <div className="fixed bottom-4 right-4 z-[9999] w-64 bg-gi-surface/95 border border-gi-primary rounded-xl p-4 flex flex-col pointer-events-auto">
                    <div className="flex items-center justify-between mb-4 border-b border-gi-border pb-2">
                        <div className="flex items-center gap-2 text-gi-primary font-bold font-display">
                            <Bug className="w-4 h-4" /> QA TESTER
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mb-3 pb-3 border-b border-gi-border">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1">
                            <span>Banner card width</span>
                            <span className="text-gi-primary tabular-nums">{cardWidth}px</span>
                        </div>
                        <input
                            type="range"
                            min={BANNER_WIDTH_MIN}
                            max={BANNER_WIDTH_MAX}
                            value={cardWidth}
                            onChange={(e) => setBannerCardWidth(Number(e.target.value))}
                            className="w-full accent-gi-primary cursor-pointer"
                        />
                    </div>

                    <div className="space-y-2 overflow-y-auto max-h-[50vh] custom-scrollbar pr-1">
                        {testActions.map((action, i) => (
                            <button
                                key={i}
                                onClick={action.onClick}
                                className="w-full text-left px-3 py-2 rounded bg-gi-base hover:bg-gi-primary/20 border border-gi-border hover:border-gi-primary/50 text-sm font-bold transition-colors flex items-center gap-2 group"
                            >
                                <Plus className="w-3 h-3 text-gi-primary group-hover:scale-125 transition-transform" />
                                {action.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-center text-gi-muted mt-3 uppercase tracking-widest font-bold">
                        Area Rework Dev Tools
                    </div>
                </div>
            )}

            {showFontTest && <FontTestModal onClose={() => setShowFontTest(false)} />}
        </>
    );
});

const FontTestModal = ({ onClose }) => {
    const fontSizes = [
        { key: '--font-size-xxs', label: 'XXS (Extra Extra Small)', fallback: 10 },
        { key: '--font-size-xs', label: 'XS (Extra Small)', fallback: 12 },
        { key: '--font-size-sm', label: 'SM (Small)', fallback: 16 },
        { key: '--font-size-base', label: 'BASE (Standard)', fallback: 20 },
        { key: '--font-size-lg', label: 'LG (Large)', fallback: 24 },
        { key: '--font-size-xl', label: 'XL (Extra Large)', fallback: 32 },
        { key: '--font-size-2xl', label: '2XL (Double Large)', fallback: 48 },
    ];

    const [sizes, setSizes] = useState(() => {
        const initial = {};
        fontSizes.forEach(f => {
            const valStr = getComputedStyle(document.documentElement).getPropertyValue(f.key).trim();
            const val = valStr ? parseInt(valStr, 10) : f.fallback;
            initial[f.key] = val;
        });
        return initial;
    });

    const handleSliderChange = (key, value) => {
        setSizes(prev => ({ ...prev, [key]: value }));
        document.documentElement.style.setProperty(key, `${value}px`);
    };

    const handleReset = () => {
        fontSizes.forEach(f => {
            handleSliderChange(f.key, f.fallback);
        });
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-[500px] max-w-full bg-gi-surface border-2 border-gi-primary/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gi-border bg-gi-base/60">
                    <span className="font-display font-bold text-base text-gi-primary uppercase tracking-widest">
                        Typography Scale Test
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-gi-text">
                    <p className="text-[10px] text-gi-muted normal-case tracking-normal">
                        Drag the sliders to dynamically change font sizes in real-time. The entire game UI behind this modal will scale immediately so you can preview the layout fit.
                    </p>

                    <div className="space-y-5">
                        {fontSizes.map(f => {
                            const currentVal = sizes[f.key];
                            return (
                                <div key={f.key} className="space-y-1.5 p-3 rounded-lg bg-black/20 border border-white/5">
                                    <div className="flex justify-between items-baseline text-xs font-bold font-display text-gi-primary">
                                        <span>{f.label}</span>
                                        <span className="text-[10px] text-gi-gold tabular-nums">{f.key} ({currentVal}px)</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="8"
                                        max="64"
                                        value={currentVal}
                                        onChange={(e) => handleSliderChange(f.key, Number(e.target.value))}
                                        className="w-full accent-gi-gold cursor-pointer"
                                    />
                                    
                                    <div className="border border-dashed border-white/10 p-2.5 rounded bg-black/40 text-center mt-2">
                                        <div style={{ fontSize: `${currentVal}px` }} className="font-base uppercase leading-tight tracking-wider truncate">
                                            12 Nature: Harvesting 99 Oak.
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-gi-border bg-gi-base/40 flex justify-between gap-3">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded border border-gi-muted text-xs font-bold text-gi-muted hover:text-white hover:border-white transition-colors"
                    >
                        Reset Defaults
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded bg-gi-primary text-black text-xs font-bold hover:scale-105 transition-transform"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TestDashboard;
