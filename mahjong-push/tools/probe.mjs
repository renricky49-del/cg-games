import * as L from '../js/logic.js';
const cfgs=[[4,5,6,4,0],[5,6,10,6,0],[6,7,15,8,1],[7,8,22,12,2],[8,9,28,16,3],[8,10,32,18,4],[8,10,36,22,2]];
for(const [w,h,pairs,types,stones] of cfgs){
  let solv=0,t0=Date.now(),dr=0,br=0,ab=0,nodes=0;
  for(let s=1;s<=10;s++){const b=L.generateBoard({w,h,pairs,types,stones},s*7919);
    const r=L.solve(b.cells,w,h,100000); if(r.solution)solv++; if(r.aborted)ab++; nodes+=r.nodes;
    const a=L.analyze(b.cells,w,h,20,s); dr+=a.deadRatio; br+=a.branch;}
  console.log(w,h,pairs,types,stones,'solv',solv,'ab',ab,'nodes',nodes/10|0,'dead',(dr/10).toFixed(2),'br',(br/10).toFixed(1),'ms',(Date.now()-t0)/10|0);
}
