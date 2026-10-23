import TokenInspection from './TokenInspection.jsx';
import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { SearchCheck } from 'lucide-react';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { cn } from '../../utils/cn.js';

/** How far an arrow press scrolls the inspection sheet. */
const INSPECT_SCROLL_STEP_PX = 180;

/**
 * InspectionPanel: the Guild Hall's inspection column (an upgrade or a Token). Items have no
 * inspect column: their details are the Bank tile's tooltip.
 */
export const InspectionPanel = ({
    selection,
    onClear,
    className
}) => {
    let body = null;
    // The upgrade sheet keeps its header still and scrolls only its rank list, with its own
    // arrow bars; a second pair around it would be a list inside a list.
    let scrollsItself = false;

    if (selection?.type === 'guild_upgrade') {
        const upgradeDef = selection.upgradeDef || selection.source?.upgradeDef || getUpgradeDef(selection.id);
        scrollsItself = true;
        body = (
            <GuildUpgradeInspection
                upgradeDef={upgradeDef}
                onClose={onClear}
            />
        );
    } else if (selection?.type === 'token') {
        body = (
            <TokenInspection typeId={selection.id} />
        );
    }

    return (
        <div className={cn("w-80 shrink-0 bg-gi-base/40 flex flex-col min-h-0 relative", className)}>
            <div className="shrink-0 flex items-center px-3.5 py-2 border-b border-gi-border/40 bg-gi-base/80">
                <span className="flex items-center gap-2.5 text-sm md:leading-normal font-bold tracking-wide text-gi-text">
                    <SearchCheck size={18} className="text-gi-primary" /> Inspect
                </span>
            </div>

            {scrollsItself ? (
                <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
            ) : (
                <ArrowScrollList step={INSPECT_SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                    {body || (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                            <SearchCheck size={36} />
                            <span className="text-xs gi-caps tracking-widest font-bold">Nothing selected</span>
                            <span className="ui-text-body normal-case tracking-normal">
                                Click an upgrade or Token to see its details here.
                            </span>
                        </div>
                    )}
                </ArrowScrollList>
            )}
        </div>
    );
};

export default InspectionPanel;
