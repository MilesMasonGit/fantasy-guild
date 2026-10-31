import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { PanelHeader } from '../base/CloseX.jsx';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';

/** How far an arrow press scrolls the inspection sheet. */
const INSPECT_SCROLL_STEP_PX = 180;

/**
 * InspectionPanel: the Guild Hall's inspection column (an upgrade), the kit's header
 * on top with the close X while an upgrade is shown. Its frame is the caller's. Items have no
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
        body = <GuildUpgradeInspection upgradeDef={upgradeDef} />;
    }

    return (
        <div className={cn('w-80 shrink-0 flex flex-col min-h-0 relative gap-1', className)}>
            <PanelHeader
                title={t('guildHall.inspect')}
                onClose={selection?.type === 'guild_upgrade' && onClear ? onClear : null}
                className="px-1 min-h-8"
            />

            {scrollsItself ? (
                <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
            ) : (
                <ArrowScrollList step={INSPECT_SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                    {body || (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted p-6 text-center">
                            <span className="ui-text-body gi-caps tracking-widest font-bold">Nothing selected</span>
                            <span className="ui-text-body normal-case tracking-normal">
                                Click an upgrade to see its details here.
                            </span>
                        </div>
                    )}
                </ArrowScrollList>
            )}
        </div>
    );
};

export default InspectionPanel;
