#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# SPDX-FileCopyrightText: 2026 mhammedyildirim
# Runs inside a test container: headless gnome-shell with the extension + harness.
set -u
export HOME=/tmp/home XDG_DATA_HOME=/tmp/home/data XDG_CONFIG_HOME=/tmp/home/config \
       XDG_CACHE_HOME=/tmp/home/cache XDG_RUNTIME_DIR=/tmp/run SHOT_DIR=/out LANG=${LANG:-en_US.UTF-8}
mkdir -p $XDG_DATA_HOME/gnome-shell/extensions $XDG_CONFIG_HOME $XDG_CACHE_HOME $XDG_RUNTIME_DIR /out
chmod 700 $XDG_RUNTIME_DIR
cp -r /stage/ext/stoic-hourglass@mhammedyildirim.github.io /stage/ext/shot@test $XDG_DATA_HOME/gnome-shell/extensions/
glib-compile-schemas $XDG_DATA_HOME/gnome-shell/extensions/stoic-hourglass@mhammedyildirim.github.io/schemas
gnome-shell --version > /out/version.txt
# The shell talks to the system bus (logind, time limits); give it one.
rm -rf /run/systemd/seats  # no logind here; makes the shell use its dummy login manager
mkdir -p /run/dbus && dbus-uuidgen --ensure && dbus-daemon --system --fork
dbus-run-session -- bash -c '
  gsettings set org.gnome.shell enabled-extensions "[\"stoic-hourglass@mhammedyildirim.github.io\", \"shot@test\"]"
  gsettings set org.gnome.shell disable-user-extensions false
  gsettings set org.gnome.shell disable-extension-version-validation true
  gsettings set org.gnome.shell welcome-dialog-last-shown-version "999"
  timeout 90 gnome-shell --headless --wayland --no-x11 --virtual-monitor 1600x900
' > /out/shell.log 2>&1
echo "exit=$?" >> /out/shell.log
