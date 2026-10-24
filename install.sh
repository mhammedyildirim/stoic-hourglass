#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# SPDX-FileCopyrightText: 2026 mhammedyildirim
# Installs Stoic Hourglass for the current user and enables it.
set -euo pipefail

UUID=stoic-hourglass@mhammedyildirim.github.io
SRC=$(cd "$(dirname "$0")" && pwd)/$UUID
DEST=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID

rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -r "$SRC" "$DEST"
glib-compile-schemas "$DEST/schemas"

# The shell only discovers extensions at start-up, so `gnome-extensions enable`
# cannot see a fresh install yet. Add the UUID to the enabled list directly;
# the running shell ignores unknown UUIDs and loads it on the next login.
enabled=$(gsettings get org.gnome.shell enabled-extensions)
if [[ $enabled != *"'$UUID'"* ]]; then
    if [[ $enabled == "@as []" || $enabled == "[]" ]]; then
        enabled="['$UUID']"
    else
        enabled="${enabled%]}, '$UUID']"
    fi
    gsettings set org.gnome.shell enabled-extensions "$enabled"
fi

echo "Installed to $DEST"
if [[ ${XDG_SESSION_TYPE:-} == wayland ]]; then
    echo "Log out and back in to load it (Wayland cannot restart GNOME Shell in place)."
else
    echo "Restart GNOME Shell to load it: Alt+F2, type r, press Enter."
fi
