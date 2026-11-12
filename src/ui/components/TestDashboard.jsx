import React, { useMemo, useState } from 'react';
import { Bug } from 'lucide-react';
import { cn } from '../utils/cn.js';
import { ItemIcon } from './base/ItemIcon.jsx';
import { TokenSprite, TOKEN_SURFACE } from './base/TokenSprite.jsx';
import { CloseX } from './base/CloseX.jsx';
import { AnimationStudioModal } from './dev/AnimationStudioModal.jsx';
import { PerfDevSection } from '../dev/perf/PerfDevSection.jsx';
import { saveLiveMatToCms, DEFAULT_CMS_URL } from '../dev/starterCampDev.js';
import {
    PICKER_ROWS, itemChoices, tokenChoices, filterByName, giveAndSay, devBankEveryKind, devFillBank,
    hireHero, spawnParty, levelAllHeroes, healEveryone, knockOutAHero, devPlaceToken, clearBoard
} from '../dev/qaTools.js';
import * as Landmarks from '../../systems/board/Landmarks.js';

/**
 * The open QA panel never grows past the window: it is capped at the viewport height less its
 * 1rem margins top and bottom, and the part under the header scrolls inside it.
 */
export const QA_PANEL_FIT_CLASS = 'max-h-[calc(100dvh-2rem)]';
export const QA_PANEL_BODY_CLASS = 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const inputClass = 'min-w-0 px-2 py-1 rounded bg-gi-base border border-gi-border text-xs text-gi-text focus:outline-none focus:border-gi-primary/50';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';
const sectionClass = 'mb-3 pb-3 border-b border-gi-border space-y-1.5';

/** Remembered on this device by the Starter Camp tool: where the CMS runs. */
const CMS_URL_KEY = 'fantasy_guild_dev_cms_url';
function storedCmsUrl() {
    try { return localStorage.getItem(CMS_URL_KEY) || DEFAULT_CMS_URL; } catch { return DEFAULT_CMS_URL; }
}

/**
 * A search box over a list of `{id, name}`: typing narrows the list by name, a row is clicked.
 * Shows the first `PICKER_ROWS` matches; the rest are reached by typing more.
 */
