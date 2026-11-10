import { useRef } from 'react';
import { SideDrawer } from '../base/SideDrawer.jsx';
import { GuildUpgradeInspection } from './GuildUpgradeInspection.jsx';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { t } from '../../../i18n/index.js';

/**
 * The Upgrade drawer: the side drawer (`SideDrawer`) in the Hall's purple, showing one star
 * (`GuildUpgradeInspection`). Closed when the Hall opens; a click on a star opens it, its X or
 * Escape closes it (Escape closes the drawer first, the Hall on the next press).
 * @param {{ upgradeDef: object|null, menuRight?: boolean, onClose: () => void }} props
 */
export const HallUpgradeDrawer = ({ upgradeDef, menuRight = false, onClose }) => {
    const open = !!upgradeDef;
    // The star stays in the drawer while it slides out.
    const shown = useRef(null);
    if (upgradeDef) shown.current = upgradeDef;
    useEscapeLayer(open, onClose);
    return (
        <SideDrawer
            open={open}
            menuRight={menuRight}
            backdrop="hall"
            frameClassName="ui-frame-studs-purple"
            label={t('guildHall.drawerLabel')}
            data-hall-drawer={upgradeDef?.id || ''}
        >
            {shown.current && <GuildUpgradeInspection upgradeDef={shown.current} onClose={onClose} />}
        </SideDrawer>
    );
};

export { HERO_BAR_CLEAR_PX } from './GuildUpgradeInspection.jsx';
