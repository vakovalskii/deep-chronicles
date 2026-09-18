// The website is only a downloader/status page; gameplay acceptance runs in Godot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import WebSocket, { WebSocketServer } from 'ws';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'native-site-'));
const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const backend=spawn(process.execPath,['--no-warnings','server/server.js'],{env:{...process.env,PORT:String(port),DB:path.join(temp,'world.db'),DEV_CMD:'0'},stdio:['ignore','pipe','pipe']});
let browser,server,wss;
try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('backend timeout')),10000);backend.stdout.once('data',()=>{clearTimeout(timer);resolve();});backend.once('error',reject);});
  server=http.createServer((req,res)=>{
    let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
    const file=path.resolve('dist','.'+(url==='/'?'/index.html':url));
    if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
    res.setHeader('content-type',({'html':'text/html','js':'application/javascript','css':'text/css','json':'application/json','zip':'application/zip'})[file.split('.').at(-1)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  wss=new WebSocketServer({server});
  wss.on('connection',client=>{const upstream=new WebSocket(`ws://127.0.0.1:${port}`);upstream.on('message',data=>{if(client.readyState===1)client.send(data.toString());});upstream.on('error',()=>client.close());client.on('close',()=>upstream.close());});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByText('Сервер доступен · игроков онлайн: 0',{exact:true}).waitFor();
  assert.equal(await page.locator('canvas').count(),0);assert.match(await page.locator('.notice').textContent(),/Браузерная версия закрыта/);
  const release=JSON.parse(fs.readFileSync('dist/release.json'));
  for(const target of ['windows','macos']){const entry=release.files[target];assert.equal(await page.locator('#'+target).getAttribute('href'),entry.url);const bytes=fs.readFileSync('dist'+entry.url);assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
  assert.equal((await page.request.get(url+'/src/main.js')).status(),404);
  fs.mkdirSync('.native-run/site-artifacts',{recursive:true});await page.screenshot({path:'.native-run/site-artifacts/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.native-run/site-artifacts/mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('SITE_TEST_OK: live server status, native downloads and hashes, desktop/mobile layout, no browser game');
}finally{
  await browser?.close();wss?.clients.forEach(c=>c.terminate());await new Promise(r=>wss?wss.close(r):r());await new Promise(r=>server?server.close(r):r());
  backend.kill();await new Promise(r=>backend.exitCode!==null?r():backend.once('exit',r));fs.rmSync(temp,{recursive:true,force:true});
}