function Picker({ testId, choices, placeholder, selectedId, onPick, Icon }) {
    const [query, setQuery] = useState('');
    const matches = useMemo(() => filterByName(choices, query), [choices, query]);
    return (
        <div data-testid={testId}>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className={cn(inputClass, 'w-full mb-1')}
            />
            <ul className="h-28 overflow-y-auto custom-scrollbar rounded border border-gi-border bg-gi-base">
                {matches.length === 0 && <li className="px-2 py-1 text-xs text-gi-muted">Nothing by that name</li>}
                {matches.slice(0, PICKER_ROWS).map(c => (
                    <li key={c.id}>
                        <button
                            type="button"
                            data-qa-pick={c.id}
                            onClick={() => onPick(c)}
                            title={c.id}
                            className={cn(
                                'w-full flex items-center gap-2 px-1 text-left text-xs hover:bg-gi-primary/20',
                                c.id === selectedId && 'bg-gi-primary/25 text-gi-primary font-bold'
                            )}
                        >
                            <span className="shrink-0 w-8 h-8 flex items-center justify-center overflow-hidden">
                                <Icon id={c.id} />
                            </span>
                            <span className="truncate">{c.name}</span>
                            {c.enemy && <span className="ml-auto pr-1 ui-text-body text-gi-muted">enemy</span>}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const ItemPickIcon = ({ id }) => <ItemIcon item={id} size={32} title={null} />;
const TokenPickIcon = ({ id }) => <TokenSprite typeId={id} surface={TOKEN_SURFACE.CATALOGUE} size={32} alt="" />;

/**
 * The QA panel: give items, change the heroes, put Tokens and enemies on the mat, and the
 * owner's two art and authoring tools. Off in a ship build (`QA_TOOLS`, where it is rendered).
 */
export const TestDashboard = React.memo(() => {
    const [isOpen, setIsOpen] = useState(false);
    const [showAnimationStudio, setShowAnimationStudio] = useState(false);
    const [item, setItem] = useState(null);
    const [amount, setAmount] = useState(1);
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [layoutEditing, setLayoutEditing] = useState(() => Landmarks.isLayoutEditing());
    const items = useMemo(() => (isOpen ? itemChoices() : []), [isOpen]);
    const tokens = useMemo(() => (isOpen ? tokenChoices() : []), [isOpen]);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                setShowAnimationStudio(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const say = (msg) => {
        setStatus(msg);
        console.log(`[QA] ${msg}`);
    };

    const onGive = () => {
        if (!item) { say('Pick an item first'); return; }
        say(giveAndSay(item.id, amount));
    };

    const onPlace = (choice) => {
        const res = devPlaceToken(choice.id);
        say(res?.success ? `Placed ${choice.name}` : (res?.reason || `Could not place ${choice.name}`));
    };

    const onKnockOut = () => {
        const r = knockOutAHero();
        say(r.ok ? `${r.name} is knocked out` : r.error);
    };

    const onSaveCamp = async () => {
        setSaving(true);
        say('Saving…');
        const result = await saveLiveMatToCms({ cmsUrl: storedCmsUrl(), savedAt: new Date().toISOString() });
        setSaving(false);
        say(result.message);
    };

    const onLayoutEditing = (on) => {
        Landmarks.setLayoutEditing(on);
        setLayoutEditing(on);
    };

    const heroActions = [
        ['Hire a hero', () => say(hireHero() ? 'Hired a hero' : 'Could not hire a hero')],
        ['Spawn a party', () => say(`Spawned a party of ${spawnParty()} at level 50`)],
        ['Level all +1', () => say(`Raised ${levelAllHeroes(1)} heroes one level`)],
        ['Level all +10', () => say(`Raised ${levelAllHeroes(10)} heroes ten levels`)],
        ['Heal everyone', () => say(`Healed ${healEveryone()} heroes`)],
        ['Knock out a hero', onKnockOut]
    ];

    return (
        <>
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 right-4 z-(--z-dev-tools) p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold"
                    title="Open QA Dashboard"
                >
                    <Bug className="w-5 h-5" /> QA
                </button>
            ) : (
                <div
                    data-testid="qa-panel"
                    className={`fixed bottom-4 right-4 z-(--z-dev-tools) w-72 ${QA_PANEL_FIT_CLASS} bg-gi-surface/95 border border-gi-primary rounded-xl p-3 flex flex-col pointer-events-auto`}
                >
                    <div className="shrink-0 flex items-center justify-between mb-3 border-b border-gi-border pb-2">
                        <div className="flex items-center gap-2 text-gi-primary font-bold">
                            <Bug className="w-4 h-4" /> QA TESTER
                        </div>
                        <CloseX onClick={() => setIsOpen(false)} />
                    </div>

                    <div data-testid="qa-panel-body" className={QA_PANEL_BODY_CLASS}>
                        <div className={sectionClass} data-testid="qa-give" data-qa-group>
                            <div className={labelClass}>Give items</div>
                            <Picker
                                testId="qa-item-picker"
                                choices={items}
                                placeholder="Search items"
                                selectedId={item?.id}
                                onPick={setItem}
                                Icon={ItemPickIcon}
                            />
                            <div className="flex gap-1 items-center">
                                <span className="flex-1 min-w-0 truncate text-xs text-gi-text" data-qa-give-chosen>
                                    {item ? item.name : <span className="text-gi-muted">No item picked</span>}
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    aria-label="Amount"
                                    className={cn(inputClass, 'w-16')}
                                />
                                <button onClick={onGive} className={cn(buttonClass, 'shrink-0')}>Give</button>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    className={buttonClass}
                                    onClick={() => {
                                        const { added, left } = devBankEveryKind();
                                        say(`Put ${added} kinds in the Bank` + (left ? `; ${left} found no slot` : ''));
                                    }}
                                >
                                    One of every item
                                </button>
                                <button
                                    className={buttonClass}
                                    onClick={() => {
                                        const { filled, free } = devFillBank();
                                        say(`Filled ${filled} Bank slots` + (free ? `; ${free} still free (too few kinds)` : ''));
                                    }}
                                >
                                    Fill the Bank
                                </button>
                            </div>
                        </div>

                        <div className={sectionClass} data-testid="qa-heroes" data-qa-group>
                            <div className={labelClass}>Heroes</div>
                            <div className="grid grid-cols-2 gap-1">
                                {heroActions.map(([label, onClick]) => (
                                    <button key={label} className={buttonClass} onClick={onClick}>{label}</button>
                                ))}
                            </div>
                        </div>

                        <div className={sectionClass} data-testid="qa-place" data-qa-group>
                            <div className={labelClass}>Place a Token or enemy</div>
                            <Picker
                                testId="qa-token-picker"
                                choices={tokens}
                                placeholder="Search Tokens and enemies"
                                selectedId={null}
                                onPick={onPlace}
                                Icon={TokenPickIcon}
                            />
                            <button
                                className={cn(buttonClass, 'w-full')}
                                onClick={() => { clearBoard(); say('Cleared the board'); }}
                            >
                                Clear the board
                            </button>
                        </div>

                        <div className="space-y-1.5" data-testid="qa-tools" data-qa-group>
                            <div className={labelClass}>Tools</div>
                            <div className="grid grid-cols-2 gap-1">
                                <button className={buttonClass} onClick={() => setShowAnimationStudio(true)}>
                                    Animation Studio
                                </button>
                                <button className={buttonClass} onClick={onSaveCamp} disabled={saving}>
                                    Save as Starter Camp
                                </button>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gi-text cursor-pointer select-none">
                                <input type="checkbox" checked={layoutEditing} onChange={(e) => onLayoutEditing(e.target.checked)} />
                                Move and remove landmarks and camp Tokens
                            </label>
                        </div>

                        {status && (
                            <div className="mt-2 ui-text-body text-gi-muted break-words" role="status">{status}</div>
                        )}

                        {/** The perf HUD and stress boards: dev or perf builds only, never a test build. */}
                        {(import.meta.env.DEV || import.meta.env.MODE === 'perf') && (
                            <details className="mt-3 pt-2 border-t border-gi-border">
                                <summary className={cn(labelClass, 'cursor-pointer')}>Perf HUD and stress boards</summary>
                                <PerfDevSection />
                            </details>
                        )}
                    </div>
                </div>
            )}

            {showAnimationStudio && (
                <AnimationStudioModal
                    isOpen={showAnimationStudio}
                    onClose={() => setShowAnimationStudio(false)}
                />
            )}
        </>
    );
});

export default TestDashboard;
