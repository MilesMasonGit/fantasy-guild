import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getSkill, SKILL_LAYERS, SKILL_CATEGORIES } from '../../../config/registries/skillRegistry.js';
import { getJob, getJobLineage } from '../../../config/registries/jobRegistry.js';

/**
 * HeroSkillSheet — a hero's job, the six skills they hold, and everything they
 * have **set down**.
 *
 * ## Why banked skills live here and not on the dock card (D-250)
 * The card is a glance surface: six cells, no room, and a player scanning the
 * dock wants to know what someone can do *now*. Banked skills are the opposite
 * kind of information — they only matter when you are deciding whether to
 * re-train, and that decision is made here.
 *
 * Showing them is what makes reversibility real rather than a rule in a
 * document. A player who cannot see that Bren still has Cooking 30 sitting
 * dormant has no reason to believe promotion is anything but permanent, and
 * D-71 exists precisely so it isn't.
 *
 * ## Grouped by layer, because the layers mean different things
 * Foundation skills are the ordinary work of the guild; a combat skill decides
 * whether this person can fight at all; a signature is exclusive to one job in
 * the whole tree. Listing them flat would flatten that.
 */
export const HeroSkillSheet = ({ heroId, className }) => {
    // One flat projection, per the useGameState selector contract: job id, then
    // held and banked skills as delimited pairs.
    const signature = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            const held = Object.entries(h.skills || {}).map(([id, s]) => `${id}:${s?.level ?? 1}`);
            const banked = Object.entries(h.bankedSkills || {}).map(([id, s]) => `${id}:${s?.level ?? 1}`);
            return `${h.jobId || 'recruit'}|${held.join(',')}|${banked.join(',')}`;
        },
        ['heroes_updated', 'hero_promoted'],
        null,
        { deps: [heroId] }
    );

    if (!signature) return null;

    const [jobId, heldRaw, bankedRaw] = signature.split('|');
    const parse = (raw) => (raw ? raw.split(',').filter(Boolean).map(p => p.split(':')) : []);
    const held = parse(heldRaw);
    const banked = parse(bankedRaw);

    const job = getJob(jobId);
    const lineage = getJobLineage(jobId).map(id => getJob(id)?.name || id);

    // Group held skills by layer, in the registry's own layer order, so adding
    // or re-layering a skill needs no edit here.
    const byLayer = Object.values(SKILL_LAYERS)
        .map(layer => ({
            layer,
            name: SKILL_CATEGORIES[layer]?.name || layer,
            rows: held.filter(([id]) => getSkill(id)?.layer === layer)
        }))
        .filter(g => g.rows.length > 0);

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {/* Job, and the path taken to it */}
            <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">Job</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-gi-text">{job?.icon} {job?.name || jobId}</span>
                    {lineage.length > 1 && (
                        <span className="text-[9px] text-gi-muted/70">{lineage.join(' → ')}</span>
                    )}
                </div>
                {job?.description && (
                    <span className="text-[9px] text-gi-muted italic">{job.description}</span>
                )}
            </div>

            {/* Held — the six they can use right now */}
            <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                    Skills ({held.length})
                </span>
                {byLayer.map(group => (
                    <div key={group.layer} className="flex flex-col gap-1">
                        <span className="text-[9px] gi-caps tracking-wider text-gi-muted/60">{group.name}</span>
                        <div className="grid grid-cols-2 gap-1">
                            {group.rows.map(([id, level]) => {
                                const def = getSkill(id);
                                return (
                                    <div
                                        key={id}
                                        title={`${def?.name || id} — level ${level}`}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded border border-gi-border/30 bg-black/20"
                                    >
                                        <span className="text-[11px] leading-none shrink-0">{def?.icon}</span>
                                        <span className="text-[10px] text-gi-text truncate flex-1">{def?.name || id}</span>
                                        <span className="text-[10px] font-bold tabular-nums text-gi-text/80">{level}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Banked — greyed, and explained, because a level sitting in a
                list with no context reads as a bug rather than as a promise. */}
            {banked.length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t border-gi-border/30">
                    <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted/70">
                        Set aside ({banked.length})
                    </span>
                    <span className="text-[9px] text-gi-muted/60 italic">
                        Kept at the level they reached. A job that uses one again gets it back exactly as it is.
                    </span>
                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                        {banked.map(([id, level]) => {
                            const def = getSkill(id);
                            return (
                                <div
                                    key={id}
                                    title={`${def?.name || id} — banked at level ${level}`}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded border border-dashed border-gi-border/25 bg-black/10 opacity-60"
                                >
                                    <span className="text-[11px] leading-none shrink-0 grayscale">{def?.icon}</span>
                                    <span className="text-[10px] text-gi-muted truncate flex-1">{def?.name || id}</span>
                                    <span className="text-[10px] font-bold tabular-nums text-gi-muted">{level}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeroSkillSheet;
