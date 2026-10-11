'use strict';
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3013;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// ─── TLE météo (72 satellites) ───────────────────────────────
const TLE_PATH = path.join(__dirname, 'data', 'weather.tle');
if (!fs.existsSync(TLE_PATH)) {
  console.error('❌ TLE météo introuvable:', TLE_PATH);
  process.exit(1);
}

// ─── TLE ISS (fichier local en priorité) ─────────────────────
const ISS_TLE_PATH = path.join(__dirname, 'data', 'iss.tle');

const ISS_URLS = [
  'https://tle.ivanstanojevic.me/api/tle/25544',
  `https://api.allorigins.win/raw?url=${encodeURIComponent(
    'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'
  )}`,
  'https://api.wheretheiss.at/v1/satellites/25544/tles'
];

// ─── Alias reconnus par termtrack ────────────────────────────
const TERMTRACK_ALIASES = {
  'iss': '25544',
  'hst': '20580',
  'hubble': '20580',
  'landsat7': '25682',
  'landsat8': '39084',
  'qzs-1': '37158',
  'qzs1': '37158',
  'smap': '40376',
};

// ─── Parsing de weather.tle ──────────────────────────────────
function parseTLEList() {
  const raw = fs.readFileSync(TLE_PATH, 'utf-8').split('\n');
  const sats = [];
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const name = raw[i].trim();
    const l1 = raw[i + 1] ? raw[i + 1].trim() : '';
    const l2 = raw[i + 2] ? raw[i + 2].trim() : '';
    if (name && l1.startsWith('1 ') && l2.startsWith('2 ')) {
      sats.push({ name, norad: l1.slice(2, 7).trim(), line1: l1, line2: l2 });
    }
  }
  return sats;
}

// ─── Route /api/satellites ───────────────────────────────────
app.get('/api/satellites', (req, res) => {
  try {
    const aliases = [
      { name: 'ISS (ZARYA)',       norad: '25544' },
      { name: 'Hubble (HST)',      norad: '20580' },
      { name: 'Landsat 7',         norad: '25682' },
      { name: 'Landsat 8',         norad: '39084' },
      { name: 'QZS-1 (Michibiki)', norad: '37158' },
      { name: 'SMAP',              norad: '40376' },
    ];
    const weather = parseTLEList().map(s => ({ name: s.name, norad: s.norad }));
    const seen = new Set();
    const all = [...aliases, ...weather].filter(s => {
      if (seen.has(s.norad)) return false;
      seen.add(s.norad); return true;
    });
    res.json({ ok: true, satellites: all });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Route /api/iss-tle ──────────────────────────────────────
app.get('/api/iss-tle', async (req, res) => {
  if (fs.existsSync(ISS_TLE_PATH)) {
    try {
      const lines = fs.readFileSync(ISS_TLE_PATH, 'utf-8')
        .trim().split('\n').map(l => l.trim()).filter(Boolean);
      let l1, l2;
      for (const l of lines) {
        if (l.startsWith('1 ')) l1 = l;
        if (l.startsWith('2 ')) l2 = l;
      }
      if (l1 && l2) {
        return res.json({ ok: true, line1: l1, line2: l2, source: 'local:data/iss.tle' });
      }
    } catch (e) { console.warn('Lecture iss.tle échouée:', e.message); }
  }
  for (const url of ISS_URLS) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const txt = await r.text();
      let l1, l2;
      try { const j = JSON.parse(txt); l1 = j.line1; l2 = j.line2; }
      catch {
        const ls = txt.trim().split('\n').map(x => x.trim());
        if (ls.length >= 3) { l1 = ls[1]; l2 = ls[2]; }
      }
      if (l1 && l2) return res.json({ ok: true, line1: l1, line2: l2, source: url });
    } catch (e) { console.warn(`Source ISS ${url} échouée:`, e.message); }
  }
  res.status(502).json({ ok: false, error: 'Aucune source TLE ISS disponible' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/pty' });

// ─── Résolution : renvoie TOUJOURS un NORAD ──────────────────
function resolveSatellite(input) {
  const sats = parseTLEList();
  if (!input) return { arg: '25544', sat: { name: 'ISS', norad: '25544' } };
  const q = input.trim().toLowerCase();

  if (TERMTRACK_ALIASES[q]) {
    return { arg: TERMTRACK_ALIASES[q], sat: { name: q, norad: TERMTRACK_ALIASES[q] } };
  }
  const found = sats.find(s =>
    s.name.toLowerCase() === q ||
    s.name.toLowerCase().includes(q) ||
    s.norad === q
  );
  if (found) return { arg: found.norad, sat: found };
  return { arg: '25544', sat: { name: 'ISS', norad: '25544' } };
}

// ─── Recoloration ANSI : le satellite passe en rouge ─────────
//  Termtrack dessine le satellite comme un 'X'. On remplace
//  la séquence ANSI qui précède tout 'X' par du rouge vif.
function recolorSatellite(data) {
  // \x1b[31m = rouge
  // On capture tout code couleur ANSI suivi immédiatement d'un X
  return data.replace(/\x1b\[[0-9;]*mX/g, '\x1b[1;31mX');
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { arg, sat } = resolveSatellite(url.searchParams.get('sat'));

  // Flags par défaut : crosshair + grille + footprint + nuit + infos
  const FLAGS = ['-x', '-g', '-f', '-n', '-i'];

  console.log(`🔌 PTY → termtrack ${FLAGS.join(' ')} ${arg} (${sat.name}) depuis ${req.socket.remoteAddress}`);

  let term;
  try {
    term = pty.spawn('termtrack', [...FLAGS, arg], {
      name: 'xterm-256color',
      cols: 120, rows: 50,
      cwd: __dirname,
      env: Object.assign({}, process.env, {
        TERM: 'xterm-256color',
        LANG: 'fr_FR.UTF-8',
        LC_ALL: 'fr_FR.UTF-8'
      })
    });
  } catch (e) {
    ws.send(`\r\n\x1b[31mErreur spawn: ${e.message}\x1b[0m\r\n`);
    ws.close(); return;
  }

  term.onData(d => {
    if (ws.readyState !== ws.OPEN) return;
    // Recolore le satellite en rouge avant envoi au navigateur
    ws.send(recolorSatellite(d));
  });

  term.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[33m[termtrack terminé — code ${exitCode}]\x1b[0m\r\n`);
      ws.close();
    }
  });

  ws.on('message', msg => {
    let p; try { p = JSON.parse(msg.toString()); } catch { return term.write(msg.toString()); }
    if (p.type === 'input') term.write(p.data);
    if (p.type === 'resize') { try { term.resize(p.cols, p.rows); } catch {} }
  });

  ws.on('close', () => { try { term.kill(); } catch {} });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🛰️  Cellule orbitale → http://${HOST}:${PORT}`);
  console.log(`   Flags termtrack   : -x -g -f -n -i`);
  console.log(`   Satellite         : rouge vif (recoloration ANSI)`);
  console.log(`   TLE météo         : ${TLE_PATH}`);
  console.log(`   TLE ISS           : ${ISS_TLE_PATH} ${fs.existsSync(ISS_TLE_PATH) ? '✅' : '❌ (absent)'}\n`);
});