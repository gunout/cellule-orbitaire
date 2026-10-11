#!/usr/bin/env bash
# =============================================================
#  Cellule Orbitaire — install-full.sh
#  Installation complète depuis zéro :
#    - Node.js, Python3, pipx, termtrack, outils de compilation
#    - Clone de https://github.com/gunout/cellule-orbitaire
#    - npm install
#    - Téléchargement des TLE (météo + ISS)
#  Compatible Debian/Ubuntu et macOS.
# =============================================================
set -euo pipefail

# ─── PARAMÈTRES ──────────────────────────────────────────────
GITHUB_USER="${GITHUB_USER:-gunout}"
GITHUB_REPO="${GITHUB_REPO:-cellule-orbitaire}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/cellule-orbitaire}"
# ─────────────────────────────────────────────────────────────

CYAN="\033[36m"; GREEN="\033[32m"; RED="\033[31m"; YELLOW="\033[33m"; RESET="\033[0m"
info()  { echo -e "${CYAN}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✅ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
fail()  { echo -e "${RED}❌ $*${RESET}"; exit 1; }

# ─── 1. Détection OS ─────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM=linux ;;
  Darwin*) PLATFORM=macos ;;
  *) fail "OS non supporté : $OS" ;;
esac
info "Plateforme : $PLATFORM"

pkg_install() {
  local pkg="$1"
  if [ "$PLATFORM" = "macos" ]; then
    brew install "$pkg"
  else
    sudo apt-get install -y "$pkg"
  fi
}

# ─── 2. Homebrew (macOS) ─────────────────────────────────────
if [ "$PLATFORM" = "macos" ] && ! command -v brew >/dev/null 2>&1; then
  info "Installation de Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [ "$PLATFORM" = "linux" ]; then
  info "apt update…"
  sudo apt-get update -qq
fi

# ─── 3. Outils de base ───────────────────────────────────────
info "Installation des outils de base…"
for cmd in git curl; do
  command -v "$cmd" >/dev/null 2>&1 || pkg_install "$cmd"
done

# ─── 4. Python3 + pip + pipx ─────────────────────────────────
command -v python3 >/dev/null 2>&1 || pkg_install python3
python3 -m pip --version >/dev/null 2>&1 || {
  if [ "$PLATFORM" = "linux" ]; then pkg_install python3-pip; else python3 -m ensurepip --upgrade || true; fi
}

if ! command -v pipx >/dev/null 2>&1; then
  info "Installation de pipx…"
  if [ "$PLATFORM" = "linux" ]; then pkg_install pipx; else brew install pipx; fi
fi
pipx ensurepath >/dev/null 2>&1 || true
export PATH="$HOME/.local/bin:$PATH"
ok "pipx OK"

# ─── 5. Node.js 20 ───────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  info "Installation de Node.js 20…"
  if [ "$PLATFORM" = "linux" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    brew install node@20
    brew link --overwrite --force node@20 || true
  fi
fi
ok "Node $(node -v), npm $(npm -v)"

# ─── 6. Outils de compilation (node-pty) ─────────────────────
if [ "$PLATFORM" = "linux" ]; then
  info "Installation des outils de compilation…"
  for pkg in build-essential make g++ python3; do
    dpkg -s "$pkg" >/dev/null 2>&1 || sudo apt-get install -y "$pkg"
  done
elif [ "$PLATFORM" = "macos" ]; then
  if ! xcode-select -p >/dev/null 2>&1; then
    info "Installation des Xcode Command Line Tools…"
    xcode-select --install || true
    warn "Attends la fin, puis relance ce script."
    exit 0
  fi
fi
ok "Outils de compilation OK"

# ─── 7. termtrack ────────────────────────────────────────────
if ! command -v termtrack >/dev/null 2>&1; then
  info "Installation de termtrack via pipx…"
  pipx install termtrack
fi
ok "termtrack installé"

# ─── 8. Clone du projet ──────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Mise à jour de $INSTALL_DIR…"
  cd "$INSTALL_DIR"
  git pull --ff-only || warn "git pull a échoué"
else
  info "Clone de https://github.com/$GITHUB_USER/$GITHUB_REPO.git"
  git clone --branch "$GITHUB_BRANCH" \
    "https://github.com/$GITHUB_USER/$GITHUB_REPO.git" "$INSTALL_DIR" \
    || fail "git clone a échoué"
  cd "$INSTALL_DIR"
fi
ok "Projet dans $INSTALL_DIR"

# ─── 9. npm install ──────────────────────────────────────────
info "Installation des dépendances npm…"
npm install --no-audit --no-fund || fail "npm install a échoué"
ok "Dépendances npm installées"

# ─── 10. TLE météo + ISS ─────────────────────────────────────
mkdir -p "$INSTALL_DIR/data"

if [ ! -s "$INSTALL_DIR/data/weather.tle" ]; then
  info "Téléchargement des TLE météo…"
  curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" \
    -o "$INSTALL_DIR/data/weather.tle" || warn "weather.tle échoué"
fi
[ -s "$INSTALL_DIR/data/weather.tle" ] && \
  ok "weather.tle : $(grep -c '^1 ' "$INSTALL_DIR/data/weather.tle") satellites"

if [ ! -s "$INSTALL_DIR/data/iss.tle" ]; then
  info "Téléchargement du TLE ISS…"
  curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" \
    -o "$INSTALL_DIR/data/iss.tle" || warn "iss.tle échoué"
fi
[ -s "$INSTALL_DIR/data/iss.tle" ] && ok "iss.tle présent"

# ─── 11. refresh-tle.sh ──────────────────────────────────────
cat > "$INSTALL_DIR/refresh-tle.sh" <<'EOF'
#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/data"
mkdir -p "$DATA"
echo "[$(date -Iseconds)] Refresh TLE…"
curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" \
  -o "$DATA/weather.tle" && echo "  ✅ weather.tle ($(grep -c '^1 ' "$DATA/weather.tle") sats)"
curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" \
  -o "$DATA/iss.tle" && echo "  ✅ iss.tle"
echo "[$(date -Iseconds)] OK"
EOF
chmod +x "$INSTALL_DIR/refresh-tle.sh"
ok "refresh-tle.sh prêt"

# ─── 12. Récap ───────────────────────────────────────────────
echo
ok "Installation terminée."
echo
echo -e "${CYAN}Pour lancer :${RESET}"
echo "   cd $INSTALL_DIR"
echo "   npm start"
echo
echo -e "${CYAN}Puis ouvrir :${RESET} http://127.0.0.1:3013"
echo
