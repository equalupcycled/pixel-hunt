#!/usr/bin/env bash
# Build a sideloadable debug APK: PixelHunt-1.0.0-test.apk
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/home/box/jdk21}"
export ANDROID_HOME="${ANDROID_HOME:-/home/box/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export GRADLE_OPTS="${GRADLE_OPTS:--Xmx1536m -Dorg.gradle.daemon=false}"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "JAVA_HOME is not a JDK: $JAVA_HOME" >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "ANDROID_HOME is missing platforms: $ANDROID_HOME" >&2
  exit 1
fi

cd "$ROOT"
bash "$ROOT/tools/prepare-native.sh"
python3 "$ROOT/tools/make-android-icons.py"
# Keep local.properties out of git; write it for this machine.
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/android/local.properties"
npx cap sync android
cd "$ROOT/android"
./gradlew :app:assembleDebug --no-daemon
mkdir -p "$ROOT/dist"
SRC="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
DEST="$ROOT/dist/PixelHunt-1.0.0-test.apk"
cp -f "$SRC" "$DEST"
ls -lh "$DEST"
