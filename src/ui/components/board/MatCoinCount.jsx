import { useGameState } from '../../hooks/useGameState.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { getCoins } from '../../../systems/inventory/Coins.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { TOP_BAR_ICON, TopBarIcon } from './MatTopBar.jsx';
import { t } from '../../../i18n/index.js';

/** What changes the count: a sale (or any coin change) and a load or new game. */
const COIN_EVENTS = [ENGINE_EVENTS.COINS_UPDATED, ENGINE_EVENTS.GAME_LOADED, ENGINE_EVENTS.GAME_RESET];

/** The guild's coins in the top bar, in the item bar style of the badges it replaces. */
export const MatCoinCount = () => {
    const coins = useGameState(() => getCoins(), COIN_EVENTS);
    return (
        <EntityRibbon
            data-mat-coins
            size="xs"
            name={t('matTopBar.coins')}
            title={t('matTopBar.coinsTip')}
            icon={<TopBarIcon src={TOP_BAR_ICON.COINS} />}
            countText={<span data-mat-coins-count className="tabular-nums">{coins.toLocaleString('en-US')}</span>}
            className="whitespace-nowrap cursor-default"
        />
    );
};

export default MatCoinCount;
