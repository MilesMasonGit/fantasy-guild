import { useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { TEXT, FLAVOUR_NAME_MAX } from '../../../systems/atlas/regionNames.js';
import { cn } from '../../utils/cn.js';
import { SCREEN_TEXT, dayOf } from './atlasScreenText.js';

const buttonCls = 'px-2 py-0.5 rounded border border-gi-gold/40 text-amber-100 hover:border-gi-gold hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gi-gold/40';

/** Why Region `region` cannot be abandoned, or null when it can. The engine refuses the same. */
export function abandonRefusal(region) {
    if (region.active) return TEXT.REFUSE_ACTIVE;
    if (region.kind === Atlas.REGION_KIND.STARTER) return TEXT.REFUSE_STARTER;
    return null;
}

/** The flavour name, and its inline rename: Enter or leaving the box keeps it, Escape does not. */
const FlavourName = ({ region, onMessage }) => {
    const [draft, setDraft] = useState(null);
    // Enter or Escape unmounts the box, and a browser may blur it on the way out: that blur must do nothing.
    const dropped = useRef(false);
    const commit = () => {
        if (draft == null || dropped.current) return;
        dropped.current = true;
        const result = Atlas.rename(region.id, draft);
        setDraft(null);
        onMessage(result.success ? null : result.reason);
    };
    if (draft != null) {
        return (
            <input
                autoFocus
                data-region-rename-input={region.id}
                aria-label={SCREEN_TEXT.RENAME}
                value={draft}
                maxLength={FLAVOUR_NAME_MAX}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        dropped.current = true;
                        setDraft(null);
                    }
                }}
                className="w-full max-w-[16rem] px-1 bg-black/60 border border-gi-gold/50 rounded-sm text-white outline-none"
            />
        );
    }
    return (
        <button
            type="button"
            data-region-rename={region.id}
            title={SCREEN_TEXT.RENAME}
            onClick={() => { dropped.current = false; setDraft(region.flavourName); }}
            className="group flex items-center gap-1 font-bold text-white text-left hover:text-gi-gold"
        >
            <span className="truncate">{region.flavourName}</span>
            <Pencil className="w-3 h-3 opacity-40 group-hover:opacity-100 shrink-0" />
        </button>
    );
};

const RegionRow = ({ region, onTravel, onMessage }) => {
    const [confirming, setConfirming] = useState(false);
    const refusal = abandonRefusal(region);
    const settledAt = Atlas.getRegion(region.id)?.settledAt;
    const act = (fn) => {
        const result = fn(region.id);
        onMessage(result.success ? null : result.reason);
    };
    return (
        <li data-region-row={region.id} data-region-active={region.active} className="py-1.5 border-b border-white/10 last:border-b-0">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <FlavourName region={region} onMessage={onMessage} />
                    <div className="text-white/60 truncate">
                        {region.practicalName} · {SCREEN_TEXT.settledDay(dayOf(settledAt))} · {SCREEN_TEXT.tokens(region.tokens)}
                    </div>
                </div>
                {region.active ? (
                    <span data-region-here className="px-2 text-gi-gold font-bold">{SCREEN_TEXT.HERE}</span>
                ) : region.archived ? (
                    <button type="button" data-region-restore={region.id} className={buttonCls} onClick={() => act(Atlas.restore)}>{SCREEN_TEXT.RESTORE}</button>
                ) : (
                    <>
                        <button type="button" data-region-travel={region.id} className={buttonCls} onClick={() => onTravel(region.id)}>{SCREEN_TEXT.TRAVEL}</button>
                        <button type="button" data-region-archive={region.id} className={buttonCls} onClick={() => act(Atlas.archive)}>{SCREEN_TEXT.ARCHIVE}</button>
                    </>
                )}
                <button
                    type="button"
                    data-region-abandon={region.id}
                    className={cn(buttonCls, 'text-red-200')}
                    disabled={!!refusal}
                    title={refusal || undefined}
                    onClick={() => setConfirming(true)}
                >
                    {SCREEN_TEXT.ABANDON}
                </button>
            </div>
            {confirming && (
                <div data-region-abandon-confirm={region.id} className="mt-1 flex items-center gap-2 text-red-200">
                    <span className="flex-1">{SCREEN_TEXT.abandonQuestion(region.flavourName)}</span>
                    <button type="button" data-region-abandon-yes={region.id} className={cn(buttonCls, 'text-red-200')} onClick={() => { setConfirming(false); act(Atlas.abandon); }}>{SCREEN_TEXT.ABANDON}</button>
                    <button type="button" data-region-abandon-no={region.id} className={buttonCls} onClick={() => setConfirming(false)}>{SCREEN_TEXT.KEEP}</button>
                </div>
            )}
        </li>
    );
};

/**
 * Every Region the guild has settled, oldest first, then the archive: each with its flavour name
 * (click to rename), its practical name, the day it was settled and its Token count; Travel,
 * Archive or Restore, and Abandon behind a confirmation. The Region the guild is in reads "Here".
 */
export const RegionList = ({ version, onTravel, message, onMessage }) => {
    const regions = useMemo(() => Atlas.list(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const archived = useMemo(() => Atlas.list({ archived: true }), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div data-region-list className="flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
            <ul>
                {regions.map(r => <RegionRow key={r.id} region={r} onTravel={onTravel} onMessage={onMessage} />)}
            </ul>
            {archived.length > 0 && (
                <div data-region-archive-list className="mt-3">
                    <h3 className="text-[10px] uppercase tracking-wide text-white/50 mb-1">{SCREEN_TEXT.ARCHIVED_HEADING}</h3>
                    <ul>
                        {archived.map(r => <RegionRow key={r.id} region={r} onTravel={onTravel} onMessage={onMessage} />)}
                    </ul>
                </div>
            )}
            {message && <p role="status" data-region-message className="mt-2 text-red-300">{message}</p>}
        </div>
    );
};

export default RegionList;
