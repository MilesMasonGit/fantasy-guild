import AppShell from './components/layout/AppShell';
import SupplyChainLayout from './components/layout/SupplyChainLayout';
import ItemEditor from './components/editors/ItemEditor';
import TokenEditor from './components/editors/TokenEditor';
import RecipeEditor from './components/editors/RecipeEditor';
import MapEditor from './components/editors/MapEditor';
import RecolorEditor from './components/editors/RecolorEditor';
import SpriteAuditDashboard from './components/audit/SpriteAuditDashboard';
import { useEntityStore } from './stores/useEntityStore';
import { Package, Boxes, Map as MapIcon } from 'lucide-react';

/**
 * Editors, by the entity type the sidebar selected.
 *
 * All three editors are real as of Phase 7.
 */
const EDITOR_MAP = {
  item: ItemEditor,
  token: TokenEditor,
  map: MapEditor,
};

function App() {
  return (
    <AppShell>
      {({ currentView, openGenerate }) => {
        if (currentView === 'recipes') return <RecipeEditor />;
        if (currentView === 'recolor') return <RecolorEditor />;
        if (currentView === 'sprites') return <SpriteAuditDashboard />;
        return (
          <SupplyChainLayout>
            <EditorRouter openGenerate={openGenerate} />
          </SupplyChainLayout>
        );
      }}
    </AppShell>
  );
}

function EditorRouter({ openGenerate }) {
  const activeType = useEntityStore((s) => s.activeEntityType);
  const activeId = useEntityStore((s) => s.activeEntityId);

  if (!activeType || !activeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--color-text-muted)' }}>
        <div className="text-6xl">⚒️</div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Fantasy Guild CMS</h2>
        <p className="text-sm">Select an entity from the sidebar, or create one to begin</p>
        <div className="flex flex-wrap gap-3 mt-2 justify-center max-w-md">
          <Hint icon={<Package size={13} />} label="Items" />
          <Hint icon={<Boxes size={13} />} label="Tokens" />
          <Hint icon={<MapIcon size={13} />} label="Maps" />
        </div>
        <p className="text-xs max-w-sm text-center mt-2 leading-relaxed">
          Items first — they are the leaf nodes Tokens and Maps both reference,
          so authoring one never stalls on an ingredient that does not exist yet.
        </p>
      </div>
    );
  }

  const Editor = EDITOR_MAP[activeType];
  if (!Editor) return <div style={{ color: 'var(--color-text-muted)' }}>Unknown entity type: {activeType}</div>;
  return <Editor openGenerate={openGenerate} />;
}

function Hint({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
      <span className="flex items-center">{icon}</span>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  );
}

export default App;
