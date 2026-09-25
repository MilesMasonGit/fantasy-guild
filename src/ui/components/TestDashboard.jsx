import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { listTokenTypeIds, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { matW, matH } from '../../config/matGeometry.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { Bug, Plus, X } from 'lucide-react';
import { useBannerCardWidth, setBannerCardWidth, BANNER_WIDTH_MIN, BANNER_WIDTH_MAX } from '../dev/cardSizeStore.js';
import { DevSpawnItemModal } from './dev/DevSpawnItemModal.jsx';
import { AnimationStudioModal } from './dev/AnimationStudioModal.jsx';
import { TypographyScaleModal } from '../modals/TypographyScaleModal.jsx';
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
    const [showAnimationStudio, setShowAnimationStudio] = useState(false);
    const cardWidth = useBannerCardWidth();

    React.useEffect(() => {
        if (!engine) return;
        const unsub = engine.EventBus.subscribe('dev:open-animation-studio', () => {
            setShowAnimationStudio(true);
        });
        const handleKeyDown = (e) => {
            if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                setShowAnimationStudio(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            unsub?.();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [engine]);

    if (!engine) return null;

    // Raise every skill a hero HOLDS — which is 6 of 27, not the whole
    // registry. Raising a skill means raising its XP to exactly the level
    // boundary `n` steps up, so each one moves by precisely `n` regardless of
    // where it currently sits mid-level. Hero level is the average of the held
    // skills (see calculateHeroLevel in HeroGenerator.js), so it moves by `n`
    // too.
    const levelAllHeroes = (n) => {
        const heroes = engine.HeroManager.getAllHeroes().filter(h => !h.isVillager);
        heroes.forEach(hero => {
            Object.keys(hero.skills || {}).forEach(skillId => {
                const skill = hero.skills[skillId];
                if (!skill) return;
                const targetLevel = Math.min(99, skill.level + n);
                const xpNeeded = xpForLevel(targetLevel) - skill.xp;
                if (xpNeeded > 0) engine.SkillSystem.addXP(hero.id, skillId, xpNeeded);
            });
        });
        console.log(`[Dev] Leveled ${heroes.length} hero(es) by +${n}`);
    };

    /**
     * "Spawn Party" — a Fighter, Wizard, Ranger and Rogue, each already at
     * level 50 in every skill their job holds. Unlike a Recruit (no combat
     * skill at all — see `grantCombatSkill` below), each of these jobs
     * already includes its own combat skill (melee, magic, ranged, ranged),
     * so no separate "grant combat" step is needed to make them fight.
     *
     * Bumps the roster cap first if the incoming four would not fit — a dev
     * convenience, not a purchase, so it writes the rank directly rather
     * than paying items through `GuildUpgradeManager.purchase`.
     */
    const spawnParty = () => {
        const jobIds = ['fighter', 'wizard', 'ranger', 'rogue'];

        const ranks = engine.GuildUpgradeManager.getRanks();
        const neededRank = engine.GameState.state.heroes.length + jobIds.length;
        if ((ranks.roster_size || 0) < neededRank) {
            ranks.roster_size = neededRank;
            engine.GuildUpgradeManager.recompute();
        }

        let added = 0;
        jobIds.forEach(jobId => {
            const hero = generateHero({ jobId, spriteId: jobId });
            if (!engine.HeroManager.addHero(hero)) return;
            added++;
            Object.keys(hero.skills || {}).forEach(skillId => {
                const skill = hero.skills[skillId];
                const xpNeeded = xpForLevel(50) - skill.xp;
                if (xpNeeded > 0) engine.SkillSystem.addXP(hero.id, skillId, xpNeeded);
            });
            // Leveling the combat skill raises max HP (it's derived from it);
            // top current HP back up too, or a freshly "spawned" hero reads
            // as already wounded.
            if (hero.hp) hero.hp.current = hero.hp.max;
        });
        engine.EventBus.publish('heroes_updated', { source: 'dev_spawn_party' });
        console.log(`[Dev] Spawned a party of ${added} hero(es) at level 50`);
    };

    /**
     * ⚠️ TEMPORARY SCAFFOLDING — remove when promotion lands (Phase 5).
     *
     * Every hero now generates as a Recruit, and a Recruit holds no combat
     * skill, so nobody can fight. That is the intended end state, but the only
     * legitimate way to gain a combat skill is a promotion, and the promotion
     * system does not exist yet. Without this button combat is untestable for
     * three phases.
     */
    const grantCombatSkill = (skillId) => {
        const heroes = engine.HeroManager.getAllHeroes().filter(h => !h.isVillager);
        heroes.forEach(hero => {
            if (!hero.skills[skillId]) {
                hero.skills[skillId] = { xp: xpForLevel(1), level: 1 };
            }
        });
        engine.EventBus.publish('heroes_updated', { source: 'dev_grant_combat' });
        console.log(`[Dev] Granted ${skillId} to ${heroes.length} hero(es)`);
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
            label: "Hire Random Hero",
            onClick: () => {
                const hero = generateHero();
                engine.HeroManager.addHero(hero);
            }
        },
        {
            label: "🎉 Spawn Party",
            onClick: spawnParty
        },
        {
            label: "⬆️ Level All Skills +1",
            onClick: () => levelAllHeroes(1)
        },
        {
            label: "⬆️⬆️ Level All Skills +10",
            onClick: () => levelAllHeroes(10)
        },
        // ⚠️ Scaffolding — delete when promotion lands (Phase 5).
        {
            label: "⚔️ Grant Melee (temp)",
            onClick: () => grantCombatSkill('melee')
        },
        {
            label: "🏹 Grant Ranged (temp)",
            onClick: () => grantCombatSkill('ranged')
        },
        {
            label: "🎞️ Sprite Animation Studio",
            onClick: () => setShowAnimationStudio(true)
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
            label: "🎁 Fill Vault with Tokens",
            onClick: () => {
                // One of every Token type, into the Vault to drag onto the mat.
                // It filled the Tray until slice 1.9 retired it.
                const ids = listTokenTypeIds();
                let added = 0;
                for (const typeId of ids) {
                    const instance = engine.BoardState.createTokenInstance(
                        typeId, tokenStartingUses(typeId)
                    );
                    if (engine.TokenBank.deposit(instance)) added++;
                }
                engine.EventBus.publish('token_bank_updated');
                engine.EventBus.publish('state_changed');
                console.log(`[Dev] Added ${added} Tokens to the Vault`);
            }
        },
        {
            label: "✨ Scatter Loot (burst)",
            onClick: () => {
                // Stands in for a Map burst until Phase 8 — 3-6 things, mixed
                // items and Tokens, scattered from random tiles (D-167).
                const items = ['item_yew_log', 'item_glowcap', 'item_spider_silk'];
                const tokens = listTokenTypeIds();
                const count = 3 + Math.floor(Math.random() * 4);
                for (let i = 0; i < count; i++) {
                    // A random point on the mat, as a fraction of it, so the
                    // scatter follows the mat's live size (slice 1.6d-3). The
                    // fractions are the old fixed numbers over the shipped
                    // 1760 × 1126, so at 11 steps nothing has moved.
                    const w = matW();
                    const hh = matH();
                    const from = {
                        centre: {
                            x: w * (480 / 1760) + Math.random() * w * (800 / 1760),
                            y: hh * (163 / 1126) + Math.random() * hh * (800 / 1126)
                        }
                    };
                    if (Math.random() < 0.6) {
                        engine.SpriteLayer.addSprite(
                            'item', items[i % items.length], 1 + Math.floor(Math.random() * 5), from
                        );
                    } else {
                        const typeId = tokens[Math.floor(Math.random() * tokens.length)];
                        engine.SpriteLayer.addSprite('token', typeId, 1, from, tokenStartingUses(typeId));
                    }
                }
                console.log(`[Dev] Scattered ${count} things onto the board`);
            }
        },
        {
            label: "🧹 Clear the Board",
            onClick: () => {
                const state = engine.GameState.state;
                state.board.tokens = {};
                state.board.vacancies = {};
                state.board.tray = [];
                state.board.sprites = [];
                engine.EventBus.publish('state_changed');
                console.log('[Dev] Board cleared');
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

            {showFontTest && <TypographyScaleModal isOpen={showFontTest} onClose={() => setShowFontTest(false)} />}
            {showSpawnItem && <DevSpawnItemModal engine={engine} onClose={() => setShowSpawnItem(false)} />}
            {showAnimationStudio && (
                <AnimationStudioModal
                    isOpen={showAnimationStudio}
                    onClose={() => setShowAnimationStudio(false)}
                />
            )}
        </>
    );
});

export default TestDashboard;
