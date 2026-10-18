/**
 * The kit's text sizes (UI_STYLE "Text sizes"): three for panels and menus, plus display for
 * celebrations on the mat only. Each class in `src/tailwind.css` reads one step of the Text size
 * setting (the `--font-size-*` variables SettingsManager writes), so the setting scales them.
 * `px` is the size at the setting's defaults.
 */
export const TEXT_SIZES = [
    { id: 'title', className: 'ui-text-title', cssVar: '--font-size-sm', px: 18, use: 'panel titles, row names' },
    { id: 'body', className: 'ui-text-body', cssVar: '--font-size-xs', px: 16, use: 'rows, ribbons, tooltip lines' },
    { id: 'small', className: 'ui-text-small', cssVar: '--font-size-xxs', px: 14, use: 'counts, hints' },
    { id: 'display', className: 'ui-text-display', cssVar: '--font-size-xl', px: 32, use: 'mat celebrations only' }
];
