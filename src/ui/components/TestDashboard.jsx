import React, { useState } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { matW, matH } from '../../config/matGeometry.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { Bug, Plus, X } from 'lucide-react';
import { DevSpawnItemModal } from './dev/DevSpawnItemModal.jsx';
import { AnimationStudioModal } from './dev/AnimationStudioModal.jsx';
import { TypographyScaleModal } from '../modals/TypographyScaleModal.jsx';
import { xpForLevel } from '../../utils/XPCurve.js';
import {
    giveItem, listGivableItemIds, advanceTime, getSpawnerKindCounts,
    DEV_ADVANCE_STEP_MS, DEV_ADVANCE_MAX_STEPS
} from '../../systems/core/DevTools.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { PerfDevSection } from '../dev/perf/PerfDevSection.jsx';

const DEV_ADVANCE_MAX_MINUTES = (DEV_ADVANCE_STEP_MS * DEV_ADVANCE_MAX_STEPS) / 60_000;
const devInputClass = 'min-w-0 px-2 py-1 rounded bg-gi-base border border-gi-border text-xs text-gi-text focus:outline-none focus:border-gi-primary/50';
const devButtonClass = 'shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';
/**
 * The open QA panel never grows past the window (FB-36): it is capped at the
 * viewport height less its 1rem margins top and bottom, and the part under the
 * header scrolls inside it.
 */
export const QA_PANEL_FIT_CLASS = 'max-h-[calc(100dvh-2rem)]';
export const QA_PANEL_BODY_CLASS = 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1';
const devLabelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';

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
    const [giveId, setGiveId] = useState('');
    const [giveAmount, setGiveAmount] = useState(1);
    const [advanceMinutes, setAdvanceMinutes] = useState(10);
    const [devStatus, setDevStatus] = useState('');
    const itemIds = React.useMemo(() => (isOpen ? listGivableItemIds() : []), [isOpen]);
    const kindCounts = isOpen ? getSpawnerKindCounts() : [];

    // Spawner kinds refresh (Token Lifecycle 3.3): a spawn, a grow, a removal
    // and a Token running out each change a family's count or cap, and each
    // publishes one of these. Only while the panel is open.
    const [, setKindTick] = useState(0);
    React.useEffect(() => {
        if (!engine || !isOpen) return;
        const bump = () => setKindTick(n => n + 1);
        const offs = [
            engine.EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, bump),
            engine.EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, bump)
        ];
        return () => offs.forEach(off => off?.());
    }, [engine, isOpen]);

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

    const onGiveItem = () => {
        const r = giveItem(giveId, giveAmount);
        if (!r.ok) { setDevStatus(r.error); return; }
        const msg = r.overflow > 0
            ? `Gave ${r.added}x ${giveId.trim()} to the Bank; ${r.overflow} overflowed onto the mat`
            : `Gave ${r.added}x ${giveId.trim()} to the Bank`;
        setDevStatus(msg);
        console.log(`[Dev] ${msg}`);
    };

    const onAdvanceTime = () => {
        const started = performance.now();
        const r = advanceTime(advanceMinutes);
        if (!r.ok) { setDevStatus(r.error); return; }
        const mins = +(r.advancedMs / 60_000).toFixed(2);
        const took = Math.round(performance.now() - started);
        const msg = `Advanced ${mins} min in ${r.steps} steps (${took} ms)` +
            (r.capped ? ` - capped at ${DEV_ADVANCE_MAX_MINUTES} min` : '');
        setDevStatus(msg);
        console.log(`[Dev] ${msg}`);
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
        // No "Add 1k Gold": gold is retired (SP-65, slice 2.2). Use Spawn
        // Items for the items that are the only price now.
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
            label: "✨ Scatter Loot (burst)",
            onClick: () => {
                // 3-6 item stacks scattered from random points (D-167). Items
                // only: Token loot went with the Vault (Token Lifecycle 9.3).
                const items = ['item_yew_log', 'item_glowcap', 'item_spider_silk'];
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
                    engine.SpriteLayer.addSprite(
                        'item', items[i % items.length], 1 + Math.floor(Math.random() * 5), from
                    );
                }
                console.log(`[Dev] Scattered ${count} things onto the board`);
            }
        },
        {
            label: "🧹 Clear the Board",
            onClick: () => {
                const state = engine.GameState.state;
                state.board.tokens = {};
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
                <div
                    data-testid="qa-panel"
                    className={`fixed bottom-4 right-4 z-[9999] w-64 ${QA_PANEL_FIT_CLASS} bg-gi-surface/95 border border-gi-primary rounded-xl p-4 flex flex-col pointer-events-auto`}
                >
                    <div className="shrink-0 flex items-center justify-between mb-4 border-b border-gi-border pb-2">
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

                    {/* Everything under the header scrolls, so the panel never
                        runs off a short window (FB-36). */}
                    <div data-testid="qa-panel-body" className={QA_PANEL_BODY_CLASS}>
                        {/* Perf HUD + stress scenarios (round-3 review, P3).
                            Compile-time dev only: a production build with
                            Debug Mode on still has no harness. */}
                        {import.meta.env.DEV && <PerfDevSection />}
                        {/* Token Lifecycle dev tools (slice 0.2, DP-11) */}
                        <div className="mb-3 pb-3 border-b border-gi-border space-y-2">
                            <div>
                                <div className={devLabelClass}>Give item</div>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        list="dev-item-ids"
                                        value={giveId}
                                        onChange={(e) => setGiveId(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') onGiveItem(); }}
                                        placeholder="item_..."
                                        aria-label="Item id"
                                        className={`${devInputClass} flex-1`}
                                    />
                                    <datalist id="dev-item-ids">
                                        {itemIds.map(id => <option key={id} value={id} />)}
                                    </datalist>
                                    <input
                                        type="number"
                                        min={1}
                                        value={giveAmount}
                                        onChange={(e) => setGiveAmount(e.target.value)}
                                        aria-label="Amount"
                                        className={`${devInputClass} w-14`}
                                    />
                                    <button onClick={onGiveItem} className={devButtonClass}>Give</button>
                                </div>
                            </div>

                            <div>
                                <div className={devLabelClass}>Advance timers (minutes)</div>
                                <div className="flex gap-1">
                                    <input
                                        type="number"
                                        min={0}
                                        max={DEV_ADVANCE_MAX_MINUTES}
                                        value={advanceMinutes}
                                        onChange={(e) => setAdvanceMinutes(e.target.value)}
                                        aria-label="Minutes to advance"
                                        className={`${devInputClass} flex-1`}
                                    />
                                    <button onClick={onAdvanceTime} className={devButtonClass}>Advance</button>
                                </div>
                            </div>

                            <div>
                                <div className={devLabelClass}>Spawner kinds</div>
                                {kindCounts.length === 0 ? (
                                    <div className="text-xs text-gi-muted">No spawners yet</div>
                                ) : (
                                    <ul className="text-xs space-y-0.5">
                                        {kindCounts.map(({ kind, count, cap }) => (
                                            <li key={kind} className="flex justify-between">
                                                <span>{kind}</span>
                                                <span className="tabular-nums text-gi-primary">{count} / {cap}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {devStatus && (
                                <div className="text-[10px] text-gi-muted break-words" role="status">{devStatus}</div>
                            )}
                        </div>

                        <div className="space-y-2">
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
