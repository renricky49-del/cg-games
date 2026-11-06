import * as L from '../js/logic.js';
const cfgs=[[6,7,12,6,1],[7,8,18,9,2],[8,9,22,11,2],[8,10,24,12,3],[8,10,26,10,3],[8,10,28,14,2],[8,10,30,12,4]];
for(const [w,h,pairs,types,stones] of cfgs){
  let solv=0,t0=Date.now(),dr=0,br=0,ab=0,nodes=0;
  for(let s=1;s<=10;s++){const b=L.generateBoard({w,h,pairs,types,stones},s*7919);
    const r=L.solve(b.cells,w,h,60000); if(r.solution)solv++; if(r.aborted)ab++; nodes+=r.nodes;
    const a=L.analyze(b.cells,w,h,20,s); dr+=a.deadRatio; br+=a.branch;}
  console.log(w,h,pairs,types,stones,'solv',solv,'ab',ab,'nodes',nodes/10|0,'dead',(dr/10).toFixed(2),'br',(br/10).toFixed(1),'ms',(Date.now()-t0)/10|0);
}
