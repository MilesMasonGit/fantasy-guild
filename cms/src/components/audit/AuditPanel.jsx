import { useState, useMemo } from 'react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { ArrowUpDown, Filter, Sparkles, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ProposalReviewModal } from '../shared/ProposalReviewModal';
import { SKILLS } from '../../utils/constants';
import SpriteAuditDashboard from './SpriteAuditDashboard';

const SEVERITY_ORDER = { Critical: 0, Warning: 1, Info: 2 };
const SEVERITY_COLORS = {
  Critical: 'var(--color-error)',
  Warning: 'var(--color-warning)',
  Info: 'var(--color-info)',
};

export default function AuditPanel({ openGenerate }) {
  const auditResults = useSimulationStore((s) => s.auditResults);
  const proposals = useSimulationStore((s) => s.proposals);
  const lastRun = useSimulationStore((s) => s.lastRunTimestamp);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const progressionReports = useSimulationStore((s) => s.progressionReports);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'progression' | 'pacing'
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0].id);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  const [sortField, setSortField] = useState('severity');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterType, setFilterType] = useState('');

  const issueTypes = useMemo(() => [...new Set(auditResults.map((r) => r.issueType))], [auditResults]);

  const sorted = useMemo(() => {
    let list = filterType ? auditResults.filter((r) => r.issueType === filterType) : auditResults;

    list = [...list].sort((a, b) => {
      if (sortField === 'severity') {
        const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        return sortAsc ? diff : -diff;
      }
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return list;
  }, [auditResults, sortField, sortAsc, filterType]);

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const handleRowClick = (issue) => {
    const type = issue.entityType.toLowerCase();
    setActiveEntity(issue.entityId, type);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Switcher */}
      <div className="flex gap-4 border-b mb-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <button 
          onClick={() => setActiveTab('audit')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'audit' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Audit List
          {activeTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />}
        </button>
        <button 
          onClick={() => setActiveTab('progression')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'progression' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Progression
          {activeTab === 'progression' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />}
        </button>
        <button 
          onClick={() => setActiveTab('pacing')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'pacing' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Pacing
          {activeTab === 'pacing' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />}
        </button>
        <button 
          onClick={() => setActiveTab('sprites')}
          className="px-4 py-2 text-sm font-bold transition-all relative"
          style={{ color: activeTab === 'sprites' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          Sprite Audit
          {activeTab === 'sprites' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />}
        </button>
      </div>

      {activeTab === 'sprites' ? (
        <SpriteAuditDashboard />
      ) : !lastRun ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-lg">No simulation has been run yet</p>
          <p className="text-sm">Click "Run Simulation" in the top bar to audit the entity graph</p>
        </div>
      ) : activeTab === 'audit' ? (
        <AuditListView 
          auditResults={auditResults} 
          issueTypes={issueTypes} 
          sorted={sorted}
          sortField={sortField}
          sortAsc={sortAsc}
          filterType={filterType}
          setFilterType={setFilterType}
          toggleSort={toggleSort}
          handleRowClick={handleRowClick}
          openGenerate={openGenerate}
          lastRun={lastRun}
        />
      ) : activeTab === 'progression' ? (
        <ProgressionView 
          reports={progressionReports} 
          selectedSkill={selectedSkill}
          setSelectedSkill={setSelectedSkill}
        />
      ) : (
        <PacingView />
      )}
    </div>
  );
}

function AuditListView({ auditResults, issueTypes, sorted, sortField, sortAsc, filterType, setFilterType, toggleSort, handleRowClick, openGenerate, lastRun }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Audit Results</h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {auditResults.length} issues found • Last run: {new Date(lastRun).toLocaleTimeString()}
          </p>
        </div>
        {/* Filter chips */}
        <div className="flex items-center gap-1">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <button onClick={() => setFilterType('')} className="px-2 py-1 rounded text-xs" style={{ background: !filterType ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: !filterType ? 'white' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>All</button>
          {issueTypes.map((type) => (
            <button key={type} onClick={() => setFilterType(type)} className="px-2 py-1 rounded text-xs" style={{ background: filterType === type ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: filterType === type ? 'white' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>{type}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-surface)' }}>
              {['entityName', 'entityType', 'issueType', 'severity', 'details'].map((field) => (
                <th key={field} onClick={() => toggleSort(field)} className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer select-none" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span className="flex items-center gap-1">
                    {field === 'entityName' ? 'Entity' : field === 'entityType' ? 'Type' : field === 'issueType' ? 'Issue' : field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field && <ArrowUpDown size={10} />}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, i) => (
              <tr key={i} onClick={() => handleRowClick(issue)} className="cursor-pointer transition-colors" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{issue.entityName}</td>
                <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{issue.entityType}</td>
                <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>{issue.issueType}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: SEVERITY_COLORS[issue.severity], background: `${SEVERITY_COLORS[issue.severity]}15` }}>{issue.severity}</span></td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{issue.details}</td>
                <td className="px-3 py-2">
                  {issue.issueType === 'Skill Gap' && openGenerate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const levelMatch = issue.details.match(/level (\d+) and (\d+)/);
                        const highMatch = issue.details.match(/levels (\d+)/);
                        openGenerate({
                          type: 'fill_skill_gap',
                          skill: issue.entityId,
                          levelMin: levelMatch ? Number(levelMatch[1]) : (highMatch ? Number(highMatch[1]) : 1),
                          levelMax: levelMatch ? Number(levelMatch[2]) : 99,
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                      style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <Sparkles size={10} /> Fill Gap
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-success)' }}>
            <p className="text-sm font-medium">✅ No issues found!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressionView({ reports, selectedSkill, setSelectedSkill }) {
  const report = reports[selectedSkill] || [];
  const skillName = SKILLS.find(s => s.id === selectedSkill)?.name;

  const totalHours = report.reduce((sum, d) => sum + (d.ttlMinutes || 0), 0) / 60;
  const stallingLevels = report.filter(d => d.isStalling).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">
      {/* Skill Selector */}
      <div className="flex flex-wrap gap-2">
        {SKILLS.map(skill => (
          <button
            key={skill.id}
            onClick={() => setSelectedSkill(skill.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
            style={{ 
              background: selectedSkill === skill.id ? 'var(--color-accent-muted)' : 'var(--color-bg-surface)',
              color: selectedSkill === skill.id ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
              borderColor: selectedSkill === skill.id ? 'var(--color-accent)' : 'var(--color-border-subtle)',
              cursor: 'pointer'
            }}
          >
            {skill.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Time to Lv.99" value={totalHours > 1000 ? '1,000+ hrs' : `${totalHours.toFixed(1)} hrs`} />
        <StatCard label="Efficiency Health" value={`${Math.round((1 - (stallingLevels / 99)) * 100)}%`} color={stallingLevels > 10 ? 'var(--color-error)' : 'var(--color-success)'} />
        <StatCard label="Stalling Levels" value={stallingLevels} color={stallingLevels > 0 ? 'var(--color-warning)' : 'var(--color-success)'} />
      </div>

      <div className="flex-1 bg-black/10 rounded-xl border p-6 flex flex-col gap-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} />
            {skillName} Progression Curve (Levels 1-99)
          </h3>
          <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} /> Optimal</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} /> Slow</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-error)' }} /> Stalled</div>
          </div>
        </div>

        <SkillChart report={report} />
        
        <div className="flex justify-between text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>Level 1</span>
          <span>Level 25</span>
          <span>Level 50</span>
          <span>Level 75</span>
          <span>Level 99</span>
        </div>
      </div>

      {stallingLevels > 0 && (
        <div className="p-3 rounded-lg flex items-start gap-3 border" style={{ background: 'var(--color-error)10', borderColor: 'var(--color-error)30' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-error)', marginTop: 2 }} />
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--color-error)' }}>Stalling Detected</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              {skillName} leveling is significantly slower than target between levels {report.find(d => d.isStalling)?.level} and {report.reverse().find(d => d.isStalling)?.level}. Consider adding interim tasks or adjusting XP rewards.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="text-xl font-black" style={{ color: color || 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function SkillChart({ report }) {
  return (
    <div className="flex items-end gap-px h-full w-full relative group">
      {/* Reference Lines */}
      <div className="absolute left-0 right-0 h-px border-t border-dashed pointer-events-none opacity-20" style={{ bottom: '25%', borderColor: 'var(--color-text-muted)' }} />
      <div className="absolute left-0 right-0 h-px border-t border-dashed pointer-events-none opacity-20" style={{ bottom: '50%', borderColor: 'var(--color-text-muted)' }} />
      <div className="absolute left-0 right-0 h-px border-t border-dashed pointer-events-none opacity-20" style={{ bottom: '75%', borderColor: 'var(--color-text-muted)' }} />

      {report.map((d, i) => {
        let color = 'var(--color-error)';
        if (d.efficiency >= 0.9) color = 'var(--color-success)';
        else if (d.efficiency >= 0.4) color = 'var(--color-warning)';
        
        // Scale efficiency to height. 1.0 efficiency = 75% height.
        const height = Math.min(100, (d.efficiency || 0) * 75);
        
        return (
          <div 
            key={i} 
            className="flex-1 min-w-[2px] transition-all hover:brightness-125" 
            style={{ 
              height: d.bestSourceId ? `${Math.max(2, height)}%` : '2%', 
              background: color,
              opacity: d.bestSourceId ? 1 : 0.2
            }}
          >
            <div className="hidden group-hover:block absolute top-0 left-0 bg-black/80 p-2 rounded text-[10px] whitespace-nowrap pointer-events-none z-10 border border-white/10">
               Lv.{d.level}: {Math.round(d.xpVelocity)} XP/min ({Math.round(d.efficiency * 100)}% target)
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PacingView() {
  const taskUpdates = useSimulationStore(s => s.taskUpdates);
  const entities = useEntityStore(s => s.tasks);
  const areas = useEntityStore(s => s.areas);

  // Group tasks by area and calculate average GPH/XPH
  const areaStats = useMemo(() => {
    const stats = {};
    Object.entries(taskUpdates || {}).forEach(([id, update]) => {
      const task = entities[id];
      if (!task) return;
      const areaId = task.areaId || 'unassigned';
      if (!stats[areaId]) stats[areaId] = { gph: 0, xph: 0, count: 0 };
      stats[areaId].gph += (update.goldPerMinute || 0) * 60;
      stats[areaId].xph += (update.xpPerMinute || 0) * 60;
      stats[areaId].count++;
    });
    return stats;
  }, [taskUpdates, entities]);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-400" />
        Wealth & XP Velocity (Pacing Audit)
      </h3>
      
      <div className="grid gap-4">
        {Object.entries(areaStats).map(([areaId, stats]) => {
          const area = areas[areaId];
          const avgGph = stats.gph / stats.count;
          const avgXph = stats.xph / stats.count;
          
          return (
            <div key={areaId} className="p-4 rounded-xl border bg-white/5 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-white">{area?.name || 'Unassigned Tasks'}</span>
                <span className="text-xs text-gray-500">{stats.count} tasks</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                    <span>Avg Gold/Hr</span>
                    <span>{Math.round(avgGph).toLocaleString()} GP</span>
                  </div>
                  <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500/50" 
                      style={{ width: `${Math.min(100, (avgGph / 5000) * 100)}%` }} 
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                    <span>Avg XP/Hr</span>
                    <span>{Math.round(avgXph).toLocaleString()} XP</span>
                  </div>
                  <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500/50" 
                      style={{ width: `${Math.min(100, (avgXph / 1000) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
