// Compatibility renderer for the retained web client; rewards remain on the server.
import * as THREE from 'three';
import { ITEMS } from './data.js';
import { heightAt } from './world-core.js';
export function groundLootView(scene) {
  const entries = new Map();
  function sync(rows) {
    const seen = new Set(rows.map(d => d.id));
    for (const [id, d] of entries) if (!seen.has(id)) {
      scene.remove(d.obj);
      d.obj.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
      entries.delete(id);
    }
    for (const row of rows) {
      let d = entries.get(row.id);
      if (!d) {
        const obj = new THREE.Group(); obj.position.set(row.x, heightAt(row.x, row.z), row.z);
        const coin = row.item === 'coins';
        const mesh = new THREE.Mesh(coin ? new THREE.CylinderGeometry(0.3, 0.3, 0.13, 16) : new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshStandardMaterial({ color: coin ? 0xe6bd58 : 0x91633c, roughness: 0.55, metalness: coin ? 0.7 : 0 }));
        mesh.position.y = 0.16; obj.add(mesh);
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
        const ctx = canvas.getContext('2d'); ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
        const title = `${coin ? 'Монеты' : ITEMS[row.item]?.name || row.item} ×${row.n}`;
        ctx.strokeStyle = '#151510'; ctx.lineWidth = 5; ctx.strokeText(title, 256, 34); ctx.fillStyle = '#ffe2a0'; ctx.fillText(title, 256, 34);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
        label.position.y = 0.9; label.scale.set(5, 0.8, 1); obj.add(label);
        d = { obj, label, data: row }; obj.traverse(o => { o.userData.groundDrop = d; }); scene.add(obj); entries.set(row.id, d);
      }
      d.data = row; d.label.material.color.setHex(row.available ? 0xffffff : 0x999999);
    }
  }
  return { entries, sync };
}
