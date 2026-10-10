import { describe } from '../../../systems/atlas/Budget.js';
import { ROLE_COLOUR } from './LayoutPreview.jsx';
import { SCREEN_TEXT } from './atlasScreenText.js';

/**
 * The Node Summary: what the slotted maps write, one line per Token (`Budget.describe`), each with
 * the dot its role has on the layout preview. A reroll keeps the very same summary.
 */
export const NodeSummary = ({ summary }) => {
    if (!summary) {
        return <p data-node-summary="empty" className="text-white/50">{SCREEN_TEXT.SUMMARY_EMPTY}</p>;
    }
    const { headline, lines } = describe(summary);
    return (
        <div data-node-summary>
            <div data-node-summary-headline className="font-bold text-gi-gold">{headline}</div>
            <ul className="mt-1 flex flex-col">
                {lines.map(line => (
                    <li key={`${line.role}|${line.typeId}`} data-node-summary-line={line.typeId} className="flex items-center gap-2 py-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_COLOUR[line.role] || ROLE_COLOUR.node }} />
                        <span className="tabular-nums">{line.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default NodeSummary;
