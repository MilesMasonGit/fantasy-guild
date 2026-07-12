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
    const cardWidth = useBannerCardWidth();

    if (!engine) return null;

    const testActions = [
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
            label: "🎴 Buy GH Pack",
            onClick: () => {
                const result = engine.CollectionManager.buyPack('area_guild_hall');
                console.log('[Dev] Buy physical pack result:', result);
            }
        },
        {
            label: "📦 Spawn Booster",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'area_guild_hall';
                engine.CardManager.createCard('booster_pack', { position: { x: 5, y: 5 }, metadata: { areaId: activeAreaId } });
                console.log('[Dev] Physical booster spawned');
            }
        },
        {
            label: "🧭 Spawn Discovery",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'area_guild_hall';
                engine.ExplorationManager.spawnExploreCard(activeAreaId);
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

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[9999] p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold font-display"
                title="Open QA Dashboard"
            >
                <Bug className="w-5 h-5" /> QA
            </button>
        );
    }

    return (
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

            <div className="space-y-2 overflow-y-auto max-h-[60vh] custom-scrollbar pr-1">
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
    );
});

export default TestDashboard;
