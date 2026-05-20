import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getAllAreaSets } from '../../config/registries/areaSetRegistry.js';
import { Bug, Plus, X } from 'lucide-react';

/**
 * TestDashboard: A temporary developer QA tool for spawning test data
 * and verifying React data-binding reactivity against the Vanilla Engine.
 */
export const TestDashboard = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);

    if (!engine) return null;

    const testActions = [
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
            label: "Give 10 Wood",
            onClick: () => {
                engine.InventoryManager.addItem('wood_oak', 10);
            }
        },
        {
            label: "🍳 Spawn Kitchen",
            onClick: () => {
                const result = engine.CardManager.createCard('kitchen');
                console.log('[Dev] Kitchen spawn:', result);
            }
        },
        {
            label: "🐺 Spawn Wolf Den",
            onClick: () => {
                const result = engine.CardManager.createCard('combat_wolf_forest');
                console.log('[Dev] Wolf Den spawn:', result);
            }
        },
        {
            label: "🌿 Spawn Berry Bramble",
            onClick: () => {
                const result = engine.CardManager.createCard('gather_berry_bramble');
                console.log('[Dev] Berry Bramble spawn:', result);
            }
        },
        {
            label: "🌵 Spawn Thorn Elemental",
            onClick: () => {
                const result = engine.CardManager.createCard('combat_thorn_elemental');
                console.log('[Dev] Thorn Elemental spawn:', result);
            }
        },
        {
            label: "📜 Spawn Pie Tin",
            onClick: () => {
                const result = engine.CardManager.createCard('blueprint_pie_tin');
                console.log('[Dev] Pie Tin spawn:', result);
            }
        },
        {
            label: "Give 5 Apples",
            onClick: () => {
                engine.InventoryManager.addItem('apple', 5);
            }
        },
        {
            label: "🥖 Give 100 Flour",
            onClick: () => {
                engine.InventoryManager.addItem('flour', 100);
            }
        },
        {
            label: "💧 Give 100 Water",
            onClick: () => {
                engine.InventoryManager.addItem('drink_water', 100);
            }
        },
        {
            label: "Give Rare Sword",
            onClick: () => {
                engine.InventoryManager.addItem('longsword_mithril', 1);
            }
        },
        {
            label: "Give Iron Armor",
            onClick: () => {
                engine.InventoryManager.addItem('iron_armor', 1);
            }
        },
        {
            label: "Spawn Task Card",
            onClick: () => {
                engine.GameState.state.cards.active.push({
                    id: `test_card_${Date.now()}`,
                    templateId: 'logging',
                    location: 'board'
                });
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "🛠️ Toggle Layout Sandbox",
            onClick: () => {
                engine.EventBus.publish('dev:toggle-sandbox');
            }
        },
        {
            label: "🛏️ Spawn Bunk Bed Project",
            onClick: () => {
                const result = engine.CardManager.createCard('bunk_bed');
                if (result.success) {
                    console.log('[Dev] Bunk Bed Project spawned:', result.card.id);
                }
            }
        },
        // === Area Rework Dev Tools ===
        {
            label: "🎴 Buy GH Pack",
            onClick: () => {
                const result = engine.CollectionManager.buyPack('guild_hall_v1');
                console.log('[Dev] Buy physical pack result:', result);
            }
        },
        {
            label: "📦 Spawn Booster",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'guild_hall_v1';
                engine.CardManager.createCard('booster_pack', { position: { x: 5, y: 5 }, metadata: { areaId: activeAreaId } });
                console.log('[Dev] Physical booster spawned');
            }
        },
        {
            label: "🧭 Spawn Discovery",
            onClick: () => {
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'guild_hall_v1';
                engine.ExplorationManager.spawnExploreCard(activeAreaId);
            }
        },
        {
            label: "🌲 Unlock Forest",
            onClick: () => {
                const collection = engine.GameState.state.collection;
                if (!collection.unlockedAreaSets.includes('forest_v1')) {
                    collection.unlockedAreaSets.push('forest_v1');
                }
                if (!engine.GameState.state.mapFragments) {
                    engine.GameState.state.mapFragments = {};
                }
                engine.GameState.state.mapFragments['forest_v1'] = 999;
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
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'guild_hall_v1';
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
                const activeAreaId = engine.GameState.state.ui?.activeAreaId || 'guild_hall_v1';
                engine.EventBus.publish('spawn_invasion', { 
                    areaId: activeAreaId, 
                    invasionId: 'hostile_hens' 
                });
                console.log('[Dev] Hostile Hens invasion triggered');
            }
        },
        // === Tool System QA ===
        {
            label: "⛏️ Give Copper Pickaxe",
            onClick: () => {
                engine.InventoryManager.addItem('copper_pickaxe', 1);
            }
        },
        {
            label: "🗻 Spawn Copper Mine",
            onClick: () => {
                const result = engine.CardManager.createCard('copper_mine_test');
                console.log('[Dev] Copper Mine spawn:', result);
            }
        },
        {
            label: "🏰 Spawn Crypt Dungeon",
            onClick: () => {
                const result = engine.CardManager.createCard('dungeon_crypt_walk');
                console.log('[Dev] Dungeon spawn:', result.success, result.card?.id, result.card?.position);
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
