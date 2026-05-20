import { useState, useRef, useEffect, useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Plus } from 'lucide-react';

/**
 * EntitySelect — The "Frictionless Linker"
 * Searchable dropdown for selecting items. If the typed name doesn't exist,
 * offers to create it as a "Ghost Item" instantly.
 */
export default function EntitySelect({ value, onChange, entityTypes = ['item'], placeholder = 'Search or create...' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const store = useEntityStore();

  const allEntities = useMemo(() => {
    const merged = [];
    for (const type of entityTypes) {
      const collectionKey = type === 'enemy' ? 'enemies' : type + 's';
      const coll = store[collectionKey] || {};
      for (const entity of Object.values(coll)) {
        merged.push({ ...entity, _type: type });
      }
    }
    return merged;
  }, [entityTypes, store]);

  const filtered = useMemo(() => {
    if (!query) return allEntities.slice(0, 20);
    const q = query.toLowerCase();
    return allEntities.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allEntities, query]);

  const selectedEntity = allEntities.find((e) => e.id === value);
  const exactMatch = allEntities.find((e) => e.name.toLowerCase() === query.toLowerCase());

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id, type) => {
    onChange(id, type);
    setQuery('');
    setIsOpen(false);
  };

  const handleCreateGhost = () => {
    // If multiple types are supported, we default to the first one for ghost creation
    const defaultType = entityTypes[0];
    const defaultIcon = defaultType === 'enemy' ? '💀' : defaultType === 'encounterTable' ? '⚔️' : defaultType === 'lootTable' ? '🎲' : '👻';
    const addKey = 'add' + defaultType.charAt(0).toUpperCase() + defaultType.slice(1);
    
    const id = store[addKey]({ name: query, icon: defaultIcon });
    onChange(id, defaultType);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? query : (selectedEntity?.name || '')}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        className="w-full"
        style={{ fontSize: 13 }}
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-xl border"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border-default)',
            maxHeight: 240,
            overflowY: 'auto',
          }}>
          {filtered.map((entity) => (
            <button
              key={entity.id}
              onClick={() => handleSelect(entity.id, entity._type)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
              style={{
                background: entity.id === value ? 'var(--color-bg-hover)' : 'transparent',
                color: 'var(--color-text-primary)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-bg-hover)'}
              onMouseLeave={(e) => e.target.style.background = entity.id === value ? 'var(--color-bg-hover)' : 'transparent'}
            >
              <span>{entity.icon || (entity._type === 'encounterTable' ? '⚔️' : entity._type === 'lootTable' ? '🎲' : '📦')}</span>
              <span>{entity.name}</span>
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{entity._type === 'encounterTable' ? 'ENC' : entity._type === 'lootTable' ? 'LOOT' : 'ITEM'}</span>
              <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {entity.trueCost > 0 ? `${entity.trueCost} GP` : ''}
              </span>
            </button>
          ))}

          {/* Ghost Creation Option */}
          {query && !exactMatch && (
            <button
              onClick={handleCreateGhost}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t"
              style={{
                background: 'transparent',
                color: 'var(--color-accent)',
                borderColor: 'var(--color-border-subtle)',
                border: 'none',
                borderTop: '1px solid var(--color-border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Create "<strong>{query}</strong>" as new {entityTypes[0] || 'item'}</span>
            </button>
          )}

          {filtered.length === 0 && !query && (
            <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No {entityTypes[0] || 'options'} found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
