<div align="center">

# 🛰️ Cellule Orbitaire

**Console de suivi orbital — Terminal termtrack + Suivi ISS temps réel**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![termtrack](https://img.shields.io/badge/termtrack-0.8.0-000091?style=flat-square)](https://github.com/trehn/termtrack)
[![satellite.js](https://img.shields.io/badge/satellite.js-5.0.0-000091?style=flat-square)](https://github.com/shashwatak/satellite-js)
[![xterm.js](https://img.shields.io/badge/xterm.js-5.3.0-000091?style=flat-square)](https://xtermjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

[Fonctionnalités](#-fonctionnalités) ·
[Installation](#-installation) ·
[Utilisation](#-utilisation) ·
[Architecture](#-architecture) ·
[Configuration](#-configuration) ·
[Contribuer](#-contribuer)

</div>

---

## 📖 Présentation

**Cellule Orbitaire** est une interface web qui combine deux outils de suivi satellitaire :

- 🖥️ **Un terminal intégré** qui exécute [`termtrack`](https://github.com/trehn/termtrack) dans un pseudo-terminal distant (`node-pty`), offrant une carte ASCII du monde en temps réel avec la position du satellite suivi.
- 🛰️ **Un tracker ISS** en JavaScript pur (via `satellite.js`) qui calcule la position, les télémesures et les prochains passages de l'ISS au-dessus d'un observateur donné.

L'ensemble est servi par un serveur Node.js/Express qui expose une page web sobre au design institutionnel français (bandeau Marianne, tricolore, footer officiel).

---

## ✨ Fonctionnalités

### Terminal termtrack (PTY)

- [x] Terminal interactif dans le navigateur via **xterm.js**
- [x] Pseudo-terminal distant via **node-pty** et **WebSocket**
- [x] Carte ASCII du monde mise à jour en temps réel
- [x] Calques activables : `-x` (crosshair), `-g` (grille), `-f` (footprint), `-n` (nuit), `-i` (infos)
- [x] Recoloration **ANSI** du satellite en rouge vif
- [x] Sélecteur de **78 satellites** (6 alias + 72 météo CelesTrak)
- [x] Capture PNG du terminal en un clic

### Suivi ISS (satellite.js)

- [x] Carte ASCII équirectangulaire (grille 120×50)
- [x] Télémesures : latitude, longitude, altitude, vitesse, cap, période
- [x] Trace de la trajectoire récente
- [x] Prédiction des **passages sur 72 h** avec critère de visibilité (satellite éclairé + observateur dans la nuit)
- [x] **Carte du ciel** SVG (azimut/élévation) pour chaque passage
- [x] Compte à rebours vers le prochain passage
- [x] Géolocalisation GPS de l'observateur

### Infrastructure

- [x] Récupération automatique des TLE depuis CelesTrak
- [x] Fallback sur fichier local si le réseau est indisponible
- [x] Rafraîchissement quotidien des TLE via cron
- [x] Script d'installation complète `install-full.sh`

---

## 🚀 Installation

### Prérequis

| Outil | Version minimale | Installation |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | inclus avec Node.js |
| Python | 3.10+ | `sudo apt install python3` |
| pipx | — | `sudo apt install pipx` |
| termtrack | 0.8.0 | `pipx install termtrack` |
| Build tools | — | `sudo apt install build-essential` (Linux) / `xcode-select --install` (macOS) |

### Installation automatique (recommandée)

```bash
curl -fsSL "https://raw.githubusercontent.com/gunout/cellule-orbitaire/main/install-full.sh" -o install-full.sh
chmod +x install-full.sh
./install-full.sh
```

Le script installe tout : Node.js, Python, pipx, termtrack, outils de compilation, puis clone le repo et télécharge les TLE.

### Installation manuelle

```bash
# 1. Clone
git clone https://github.com/gunout/cellule-orbitaire.git
cd cellule-orbitaire

# 2. Dépendances système
sudo apt install -y nodejs npm python3 python3-pip pipx build-essential curl
pipx install termtrack

# 3. Dépendances Node
npm install

# 4. TLE initiaux
mkdir -p data
curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" -o data/weather.tle
curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" -o data/iss.tle
```

---

## 🎮 Utilisation

### Démarrer le serveur

```bash
cd cellule-orbitaire
npm start
```

Le serveur écoute par défaut sur **http://127.0.0.1:3013**.

### Accéder à l'interface

Ouvrir **http://127.0.0.1:3013** dans un navigateur.

### Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3013` | Port d'écoute du serveur |
| `HOST` | `127.0.0.1` | Interface d'écoute (`0.0.0.0` pour exposer) |

```bash
PORT=8080 HOST=0.0.0.0 npm start
```

### Rafraîchir les TLE manuellement

```bash
./refresh-tle.sh
```

### Rafraîchissement automatique

Ajouter au crontab pour une mise à jour quotidienne à 3 h :

```cron
0 3 * * * /chemin/vers/cellule-orbitaire/refresh-tle.sh >> /chemin/vers/cellule-orbitaire/refresh-tle.log 2>&1
```

---

## 🏗️ Architecture

```
cellule-orbitaire/
├── install-full.sh          # Script d'installation complète
├── refresh-tle.sh           # Rafraîchissement des TLE
├── package.json             # Dépendances Node (express, node-pty, ws)
├── server.js                # Serveur Express + WebSocket PTY
├── data/
│   ├── weather.tle          # 72 satellites météo (CelesTrak)
│   └── iss.tle              # TLE ISS
├── fonts/
│   └── NASALIZA.TTF         # Police d'affichage
└── public/
    ├── index.html           # Page principale (2 onglets)
    ├── term.js              # Logique du terminal xterm.js
    └── fonts/
        └── nasalization.ttf # Police servie au navigateur
```

### Flux de données

```
┌──────────────┐      WebSocket       ┌──────────────┐
│  Navigateur  │ ◄──────────────────► │   Express    │
│  (xterm.js)  │   /pty?sat=NORAD     │   + ws       │
└──────────────┘                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  node-pty    │
                                      │  → termtrack │
                                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  CelesTrak   │
                                      │  (TLE)       │
                                      └──────────────┘
```

Le serveur :

1. Sert les fichiers statiques (`public/`)
2. Expose `/api/satellites` (liste des satellites disponibles)
3. Expose `/api/iss-tle` (TLE ISS local ou distant)
4. Ouvre un WebSocket sur `/pty` qui spawn `termtrack` par connexion

---

## ⚙️ Configuration

### Ajouter un satellite

Modifier `server.js`, constante `TERMTRACK_ALIASES` :

```javascript
const TERMTRACK_ALIASES = {
  'iss': '25544',
  'hst': '20580',
  // Ajouter un nouvel alias ici
  'noaa19': '33591',
};
```

### Modifier la couleur du satellite

Dans `server.js`, fonction `recolorSatellite()` :

```javascript
function recolorSatellite(data) {
  return data.replace(/\x1b\[[0-9;]*mX/g, '\x1b[1;31mX'); // rouge vif
  //                                    ↑
  //    Remplacer 31 (rouge) par :
  //      32 = vert
  //      33 = jaune
  //      34 = bleu
  //      35 = magenta
  //      36 = cyan
}
```

### Modifier les calques termtrack par défaut

Dans `server.js` :

```javascript
const FLAGS = ['-x', '-g', '-f', '-n', '-i'];
//             ↑    ↑    ↑    ↑    ↑
//       crosshair grid foot night info
```

| Flag | Effet |
|---|---|
| `-x` | Crosshair sur le satellite |
| `-g` | Grille latitude/longitude |
| `-f` | Footprint (empreinte au sol) |
| `-n` | Zone de nuit |
| `-i` | Panneau d'informations |
| `-o N` | Trace les N prochaines orbites |
| `--apsides` | Marque apoapsis/périapsis |

### Modifier l'observateur par défaut

Dans `public/index.html`, chercher :

```javascript
let observer = { lat: -20.88, lon: 55.45 }; // La Réunion
```

---

## 🔒 Sécurité

⚠️ **Ce serveur exécute une commande système whitelistée** (`termtrack`) via un PTY. Par défaut :

- Le serveur écoute sur **`127.0.0.1`** uniquement — pas d'accès externe
- La commande lancée est **figée** : `termtrack [-x -g -f -n -i] <NORAD>`
- Le paramètre `<NORAD>` est validé contre la liste des satellites connus
- Aucune commande arbitraire ne peut être injectée

Pour **exposer le serveur** (`HOST=0.0.0.0`), ajoutez impérativement une authentification :

- Reverse-proxy **nginx** avec `auth_basic`
- **Caddy** avec `basicauth`
- **Cloudflare Access** ou équivalent

Ne l'exposez jamais directement sur Internet sans authentification.

---

## 🤝 Contribuer

Les contributions sont bienvenues !

1. Fork le projet
2. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commit : `git commit -am 'Ajout de ma fonctionnalité'`
4. Push : `git push origin feature/ma-fonctionnalite`
5. Ouvrir une Pull Request

### Conventions

- **Français** pour les commentaires et l'interface
- **2 espaces** d'indentation pour le JavaScript
- Une fonction = une responsabilité
- Pas de dépendance ajoutée sans justification

---

## 📜 Licence

Distribué sous licence **MIT**. Voir [`LICENSE`](LICENSE) pour plus d'informations.

---

## 🙏 Remerciements

- [**termtrack**](https://github.com/trehn/termtrack) — tracker satellite en terminal
- [**satellite.js**](https://github.com/shashwatak/satellite-js) — propagation SGP4 en JavaScript
- [**xterm.js**](https://xtermjs.org/) — émulateur de terminal pour le web
- [**node-pty**](https://github.com/microsoft/node-pty) — pseudo-terminal Node.js
- [**CelesTrak**](https://celestrak.org/) — source des TLE
- [**Natural Earth**](https://www.naturalearthdata.com/) — données géographiques
- [**Nasalization**](https://www.dafont.com/nasalization.font) — police d'affichage

---

<div align="center">

**Fait avec 🛰️ en France**

*Liberté · Égalité · Fraternité*

</div>
