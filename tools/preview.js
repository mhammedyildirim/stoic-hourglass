// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Renders preview PNGs of the panel widget and the popup card outside of
// GNOME Shell, and sanity-checks the quote list and the calendar math.
//
// Usage: [STOIC_HOURGLASS_LANG=tr|en] gjs -m tools/preview.js <out-dir> [YYYY-MM-DD] [zoom] [quote-index]
import Cairo from 'cairo';
import System from 'system';

import {
    UNIT_PX, drawCard, drawPanel, layoutCard, layoutPanel,
} from '../stoic-hourglass@mhammedyildirim.github.io/pixel.js';
import {QUOTES as QUOTES_EN} from '../stoic-hourglass@mhammedyildirim.github.io/quotes-en.js';
import {QUOTES as QUOTES_TR} from '../stoic-hourglass@mhammedyildirim.github.io/quotes-tr.js';
import {BIG, TINY} from '../stoic-hourglass@mhammedyildirim.github.io/font.js';
import {LANG, TEXT} from '../stoic-hourglass@mhammedyildirim.github.io/strings.js';
import {quoteForDay, yearState} from '../stoic-hourglass@mhammedyildirim.github.io/year.js';

const QUOTES = LANG === 'tr' ? QUOTES_TR : QUOTES_EN;

const [outDir = '.', dateArg, zoomArg, quoteArg] = System.programArgs;
const now = dateArg ? new Date(`${dateArg}T14:30:00`) : new Date();
const ZOOM = Number(zoomArg ?? 2);
const unit = UNIT_PX * ZOOM;
let failures = 0;

function check(ok, message) {
    if (!ok) {
        failures++;
        print(`FAIL: ${message}`);
    }
}

function render(name, width, height, background, paint) {
    const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
    const cr = new Cairo.Context(surface);
    cr.setSourceRGB(...background);
    cr.paint();
    paint(cr);
    surface.writeToPNG(`${outDir}/${name}`);
    cr.$dispose();
    print(`wrote ${outDir}/${name} (${width}x${height})`);
}

// Panel: a slice of the black GNOME top bar (32 logical px high).
const state = yearState(now);
const panel = layoutPanel(state);
const barH = 32 * ZOOM;
render('panel.png', (panel.width + 24) * unit, barH, [0, 0, 0], cr => {
    cr.translate(12 * unit, Math.round((barH - panel.height * unit) / 2));
    drawPanel(cr, panel, unit, [1, 1, 1, 1]);
});

// Card on a popup-colored background, still and one animation frame.
const quote = quoteArg ? QUOTES[Number(quoteArg)] : quoteForDay(state.year, state.dayOfYear);
const card = layoutCard(state, quote);
for (const [name, frame] of [['card.png', -1], ['card-frame.png', 3]]) {
    render(name, (card.width + 8) * unit, (card.height + 8) * unit, [0.208, 0.208, 0.208], cr => {
        cr.translate(4 * unit, 4 * unit);
        drawCard(cr, card, unit, frame);
    });
}
print(`today: day ${state.dayOfYear}/${state.daysInYear}, ${(state.progress * 100).toFixed(2)}%, quote by ${quote.author}`);

// Same aliases and spaces as pixel.js accepts.
const ALIASES = {'“': '"', '”': '"', '„': '"', '«': '"', '»': '"', '‘': "'", '’': "'"};
const hasGlyph = (font, ch) => ch === ' ' || ch === '\u00a0' || (ALIASES[ch] ?? ch) in font.glyphs;

// Checks.

const texts = new Set();
let longest = {lines: 0};
for (const [i, q] of QUOTES.entries()) {
    check(q.text && q.author, `quote ${i} is missing text or author`);
    check(!texts.has(q.text), `duplicate quote ${i}: ${q.text.slice(0, 40)}`);
    texts.add(q.text);
    for (const ch of q.text)
        check(hasGlyph(BIG, ch), `quote ${i}: no big glyph for ${JSON.stringify(ch)}`);
    for (const ch of TEXT.upper(`— ${q.author} ${q.source ?? ''}`))
        check(hasGlyph(TINY, ch), `quote ${i}: no tiny glyph for ${JSON.stringify(ch)}`);
    const lines = layoutCard(state, q).lines.length;
    if (lines > longest.lines)
        longest = {lines, i};
}
print(`lang: ${LANG}, quotes: ${QUOTES.length}, longest wraps to ${longest.lines} lines (#${longest.i})`);

for (const year of [2026, 2027, 2028]) {
    const days = yearState(new Date(year, 11, 31, 12)).daysInYear;
    const seen = new Set();
    for (let d = 1; d <= days; d++)
        seen.add(quoteForDay(year, d));
    if (QUOTES.length >= days)
        check(seen.size === days, `${year}: ${seen.size} distinct quotes for ${days} days`);
}

const cases = [
    [new Date(2026, 0, 1, 0, 0, 0), 1, 365, 364],
    [new Date(2026, 11, 31, 23, 59, 59), 365, 365, 0],
    [new Date(2028, 1, 29, 12), 60, 366, 306],
    [new Date(2028, 11, 31, 12), 366, 366, 0],
    [new Date(2026, 2, 29, 12), 88, 365, 277],
];
for (const [date, day, total, left] of cases) {
    const s = yearState(date);
    check(s.dayOfYear === day && s.daysInYear === total && s.daysLeft === left,
        `${date.toISOString()}: got day ${s.dayOfYear}/${s.daysInYear} left ${s.daysLeft}`);
    check(s.progress >= 0 && s.progress < 1, `${date.toISOString()}: progress ${s.progress}`);
}

print(failures ? `${failures} check(s) failed` : 'all checks passed');
System.exit(failures ? 1 : 0);
