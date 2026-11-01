import { buildSky } from './build.mjs';
const sky = buildSky(Object.fromEntries(['item_oak_wood','item_copper_ore','item_stone','item_coal','item_raw_shrimp','item_iron_ore','item_fir_wood'].map(i=>[i,5])));
const pts = [['hall',{x:0,y:0}],['bank_tabs',{x:-0.5,y:0}],['roster_size',{x:0,y:-0.5}],['wishing_well',{x:0,y:0.5}], ...Object.entries(sky.stars).map(([id,s])=>[id,s.node])];
const labels = [['L:hearth',{x:0,y:-0.8}],['L:vault',{x:-0.72,y:0.3}],['L:well',{x:0,y:0.8}], ...Object.entries(sky.constellations).map(([id,c])=>['L:'+id,c.label])];
const pos = Object.fromEntries(pts);
let minD = 9, bad = [];
for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++){const d=Math.hypot(pts[i][1].x-pts[j][1].x,pts[i][1].y-pts[j][1].y); if(d<minD)minD=d; if(d<0.3) bad.push(`${pts[i][0]}~${pts[j][0]} ${d.toFixed(2)}`);}
console.log('min star distance', minD.toFixed(3)); console.log('close pairs', bad);
// star vs label
for (const [l,p] of labels) for (const [id,q] of pts){const d=Math.hypot(p.x-q.x,p.y-q.y); if(d<0.2) console.log('label near star', l, id, d.toFixed(2));}
// line vs other star
const segs=[]; for (const [id,s] of Object.entries(sky.stars)) for (const l of s.links) segs.push([id,l]);
for (const [a,b] of segs){const A=pos[a],B=pos[b]; for(const [id,P] of pts){ if(id===a||id===b) continue; const dx=B.x-A.x,dy=B.y-A.y; const t=Math.max(0,Math.min(1,((P.x-A.x)*dx+(P.y-A.y)*dy)/(dx*dx+dy*dy))); const d=Math.hypot(A.x+t*dx-P.x,A.y+t*dy-P.y); if(d<0.15) console.log('line',a,'-',b,'passes',id,d.toFixed(2));}}
const xs=pts.map(p=>p[1].x), ys=pts.map(p=>p[1].y); console.log('extent x',Math.min(...xs),Math.max(...xs),'y',Math.min(...ys),Math.max(...ys));
// tag overlap: same-row stars with right/left tags
for (let i=0;i<pts.length;i++) for (let j=0;j<pts.length;j++){ if(i===j) continue; const [ia,a]=pts[i],[ib,b]=pts[j]; const s=sky.stars[ia]; if(!s) continue; const dy=Math.abs(a.y-b.y); if(dy>0.1) continue; const dx=b.x-a.x; if((s.tag==='right'&&dx>0&&dx<0.5)||(s.tag==='left'&&dx<0&&dx>-0.5)) console.log('tag of',ia,'runs into',ib,dx.toFixed(2),dy.toFixed(2)); }
for (const [id,c] of Object.entries(sky.constellations)) console.log(id, JSON.stringify(c.label), Object.entries(sky.stars).filter(([,s])=>s.constellation===id).map(([sid,s])=>`${sid.replace('star_'+id+'_','')}(${s.node.x},${s.node.y},${s.tag})`).join(' '));
