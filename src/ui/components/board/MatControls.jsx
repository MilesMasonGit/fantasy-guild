import { useEffect } from 'react';
import { Users, Trees, Skull, Gem, Search } from 'lucide-react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { t } from '../../../i18n/index.js';
import { DOCK_STRIP_PX } from '../dock/dockHeroView.js';
import { setMapMode } from '../../hooks/useMapMode.js';
import {
    FIND_CATEGORY, useMatFind, useFindText, setFindCategory, setFindText, clearMatFind
} from '../../hooks/useMatFind.js';
import { MapModeToggles, CONTROL_BUTTON_PX, CONTROL_BUTTON_CLS, CONTROL_OFF_CLS } from './MatModeControls.jsx';

/**
 * The Find buttons, in order. Lucide placeholders until the owner draws the strip's icons
 * (owner_art_list.md): swap a picture here.
 */
export const FIND_BUTTONS = Object.freeze([
    { category: FIND_CATEGORY.HEROES, Icon: Users, labelKey: 'matControls.findHeroes', tipKey: 'matControls.findHeroesTip' },
    { category: FIND_CATEGORY.TOKENS, Icon: Trees, labelKey: 'matControls.findTokens', tipKey: 'matControls.findTokensTip' },
    { category: FIND_CATEGORY.ENEMIES, Icon: Skull, labelKey: 'matControls.findEnemies', tipKey: 'matControls.findEnemiesTip' },
    { category: FIND_CATEGORY.ITEMS, Icon: Gem, labelKey: 'matControls.findItems', tipKey: 'matControls.findItemsTip' }
]);

const LIT_CLS = 'bg-black/50 border-[var(--color-ui-white)] text-white';

/** One Find button: every match on the mat lights while it is hovered (or focused). */
const FindButton = ({ category, Icon, labelKey, tipKey, lit }) => {
    const on = () => setFindCategory(category);
    const off = () => setFindCategory(null);
    return (
        <Tooltip title={t(labelKey)} lines={[t(tipKey)]}>
            <button
                type="button"
                data-find-category={category}
                data-lit={lit ? 'true' : 'false'}
                aria-label={t(labelKey)}
                onPointerEnter={on}
                onPointerLeave={off}
                onFocus={on}
                onBlur={off}
                className={cn(CONTROL_BUTTON_CLS, lit ? LIT_CLS : CONTROL_OFF_CLS)}
                style={{ width: CONTROL_BUTTON_PX, height: CONTROL_BUTTON_PX }}
            >
                <Icon aria-hidden="true" size={22} strokeWidth={2.5} />
            </button>
        </Tooltip>
    );
};

/** The search box: names and what Tokens make light while it holds text; Esc or emptying it ends it. */
const FindSearch = () => {
    const text = useFindText();
    useEscapeLayer(text.length > 0, () => setFindText(''));
    return (
        <Tooltip title={t('matControls.search')} lines={[t('matControls.searchTip')]}>
            <label
                data-find-search
                className={cn(
                    'shrink-0 flex items-center gap-1.5 px-2 border-2 cursor-text transition-colors',
                    text ? LIT_CLS : CONTROL_OFF_CLS
                )}
                style={{ height: CONTROL_BUTTON_PX }}
            >
                <Search aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0" />
                <input
                    type="text"
                    data-find-search-input
                    value={text}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder={t('matControls.searchPlaceholder')}
                    aria-label={t('matControls.search')}
                    spellCheck={false}
                    autoComplete="off"
                    className="w-28 min-w-0 bg-transparent outline-none border-0 p-0 ui-text-body text-amber-100 placeholder:text-amber-100/50"
                />
            </label>
        </Tooltip>
    );
};

/**
 * The Controls strip, under the mat at the left of the hero bar and its height: a framed row of
 * square icon buttons. Demolish (the map mode), then Find: Heroes, Tokens, Enemies and Items light
 * every match while hovered, and the search box lights what it names while it has text
 * (`matFind.js` says what matches; the mat outlines matches in white and fades the rest).
 * `away` (the Guild Hall or the World Map open): hidden but keeping its room, so the hero bar
 * beside it does not jump, and the mode and the find are ended.
 * @param {{ away?: boolean }} props
 */
export const MatControls = ({ away = false }) => {
    const find = useMatFind();
    useEffect(() => {
        if (!away) return;
        clearMatFind();
        setMapMode(null);
    }, [away]);
    useEffect(() => () => clearMatFind(), []);

    return (
        <PixelFrame
            kind={FRAME_KIND.STUDS}
            data-mat-controls
            data-away={away ? 'true' : undefined}
            role="toolbar"
            aria-label={t('matControls.label')}
            aria-hidden={away || undefined}
            className="shrink-0 select-none pointer-events-auto"
            style={{ height: DOCK_STRIP_PX, visibility: away ? 'hidden' : undefined }}
            frameClassName="flex items-center gap-1.5 px-1.5"
        >
            <MapModeToggles />
            <span aria-hidden="true" className="shrink-0 w-px self-stretch my-1.5 bg-white/15" />
            {FIND_BUTTONS.map(b => <FindButton key={b.category} {...b} lit={find?.category === b.category} />)}
            <FindSearch />
        </PixelFrame>
    );
};

export default MatControls;
