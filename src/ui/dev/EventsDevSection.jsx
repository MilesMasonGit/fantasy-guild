// The QA panel's Events section: land an event now, without waiting an hour.
// ⚠️ QA BUILDS ONLY: TestDashboard renders this behind `QA_TOOLS && …`.

import { useState } from 'react';
import * as EventClock from '../../systems/events/EventClock.js';
import { allEvents } from '../../config/registries/eventRegistry.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/** `m:ss` for a game-ms span. */
function clockText(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What the event clock says now, in a line. */
function clockLine() {
    if (!EventClock.isEnabled()) return 'Events are off';
    if (EventClock.eventTokenOnMat()) return 'An event is on the mat: the clock waits until it leaves';
    return `Next event in ${clockText(EventClock.nextEventInMs())}`;
}

export function EventsDevSection() {
    const [status, setStatus] = useState('');
    const events = allEvents();
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-events">
            <div className={labelClass}>Events</div>
            <div className="ui-text-body text-gi-muted" data-qa-events-clock>{clockLine()}</div>
            <div className="flex flex-wrap gap-1">
                <button
                    type="button"
                    data-qa-event-next
                    className={buttonClass}
                    onClick={() => {
                        const instance = EventClock.landNext();
                        setStatus(instance ? `${instance.event.name} landed` : 'No event fits here, or none found room');
                    }}
                >
                    Land the next event (by weight)
                </button>
                {events.map(ev => (
                    <button
                        key={ev.id}
                        type="button"
                        data-qa-event={ev.id}
                        className={buttonClass}
                        onClick={() => {
                            const res = EventClock.landNow(ev.id);
                            setStatus(res.success ? `${ev.name} landed` : res.reason);
                        }}
                    >
                        Land {ev.name}
                    </button>
                ))}
            </div>
            {!events.length && <div className="ui-text-body text-gi-muted">No events in the table yet (the CMS's Events page)</div>}
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
