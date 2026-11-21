#!/usr/bin/env bash
# Build the signed Play Store release: dist/PixelHunt-<ver>.aab (upload to Play) + dist/PixelHunt-<ver>.apk (sideload/test).
# Signing uses the upload key described in /home/box/secrets/pixelhunt-upload.properties (or $PH_UPLOAD_PROPS). Never commit that file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="$(node -p "require('$ROOT/package.json').version")"
export JAVA_HOME="${JAVA_HOME:-/home/box/jdk21}"
export ANDROID_HOME="${ANDROID_HOME:-/home/box/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export GRADLE_OPTS="${GRADLE_OPTS:--Xmx2048m -Dorg.gradle.daemon=false}"
PROPS="${PH_UPLOAD_PROPS:-/home/box/secrets/pixelhunt-upload.properties}"
[ -f "$PROPS" ] || { echo "Missing upload key properties: $PROPS" >&2; exit 1; }
cd "$ROOT"
[ -d node_modules/@capacitor/cli ] || npm install
STORE=1 bash "$ROOT/tools/prepare-native.sh"   # store build: no placeholder ads / simulated purchase
python3 "$ROOT/tools/make-android-icons.py"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/android/local.properties"
npx cap sync android
cd "$ROOT/android"
./gradlew :app:bundleRelease :app:assembleRelease --no-daemon
mkdir -p "$ROOT/dist"
cp -f app/build/outputs/bundle/release/app-release.aab "$ROOT/dist/PixelHunt-$VER.aab"
cp -f app/build/outputs/apk/release/app-release.apk "$ROOT/dist/PixelHunt-$VER.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs "$ROOT/dist/PixelHunt-$VER.apk" | grep -E "SHA-256|DN" || true
ls -l "$ROOT/dist/PixelHunt-$VER.aab" "$ROOT/dist/PixelHunt-$VER.apk"
