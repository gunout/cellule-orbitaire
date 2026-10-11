'use strict';
(function () {
  const container = document.getElementById('pty-terminal');
  if (!container || typeof Terminal === 'undefined') return;

  const term = new Terminal({
    cols: 120, rows: 50,
    fontFamily: "'JetBrains Mono','Fira Code',monospace",
    fontSize: 11, lineHeight: 1.05,
    theme: {
      background: '#f6f6f6', foreground: '#1e1e1e', cursor: '#000091',
      selectionBackground: '#00009133',
      black:'#1e1e1e', red:'#E1000F', green:'#16a34a', yellow:'#65a30d',
      blue:'#000091', magenta:'#6b6bff', cyan:'#1212ff', white:'#f6f6f6'
    },
    scrollback: 2000, convertEol: true, cursorBlink: true
  });
  term.open(container);

  let ws = null;

  function connect(satName) {
    if (ws) { try { ws.close(); } catch {} ws = null; }
    term.clear();
    term.write(`\x1b[36m⟳ Connexion au PTY pour ${satName}…\x1b[0m\r\n`);

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/pty?sat=${encodeURIComponent(satName)}`);

    ws.onopen = () => {
      term.write(`\x1b[32m✅ PTY connecté — ${satName}\x1b[0m\r\n\r\n`);
      fit();
    };
    ws.onmessage = e => term.write(e.data);
    ws.onclose  = () => term.write('\r\n\x1b[33m⚠ PTY déconnecté.\x1b[0m\r\n');
    ws.onerror  = () => term.write('\r\n\x1b[31m✖ Erreur WebSocket.\x1b[0m\r\n');

    term.onData(d => {
      if (ws && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type:'input', data:d }));
    });
  }

  function fit() {
    if (ws && ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type:'resize', cols:term.cols, rows:term.rows }));
  }
  window.addEventListener('resize', fit);

  fetch('/api/satellites')
    .then(r => r.json())
    .then(j => {
      const sel = document.getElementById('sat-select');
      if (!sel || !j.ok) return;
      sel.innerHTML = '';
      j.satellites.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (NORAD ${s.norad})`;
        sel.appendChild(opt);
      });
      const target = sel.value || (j.satellites[0] && j.satellites[0].name);
      connect(target);
      sel.addEventListener('change', () => connect(sel.value));
    })
    .catch(e => {
      term.write(`\x1b[31m✖ Liste satellites: ${e.message}\x1b[0m\r\n`);
      connect('iss');
    });

  window.__pty = {
    reconnect() { const sel = document.getElementById('sat-select'); connect(sel ? sel.value : 'iss'); },
    clear() { term.clear(); },
    fit,
    screenshot() {
      const frame = document.querySelector('.terminal-frame');
      if (!frame || typeof html2canvas === 'undefined') return alert('html2canvas non chargé');
      html2canvas(frame, { backgroundColor: '#f6f6f6', scale: 2, useCORS: true })
        .then(canvas => {
          const a = document.createElement('a');
          a.download = `termtrack-${Date.now()}.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
        });
    }
  };
})();