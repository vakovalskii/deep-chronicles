// Одна расстановка для серверных препятствий и визуального оформления Godot.
export const TOWN_DECOR = [
  {kind:'stall',x:-25,z:-8,r:3,rotation:Math.PI/2,color:'burgundy'},
  {kind:'stall',x:-25,z:7,r:3,rotation:Math.PI/2,color:'ochre'},
  {kind:'stall',x:-25,z:22,r:3,rotation:Math.PI/2,color:'green'},
  {kind:'bench',x:11,z:26,r:2,rotation:Math.PI},
  {kind:'bench',x:-8,z:26,r:2,rotation:Math.PI},
  {kind:'bench',x:27,z:-8,r:2,rotation:-Math.PI/2},
  {kind:'planter',x:21,z:-19,r:2,rotation:0},
  {kind:'planter',x:29,z:2,r:2,rotation:0},
  {kind:'planter',x:-15,z:26,r:2,rotation:0},
  {kind:'planter',x:18,z:27,r:2,rotation:0},
  {kind:'tree',x:30,z:-23,r:2.2,rotation:0},
  {kind:'tree',x:-34,z:28,r:2.2,rotation:0},
  {kind:'barrels',x:-29,z:14,r:1.5,rotation:0},
  {kind:'barrels',x:-29,z:-1,r:1.5,rotation:0},
  {kind:'lamp',x:-17,z:-10,r:.35,rotation:0},
  {kind:'lamp',x:17,z:-10,r:.35,rotation:0},
  {kind:'lamp',x:-5,z:24,r:.35,rotation:0},
  {kind:'lamp',x:22,z:8,r:.35,rotation:0},
];
export const TOWN_SHOPS = [
  {id:'weapons',name:'Оружейная',x:-39,z:-30,color:'burgundy',slots:['weapon','shield']},
  {id:'clothes',name:'Лавка одежды',x:39,z:-30,color:'green',slots:['head','armor','legs','gloves','feet']},
  {id:'alchemy',name:'Зелья и украшения',x:39,z:30,color:'ochre',slots:['ear','neck','ring']},
];
export const TOWN_ROADS = [
  {x:0,z:0,w:180,d:5}, {x:0,z:0,w:5,d:180},
  {x:-30,z:0,w:4,d:92}, {x:30,z:0,w:4,d:92},
  {x:0,z:-12,w:100,d:4}, {x:0,z:39,w:100,d:4},
];
export function shopObstacles(shop) {
  const result=[{x:shop.x,z:shop.z-7,r:5.4}];
  for(let z=-4;z<=4;z+=1.5)for(const x of [-5,5])result.push({x:shop.x+x,z:shop.z+z,r:.85});
  for(let x=-4;x<=4;x+=1.5) result.push({x:shop.x+x,z:shop.z-4,r:.85});
  for(let x=-4;x<=4;x+=1.4) result.push({x:shop.x+x,z:shop.z-1.5,r:.7});
  result.push({x:shop.x+3.5,z:shop.z-.3,r:.5});
  return result;
}
