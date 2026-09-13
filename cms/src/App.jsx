import AppShell from './components/layout/AppShell';
import SupplyChainLayout from './components/layout/SupplyChainLayout';
import ItemEditor from './components/editors/ItemEditor';
import TokenEditor from './components/editors/TokenEditor';
import RecipeEditor from './components/editors/RecipeEditor';
import MapEditor from './components/editors/MapEditor';
import RecolorEditor from './components/editors/RecolorEditor';
import EffectEditor from './components/editors/EffectEditor';
import SpriteAuditDashboard from './components/audit/SpriteAuditDashboard';
import AuditPanel from './components/audit/AuditPanel';
import ProgressionPanel from './components/progression/ProgressionPanel';
import RulesLineP0 from './components/prototype/RulesLineP0';
import RulesLineSandbox from './components/prototype/RulesLineSandbox';
import BearerRulesSandbox from './components/prototype/BearerRulesSandbox';
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
  effect: EffectEditor,
};

/**
 * ⚠️ P0 throwaway route: `?p0=1` renders the Rules Line prototype instead of the
 * app. Deliberately a query flag and not a nav entry — it is a thing to look at
 * once, not a feature, and it leaves the shell untouched so removing it is one
 * import and one line.
 */
function App() {
  if (new URLSearchParams(window.location.search).has('p0')) {
    return <RulesLineP0 />;
  }
  // ⚠️ P2 sandbox: the real rule editor on in-memory rules, so verifying the
  // line never leaves a test effect in the workspace for a sync to ship.
  if (new URLSearchParams(window.location.search).has('p2')) {
    return <RulesLineSandbox />;
  }
  // ⚠️ P6 sandbox: the real Token and Item editors on seeded content, with the
  // store's persistence switched off first so the saved draft is never written.
  if (new URLSearchParams(window.location.search).has('p6')) {
    return <BearerRulesSandbox />;
  }
  return (
    <AppShell>
      {({ currentView, openGenerate }) => {
        if (currentView === 'recipes') return <RecipeEditor />;
        // The bulk-authoring view: one list of everything with a work cycle,
        // by skill and level (docs/progression_screen_plan_v1.md).
        if (currentView === 'progression') return <ProgressionPanel />;
        if (currentView === 'recolor') return <RecolorEditor />;
        if (currentView === 'sprites') return <SpriteAuditDashboard />;
        // ⚠️ `AuditPanel` had no route at all until P6 — it was written for
        // CMS-74 and then never mounted, so the economy audit and the churn
        // report had nowhere to appear. This is that route.
        if (currentView === 'audit') return <div className="p-4 h-full"><AuditPanel openGenerate={openGenerate} /></div>;
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
