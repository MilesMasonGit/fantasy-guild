// The QA panel's Starter Camp section.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useMemo, useState } from 'react';
import { getAllTokenTypes } from '../../config/registries/tokenRegistry.js';
import * as Landmarks from '../../systems/board/Landmarks.js';
import { saveLiveMatToCms, devPlaceToken, placeableTypes, DEFAULT_CMS_URL } from './starterCampDev.js';

const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';
const inputClass = 'min-w-0 px-2 py-1 rounded bg-gi-base border border-gi-border text-xs text-gi-text focus:outline-none focus:border-gi-primary/50';
const buttonClass = 'shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/** Remembered on this device only, so the owner types a non-default CMS address once. */
const CMS_URL_KEY = 'fantasy_guild_dev_cms_url';

function storedCmsUrl() {
    try { return localStorage.getItem(CMS_URL_KEY) || DEFAULT_CMS_URL; } catch { return DEFAULT_CMS_URL; }
}

/**
 * Lay out the Starter Camp on the mat, then save it to the CMS: Place Token brings any Token
 * (endgame sites included) beside the Hall; "Move and remove landmarks" lets them be dragged and
 * binned while it is ticked; "Save this mat as the Starter Camp" sends the mat and the Bank to the
 * CMS's Starter Camp page, to review and Sync.
 */
export function StarterCampDevSection() {
    const [placeId, setPlaceId] = useState('');
    const [editing, setEditing] = useState(Landmarks.isLayoutEditing());
    const [cmsUrl, setCmsUrl] = useState(storedCmsUrl);
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const types = useMemo(() => placeableTypes(getAllTokenTypes()), []);

    const onPlace = () => {
        const typed = placeId.trim();
        const match = types.find(t => t.id === typed || t.name.toLowerCase() === typed.toLowerCase());
        const res = devPlaceToken(match?.id || typed);
        setStatus(res.success ? `Placed ${match?.name || typed}` : res.reason);
    };

    const onEditing = (on) => {
        Landmarks.setLayoutEditing(on);
        setEditing(on);
    };

    const onCmsUrl = (value) => {
        setCmsUrl(value);
        try { localStorage.setItem(CMS_URL_KEY, value); } catch { /* a convenience only */ }
    };

    const onSave = async () => {
        setSaving(true);
        setStatus('Saving…');
        const result = await saveLiveMatToCms({ cmsUrl, savedAt: new Date().toISOString() });
        setSaving(false);
        setStatus(result.message);
        console.log(`[Dev] Starter Camp: ${result.message}`);
    };

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-starter-camp">
            <div className={labelClass}>Starter Camp (dev only)</div>
            <div className="flex gap-1">
                <input
                    type="text"
                    list="dev-token-types"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onPlace(); }}
                    placeholder="token_... or a name"
                    aria-label="Token to place"
                    className={`${inputClass} flex-1`}
                />
                <datalist id="dev-token-types">
                    {types.map(t => <option key={t.id} value={t.id}>{t.landmark ? `${t.name} (landmark)` : t.name}</option>)}
                </datalist>
                <button onClick={onPlace} className={buttonClass}>Place</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gi-text cursor-pointer select-none">
                <input type="checkbox" checked={editing} onChange={(e) => onEditing(e.target.checked)} />
                Move and remove landmarks
            </label>
            <div className="flex gap-1 items-center">
                <span className="text-[10px] text-gi-muted shrink-0">CMS</span>
                <input
                    type="text"
                    value={cmsUrl}
                    onChange={(e) => onCmsUrl(e.target.value)}
                    aria-label="CMS address"
                    className={`${inputClass} flex-1`}
                />
            </div>
            <button onClick={onSave} disabled={saving} className={`${buttonClass} w-full`}>
                Save this mat as the Starter Camp
            </button>
            {status && <div className="text-[10px] text-gi-muted break-words" role="status">{status}</div>}
        </div>
    );
}
