import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_PX } from './boardConstants.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { renderStatement } from '../../../systems/effects/statementText.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { Package, Sparkles } from 'lucide-react';

/**
 * GuildHallEffectsPanel — replaces the Token Tray during Guild Hall Upgrades.
 * Uses the exact width and framing of the Token Tray to summarize active outputs and boosts.
 */
export const GuildHallEffectsPanel = ({ menuRight = false }) => {
    // Re-evaluate whenever upgrades, board, or game state updates
    const guildHallData = useGameState(
        () => {
            const def = getTokenType('token_guild_hall');
            const outputs = def?.config?.outputs || [];
            const statements = def?.statements || [];
            return { outputs, statements };
        },
        ['guild_upgrades_updated', 'state_changed', 'token_placed', 'token_bank_updated']
    );

    const outputs = guildHallData?.outputs || [];
    const statements = guildHallData?.statements || [];

    return (
        <aside
            data-dnd-region="drawer"
            className={cn(
                "w-72 md:w-80 xl:w-[320px] 2xl:w-[340px] shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent relative z-10 select-none pointer-events-auto",
                menuRight ? "pl-8 pr-0" : "pr-8 pl-0"
            )}
        >
            {/* Inner Wrapper matched to BOARD_PX (Playmat Height) */}
            <div
                className="w-full relative shrink-0 flex flex-col"
                style={{ height: BOARD_PX, maxHeight: '100%' }}
            >
                {/* Wooden Frame Box matching the exact height and styling of the Token Tray */}
                <div
                    className="w-full h-full relative rounded-2xl border-4 border-[#3a271d] shadow-2xl overflow-hidden flex flex-col bg-[#14100c]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('/assets/ui/pm_table_mountain.png')`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: 'auto, 128px',
                        imageRendering: 'pixelated',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.85), 0 8px 24px rgba(0,0,0,0.6)'
                    }}
                >
                    {/* Header: Panel title */}
                    <div className="shrink-0 py-2.5 px-3.5 text-center text-xs md:text-sm font-bold text-gi-text tracking-wider uppercase select-none border-b border-gi-border/40 bg-gi-base/80">
                        Guild Hall Effects
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4 text-xs text-gi-text">
                        {/* 1. Outputs Category */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                                Outputs
                            </span>

                            {outputs.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                    {outputs.map((output, idx) => (
                                        <EntityRibbon
                                            key={`${output.itemId}-${idx}`}
                                            kind="item"
                                            id={output.itemId}
                                            quantity={output.minQty ?? output.quantity ?? 1}
                                            chance="100%"
                                            size="md"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 text-center text-xs text-gi-muted italic bg-gi-base/30 rounded-lg border border-gi-border/30">
                                    No active outputs
                                </div>
                            )}
                        </div>

                        {/* 2. Boosts Category */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                                Boosts & Modifiers
                            </span>

                            {statements.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                    {statements.map((statement, idx) => {
                                        const sentence = renderStatement(statement, {
                                            token: id => tokenName(id) || id,
                                            item: id => getItem(id)?.name || id
                                        });

                                        return (
                                            <div
                                                key={statement.id || `stm-${idx}`}
                                                className="p-2.5 rounded-lg bg-gi-base/40 border border-gi-border/30 flex items-start gap-2 text-xs text-gi-text leading-relaxed"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-gi-primary mt-1.5 shrink-0" />
                                                <span className="flex-1">{sentence}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-3 text-center text-xs text-gi-muted italic bg-gi-base/30 rounded-lg border border-gi-border/30">
                                    No active boosts
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default GuildHallEffectsPanel;
