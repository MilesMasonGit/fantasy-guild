import AppShell from './components/layout/AppShell';
import SupplyChainLayout from './components/layout/SupplyChainLayout';
import ItemEditor from './components/editors/ItemEditor';
import RecipeEditor from './components/editors/RecipeEditor';
import TaskEditor from './components/editors/TaskEditor';
import EncounterEditor from './components/editors/EncounterEditor';
import WorkstationEditor from './components/editors/WorkstationEditor';
import EnemyEditor from './components/editors/EnemyEditor';
import AreaEditor from './components/editors/AreaEditor';
import QuestEditor from './components/editors/QuestEditor';
import SubskillEditor from './components/editors/SubskillEditor';
import EffectEditor from './components/editors/EffectEditor';
import LootTableEditor from './components/editors/LootTableEditor';
import EncounterTableEditor from './components/editors/EncounterTableEditor';
import MasterWeb from './components/graph/MasterWeb';
import AuditPanel from './components/audit/AuditPanel';
import { useEntityStore } from './stores/useEntityStore';

const EDITOR_MAP = {
  item: ItemEditor,
  recipe: RecipeEditor,
  task: TaskEditor,
  encounter: EncounterEditor,
  workstation: WorkstationEditor,
  enemy: EnemyEditor,
  area: AreaEditor,
  quest: QuestEditor,
  subskill: SubskillEditor,
  effect: EffectEditor,
  lootTable: LootTableEditor,
  encounterTable: EncounterTableEditor,
};

function App() {
  return (
    <AppShell>
      {({ currentView, openGenerate }) => {
        if (currentView === 'graph') return <MasterWeb />;
        if (currentView === 'audit') return <AuditPanel openGenerate={openGenerate} />;
        return (
          <SupplyChainLayout>
            <EditorRouter />
          </SupplyChainLayout>
        );
      }}
    </AppShell>
  );
}

function EditorRouter() {
  const activeType = useEntityStore((s) => s.activeEntityType);
  const activeId = useEntityStore((s) => s.activeEntityId);

  if (!activeType || !activeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--color-text-muted)' }}>
        <div className="text-6xl">⚔️</div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Fantasy Guild CMS</h2>
        <p className="text-sm">Select an entity from the sidebar or create a new one to begin</p>
        <div className="flex flex-wrap gap-3 mt-2 justify-center max-w-md">
          <Hint icon="📦" label="Items" />
          <Hint icon="📜" label="Recipes" />
          <Hint icon="⚔️" label="Tasks" />
          <Hint icon="⚔️" label="Encounters" />
          <Hint icon="🔨" label="Workstations" />
          <Hint icon="💀" label="Enemies" />
          <Hint icon="🗺️" label="Areas" />
          <Hint icon="📜" label="Quests" />
          <Hint icon="🎓" label="Subskills" />
          <Hint icon="✨" label="Effects" />
        </div>
      </div>
    );
  }

  const Editor = EDITOR_MAP[activeType];
  if (!Editor) return <div style={{ color: 'var(--color-text-muted)' }}>Unknown entity type: {activeType}</div>;
  return <Editor />;
}

function Hint({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
      <span>{icon}</span>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  );
}

export default App;
