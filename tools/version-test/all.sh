#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# SPDX-FileCopyrightText: 2026 mhammedyildirim
# Runs the extension on every supported GNOME release, one distro image each.
V=$(cd "$(dirname "$0")" && pwd)
for x in "g46 ubuntu:24.04 deb" "g47 fedora:41 fedora" "g48 debian:trixie deb" \
         "g49 fedora:43 fedora" "g50 fedora:44 fedora" "g51 fedora:45 fedora"; do
    # shellcheck disable=SC2086
    "$V/run.sh" $x
done
