// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// User-facing text in Turkish and English. The language follows the session
// language unless the user picks one in the preferences; STOIC_HOURGLASS_LANG=tr|en
// overrides both (used by the tools).
import GLib from 'gi://GLib';

export function systemLanguage() {
    const name = GLib.get_language_names()[0] || 'C';
    return name.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const TR = {
    monthInitials: ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'],
    dayOfYear: n => `${n}. GÜN`,
    daysLeft: n => (n > 0 ? `${n} GÜN KALDI` : 'SON GÜN'),
    percent: value => `%${value}`,
    decimal: value => value.toFixed(1).replace('.', ','),
    upper: text => text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(),
    copied: 'KOPYALANDI',
    progress: pct => `Yıl ilerlemesi: %${pct}`,
    prefsGroup: 'Görünüm',
    prefsLanguage: 'Dil',
    prefsLanguageHint: 'Panelde ve kartta kullanılacak dil',
    prefsAuto: 'Otomatik (sistem dili)',
};

const EN = {
    monthInitials: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
    dayOfYear: n => `DAY ${n}`,
    daysLeft: n => {
        if (n <= 0)
            return 'LAST DAY';
        return n === 1 ? '1 DAY LEFT' : `${n} DAYS LEFT`;
    },
    percent: value => `${value}%`,
    decimal: value => value.toFixed(1),
    upper: text => text.toUpperCase(),
    copied: 'COPIED',
    progress: pct => `Year progress: ${pct}%`,
    prefsGroup: 'Appearance',
    prefsLanguage: 'Language',
    prefsLanguageHint: 'Language used in the panel and the card',
    prefsAuto: 'Automatic (system language)',
};

export let LANG;
export let TEXT;
export let MONTH_INITIALS;

// choice: 'auto', 'tr' or 'en'.
export function setLanguage(choice = 'auto') {
    const forced = GLib.getenv('STOIC_HOURGLASS_LANG');
    LANG = forced || (choice === 'tr' || choice === 'en' ? choice : systemLanguage());
    TEXT = LANG === 'tr' ? TR : EN;
    MONTH_INITIALS = TEXT.monthInitials;
}

setLanguage();
