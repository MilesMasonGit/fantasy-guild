import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { cn } from '../../utils/cn.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';

/**
 * A Laboratory's card (`laboratoryCard.js` says what): the node it studies with Change node, its
 * kind's mastery, and the list of nodes in reach the card flips to, as a station's card flips to
 * its recipes; and the mastery section a node's own card shows. The same shape as the Hideout's
 * card (`HideoutCard.jsx`).
 */

const GOLD = 'var(--color-ui-gold)';

const Section = ({ children, className, ...rest }) => (
    <section className={cn('px-2 py-1.5 flex flex-col gap-1 border-t-2 border-white/15 first:border-t-0', className)} {...rest}>
        {children}
    </section>
);

const Heading = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

/** One node: its art, its kind's name and the gathering level a study of it asks in Science. */
const NodeName = ({ node, skillName }) => (
    <span className="flex items-center gap-2 min-w-0">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center bg-black border border-white/10">
            <TokenSprite typeId={node.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
        </span>
        <span className="flex flex-col min-w-0 leading-tight">
            <span className="ui-text-body font-bold text-white truncate">{node.name}</span>
            {node.level != null && <span className="ui-text-small text-gi-muted">{skillName} {node.level}</span>}
        </span>
    </span>
);

/** The ranks of a track as pips, filled where the guild holds them. */
export const RankPips = ({ pips }) => (
    <span data-mastery-pips className="inline-flex items-center gap-0.5">
        {pips.map((held, i) => (
            <span
                key={i}
                data-mastery-pip={held ? 'held' : 'open'}
                className="inline-block w-2.5 h-2.5 border"
                style={{ borderColor: GOLD, background: held ? GOLD : 'transparent' }}
            />
        ))}
    </span>
);

/**
 * A kind's mastery: its rank as pips and a numeral, the points to the next rank and that rank's
 * buff (its rules on hover), or that every rank is held. `title`: the section's heading.
 */
export const MasterySection = ({ mastery, title = 'Mastery' }) => {
    if (!mastery) return null;
    const held = mastery.held.map(r => `${r.roman}: ${r.buff}`);
    return (
        <Section data-card-block="mastery" data-mastery-kind={mastery.kind}>
            <Heading>{title}</Heading>
            <Tooltip lines={held.length ? [`${mastery.name} mastery, on every ${mastery.name}:`, ...held] : [`No rank of ${mastery.name} mastery yet`]}>
                <span className="flex items-center gap-2 cursor-help">
                    <RankPips pips={mastery.pips} />
                    <span data-mastery-rank={mastery.rank} className="ui-text-body text-white">
                        {mastery.rank ? `${mastery.name} ${mastery.roman}` : mastery.name}
                    </span>
                </span>
            </Tooltip>
            {mastery.next ? (
                <Tooltip lines={mastery.next.lines}>
                    <span data-mastery-next={mastery.next.rank} className="ui-text-small text-gi-muted cursor-help">
                        Next, rank {mastery.next.roman}: <span style={{ color: GOLD }}>{mastery.next.buff}</span> in {mastery.next.toGo} {mastery.next.toGo === 1 ? 'study' : 'studies'} ({mastery.points}/{mastery.next.points})
                    </span>
                </Tooltip>
            ) : (
                <span data-mastery-next="none" className="ui-text-small" style={{ color: GOLD }}>Fully mastered</span>
            )}
        </Section>
    );
};

/** The study: the node it studies, the hero's level against it, Change node. */
export const StudySection = ({ block, onChangeNode }) => (
    <Section data-card-block="study">
        <Heading>Studies</Heading>
        {block.node
            ? <span data-card-study-node={block.node.typeId}><NodeName node={block.node} skillName={block.skillName} /></span>
            : (
                <span data-card-study-none className="ui-text-body" style={{ color: GOLD }}>
                    {block.lost ? 'Its node is out of reach' : 'No node chosen'}
                </span>
            )}
        {block.away && (
            <span data-card-study-away className="ui-text-small text-gi-muted">Its node is resting or growing back: the study waits for it</span>
        )}
        {block.hero && block.hero.level < block.hero.needs && (
            <span data-card-study-short className="ui-text-small" style={{ color: GOLD }}>
                {block.hero.name}&apos;s {block.skillName} {block.hero.level} is below its {block.hero.needs}
            </span>
        )}
        {block.change && (
            <button
                type="button"
                data-card-change-node
                onClick={(e) => { e.stopPropagation(); onChangeNode?.(); }}
                className="ui-frame-chamfer self-start px-3 py-1 ui-text-body font-bold cursor-pointer"
                style={{ color: GOLD }}
            >
                {block.change.label}
            </button>
        )}
    </Section>
);

const REFUSAL_TEXT = Object.freeze({ level: 'Needs a higher Laboratory', mastered: 'Mastered' });

/**
 * The nodes in reach a Laboratory can study, nearest first: one click picks one. A node above the
 * Laboratory's level or of a kind fully mastered is shown, greyed, and cannot be picked.
 */
export const NodeList = ({ block, onChoose, onBack }) => {
    useEscapeLayer(!!onBack, () => onBack?.());
    return (
        <div data-node-list className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <span className="flex-1 ui-text-body font-bold text-white">Nodes in reach</span>
                {onBack && (
                    <button
                        type="button"
                        data-node-back
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="shrink-0 bg-black/65 px-2 py-1 ui-text-body text-gi-muted hover:text-white cursor-pointer"
                    >
                        Back
                    </button>
                )}
            </div>
            <div className="bg-black/65 py-1 flex flex-col">
                {!block.options.length && (
                    <div data-node-empty className="px-2 py-3 ui-text-body text-gi-muted">
                        No node in reach to study. Set the Laboratory near a vein, a tree, a bush, a Field or a Fishing Spot.
                    </div>
                )}
                {block.options.map(o => {
                    const pickable = !o.refusal;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            disabled={!pickable}
                            data-node-option={o.id}
                            data-node-refusal={o.refusal || undefined}
                            data-node-selected={o.id === block.node?.id ? 'true' : undefined}
                            onClick={(e) => { e.stopPropagation(); if (pickable) onChoose(o.id); }}
                            className={cn(
                                'flex items-center gap-2 px-2 py-1 text-left',
                                pickable ? 'cursor-pointer hover:bg-white/10' : 'opacity-50 cursor-default',
                                o.id === block.node?.id && 'outline outline-2 outline-white'
                            )}
                        >
                            <NodeName node={o} skillName={block.skillName} />
                            <span className="flex-1" />
                            {o.refusal
                                ? <span className="ui-text-small text-gi-muted">{REFUSAL_TEXT[o.refusal]}</span>
                                : <span className="ui-text-small text-gi-muted tabular-nums">Rank {o.rank}/{o.ranks}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
