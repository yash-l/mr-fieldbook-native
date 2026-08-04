#!/usr/bin/env sh
set -eu
VERSION=8.13
BASE="${GRADLE_USER_HOME:-$HOME/.gradle}/manual-wrapper/gradle-$VERSION"
ZIP="$BASE/gradle-$VERSION-bin.zip"
DIR="$BASE/gradle-$VERSION"
if [ ! -x "$DIR/bin/gradle" ]; then
  mkdir -p "$BASE"
  if [ ! -f "$ZIP" ]; then
    echo "Downloading Gradle $VERSION..."
    if command -v curl >/dev/null 2>&1; then
      curl -L --fail --retry 3 -o "$ZIP" "https://services.gradle.org/distributions/gradle-$VERSION-bin.zip"
    else
      wget -O "$ZIP" "https://services.gradle.org/distributions/gradle-$VERSION-bin.zip"
    fi
  fi
  unzip -q -o "$ZIP" -d "$BASE"
fi
exec "$DIR/bin/gradle" "$@"
