// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Preferences window: language choice.
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {TEXT} from './strings.js';

const LANGUAGES = ['auto', 'tr', 'en'];

export default class StoicHourglassPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const row = new Adw.ComboRow({
            title: TEXT.prefsLanguage,
            subtitle: TEXT.prefsLanguageHint,
            model: Gtk.StringList.new([TEXT.prefsAuto, 'Türkçe', 'English']),
            selected: Math.max(0, LANGUAGES.indexOf(settings.get_string('language'))),
        });
        row.connect('notify::selected', () => settings.set_string('language', LANGUAGES[row.selected]));

        const group = new Adw.PreferencesGroup({title: TEXT.prefsGroup});
        group.add(row);
        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
        window.set_default_size(600, 280);
    }
}
