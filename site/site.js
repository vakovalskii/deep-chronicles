const status = document.querySelector('#status');
let socket, retry, heartbeat, lastMessage = 0;
function connect() {
  clearTimeout(retry); clearInterval(heartbeat);
  status.textContent = 'Проверяем сервер…';
  const ws = socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  lastMessage = Date.now();
  heartbeat = setInterval(() => {
    if (Date.now() - lastMessage > 25000) { ws.close(); return; }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' }));
  }, 10000);
  ws.onmessage = ({ data }) => {
    if (socket !== ws) return;
    let m; try { m = JSON.parse(data); } catch { return; }
    lastMessage = Date.now();
    const count = m.t === 'hi' ? m.online : m.t === 'online' ? m.n : null;
    if (Number.isInteger(count) && count >= 0) status.textContent = `Сервер доступен · игроков онлайн: ${count}`;
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    clearInterval(heartbeat);
    status.textContent = 'Сервер временно недоступен · онлайн неизвестен';
    retry = setTimeout(connect, 5000);
  };
  ws.onerror = () => ws.close();
}
connect();
window.addEventListener('pagehide', () => { clearTimeout(retry); clearInterval(heartbeat); const ws = socket; socket = null; ws?.close(); });
window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
fetch('/release.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw Error('release'); return r.json(); }).then(release => {
  for (const key of ['windows', 'macos']) {
    const file = release.files[key];
    document.querySelector(`#${key}-info`).textContent = `${Math.round(file.bytes / 1048576)} МБ · сборка ${release.commit.slice(0, 8)}`;
    document.querySelector(`#${key}-sha`).textContent = file.sha256;
  }
}).catch(() => { document.querySelector('#windows-info').textContent = 'Сведения о сборке временно недоступны'; });
