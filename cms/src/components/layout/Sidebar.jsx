import { useState, useMemo } from 'react';
import { Package, Boxes, Map as MapIcon, Plus, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';
import { TOKEN_TYPES } from '../../utils/constants';

/**
 * Three tabs, not ten (CMS-36/37). Tasks, Stations, Areas, Subskills, Tags,
 * Effects and Loot Tables are gone with the card-sequence game they described.
 *
 * ⚠️ **There is no Enemies tab.** CMS-85 makes Enemy a *filtered view* of the
 * Token list rather than a separate entity — an enemy is a Token (D-104), so it
 * lives in the Token list and is reached through the type filter below.
 */
const ENTITY_TABS = [
  { key: 'items', label: 'Items', type: 'item', icon: Package, color: 'var(--color-item)', add: 'addItem' },
  { key: 'tokens', label: 'Tokens', type: 'token', icon: Boxes, color: 'var(--color-accent)', add: 'addToken' },
  { key: 'maps', label: 'Maps', type: 'map', icon: MapIcon, color: 'var(--color-area)', add: 'addMap' },
];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const tab = ENTITY_TABS.find((t) => t.key === activeTab);
  const entities = useEntityStore((s) => s[activeTab]);
  const addEntity = useEntityStore((s) => s[tab.add]);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const filteredEntities = useMemo(() => {
    let list = Object.values(entities || {});

    if (activeTab === 'tokens' && typeFilter) {
      list = list.filter((e) => e.tokenType === typeFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) => (e.name || '').toLowerCase().includes(q) || (e.id || '').includes(q)
      );
    }

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [entities, activeTab, typeFilter, searchQuery]);

  /**
   * Tokens group by `tokenType`, which is the one classification that reliably
   * says what a Token is for. Items and Maps stay flat — there are too few Maps
   * to group, and an Item's type is not how you look for one.
   */
  const groupedEntities = useMemo(() => {
    if (activeTab !== 'tokens') return null;
    const groups = {};
    for (const entity of filteredEntities) {
      const key = entity.tokenType || 'unclassified';
      (groups[key] ||= []).push(entity);
    }
    return groups;
  }, [filteredEntities, activeTab]);

  const handleAdd = () => {
    const id = addEntity();
    setActiveEntity(id, tab.type);
  };

  const renderEntityButton = (entity) => {
    const isSelected = entity.id === activeEntityId;
    const path = resolveSpritePath(entity);
    const FallbackIcon = tab.icon;

    return (
      <button
        key={entity.id}
        onClick={() => setActiveEntity(entity.id, tab.type)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors hover:bg-white/5"
        style={{
          background: isSelected ? 'var(--color-bg-hover)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      >
        <div className="w-5 h-5 flex items-center justify-center shrink-0 overflow-hidden rounded border border-white/5 bg-black/20 text-gray-500">
          {path ? (
            <>
              <img
                src={path.startsWith('/') ? path : `/${path}`}
                className="w-5 h-5 object-contain pixel-art"
                alt=""
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none' }} className="items-center justify-center w-full h-full">
                <FallbackIcon size={12} />
              </div>
            </>
          ) : (
            <FallbackIcon size={12} />
          )}
        </div>
        <span className="flex-1 text-sm truncate">{entity.name}</span>
        <ChevronRight size={12} style={{ opacity: isSelected ? 1 : 0 }} />
      </button>
    );
  };

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: 280,
        minWidth: 280,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {ENTITY_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                setSearchQuery('');
                setTypeFilter('');
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors"
              style={{
                color: isActive ? t.color : 'var(--color-text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${t.color}` : '2px solid transparent',
                cursor: 'pointer',
              }}
              title={t.label}
            >
              <Icon size={15} />
              <span className="text-xs font-semibold">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Header + add */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {tab.label}
        </span>
        <button onClick={handleAdd} className="btn-ghost flex items-center gap-1" style={{ padding: '4px 8px' }}>
          <Plus size={14} />
          <span className="text-xs">New</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${tab.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Token type filter — this is how Enemies are reached (CMS-85) */}
      {activeTab === 'tokens' && (
        <div className="px-3 pb-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full"
            style={{ fontSize: 12 }}
            title="Filter by Token type — enemies are a filtered view of this list, not a separate tab"
          >
            <option value="">All types</option>
            {TOKEN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {filteredEntities.length === 0 && (
          <div className="text-center py-8 px-4" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            {searchQuery || typeFilter
              ? 'No results found'
              : `No ${tab.label.toLowerCase()} yet. Click + New to create one.`}
          </div>
        )}

        {groupedEntities
          ? Object.entries(groupedEntities)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, groupItems]) => {
                const isExpanded = !collapsedGroups[groupName];
                return (
                  <div key={groupName} className="mb-2">
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left"
                      style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        {groupName} ({groupItems.length})
                      </span>
                      {isExpanded ? (
                        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                      ) : (
                        <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </button>
                    {isExpanded && <div className="pl-2 space-y-0.5 mt-0.5">{groupItems.map(renderEntityButton)}</div>}
                  </div>
                );
              })
          : filteredEntities.map(renderEntityButton)}
      </div>

      {/* Footer count */}
      <div
        className="px-3 py-2 border-t text-xs"
        style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
      >
        {Object.keys(entities || {}).length} {tab.label.toLowerCase()}
      </div>
    </aside>
  );
}
