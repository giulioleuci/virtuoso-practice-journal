#!/usr/bin/env bash
# build-apk.sh — Build a debug APK for Virtuoso on Linux
#
# Prerequisites (must be installed and on PATH before running):
#   • Node.js 18+  (https://nodejs.org)
#   • Java JDK 17+ (https://adoptium.net)
#   • Android SDK with:
#       - Android platform (API 34 recommended)
#       - build-tools (34.x)
#       - platform-tools (adb)
#   • ANDROID_HOME or ANDROID_SDK_ROOT env var pointing to the SDK root
#
# Usage:
#   chmod +x build-apk.sh
#   ./build-apk.sh
#
# The finished APK is copied to ./virtuoso-debug.apk

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${CYAN}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}✗ ERROR:${NC} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 1. Prerequisite checks ────────────────────────────────────────────────────
info "Checking prerequisites…"

command -v node  >/dev/null 2>&1 || die "Node.js not found. Install from https://nodejs.org"
command -v npm   >/dev/null 2>&1 || die "npm not found. Install Node.js from https://nodejs.org"
command -v java  >/dev/null 2>&1 || die "Java not found. Install JDK 17+ from https://adoptium.net"

NODE_VER=$(node -e "process.stdout.write(process.version.replace('v',''))")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
[[ "$NODE_MAJOR" -ge 18 ]] || die "Node.js 18+ required (found v$NODE_VER)"

JAVA_VER=$(java -version 2>&1 | awk -F'"' 'NR==1{print $2}' | cut -d. -f1)
# Java 9+ uses "17", Java 8 uses "1.8" — handle both
[[ "$JAVA_VER" == "1" ]] && JAVA_VER=$(java -version 2>&1 | awk -F'"' 'NR==1{print $2}' | cut -d. -f2)
[[ "$JAVA_VER" -ge 17 ]] 2>/dev/null || die "Java 17+ required (found version $JAVA_VER)"

# Resolve Android SDK
ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_SDK" ]]; then
  # Common default locations on Linux
  for candidate in "$HOME/Android/Sdk" "$HOME/.android/sdk" "/opt/android-sdk"; do
    [[ -d "$candidate" ]] && ANDROID_SDK="$candidate" && break
  done
fi
[[ -n "$ANDROID_SDK" && -d "$ANDROID_SDK" ]] \
  || die "Android SDK not found. Set ANDROID_HOME to your SDK root.\nCommon path: ~/Android/Sdk"

export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"

# Ensure the SDK local.properties exists for Gradle
LOCAL_PROPS="android/local.properties"
if [[ ! -f "$LOCAL_PROPS" ]] || ! grep -q "sdk.dir" "$LOCAL_PROPS"; then
  echo "sdk.dir=$ANDROID_SDK" > "$LOCAL_PROPS"
  ok "Wrote $LOCAL_PROPS"
fi

ok "Prerequisites satisfied (Node v$NODE_VER, Java $JAVA_VER, SDK at $ANDROID_SDK)"

# ── 2. Install npm dependencies ───────────────────────────────────────────────
info "Installing npm dependencies…"
npm ci --prefer-offline 2>/dev/null || npm install
ok "npm dependencies installed"

# ── 3. Generate PWA icons (idempotent) ───────────────────────────────────────
if [[ ! -f "public/icons/icon-192.png" || ! -f "public/icons/icon-512.png" ]]; then
  info "Generating placeholder PWA icons…"
  node scripts/generate-icons.mjs
  ok "Icons generated"
else
  ok "PWA icons already present"
fi

# ── 4. Vite production build ──────────────────────────────────────────────────
info "Building web app with Vite…"
npm run build
ok "Web build complete (dist/)"

# ── 5. Sync web assets into Android project ───────────────────────────────────
info "Syncing web assets into Android project…"
npx cap sync android
ok "Capacitor sync complete"

# ── 6. Build debug APK with Gradle ───────────────────────────────────────────
info "Building debug APK…"
cd android

# Make Gradle wrapper executable
chmod +x gradlew

# Build — disable daemon for CI-friendliness
./gradlew assembleDebug \
  --no-daemon \
  --warning-mode all \
  2>&1 | grep -E "^(BUILD|FAILURE|ERROR|> Task|warning:|error:)" || true

# Confirm Gradle actually succeeded (the grep above drains the pipe)
./gradlew assembleDebug --no-daemon -q
cd ..

APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="virtuoso-debug.apk"

[[ -f "$APK_SRC" ]] || die "APK not found at $APK_SRC — check Gradle output above"
cp "$APK_SRC" "$APK_DST"

SIZE=$(du -h "$APK_DST" | cut -f1)
ok "Debug APK ready: $APK_DST ($SIZE)"
echo ""
echo -e "${GREEN}All done!${NC}"
echo "  Install on a connected device:  adb install -r $APK_DST"
echo "  Or transfer to the device manually and open it."
