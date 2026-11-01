import { engine, dataWorkspace } from './lib.mjs';
const { server, load } = await engine();
try {
    const ws = await dataWorkspace(load);
    console.log('ws keys', Object.keys(ws), 'stars', Object.keys(ws.hallStars||{}).length, 'consts', Object.keys(ws.hallConstellations||{}));
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    const t0 = Date.now();
    const pace = workspacePace(ws);
    console.log('pace ms', Date.now() - t0, 'maxTier', pace.maxTier, 'settings.stages', JSON.stringify(pace.settings.stages), 'hallPayback', pace.settings.hallPaybackHours);
    console.log('skills', pace.skills());
    const bySkill = {};
    for (const w of pace.works) {
        const skill = pace.profiles.contextOf(w.target).skill;
        const kind = pace.book.workKindOf(w.target).kind;
        (bySkill[skill] ||= []).push(`${w.target.token}${w.target.recipe ? '/' + w.target.recipe : ''}${w.target.pool ? '[' + w.target.pool + ']' : ''}:${kind}:t${w.tier}`);
    }
    for (const [s, l] of Object.entries(bySkill)) console.log('\n##', s, l.length, '\n', l.join('  '));
    for (const s of pace.skills()) { const tr = pace.trackOf(s); console.log('track', s, 'levels', tr.levels?.length, 'tiers', [...new Set((tr.levels||[]).map(l=>l.tier))]); }
    console.log('stageOf', typeof pace.stageOf);
    for (const t of [0,1,2,3,4,5,6,7]) { try { const st = pace.stageOf(t); console.log('stage', t, JSON.stringify(st && { hours: st.hours, ...Object.fromEntries(Object.entries(st).filter(([k,v])=>typeof v!=='object')) })); } catch(e){ console.log('stage err', t, e.message);} }
} finally { await server.close(); }
