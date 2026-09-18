// Bake selected completed TRELLIS outputs into tracked, portable game assets.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const blender = process.env.BLENDER_BIN || '/Applications/Blender.app/Contents/MacOS/Blender';
const humanoids = {mage_native:2.5,warrior_cloth:2.5,warrior_chain:2.5,merchant:2.5,gatekeeper:2.6,goblin:2.1,orc:3.2,treant:5,golem:4.8,skeleton:2.7,ghoul:2.8,wraith:3.1,lich:5.5};
const creatures = {wolf:1.6,rabbit:.95,boar:1.9,spider:1.7,scorpion:1.9};
const props = {house_a:18000,house_b:18000,tower:14000,temple:18000,fountain:12000,oak:3500,pine:2800,bush:1500,rock_a:2400,rock_b:2400,crypt:14000,portal:6000,dead_tree:2200};
const file='godot/assets/manifest.json';const manifest=JSON.parse(fs.readFileSync(file));
const args=process.argv.slice(2);let n=0;
for(const [id,budget] of Object.entries({...props,...humanoids,...creatures})) {
 if(args.length && !args.includes(id))continue;
 const source=id in creatures?`art/sources/creatures/${id}.glb`:`tools/models-out/${id}.glb`;if(!fs.existsSync(source))continue;
 const type=id in props?'props':id in creatures?'creatures':'characters';
 const output=`godot/assets/${type}/${id}.glb`;fs.mkdirSync(`godot/assets/${type}`,{recursive:true});
 if(!fs.existsSync(output)||fs.statSync(source).mtimeMs>fs.statSync(output).mtimeMs||args.length){
  const script=id in props?'prepare-static.py':id in creatures?'rig-creature.py':'rig.py';
  const input=id in props?[source,output,String(budget)]:id in creatures?[source,output,id]:[source,'public/assets/anims/AnimationLibrary_Godot_Standard.nofingers.gltf',output,id==='lich'?'2.1':'1.79',id==='mage_native'?'0':'57'];
  const r=spawnSync(blender,['-b','-P',`tools/godot/${script}`,'--',...input],{encoding:'utf8',maxBuffer:10*1024*1024});
  fs.mkdirSync('.native-run',{recursive:true});fs.writeFileSync(`.native-run/art-${id}.log`,r.stdout+r.stderr);
  if(r.status!==0||!fs.existsSync(output))throw new Error(`Art conversion failed: ${id}; see .native-run/art-${id}.log`);
  console.log('Prepared',id);n++;
 }
 const path='res://'+output.replace('godot/','');
 if(id in props)manifest.props[id]={path,triangles:budget};
 else manifest.actors[id==='warrior_cloth'?'warrior':id==='mage_native'?'mage':id]={path,height:budget,...(id in humanoids?{rig:'canonical'}:{clips:Object.fromEntries(['idle','walk','run','windup','attack','cast','hit','death'].map(k=>[k,k]))})};
}
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log(`Art: ${n} assets prepared`);
