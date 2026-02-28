import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { Bug, Plus, X } from 'lucide-react';

/**
 * TestDashboard: A temporary developer QA tool for spawning test data
 * and verifying React data-binding reactivity against the Vanilla Engine.
 */
export const TestDashboard = () => {
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
                // We mutate state and then emit, just like the real engine
                engine.GameState.state.heroes.push(hero);
                engine.EventBus.publish('state_changed');
                console.log(`Hired ${hero.name}`);
            }
        },
        {
            label: "Give 10 Wood",
            onClick: () => {
                // Must ensure the items object exists
                if (!engine.GameState.state.inventory.items) engine.GameState.state.inventory.items = {};

                const current = engine.GameState.state.inventory.items['wood_oak']?.quantity || 0;
                engine.GameState.state.inventory.items['wood_oak'] = { quantity: current + 10 };
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "Give 5 Apples",
            onClick: () => {
                if (!engine.GameState.state.inventory.items) engine.GameState.state.inventory.items = {};

                const current = engine.GameState.state.inventory.items['apple']?.quantity || 0;
                engine.GameState.state.inventory.items['apple'] = { quantity: current + 5 };
                engine.EventBus.publish('state_changed');
            }
        },
        {
            label: "Give Rare Sword",
            onClick: () => {
                if (!engine.GameState.state.inventory.items) engine.GameState.state.inventory.items = {};

                const current = engine.GameState.state.inventory.items['longsword_mithril']?.quantity || 0;
                engine.GameState.state.inventory.items['longsword_mithril'] = { quantity: current + 1 };
                engine.EventBus.publish('state_changed');
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
        }
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
        <div className="fixed bottom-4 right-4 z-[9999] w-64 bg-gi-surface/95 backdrop-blur-md border border-gi-primary rounded-xl shadow-2xl p-4 flex flex-col pointer-events-auto">
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
                Phase 8 Binding Tests
            </div>
        </div>
    );
};

export default TestDashboard;
