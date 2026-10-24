#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# SPDX-FileCopyrightText: 2026 mhammedyildirim
# Runs the extension inside an isolated headless GNOME Shell (own XDG dirs and
# D-Bus, so the desktop session is untouched), screenshots the panel and the
# open menu, and cycles disable/enable.
#
# Usage: tools/shell-test/run.sh [out-dir]
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$(cd "$HERE/../.." && pwd)/stoic-hourglass@mhammedyildirim.github.io
OUT=$(mkdir -p "${1:-$(mktemp -d)}" && cd "${1:-.}" && pwd)
ENV=$OUT/env
SHOTS=$OUT/shots

rm -rf "$ENV" "$SHOTS"
mkdir -p "$ENV"/{data/gnome-shell/extensions,config,cache,state} "$SHOTS"
cp -r "$SRC" "$HERE/shot@test" "$ENV/data/gnome-shell/extensions/"
glib-compile-schemas "$ENV/data/gnome-shell/extensions/stoic-hourglass@mhammedyildirim.github.io/schemas"
# Wayland socket paths must stay under 108 bytes, so the runtime dir is short.
RUN=$(mktemp -d /tmp/sy.XXXXXX)

export XDG_DATA_HOME=$ENV/data XDG_CONFIG_HOME=$ENV/config XDG_CACHE_HOME=$ENV/cache \
       XDG_STATE_HOME=$ENV/state XDG_RUNTIME_DIR=$RUN SHOT_DIR=$SHOTS
unset WAYLAND_DISPLAY DISPLAY DBUS_SESSION_BUS_ADDRESS
dbus-run-session -- bash -c '
  gsettings set org.gnome.shell enabled-extensions "[\"stoic-hourglass@mhammedyildirim.github.io\", \"shot@test\"]"
  gsettings set org.gnome.shell disable-user-extensions false
  gsettings set org.gnome.shell welcome-dialog-last-shown-version "999"
  timeout 60 gnome-shell --headless --wayland --no-x11 --virtual-monitor 1600x900
' > "$OUT/shell.log" 2>&1
status=$?

# Stop helpers the private session left behind (e.g. ibus-daemon).
for pid in $(pgrep -u "$(id -u)"); do
    if { tr '\0' '\n' < "/proc/$pid/environ"; } 2>/dev/null | grep -qx "SHOT_DIR=$SHOTS"; then
        kill "$pid" 2>/dev/null
    fi
done
fusermount3 -u "$RUN/gvfs" 2>/dev/null
rm -rf "$RUN"

grep -E 'SHOT|JS ERROR|stoic-hourglass' "$OUT/shell.log"
echo "shell exit=$status, screenshots in $SHOTS"
grep -q 'SHOT DONE' "$OUT/shell.log" && ! grep -q 'JS ERROR' "$OUT/shell.log"
