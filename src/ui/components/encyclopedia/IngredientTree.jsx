import { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { HOW } from '../../../systems/progression/ledger/engine.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { PixelTriangle } from '../base/ArrowScrollList.jsx';

/** A tree quantity as the screen says it: whole numbers as they are, others to one decimal. */
export function quantityText(q) {
    const n = Number(q) || 0;
    const shown = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
    return `×${shown.toLocaleString('en-US')}`;
}

/** Where a node comes from, in a few words: "at Furnace" for a recipe, "from Iron Ore Vein" for the rest. */
function sourceText(node) {
    if (node.cycle) return t('encyclopedia.tree.again');
    const s = node.source;
    if (!s) return null;
    if (s.how === HOW.CRAFT) return s.at ? t('encyclopedia.tree.at', { name: s.at }) : null;
    return s.viaName ? t('encyclopedia.tree.from', { name: s.viaName }) : null;
}

/** One ingredient, its own ingredients folded under it until opened. */
const TreeNode = ({ node, scale, book, onGo, depth }) => {
    const [open, setOpen] = useState(false);
    const kids = node.cycle ? [] : node.children;
    const linked = !!book.entryOf(node.key);
    const from = sourceText(node);
    return (
        <li data-codex-tree-node={node.id} data-open={kids.length ? String(open) : undefined}>
            <div className="flex items-center gap-1.5 py-0.5 ui-text-body" style={{ paddingLeft: depth * 20 }}>
                {kids.length ? (
                    <button
                        type="button"
                        data-codex-tree-toggle
                        aria-expanded={open}
                        aria-label={t(open ? 'encyclopedia.tree.close' : 'encyclopedia.tree.open')}
                        title={t(open ? 'encyclopedia.tree.close' : 'encyclopedia.tree.open')}
                        onClick={() => setOpen(o => !o)}
                        className={cn('w-5 h-5 shrink-0 flex items-center justify-center cursor-pointer text-gi-muted hover:text-white', !open && '-rotate-90')}
                    >
                        <PixelTriangle dir="down" />
                    </button>
                ) : <span className="w-5 shrink-0" />}
                <ItemIcon item={node.id} size={32} title={null} className="shrink-0" />
                <button
                    type="button"
                    data-codex-tree-link={node.key}
                    disabled={!linked}
                    onClick={() => onGo(node.key)}
                    className="font-bold text-gi-text hover:text-white cursor-pointer text-left break-words disabled:cursor-default disabled:hover:text-gi-text"
                >
                    {node.name}
                </button>
                <span className="tabular-nums text-gi-text">{quantityText(node.quantity * scale)}</span>
                {from && <span className="ui-text-small text-gi-muted">{from}</span>}
            </div>
            {open && kids.length > 0 && (
                <ul>
                    {kids.map((child, i) => <TreeNode key={`${child.key}-${i}`} node={child} scale={scale} book={book} onGo={onGo} depth={depth + 1} />)}
                </ul>
            )}
        </li>
    );
};

/**
 * An ingredient tree (`ledger/engine.js` `ingredientTree`), folded: only its first level shows, and
 * each ingredient opens to its own. A name is a link to that entry. `asChild` draws the root itself
 * as a row (a recipe's input); otherwise the root is the entry being read and its ingredients are
 * the rows. `scale` multiplies every quantity (a recipe asking for 4 of an input).
 */
export const IngredientTree = ({ root, scale = 1, book, onGo, asChild = false }) => (
    <ul data-codex-tree={root.id}>
        {asChild
            ? <TreeNode node={root} scale={scale} book={book} onGo={onGo} depth={0} />
            : root.children.map((child, i) => <TreeNode key={`${child.key}-${i}`} node={child} scale={scale} book={book} onGo={onGo} depth={0} />)}
    </ul>
);

export default IngredientTree;
