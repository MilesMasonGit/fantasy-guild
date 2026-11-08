import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { PanelHeader } from '../base/CloseX.jsx';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';

/** How far an arrow press scrolls the inspection sheet. */
const INSPECT_SCROLL_STEP_PX = 180;

/**
 * InspectionPanel: the Guild Hall's inspection column. With a star shown it is the star's sheet,
 * whose header band carries the star's name and the close X; with nothing shown, the kit's header
 * and a hint. Its frame is the caller's. Items have no inspect column: their details are the Bank
 * tile's tooltip.
 */
export const InspectionPanel = ({
    selection,
    onClear,
    className
}) => {
    if (selection?.type === 'guild_upgrade') {
        const upgradeDef = selection.upgradeDef || selection.source?.upgradeDef || getUpgradeDef(selection.id);
        // The sheet keeps its header and button still and scrolls only its middle, with its own
        // arrow bars; a second pair around it would be a list inside a list.
        return (
            <div className={cn('w-80 shrink-0 flex flex-col min-h-0 relative', className)}>
                <GuildUpgradeInspection upgradeDef={upgradeDef} onClose={onClear || null} />
            </div>
        );
    }

    return (
        <div className={cn('w-80 shrink-0 flex flex-col min-h-0 relative gap-1', className)}>
            <PanelHeader title={t('guildHall.inspect')} className="px-1 min-h-8" />
            <ArrowScrollList step={INSPECT_SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted p-6 text-center">
                    <span className="ui-text-body gi-caps tracking-widest font-bold">Nothing selected</span>
                    <span className="ui-text-body normal-case tracking-normal">
                        Click an upgrade to see its details here.
                    </span>
                </div>
            </ArrowScrollList>
        </div>
    );
};
