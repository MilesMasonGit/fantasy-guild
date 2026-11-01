import { engine, plannedWorkspace } from './lib.mjs';
const { server, load } = await engine();
try {
    const { workspace: ws, conflicts } = await plannedWorkspace(load);
    console.log('conflicts', JSON.stringify(conflicts));
    const { workspacePace } = await load('/src/engine/ledgerReport.js');
    const { itemKey, tokenKey, recipeKey } = await load('/../src/systems/progression/ledger/engine.js');
    const pace = workspacePace(ws);
    console.log('maxTier', pace.maxTier);
    for (const t of [0,1,2,3]) { const st = pace.stageOf(t); console.log('stage', t, st.hours?.toFixed(2), st.entries, st.complete); }
    const bySkill = {};
    for (const w of pace.works) {
        const skill = pace.profiles.contextOf(w.target).skill; if (!skill) continue;
        const et = pace.effTier(w.entry); const tt = pace.effTier(tokenKey(w.target.token));
        (bySkill[skill] ||= []).push(`${w.target.token.replace('token_','')}${w.target.recipe ? '/' + w.target.recipe.replace('recipe_','') : ''}:t${w.tier}/p${Math.max(et??-1,tt??-1)}`);
    }
    for (const [s, l] of Object.entries(bySkill)) console.log('\n##', s, '\n', l.join('  '));
    // gathered items per tier with bare supply
    console.log('\n## gathered supply (bare, at maxTier)');
    for (const id of ['item_oak_wood','item_copper_ore','item_coal','item_stone','item_wheat','item_raw_shrimp','item_fir_wood','item_iron_ore','item_water','item_redberry','item_grapes','item_lavender','item_trout']) {
        const s = pace.supplyOf(id, 'bare', pace.maxTier); const s0 = pace.supplyOf(id, 'bare', 0);
        console.log(id, 'tier', pace.effTier(itemKey(id)), 'bare/h@max', s.perHour?.toFixed(1), 'bare/h@0', s0.perHour?.toFixed(1), s.work?.key);
    }
} finally { await server.close(); }
