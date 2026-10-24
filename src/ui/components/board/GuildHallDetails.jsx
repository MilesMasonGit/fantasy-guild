import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { InspectionPanel } from '../drawer/InspectionPanel.jsx';
import { EventBus } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { SIDE_COLUMN_PX } from './boardConstants.js';
import { t } from '../../../i18n/index.js';

/**
 * The Guild Hall screen's right column: the way back to the playmat, then the Inspect panel in a
 * studs frame (a big docked panel). The column itself, and where it sits, are `ReactRoot`'s.
 * ⚠️ No `overflow-hidden` around the frames: their hard shadow sits outside the box.
 */
export const GuildHallDetails = ({ selection, onClear, onReturn }) => (
    <div className="w-full relative shrink-0 flex flex-col gap-3 pr-1 pb-1" style={{ height: SIDE_COLUMN_PX, maxHeight: '100%' }}>
        <PixelFrame kind={FRAME_KIND.CHAMFER} className="w-full shrink-0">
            <button
                type="button"
                data-hall-return
                onClick={() => {
                    EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
                    onReturn?.();
                }}
                className="w-full px-3 py-1 ui-text-body font-bold uppercase tracking-wider cursor-pointer text-[var(--color-ui-white)]"
            >
                {t('guildHall.returnToPlaymat')}
            </button>
        </PixelFrame>
        <PixelFrame kind={FRAME_KIND.STUDS} className="w-full flex-1 min-h-0" frameClassName="flex flex-col p-1">
            <InspectionPanel className="w-full h-full flex-1" selection={selection} onClear={onClear} />
        </PixelFrame>
    </div>
);

export default GuildHallDetails;
