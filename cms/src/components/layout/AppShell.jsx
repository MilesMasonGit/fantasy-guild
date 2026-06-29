import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GenerateModal from '../shared/GenerateModal';
import SettingsModal from '../shared/SettingsModal';
import FileManagerModal from '../shared/FileManagerModal';

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
        {currentView !== 'recolor' && currentView !== 'playmat' && <Sidebar />}
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
