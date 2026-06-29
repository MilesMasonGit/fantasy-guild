import { useState, useEffect, useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Search, X, Loader2, Check, Folder, File } from 'lucide-react';

export default function SpritePickerModal({ isOpen, onClose, onSelect }) {
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const enemies = useEntityStore((s) => s.enemies);
  const areas = useEntityStore((s) => s.areas);

  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'all'
  const [selectedFolder, setSelectedFolder] = useState('ALL'); // Original folder path or 'ALL'
  const [selectedPath, setSelectedPath] = useState(null);
  const [registering, setRegistering] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sprite-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, tasks, enemies, areas })
      });
      if (!res.ok) throw new Error('Failed to load sprite index');
      const data = await res.json();
      setAuditData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSelectedPath(null);
      setSelectedFolder('ALL');
    }
  }, [isOpen]);

  const baseSpriteList = useMemo(() => {
    if (!auditData) return [];
    const { unassigned = [], physicalSprites = [] } = auditData;
    return activeTab === 'unassigned' ? unassigned : physicalSprites;
  }, [auditData, activeTab]);

  // Derive flat folder paths from files list
  const folders = useMemo(() => {
    const set = new Set();
    baseSpriteList.forEach(filePath => {
      const parts = filePath.split('/');
      parts.pop(); // Remove filename
      const folderPath = parts.join('/');
      if (folderPath) set.add(folderPath);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [baseSpriteList]);

  // Build a nested folder tree structure from flat folder paths
  const folderTree = useMemo(() => {
    const root = { name: 'Root', fullPath: '', originalPath: 'ALL', children: {} };

    folders.forEach(rawPath => {
      if (rawPath === 'ALL') return;

      const segments = rawPath.split('/');
      let current = root;
      let accumulated = [];

      segments.forEach(segment => {
        accumulated.push(segment);
        const pathSoFar = accumulated.join('/');
        const displayName = segment.charAt(0).toUpperCase() + segment.slice(1);

        if (!current.children[segment]) {
          current.children[segment] = {
            name: displayName,
            fullPath: pathSoFar,
            originalPath: pathSoFar,
            children: {}
          };
        }
        current = current.children[segment];
      });
    });

    // Skip the "assets" folder node to keep tree cleaner (starts with "items", "enemies", etc.)
    if (root.children['assets']) {
      return root.children['assets'].children;
    }
    return root.children;
  }, [folders]);

  // Filter sprites list by folder prefix and search query
  const filteredSprites = useMemo(() => {
    return baseSpriteList.filter(filePath => {
      // 1. Folder match (checks if file is inside selected folder or its subfolders)
      if (selectedFolder !== 'ALL') {
        if (!filePath.startsWith(selectedFolder + '/')) return false;
      }
      // 2. Search query filter
      return filePath.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [baseSpriteList, selectedFolder, searchQuery]);

  const handleSelect = async () => {
    if (!selectedPath) return;
    setRegistering(true);
    try {
      const { spriteManifest = {} } = auditData || {};
      
      // Check if this path is already mapped to a manifest key
      const manifestKey = Object.keys(spriteManifest).find(
        key => spriteManifest[key] === selectedPath
      );

      if (manifestKey) {
        onSelect(manifestKey);
      } else {
        // Path is unregistered, register it automatically
        const spriteId = selectedPath.split('/').pop().replace('.png', '');
        
        const res = await fetch('/api/register-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spriteId, spritePath: selectedPath })
        });
        if (!res.ok) throw new Error('Failed to register sprite in manifest');
        
        onSelect(spriteId);
      }
      onClose();
    } catch (err) {
      setError('Registration error: ' + err.message);
    } finally {
      setRegistering(false);
    }
  };

  const getCleanFilename = (path) => {
    return path.split('/').pop().replace('.png', '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}>
      <div className="rounded-xl border flex flex-col relative w-11/12 max-w-5xl h-[80vh] shadow-2xl" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Select Sprite</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Choose an asset from folders (double click to select)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-500 hover:text-gray-300" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Top Control Bar */}
        <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-center justify-between" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
          {/* Tabs */}
          <div className="flex gap-2">
            <button 
              onClick={() => { setActiveTab('unassigned'); setSelectedPath(null); setSelectedFolder('ALL'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeTab === 'unassigned' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'} cursor-pointer`}
            >
              Unassigned Sprites ({auditData?.unassigned?.length || 0})
            </button>
            <button 
              onClick={() => { setActiveTab('all'); setSelectedPath(null); setSelectedFolder('ALL'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeTab === 'all' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'} cursor-pointer`}
            >
              All Library Assets ({auditData?.physicalSpritesCount || 0})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input 
              type="text" 
              placeholder="Search by file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Sidebar + Main Grid Split Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Sidebar: Folder Directory */}
          <div className="w-64 border-r flex flex-col overflow-y-auto p-4 gap-2" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-base)' }}>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-1">Directories</span>
            
            {loading ? (
              <div className="px-2 text-xs text-gray-500">Loading directories...</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {/* All Folders Option */}
                <button
                  onClick={() => { setSelectedFolder('ALL'); setSelectedPath(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${selectedFolder === 'ALL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03] border border-transparent'} cursor-pointer`}
                >
                  <Folder size={14} className={selectedFolder === 'ALL' ? 'text-emerald-400' : 'text-gray-500'} />
                  <span>All Folders</span>
                </button>
                
                {/* Recursive Nested Folder Tree */}
                <FolderTreeRenderer 
                  nodes={folderTree} 
                  selectedFolder={selectedFolder} 
                  onSelectFolder={(f) => { setSelectedFolder(f); setSelectedPath(null); }} 
                />
              </div>
            )}
          </div>

          {/* Right Area: Grid items (text-only, fast loading) */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-xs">Loading sprites directory...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-xs" style={{ color: 'var(--color-error)' }}>{error}</div>
            ) : filteredSprites.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-500">No sprites found in this directory.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredSprites.map(path => {
                  const isSelected = selectedPath === path;
                  const cleanFilename = getCleanFilename(path);
                  return (
                    <div 
                      key={path}
                      onClick={() => setSelectedPath(path)}
                      onDoubleClick={handleSelect}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-black/10 hover:border-white/10'}`}
                    >
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <File size={14} className="text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-xs font-semibold truncate text-white" title={cleanFilename}>
                          {cleanFilename}
                        </span>
                        <span className="text-[9px] text-gray-600 truncate">
                          {path.replace(`/${cleanFilename}.png`, '')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-elevated)' }}>
          <div className="text-xs truncate max-w-md" style={{ color: 'var(--color-text-muted)' }}>
            {selectedPath ? `Selected: ${selectedPath}` : 'Select a file from the list'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
            <button 
              onClick={handleSelect} 
              disabled={!selectedPath || registering}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {registering && <Loader2 size={12} className="animate-spin" />}
              {registering ? 'Linking...' : 'Select & Link'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Recursive component to render nested folders with indentation
function FolderTreeRenderer({ nodes, level = 0, selectedFolder, onSelectFolder }) {
  const sortedNodes = useMemo(() => {
    return Object.values(nodes || {}).sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes]);

  return (
    <div className="flex flex-col gap-1">
      {sortedNodes.map(node => {
        const isSelected = selectedFolder === node.originalPath;
        const hasChildren = Object.keys(node.children || {}).length > 0;
        
        return (
          <div key={node.fullPath} className="flex flex-col gap-0.5">
            <button
              onClick={() => onSelectFolder(node.originalPath)}
              className={`w-full text-left py-1.5 pr-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-transparent ${isSelected ? 'bg-emerald-500/10 text-emerald-400 font-bold border-emerald-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'}`}
              style={{ paddingLeft: `${Math.max(8, level * 12 + 10)}px` }}
            >
              <Folder size={12} className={isSelected ? 'text-emerald-400' : 'text-gray-500'} />
              <span className="truncate" title={node.name}>{node.name}</span>
            </button>
            {hasChildren && (
              <FolderTreeRenderer 
                nodes={node.children} 
                level={level + 1} 
                selectedFolder={selectedFolder} 
                onSelectFolder={onSelectFolder} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
