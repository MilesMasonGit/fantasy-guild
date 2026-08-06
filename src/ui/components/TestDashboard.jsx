import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { listTokenTypeIds, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { Bug, Plus, X } from 'lucide-react';
import { useBannerCardWidth, setBannerCardWidth, BANNER_WIDTH_MIN, BANNER_WIDTH_MAX } from '../dev/cardSizeStore.js';
import { DevSpawnItemModal } from './dev/DevSpawnItemModal.jsx';
import { getAllSkillIds } from '../../config/registries/skillRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * TestDashboard: A temporary developer QA tool for spawning test data
 * and verifying React data-binding reactivity against the Vanilla Engine.
 */
export const TestDashboard = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [showFontTest, setShowFontTest] = useState(false);
    const [showSpawnItem, setShowSpawnItem] = useState(false);
    const cardWidth = useBannerCardWidth();

    if (!engine) return null;

    // Every skill a hero has — all 15, combat (melee/ranged/magic/defense),
    // gathering (labor/aquatic/nature), processing (forge/cooking/alchemy/
    // science) and special (occult/crime/explore/social). Raising a skill
    // means raising its XP to exactly the level boundary `n` steps up, so
    // every skill (and hero level, which is derived from the 4 combat ones —
    // see calculateHeroLevel in HeroGenerator.js) moves by precisely `n`
    // regardless of where it currently sits mid-level.
    const ALL_SKILL_IDS = getAllSkillIds();
    const levelAllHeroes = (n) => {
        const heroes = engine.HeroManager.getAllHeroes().filter(h => !h.isVillager);
        heroes.forEach(hero => {
            ALL_SKILL_IDS.forEach(skillId => {
                const skill = hero.skills[skillId];
                if (!skill) return;
                const targetLevel = Math.min(99, skill.level + n);
                const xpNeeded = xpForLevel(targetLevel) - skill.xp;
                if (xpNeeded > 0) engine.SkillSystem.addXP(hero.id, skillId, xpNeeded);
            });
        });
        console.log(`[Dev] Leveled ${heroes.length} hero(es) by +${n}`);
    };

    const testActions = [
        {
            label: "🔤 Test Typography Scales",
            onClick: () => {
                setShowFontTest(true);
            }
        },
        {
            label: "🧰 Spawn Items...",
            onClick: () => setShowSpawnItem(true)
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
            label: "Hire Random Hero",
            onClick: () => {
                const hero = generateHero();
                engine.HeroManager.addHero(hero);
            }
        },
        {
            label: "⬆️ Level All Skills +1",
            onClick: () => levelAllHeroes(1)
        },
        {
            label: "⬆️⬆️ Level All Skills +10",
            onClick: () => levelAllHeroes(10)
        },
        {
            label: "🛠️ Toggle Layout Sandbox",
            onClick: () => {
                engine.EventBus.publish('dev:toggle-sandbox');
            }
        },
        // The deck-loop dev buttons (buy pack, unlock areas, world map,
        // rainfall, chaos, invasions) are deleted with the systems they drove.
        // Board tools replace them, phase by phase; spawn-loot lands in Phase 3.
        {
            label: "🎁 Fill Tray with Tokens",
            onClick: () => {
                // Until the Cartographer exists (Phase 8) there is no legitimate
                // way to obtain a Token, so placement would be untestable.
                const ids = listTokenTypeIds();
                let added = 0;
                for (const typeId of ids) {
                    const instance = engine.BoardState.createTokenInstance(
                        typeId, tokenStartingUses(typeId)
                    );
                    if (engine.BoardState.addToTray(instance)) added++;
                }
                engine.EventBus.publish('state_changed');
                console.log(`[Dev] Added ${added} Tokens to the Tray`);
            }
        },
        {
            label: "🧹 Clear the Board",
            onClick: () => {
                const state = engine.GameState.state;
                state.board.tiles = {};
                state.board.tray = [];
                engine.EventBus.publish('state_changed');
                console.log('[Dev] Board and Tray cleared');
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
                        Playmat Dev Tools
                    </div>
                </div>
            )}

            {showFontTest && <FontTestModal onClose={() => setShowFontTest(false)} />}
            {showSpawnItem && <DevSpawnItemModal engine={engine} onClose={() => setShowSpawnItem(false)} />}
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
