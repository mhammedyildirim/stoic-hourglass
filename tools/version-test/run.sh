#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# SPDX-FileCopyrightText: 2026 mhammedyildirim
# Builds a distro image with gnome-shell and runs the headless harness in it.
# Files go in and out with `docker cp` (Docker Desktop does not share /tmp).
# Usage: run.sh <label> <base-image> <deb|fedora> [LANG]
set -u
V=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$V/../.." && pwd)
WORK=${WORK:-$(mktemp -d)}
label=$1 base=$2 kind=$3 lang=${4:-en_US.UTF-8}
img=stoic-test:$label

if ! docker image inspect "$img" >/dev/null 2>&1; then
    docker build -q -t "$img" --build-arg BASE="$base" -f "$V/Dockerfile.$kind" "$V" > "$WORK/build-$label.log" 2>&1 \
        || { echo "$label: build failed"; tail -5 "$WORK/build-$label.log"; exit 1; }
fi

stage=$WORK/stage-$label out=$WORK/out-$label
rm -rf "$stage" "$out" && mkdir -p "$stage/ext" "$out"
cp "$V/inner.sh" "$stage/"
cp -r $ROOT/stoic-hourglass@mhammedyildirim.github.io \
      $ROOT/tools/shell-test/shot@test "$stage/ext/"

c=$(docker create -e LANG="$lang" -e LIBGL_ALWAYS_SOFTWARE=1 "$img" /stage/inner.sh)
docker cp "$stage" "$c:/stage" >/dev/null
docker start -a "$c" >/dev/null
docker cp "$c:/out/." "$out" >/dev/null
docker rm "$c" >/dev/null

echo "== $label: $(cat "$out/version.txt" 2>/dev/null)"
grep -E 'SHOT|JS ERROR|stoic-hourglass|exit=' "$out/shell.log" | cut -c1-220
