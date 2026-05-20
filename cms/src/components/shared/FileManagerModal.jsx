import { useState, useEffect } from 'react';
import { DatabaseBackup, Upload, Trash2, X, Plus, Clock, FileJson } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';

export default function FileManagerModal({ isOpen, onClose }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSaveName, setNewSaveName] = useState('');
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) throw new Error('Failed to fetch backups');
      const data = await res.json();
      setBackups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setNewSaveName('');
      setError('');
      setConfirmState(null);
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!newSaveName.trim()) return;

    try {
      const state = useEntityStore.getState();
      const backupData = {
        items: state.items,
        tasks: state.tasks,
        recipes: state.recipes,
        encounters: state.encounters,
        workstations: state.workstations,
        enemies: state.enemies,
        areas: state.areas,
        quests: state.quests,
        subskills: state.subskills,
      };

      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSaveName, data: backupData, isAutoSave: false })
      });

      if (!res.ok) throw new Error('Failed to save');
      setNewSaveName('');
      fetchBackups();
    } catch (err) {
      setError(err.message);
    }
  };

  const requestLoad = (name) => {
    setConfirmState({ type: 'load', data: name, message: `Are you sure you want to load "${name}"? Unsaved changes will be lost.` });
  };

  const requestDelete = (name) => {
    setConfirmState({ type: 'delete', data: name, message: `Are you sure you want to delete "${name}"?` });
  };

  const requestNewWorkspace = () => {
    setConfirmState({ type: 'new', data: null, message: 'Create a new empty workspace? Make sure you have saved your current work.' });
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { type, data } = confirmState;
    setConfirmState(null);
    
    try {
      if (type === 'load') {
        const res = await fetch(`/api/backups/${data}`);
        if (!res.ok) throw new Error('Failed to load backup');
        const json = await res.json();
        useEntityStore.getState().hydrate(json);
        onClose();
      } else if (type === 'delete') {
        const res = await fetch(`/api/backups/${data}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        fetchBackups();
      } else if (type === 'new') {
        localStorage.clear();
        window.location.reload();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl shadow-2xl border flex flex-col relative" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', width: 600, maxHeight: '80vh' }}>
        
        {confirmState && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(2px)' }}>
            <div className="p-6 rounded-lg border shadow-xl flex flex-col items-center text-center max-w-sm" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="mb-6 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{confirmState.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmState(null)} className="btn-ghost flex-1 py-2">Cancel</button>
                <button onClick={executeConfirm} className="btn-primary flex-1 py-2" style={{ background: 'var(--color-error)', borderColor: 'var(--color-error)' }}>Confirm</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <DatabaseBackup size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>File Manager</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>

        {/* Create Save and New Workspace */}
        <div className="px-5 py-4 border-b flex flex-col gap-2" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center justify-between w-full">
            <form onSubmit={handleSave} className="flex gap-2 flex-1 mr-4">
              <input 
                type="text" 
                placeholder="Save name (e.g., before-rebalance)" 
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                className="flex-1"
              />
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={!newSaveName.trim()}>
                <Plus size={14} /> Save Workspace
              </button>
            </form>
            
            <div className="flex-shrink-0 border-l pl-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <button 
                type="button" 
                className="btn-ghost flex items-center gap-2"
                style={{ color: 'var(--color-warning)' }}
                onClick={requestNewWorkspace}
              >
                <FileJson size={14} /> New Workspace
              </button>
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading saves...</div>
          ) : backups.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>No saved workspaces found.</div>
          ) : (
            backups.map(file => (
              <div key={file.name} className="flex items-center justify-between p-3 rounded-lg border transition-all hover:border-white/20" style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-accent)' }}>
                    {file.name.startsWith('autosave_') ? <Clock size={14} /> : <FileJson size={14} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{file.name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(file.createdAt).toLocaleString()} • {formatSize(file.size)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => requestLoad(file.name)} className="btn-ghost flex items-center gap-1">
                    <Upload size={14} /> Load
                  </button>
                  <button onClick={() => requestDelete(file.name)} className="p-1.5 rounded" style={{ color: 'var(--color-error)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
