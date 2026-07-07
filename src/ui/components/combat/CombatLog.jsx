import React, { useRef, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { ScrollText } from 'lucide-react';

/**
 * CombatLog
 * A scrolling text feed mounted at the bottom of the Combat Stage. 
 * Renders the blow-by-blow narrative of the fight with semantic coloring.
 * 
 * @param {Object} props
 * @param {Array} props.logs - Array of event log objects { id, text, type }
 *   `type` can be: 'default', 'damageDealt', 'damageTaken', 'miss', 'crit', 'heal', 'system'
 */
export const CombatLog = ({
    logs = [],
    className
}) => {
    const logContainerRef = useRef(null);
    const endOfMessagesRef = useRef(null);

    // Auto-scroll to the newest message whenever the logs array changes
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Map semantic event types to tailwind text colors
    const getTypeColor = (type) => {
        switch (type) {
            case 'damageDealt': return 'text-gi-success';
            case 'damageTaken': return 'text-gi-danger';
            case 'miss': return 'text-gray-400 italic';
            case 'crit': return 'text-yellow-400 font-bold';
            case 'system': return 'text-gray-500 uppercase tracking-widest text-[8px]';
            case 'heal': return 'text-green-400';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className={cn("flex flex-col w-full bg-black/40 rounded-lg border border-white/5 overflow-hidden", className)}>

            {/* Header / Title */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border-b border-white/5">
                <ScrollText size={12} className="text-gray-400" />
                <span className="text-[9px] uppercase font-bold tracking-widest text-gray-400">Combat Log</span>
            </div>

            {/* Scrollable Feed */}
            <div className="flex flex-col gap-1 p-2 h-24 overflow-y-auto no-scrollbar font-pixel text-[10px]">
                {logs.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 italic">
                        The battle begins...
                    </div>
                ) : (
                    logs.slice(-50).map((log) => (
                        <div key={log.id} className={cn("leading-tight pb-1 border-b border-white/5 last:border-0", getTypeColor(log.type))}>
                            {/* Optional: we could include a timestamp here like [00:00] if `log.timestamp` exists */}
                            <span className="opacity-50 text-[8px] mr-1.5 font-mono">{log.time || '>'}</span>
                            {log.text}
                        </div>
                    ))
                )}
                {/* Invisible element to anchor the scroll-to-bottom behavior */}
                <div ref={endOfMessagesRef} />
            </div>

        </div>
    );
};

export default CombatLog;
