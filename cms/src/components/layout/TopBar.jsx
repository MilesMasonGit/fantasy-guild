import { useState } from 'react';
import { Play, Download, Settings, Loader2, Sparkles, DatabaseBackup, PackageOpen, RefreshCw } from 'lucide-react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { runSimulation } from '../../engine/runSimulation';
import { exportGamePackage, syncGamePackage } from '../../engine/fileUtils';

export default function TopBar({ onViewChange, currentView, onOpenGenerate, onOpenSettings, onOpenFileManager }) {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const progress = useSimulationStore((s) => s.progress);
  const progressLabel = useSimulationStore((s) => s.progressLabel);
  const lastRun = useSimulationStore((s) => s.lastRunTimestamp);
  const auditCount = useSimulationStore((s) => s.auditResults.length);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncToGame = async () => {
    setIsSyncing(true);
    try {
      await syncGamePackage();
      alert("✅ Game data synchronized successfully!");
    } catch (err) {
      alert("❌ Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunSimulation = async () => {
    const state = useEntityStore.getState();
    const entities = {
      items: state.items,
      recipes: state.recipes,
      tasks: state.tasks,
      encounters: state.encounters,
      stations: state.stations,
      enemies: state.enemies,
      areas: state.areas,
      quests: state.quests,
      subskills: state.subskills,
    };

    // Auto-save before running
    try {
      await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `autosave_${Date.now()}`, data: entities, isAutoSave: true })
      });
    } catch (err) {
      console.warn("Autosave failed", err);
    }

    const globals = useGlobalStore.getState();

    useSimulationStore.getState().setRunning(true);

    try {
      const results = await runSimulation(
        entities,
        globals,
        (progress, label) => {
          useSimulationStore.getState().setProgress(progress, label);
        }
      );

      // Write computed item values back to the entity store
      if (results.itemUpdates) {
        for (const [id, item] of Object.entries(results.itemUpdates)) {
          useEntityStore.getState().updateItem(id, {
            trueCost: item.trueCost,
            sellPrice: item.sellPrice,
            restoreAmount: item.restoreAmount,
            restoreType: item.restoreType,
            skillRequired: item.skillRequired,
            levelRequired: item.levelRequired,
            levelRequirement: item.levelRequirement,
            requirements: item.requirements,
          });
        }
      }

      // Write computed task diagnostics back to the entity store
      if (results.taskUpdates) {
        for (const [id, diagnostics] of Object.entries(results.taskUpdates)) {
          useEntityStore.getState().updateTask(id, diagnostics);
        }
      }

      // Auto-apply all solver pacing adjustments (tweaks to tick times, XP awards, and quest rewards)
      if (results.proposals) {
        const store = useEntityStore.getState();
        if (results.proposals.tasks) {
          for (const [id, patch] of Object.entries(results.proposals.tasks)) {
            store.updateTask(id, patch);
          }
        }
        if (results.proposals.recipes) {
          for (const [id, patch] of Object.entries(results.proposals.recipes)) {
            store.updateRecipe(id, patch);
          }
        }
        if (results.proposals.enemies) {
          for (const [id, patch] of Object.entries(results.proposals.enemies)) {
            store.updateEnemy(id, patch);
          }
        }
        if (results.proposals.quests) {
          for (const [id, patch] of Object.entries(results.proposals.quests)) {
            store.updateQuest(id, patch);
          }
        }
      }

      if (results.recipeUpdates) {
        for (const [id, diagnostics] of Object.entries(results.recipeUpdates)) {
          useEntityStore.getState().updateRecipe(id, diagnostics);
        }
      }

      if (results.encounterUpdates) {
        for (const [id, diagnostics] of Object.entries(results.encounterUpdates)) {
          useEntityStore.getState().updateEncounter(id, diagnostics);
        }
      }

      // Write combat diagnostics back to enemy entities
      if (results.enemyUpdates) {
        for (const [id, diagnostics] of Object.entries(results.enemyUpdates)) {
          useEntityStore.getState().updateEnemy(id, diagnostics);
        }
      }

      useSimulationStore.getState().setAuditResults(
        results.auditResults, 
        results.progressionReports, 
        results.proposals, 
        results.itemUpdates,
        results.taskUpdates,
        results.recipeUpdates,
        results.enemyUpdates
      );

      const enemyCount = Object.keys(results.enemyUpdates || {}).length;
      console.log(
        `✅ Simulation complete: ${results.propagation.valuedCount}/${results.propagation.totalItems} items valued, ${enemyCount} enemies simulated`
      );
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      useSimulationStore.getState().setRunning(false);
      useSimulationStore.getState().setProgress(0, '');
    }
  };

  return (
    <header className="flex items-center justify-between px-4 border-b"
      style={{
        height: 52,
        minHeight: 52,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}>
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-accent)' }}>
          ⚔️ Fantasy Guild CMS
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}>
          v0.1
        </span>
      </div>

      {/* Center: View Toggle */}
      <div className="flex items-center gap-1 rounded-lg p-0.5"
        style={{ background: 'var(--color-bg-base)' }}>
        {['editor', 'graph', 'audit', 'recolor', 'playmat'].map((view) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
            style={{
              background: currentView === view ? 'var(--color-bg-elevated)' : 'transparent',
              color: currentView === view ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {view}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Progress indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>{progressLabel || 'Running...'}</span>
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
            </div>
          </div>
        )}

        {/* Audit badge */}
        {lastRun && !isRunning && auditCount > 0 && (
          <button
            onClick={() => onViewChange('audit')}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{
              background: 'var(--color-warning)',
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {auditCount} issues
          </button>
        )}

        <div className="h-4 w-px bg-white/20 mx-1"></div>

        {/* File Manager */}
        <button
          onClick={() => onOpenFileManager && onOpenFileManager()}
          className="btn-ghost flex items-center gap-2"
          title="Save/Load Workspace"
        >
          <DatabaseBackup size={14} />
          <span>File Manager</span>
        </button>

        {/* Sync Legacy IDs */}
        <button
          onClick={() => {
            if (confirm("Are you sure you want to rename all legacy/random IDs to clean human-readable names based on their current Display Names? This will safely update all recipe & task inputs/outputs throughout the workspace.")) {
              useEntityStore.getState().migrateAllEntityIds();
              alert("All entity IDs have been successfully updated to natural-language slugs!");
            }
          }}
          className="btn-ghost flex items-center gap-2"
          title="Sync Legacy IDs to Natural Language slugs"
          style={{ color: 'var(--color-accent-hover)' }}
        >
          <Sparkles size={14} className="text-emerald-400" />
          <span>Sync Legacy IDs</span>
        </button>

        {/* Export Package */}
        <button
          onClick={exportGamePackage}
          className="btn-ghost flex items-center gap-2"
          title="Export Game Data Package"
        >
          <PackageOpen size={14} />
          <span>Export Package</span>
        </button>

        {/* Sync to Game */}
        <button
          onClick={handleSyncToGame}
          disabled={isSyncing}
          className="btn-primary flex items-center gap-2"
          title="Sync game data package directly to local project data folder"
          style={{ opacity: isSyncing ? 0.6 : 1 }}
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>Sync to Game</span>
        </button>

        <div className="h-4 w-px bg-white/20 mx-1"></div>

        {/* Settings */}
        <button
          onClick={() => onOpenSettings && onOpenSettings()}
          className="btn-ghost flex items-center gap-2"
          title="Global Constants"
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>

        {/* Generate Content */}
        <button
          onClick={() => onOpenGenerate && onOpenGenerate()}
          className="btn-ghost flex items-center gap-2"
        >
          <Sparkles size={14} />
          <span>Generate</span>
        </button>

        {/* Run Simulation */}
        <button
          onClick={handleRunSimulation}
          disabled={isRunning}
          className="btn-primary flex items-center gap-2"
          style={{ opacity: isRunning ? 0.6 : 1 }}
        >
          <Play size={14} />
          <span>Run Simulation</span>
        </button>
      </div>
    </header>
  );
}
