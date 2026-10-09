// Fantasy Guild drawing bench (`npm run bench:draw`): how much drawing the game costs, measured
// by the in-game Perf HUD (`window.__perf`) in the installed Chrome, headless, real GPU.
//
//   npm run bench:draw                    perf build, CPU 1× and 4×, every scene
//   npm run bench:draw -- --dev           also the dev build
//   npm run bench:draw -- --quick         short windows, S2 only (agent checks)
//   npm run bench:draw -- --only=S2,bank  some scenes
//   npm run bench:draw -- --cpu=4         CPU slowdowns to run (default 1,4)
//   npm run bench:draw -- --switches      the cost table: S2 all-on, then once per switch off
//                                         (perf, 1× unless --cpu is given; --only=cap128 for
//                                         another board)
//   npm run bench:draw -- --repeats=3     runs per scene (the median is reported, with the spread)
//   npm run bench:draw -- --compare       compare with bench/draw-baseline.json
//   npm run bench:draw -- --save-baseline write this run as bench/draw-baseline.json
//   npm run bench:draw -- --ab=<url>      interleave A (this checkout) and B (a server someone
//                                         else started) per scene: A, B, B, A
//   npm run bench:draw -- --no-build      reuse dist-perf/ as it is
//   npm run bench:draw -- --settle=10 --window=20   seconds
//
// Exit codes: 0 ok · 1 REGRESSED against the baseline · 3 the bench failed.
// ⚠️ Numbers are machine-specific: the baseline is the owner's PC only. See bench/README.md.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startDevServer, startPerfServer, buildPerf, perfBuildInfo } from './browser/servers.mjs';
import { SCENES, sceneUrl, openBoard } from './browser/scenes.mjs';
import {
    parseArgs, SCENE_IDS, DRAW_SWITCHES, metricsOf, rejectReason, aggregate, costTable, compareToBaseline,
    baselineEntry, abOrder, conditionKey, sceneTable, costTableText, table, EXIT, TOLERANCE, settingsMismatch
} from './browser/drawLib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const resultsDir = path.join(here, 'results', 'draw');
const baselineFile = path.join(here, 'draw-baseline.json');

function gitInfo() {
    const run = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    try {
        const dirtyIn = (p) => run(`git status --porcelain -- ${p}`).length > 0;
        return {
            commit: run('git rev-parse --short HEAD'),
            branch: run('git rev-parse --abbrev-ref HEAD'),
            dirty: { src: dirtyIn('src'), data: dirtyIn('data'), bench: dirtyIn('bench'), public: dirtyIn('public') }
        };
    } catch {
        return { commit: 'unknown', branch: 'unknown', dirty: null };
    }
}

/** One measured window of one scene. */
async function measure(chrome, baseUrl, scene, cpu, args, off = []) {
    const url = sceneUrl(baseUrl, scene, off);
    const page = await openBoard(chrome, url, { cpu, stress: scene.stress });
    try {
        const how = scene.ui ? await scene.ui(page) : null;
        await sleep(args.settleS * 1000);
        await page.evaluate('window.__perf.reset(), true');
        await sleep(args.windowS * 1000);
        const report = await page.evaluate('window.__perf.report()');
        const m = metricsOf(report);
        m.reject = rejectReason(m);
        if (page.navigations > 1) m.reject = `the page reloaded during the run (${page.navigations} loads)`;
        m.how = how;
        m.pageErrors = page.consoleErrors.slice(0, 5);
        m.switchesOff = off;
        m.loaf = report?.longAnimationFrames?.worst?.slice(0, 3) ?? [];
        return m;
    } finally {
        await page.close();
    }
}

async function measureWithRetry(...a) {
    try {
        return await measure(...a);
    } catch (err) {
        console.log(`    ⚠ ${err.message}; retrying once`);
        return measure(...a);
    }
}

