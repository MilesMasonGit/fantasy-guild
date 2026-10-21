import { FloatingTip } from '../base/Tooltip.jsx';

/**
 * A top-bar badge's or a hero tab's hover tip: the shared tooltip with a gold title and a line or
 * two. Never catches the pointer.
 * @param {{ anchor: Element|null, title: string, lines?: string[], width?: number }} props
 */
export const TopBarTip = ({ anchor, title, lines = [], width = 240 }) => (
    <FloatingTip anchor={anchor} title={title} lines={lines} maxWidth={width} tipProps={{ 'data-top-bar-tip': true }} />
);

export default TopBarTip;
