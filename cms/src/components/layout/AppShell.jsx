import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GenerateModal from '../shared/GenerateModal';
import SettingsModal from '../shared/SettingsModal';
import FileManagerModal from '../shared/FileManagerModal';

/**
 * Views that show the entity sidebar — the Items / Tokens / Maps picker.
 *
 * ⚠️ **A positive list, deliberately.** This was a chain of `!==` against every
 * view that should not have it, so each new screen had to remember to add
 * itself or it inherited a sidebar it had no use for. The Progression tab did
 * exactly that on the way in. A view that wants the picker now has to say so.
 */
const VIEWS_WITH_SIDEBAR = new Set(['editor', 'sprites']);

export default function AppShell({ children }) {
  const [currentView, setCurrentView] = useState('editor');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatePrefill, setGeneratePrefill] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);

  const openGenerate = (prefill = null) => {
    setGeneratePrefill(prefill);
    setGenerateOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: 'var(--color-bg-deep)' }}>
      <TopBar
        onViewChange={setCurrentView}
        currentView={currentView}
        onOpenGenerate={() => openGenerate()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenFileManager={() => setFileManagerOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {VIEWS_WITH_SIDEBAR.has(currentView) && <Sidebar />}
        <main className="flex-1 overflow-auto p-4">
          {children({ currentView, openGenerate, setCurrentView })}
        </main>
      </div>

      {generateOpen && (
        <GenerateModal
          isOpen={generateOpen}
          onClose={() => setGenerateOpen(false)}
          prefill={generatePrefill}
        />
      )}

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      <FileManagerModal
        isOpen={fileManagerOpen}
        onClose={() => setFileManagerOpen(false)}
      />
    </div>
  );
}