function label(scene, m) {
    return `${scene.name}${m?.reject ? ' ✗' : ''}`;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const started = Date.now();
    const meta = {
        ...gitInfo(),
        date: new Date().toISOString(),
        node: process.version,
        machine: os.hostname(),
        cpu: os.cpus()[0]?.model?.trim(),
        cores: os.cpus().length,
        platform: `${os.platform()} ${os.release()}`,
        loadAvgNote: 'Windows reports no load average; quiet the machine before a baseline',
        args
    };

    // The cost table runs on one board: S2, or the one `--only` names (a cap board, say).
    const switchScene = SCENES[args.only?.[0] ?? 'S2'];
    const scenes = (args.switches ? [switchScene.id] : (args.only || SCENE_IDS)).map(id => SCENES[id]);
    console.log(`Fantasy Guild drawing bench — ${meta.commit} on ${meta.branch}${meta.dirty && Object.values(meta.dirty).some(Boolean) ? ` (uncommitted: ${Object.entries(meta.dirty).filter(([, v]) => v).map(([k]) => k).join(', ')})` : ''} · ${meta.machine} · ${meta.cpu}`);

    const servers = {};
    let chrome = null;
    let failed = false;
    const all = {};          // conditionKey → sceneId → [metrics]
    const ab = {};           // conditionKey → sceneId → { A: [], B: [] }
    let cost = null;
    try {
        for (const build of args.builds) {
            if (build === 'perf') {
                if (args.build) {
                    process.stdout.write('Building the perf build (vite build --mode perf)…\n');
                    meta.perfBuildS = buildPerf();
                } else {
                    meta.perfBuiltAt = perfBuildInfo()?.builtAt ?? null;
                    console.log(`--no-build: using dist-perf/ built ${meta.perfBuiltAt?.toISOString?.() ?? '(missing)'}`);
                }
                servers.perf = await startPerfServer({ port: args.port });
            } else {
                servers.dev = await startDevServer({ port: args.port && args.port + 1 });
            }
        }
        chrome = await launchChrome({ width: 1600, height: 1000 });
        meta.chrome = { product: chrome.info.product, userAgent: chrome.info.userAgent, gpu: chrome.info.gpu };
        console.log(`Chrome ${chrome.info.product} headless · GPU ${chrome.info.gpu?.device ?? '?'} · ${chrome.info.gpu?.angle ?? 'ANGLE ?'}`);
        console.log(`1600×1000 at DPR 1 · settle ${args.settleS} s, window ${args.windowS} s${args.repeats > 1 ? ` · ${args.repeats} repeats` : ''}`);

        // The dev server compiles on first request: one throwaway load warms it, so the first
        // measured scene does not pay for it (or reload half-way when Vite re-optimises).
        if (servers.dev) {
            process.stdout.write('Warming the dev server…\n');
            const p = await openBoard(chrome, sceneUrl(servers.dev.url, SCENES.S1), { stress: 'quiet' });
            await p.close();
        }

        for (const build of args.builds) {
            const baseUrl = servers[build].url;
            for (const cpu of args.cpus) {
                const cond = conditionKey(build, cpu);
                all[cond] = {};
                console.log(`\n${cond}${args.ab ? ` — A/B against ${args.ab}` : ''}`);

                if (args.switches) {
                    // All-on at the start, the middle and the end: the spread is the noise, and
                    // drift over the run shows up in it rather than in one switch's cost.
                    const allOn = [];
                    const offRuns = {};
                    const order = [...DRAW_SWITCHES];
                    const half = Math.ceil(order.length / 2);
                    const plan = [null, ...order.slice(0, half), null, ...order.slice(half), null];
                    for (let r = 0; r < args.repeats; r++) {
                        for (const sw of plan) {
                            const lbl = sw ? `${sw} off` : 'all on';
                            process.stdout.write(`  ${switchScene.name} ${lbl}…`);
                            const m = await measureWithRetry(chrome, baseUrl, switchScene, cpu, args, sw ? [sw] : []);
                            console.log(` ${m.fps} fps, work p50 ${m.workP50} ms${m.reject ? ` ✗ ${m.reject}` : ''}`);
                            if (m.reject) failed = true;
                            if (sw) (offRuns[sw] ||= []).push(m); else allOn.push(m);
                        }
                    }
                    cost = { cond, ...costTable(allOn, offRuns), raw: { allOn, offRuns } };
                    all[cond][switchScene.id] = allOn;
                    continue;
                }

                for (const scene of scenes) {
                    if (args.ab) {
                        const pair = { A: [], B: [] };
                        for (let r = 0; r < args.repeats; r++) {
                            for (const side of abOrder(1)) {
                                process.stdout.write(`  ${scene.name} ${side}…`);
                                const m = await measureWithRetry(chrome, side === 'A' ? baseUrl : args.ab, scene, cpu, args);
                                console.log(` ${m.fps} fps, work p50 ${m.workP50} ms${m.reject ? ` ✗ ${m.reject}` : ''}`);
                                if (m.reject) failed = true;
                                pair[side].push(m);
                            }
                        }
                        (ab[cond] ||= {})[scene.id] = pair;
                        continue;
                    }
                    const runs = [];
                    for (let r = 0; r < args.repeats; r++) {
                        process.stdout.write(`  ${scene.name}${args.repeats > 1 ? ` ${r + 1}/${args.repeats}` : ''}…`);
                        const m = await measureWithRetry(chrome, baseUrl, scene, cpu, args);
                        console.log(` ${m.fps} fps, work p50 ${m.workP50} ms${m.reject ? ` ✗ ${m.reject}` : ''}${m.how ? ` · ${m.how}` : ''}`);
                        if (m.reject) failed = true;
                        runs.push(m);
                    }
                    all[cond][scene.id] = runs;
                }
            }
        }
    } catch (err) {
        console.error(`\n✗ The bench failed: ${err?.stack || err}`);
        failed = true;
    } finally {
        if (chrome) {
            const c = await chrome.close();
            meta.chromeClosed = c;
            if (!c.exited || !c.profileRemoved) console.log(`⚠ Chrome cleanup: exited ${c.exited}, profile removed ${c.profileRemoved} (${c.profileDir})`);
        }
        for (const s of Object.values(servers)) await s.close();
    }

    // ---- Report ----
    const medians = {};
    for (const [cond, scenesRuns] of Object.entries(all)) {
        medians[cond] = {};
        const rows = [];
        for (const [id, runs] of Object.entries(scenesRuns)) {
            const ok = runs.filter(r => !r.reject);
            const agg = aggregate(ok.length ? ok : runs);
            medians[cond][id] = agg;
            rows.push({ label: label(SCENES[id], ok.length ? null : runs[0]), m: agg });
        }
        if (rows.length && !args.switches) console.log(`\n${cond}\n${sceneTable(rows)}`);
    }

    if (cost) {
        console.log(`\nCost table, ${cost.cond}: ${switchScene.name} with one system's drawing switched off. Positive saved = that system's cost.\n${costTableText(cost)}`);
    }

    const abSummary = {};
    for (const [cond, scenesAb] of Object.entries(ab)) {
        abSummary[cond] = {};
        const lines = [];
        for (const [id, pair] of Object.entries(scenesAb)) {
            const A = aggregate(pair.A.filter(r => !r.reject));
            const B = aggregate(pair.B.filter(r => !r.reject));
            abSummary[cond][id] = { A, B };
            const pct = (b, a) => (Number.isFinite(a) && a ? `${(((b - a) / a) * 100).toFixed(1)} %` : '—');
            lines.push([SCENES[id].name, A.fps?.toFixed(1) ?? '—', B.fps?.toFixed(1) ?? '—', pct(B.fps, A.fps),
                A.workP50?.toFixed(2) ?? '—', B.workP50?.toFixed(2) ?? '—', pct(B.workP50, A.workP50),
                A.workP99?.toFixed(2) ?? '—', B.workP99?.toFixed(2) ?? '—']);
        }
        console.log(`\nA/B ${cond}: A = this checkout (${meta.commit}), B = ${args.ab}; medians of A,B,B,A\n${table(
            ['scene', 'A fps', 'B fps', 'B vs A', 'A work p50', 'B work p50', 'B vs A', 'A work p99', 'B work p99'], lines)}`);
    }

    let comparison = null;
    let regressed = false;
    if (args.compare) {
        if (!fs.existsSync(baselineFile)) {
            console.log('\n--compare: there is no bench/draw-baseline.json yet (the owner takes it with --save-baseline on a quiet machine).');
            failed = true;
        } else {
            const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
            const mismatch = settingsMismatch(args, baseline);
            if (mismatch) {
                console.log(`\n--compare: not comparable: ${mismatch}. Re-run with --settle=${baseline.settings?.settleS} --window=${baseline.settings?.windowS} (no --quick).`);
                failed = true;
            } else {
                comparison = compareToBaseline(medians, baseline);
                regressed = comparison.regressed;
                console.log(`\nAgainst bench/draw-baseline.json (${baseline.meta?.commit ?? '?'}, ${baseline.meta?.date ?? '?'}, ${baseline.meta?.machine ?? '?'}):`);
                if (baseline.meta?.machine && baseline.meta.machine !== meta.machine) console.log(`⚠ The baseline was taken on ${baseline.meta.machine}; drawing numbers from another machine mean nothing here.`);
                for (const [name, set] of Object.entries(TOLERANCE)) {
                    const tol = Object.entries(set).map(([k, t]) => `${k} ${t.worseIf === 'lower' ? '−' : '+'}${Math.round(t.ratio * 100)} % and ${t.floor}`).join(' · ');
                    console.log(`fails (${name === 'full' ? 'CPU 1×' : 'CPU slowed'}) when worse by more than: ${tol}`);
                }
                console.log(table(['condition', 'scene', 'metric', 'baseline', 'now', 'verdict'],
                    comparison.checks.map(c => [c.cond, c.scene, c.metric, c.base ?? '—', c.now ?? '—', c.verdict])));
                console.log(regressed ? '\n✗ REGRESSED: at least one number is worse than the baseline beyond the tolerance.' : '\n✓ No drawing regression against the baseline.');
            }
        }
    }

    const elapsedS = (Date.now() - started) / 1000;
    fs.mkdirSync(resultsDir, { recursive: true });
    const stamp = meta.date.replace(/[:.]/g, '-');
    const file = path.join(resultsDir, `draw-${stamp}-${meta.commit}.json`);
    fs.writeFileSync(file, JSON.stringify({ meta: { ...meta, elapsedS }, medians, runs: all, cost, ab: abSummary, abRuns: ab, comparison }, null, 2));
    console.log(`\nWrote ${path.relative(root, file)} (${elapsedS.toFixed(0)} s).`);

    if (args.saveBaseline) {
        if (failed) {
            console.log('✗ Not saving bench/draw-baseline.json: the run had rejected or failed scenes.');
        } else {
            const out = {
                meta: { ...meta, note: 'Medians per condition and scene. Machine-specific: re-take on the owner\'s PC, machine quiet: npm run bench:draw -- --save-baseline' },
                settings: { settleS: args.settleS, windowS: args.windowS, repeats: args.repeats, viewport: '1600x1000@1' },
                conditions: Object.fromEntries(Object.entries(medians).map(([c, s]) => [c, Object.fromEntries(Object.entries(s).map(([id, agg]) => [id, baselineEntry(agg)]))]))
            };
            fs.writeFileSync(baselineFile, JSON.stringify(out, null, 2) + '\n');
            console.log('Wrote bench/draw-baseline.json.');
        }
    }

    process.exit(failed ? EXIT.BENCH_FAILED : regressed ? EXIT.REGRESSED : EXIT.OK);
}

main().catch(err => {
    console.error(err?.stack || err);
    runCleanups();
    process.exit(EXIT.BENCH_FAILED);
});
