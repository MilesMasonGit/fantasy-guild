import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { Coins, Crown, Settings, Map, BookOpen, Book, Save, Sparkles, Package } from 'lucide-react';
import { cn } from '../utils/cn.js';
import Button from './base/Button.jsx';
import { EventBus } from '../../systems/core/EventBus.js';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { ChaosTracker } from './hud/ChaosTracker.jsx';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';
import { CollectionManager } from '../../systems/progression/CollectionManager.js';

/**
 * TopBarView: The horizontal HUD that displays global resources and game time.
 * Reactively subscribes to specific slices of GameState to avoid over-rendering.
 */
export const TopBarView = React.memo(({ onSettingsClick, onWorldMapClick, onCardLibraryClick, onCodexClick, onBonusesClick }) => {
    // We use granular selectors to only re-render when these specific values change
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const influence = useGameState(state => state.currency?.influence || 0, ['currency_changed']);
    const isPaused = useGameState(state => state.time?.isPaused || false);

    // Unified Booster Pack shop (Phase 5 §5F — deck loop mode only).
    // collection_updated keeps the cost live after buys; state_changed
    // covers save loads (which never fire collection_updated). The selected
    // value folds in total owned copies so claims (which change the pool but
    // not the pack counter) also trigger a re-render.
    useGameState(state => {
        const owned = Object.values(state.collection?.playsets || {}).reduce((sum, n) => sum + n, 0);
        return (state.collection?.globalPacksBought || 0) * 10000 + owned;
    }, ['collection_updated', 'state_changed']);
    const packCost = USE_DECK_LOOP ? CollectionManager.getUnifiedPackCost() : 0;
    const packSoldOut = USE_DECK_LOOP ? CollectionManager.checkUnifiedExhaustion() : false;
    const canAffordPack = gold >= packCost;

    const handleBuyPack = () => {
        const result = CollectionManager.buyUnifiedPack();
        if (result.success) {
            EventBus.publish('ui:open_pack_overlay', { options: result.options, unified: true });
        }
    };

    // Persistence State
    const [lastSaved, setLastSaved] = React.useState(Date.now());
    const [asInterval, setAsInterval] = React.useState(() => {
        const mins = SettingsManager.get('gameplay.autoSaveIntervalMinutes');
        return mins > 0 ? mins * 60000 : 0;
    });
    const [isSaving, setIsSaving] = React.useState(false);
    const [timeAgo, setTimeAgo] = React.useState('Just now');

    React.useEffect(() => {
        const handleSaved = (data) => {
            setLastSaved(data.timestamp);
            if (data.autoSaveInterval !== undefined) setAsInterval(data.autoSaveInterval);
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 2000);
        };

        const handleSettingsUpdate = () => {
            const mins = SettingsManager.get('gameplay.autoSaveIntervalMinutes');
            setAsInterval(mins > 0 ? mins * 60000 : 0);
        };

        const subSaved = EventBus.subscribe('game_saved', handleSaved);
        const subSettings = EventBus.subscribe('settings_updated', handleSettingsUpdate);

        const timer = setInterval(() => {
            const diff = Date.now() - lastSaved;
            if (diff < 60000) setTimeAgo('Just now');
            else if (diff < 3600000) setTimeAgo(`${Math.floor(diff / 60000)}m ago`);
            else setTimeAgo(`${Math.floor(diff / 3600000)}h ago`);
        }, 10000);

        return () => {
            subSaved();
            subSettings();
            clearInterval(timer);
        };
    }, [lastSaved]);

    return (
        <div className="sticky top-0 z-[100] w-full bg-gi-surface/95 border-b border-gi-border shadow-lg">
            <div className="w-full flex items-center justify-between px-6 py-2">

                {/* Left: Branding & Status */}
                <div className="flex items-center gap-6">
                    <h1 className="font-display font-bold text-xl tracking-wider text-gi-text">
                        FANTASY GUILD
                    </h1>
                    {isPaused && (
                        <span className="text-xs font-bold text-gi-danger bg-gi-danger/10 px-2 py-1 rounded tracking-widest uppercase">
                            Paused
                        </span>
                    )}
                </div>

                {/* Regional Stats */}
                <div className="flex-1 flex justify-center">
                    <ChaosTracker />
                </div>

                {/* Center: Resources HUD */}
                <div className="flex items-center gap-8">

                    {/* Influence/Renown Resource */}
                    <div className="flex items-center gap-2" title="Guild Influence">
                        <div className="p-1.5 bg-gi-primary/20 rounded-full border border-gi-primary/30">
                            <Crown className="w-4 h-4 text-gi-primary" />
                        </div>
                        <span className="font-display font-bold tracking-wide text-gi-text">
                            {influence.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Unified Pack Shop (deck loop mode) */}
                    {USE_DECK_LOOP && (
                        <Button
                            variant="ghost"
                            onClick={handleBuyPack}
                            disabled={packSoldOut || !canAffordPack}
                            title={packSoldOut ? 'Sold Out — every available card is fully collected' : `Buy a Booster Pack (${packCost} gold)`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full border mr-2",
                                packSoldOut || !canAffordPack
                                    ? "border-gi-border opacity-50 cursor-not-allowed"
                                    : "border-gi-gold/40 bg-gi-gold/10 hover:bg-gi-gold/20"
                            )}
                        >
                            <Package className="w-4 h-4 text-gi-gold" />
                            <span className="text-xs font-bold tracking-wide text-gi-text uppercase">
                                {packSoldOut ? 'Sold Out' : 'Buy Pack'}
                            </span>
                            {!packSoldOut && (
                                <span className="flex items-center gap-1 text-xs font-bold text-gi-gold">
                                    <Coins className="w-3 h-3" />
                                    {packCost}
                                </span>
                            )}
                        </Button>
                    )}
                    {/* Save Info Widget */}
                    <div className="flex items-center gap-3 px-3 py-1 bg-gi-surface border border-gi-border rounded-full mr-2">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-gi-muted uppercase tracking-tighter leading-none">
                                {asInterval > 0 ? `Auto: ${Math.round(asInterval / 60000)}m` : 'Auto: Off'}
                            </span>
                            <span className="text-[10px] font-bold text-gi-text tracking-tight leading-loose opacity-60">
                                {timeAgo}
                            </span>
                        </div>
                        <div className={cn(
                            "p-1 rounded-full transition-all duration-500",
                            isSaving ? "bg-gi-primary/40 scale-125" : "bg-gi-muted/10 scale-100"
                        )}>
                            <Save className={cn(
                                "w-3 h-3 transition-colors",
                                isSaving ? "text-gi-primary" : "text-gi-muted"
                            )} />
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={onWorldMapClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                        title="World Map"
                    >
                        <Map className="w-5 h-5 text-gi-muted hover:text-gi-text transition-colors" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onCodexClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                        title="Collection Codex"
                    >
                        <Book className="w-5 h-5 text-gi-muted hover:text-gi-text transition-colors" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onCardLibraryClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                        title="Card Library"
                    >
                        <BookOpen className="w-5 h-5 text-gi-muted hover:text-gi-text transition-colors" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onBonusesClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                        title="Active Bonuses"
                    >
                        <Sparkles className="w-5 h-5 text-gi-primary hover:text-gi-primary-bright transition-colors" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onSettingsClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                    >
                        <Settings className="w-5 h-5 text-gi-muted hover:text-gi-text transition-colors" />
                    </Button>
                </div>
            </div>

        </div>
    );
});

export default TopBarView;
