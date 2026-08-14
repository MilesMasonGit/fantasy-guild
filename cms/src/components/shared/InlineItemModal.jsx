import { useEffect, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { ITEM_TYPES } from '../../utils/constants';

/**
 * Create an Item without leaving the Token you are authoring (CMS-63).
 *
 * ## Why this exists
 * It serves CMS-9/CMS-12's backward chaining directly: you start from "I want a
 * Strawberry Pie" and work down to what it needs, and every step down hits an
 * ingredient that does not exist yet. The old CMS's own design document named
 * this exact workflow — create a new ingredient without losing your place — and
 * never built it, so authoring stalled every time you needed a leaf node.
 *
 * ## Deliberately smaller than the Item editor
 * Name and type only. Everything else on an Item (sprite, tags, consumable
 * fields) can be filled in later from the Items tab, and asking for it here
 * would turn a two-second detour back into leaving the screen. There is no
 * value field at all — values are derived, never typed (CMS-86).
 */
export default function InlineItemModal({ isOpen, initialName = '', onClose, onCreated }) {
    const addItem = useEntityStore((s) => s.addItem);
    const items = useEntityStore((s) => s.items);
    const [name, setName] = useState(initialName);
    const [type, setType] = useState('material');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setType('material');
            // Focus after paint so the author can just keep typing.
            const t = setTimeout(() => inputRef.current?.focus(), 30);
            return () => clearTimeout(t);
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    const trimmed = name.trim();
    const clash = Object.values(items).find(
        (i) => (i.name || '').toLowerCase() === trimmed.toLowerCase()
    );

    const submit = () => {
        if (!trimmed) return;
        const id = addItem({ name: trimmed, type });
        onCreated(id);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-xl border p-5 space-y-4"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        New Item
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-500 hover:text-gray-300"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={15} />
                    </button>
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
                        Name
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); submit(); }
                            if (e.key === 'Escape') onClose();
                        }}
                        className="w-full"
                        placeholder="Yew Log"
                    />
                    {clash && (
                        <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-warning)' }}>
                            “{clash.name}” already exists — creating this makes a second item
                            with a suffixed id.
                        </p>
                    )}
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
                        Type
                    </label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                        {ITEM_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                <p className="text-[10px] text-gray-600 leading-relaxed">
                    Sprite, tags and consumable fields can be filled in later from the
                    Items tab. Value is derived, never typed.
                </p>

                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose} className="btn-ghost text-xs" style={{ padding: '6px 12px' }}>
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!trimmed}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{
                            background: trimmed ? 'var(--color-accent-muted)' : 'transparent',
                            color: trimmed ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                            border: 'none',
                            cursor: trimmed ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <Plus size={13} /> Create &amp; use
                    </button>
                </div>
            </div>
        </div>
    );
}
