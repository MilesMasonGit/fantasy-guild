import { useState } from 'react';
import { HardDrive, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useDiskWorkspace, workspaceStatusText } from '../../engine/diskWorkspace';

/**
 * The File Manager's word on where the workspace lives: on disk and when it was last saved, or in this browser only.
 * ⚠️ Not in the top bar: it is full, and one more line there wrapped its title onto four lines.
 */
export function WorkspaceStatus() {
  const { text, warn, title } = workspaceStatusText(useDiskWorkspace());
  return (
    <span className="text-xs flex items-center gap-1" style={{ color: warn ? 'var(--color-warning)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }} title={title} data-testid="workspace-status">
      <HardDrive size={12} /> {text}
    </span>
  );
}

/** A plain banner under the top bar: the disk changed elsewhere (reload), or a one-off note from the start. */
export function WorkspaceBanner() {
  const { conflict, notice, mode, error } = useDiskWorkspace();
  const [noticeClosed, setNoticeClosed] = useState(false);
  const bar = (color, children) => (
    <div className="flex items-center gap-2 px-4 py-2 text-xs border-b" style={{ background: 'var(--color-bg-elevated)', borderColor: color, color: 'var(--color-text-primary)' }} data-testid="workspace-banner">
      {children}
    </div>
  );

  if (conflict) {
    return bar('var(--color-warning)', <>
      <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
      <span>
        The workspace on disk changed elsewhere; reload to see it.
        {conflict.refusedBackup ? ` Your edits in this tab since then were not written over it; they are kept in Backups as ${conflict.refusedBackup}.` : ''}
      </span>
      <button type="button" className="btn-ghost flex items-center gap-1 ml-auto" onClick={() => window.location.reload()}>
        <RefreshCw size={12} /> Reload
      </button>
    </>);
  }
  if (mode === 'browser' && error) {
    return bar('var(--color-warning)', <>
      <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
      <span>{error}</span>
    </>);
  }
  if (notice && !noticeClosed) {
    return bar('var(--color-info)', <>
      <HardDrive size={14} style={{ color: 'var(--color-info)' }} />
      <span>{notice}</span>
      <button type="button" className="ml-auto" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} onClick={() => setNoticeClosed(true)} title="Close">
        <X size={14} />
      </button>
    </>);
  }
  return null;
}
