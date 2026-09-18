const status = document.querySelector('#status');
function probe() {
  status.textContent = 'Проверяем сервер…';
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  let answered = false;
  const timer = setTimeout(() => { status.textContent = 'Нет ответа сервера'; ws.close(); }, 7000);
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data); if (m.t !== 'hi') return;
    answered = true; clearTimeout(timer);
    status.textContent = `Сервер доступен · игроков онлайн: ${Number(m.online) || 0}`; ws.close();
  };
  ws.onerror = () => { clearTimeout(timer); if (!answered) status.textContent = 'Сервер временно недоступен'; };
}
probe(); setInterval(probe, 30000);
fetch('/release.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw Error('release'); return r.json(); }).then(release => {
  for (const key of ['windows', 'macos']) {
    const file = release.files[key];
    document.querySelector(`#${key}-info`).textContent = `${Math.round(file.bytes / 1048576)} МБ · сборка ${release.commit.slice(0, 8)}`;
    document.querySelector(`#${key}-sha`).textContent = file.sha256;
  }
}).catch(() => { document.querySelector('#windows-info').textContent = 'Сведения о сборке временно недоступны'; });
