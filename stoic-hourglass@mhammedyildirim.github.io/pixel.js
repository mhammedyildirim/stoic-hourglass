// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Pixel-art renderer for the panel widget and the popup card.
//
// All geometry lives on an integer grid of "units". Callers pass the size of
// one unit in device pixels, which keeps every edge crisp at any scale.
import Cairo from 'cairo';

import {BIG, TINY} from './font.js';
import {MONTH_INITIALS, TEXT} from './strings.js';
import {daysInMonth} from './year.js';

// Logical pixels per unit.
export const UNIT_PX = 2;

// Sweetie 16 palette by GrafxKid.
const C = {
    night: '#1a1c2c',
    red: '#b13e53',
    orange: '#ef7d57',
    sand: '#ffcd75',
    lime: '#a7f070',
    green: '#38b764',
    teal: '#257179',
    blue: '#3b5dc9',
    sky: '#41a6f6',
    cyan: '#73eff7',
    white: '#f4f4f4',
    silver: '#94b0c2',
    slate: '#566c86',
    ink: '#333c57',
};

const SEASONS = {
    winter: {hi: C.cyan, base: C.sky, lo: C.blue},
    spring: {hi: C.lime, base: C.green, lo: C.teal},
    summer: {hi: C.white, base: C.sand, lo: C.orange},
    autumn: {hi: C.sand, base: C.orange, lo: C.red},
};

function seasonOf(month) {
    if (month === 11 || month <= 1)
        return SEASONS.winter;
    if (month <= 4)
        return SEASONS.spring;
    if (month <= 7)
        return SEASONS.summer;
    return SEASONS.autumn;
}

function rgba(color) {
    if (typeof color !== 'string')
        return color;
    const n = parseInt(color.slice(1), 16);
    return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, 1];
}

// Collects unit rectangles per color and fills each color in one go.
class Painter {
    constructor(cr, unit) {
        this._cr = cr;
        this._unit = unit;
        this._batches = new Map();
        cr.setAntialias(Cairo.Antialias.NONE);
    }

    rect(color, x, y, w = 1, h = 1) {
        const key = typeof color === 'string' ? color : color.join(',');
        let batch = this._batches.get(key);
        if (!batch) {
            batch = {color, rects: []};
            this._batches.set(key, batch);
        }
        batch.rects.push(x, y, w, h);
    }

    flush() {
        const cr = this._cr;
        const u = this._unit;
        for (const {color, rects} of this._batches.values()) {
            cr.setSourceRGBA(...rgba(color));
            for (let i = 0; i < rects.length; i += 4)
                cr.rectangle(rects[i] * u, rects[i + 1] * u, rects[i + 2] * u, rects[i + 3] * u);
            cr.fill();
        }
        this._batches.clear();
    }
}

function compileFont(font) {
    const glyphs = new Map();
    for (const [ch, [top, art]] of Object.entries(font.glyphs)) {
        const rows = art.split('|');
        const runs = [];
        rows.forEach((row, dy) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== '#')
                    continue;
                let end = x;
                while (row[end] === '#')
                    end++;
                runs.push([x, top + dy, end - x]);
                x = end;
            }
        });
        glyphs.set(ch, {width: rows[0].length, runs});
    }
    return {...font, glyphs};
}

const big = compileFont(BIG);
const tiny = compileFont(TINY);

const ALIASES = {'“': '"', '”': '"', '„': '"', '«': '"', '»': '"', '‘': "'", '’': "'"};

const isSpace = ch => ch === ' ' || ch === ' ';

function glyph(font, ch) {
    return font.glyphs.get(ALIASES[ch] ?? ch) ?? font.glyphs.get('?');
}

function measureText(font, text) {
    let width = 0;
    for (const ch of text)
        width += (isSpace(ch) ? font.spaceWidth : glyph(font, ch).width) + font.spacing;
    return Math.max(0, width - font.spacing);
}

// Greedy word wrap. A single word wider than maxWidth keeps its own line.
function wrapText(font, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measureText(font, candidate) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line)
        lines.push(line);
    return lines;
}

// capY is the row where capital letters start.
function drawText(p, font, text, x, capY, color) {
    const y = capY - font.capTop;
    for (const ch of text) {
        if (isSpace(ch)) {
            x += font.spaceWidth + font.spacing;
            continue;
        }
        const g = glyph(font, ch);
        for (const [gx, gy, w] of g.runs)
            p.rect(color, x + gx, y + gy, w, 1);
        x += g.width + font.spacing;
    }
}

function hourglassSize(bulb, caps) {
    return {width: 2 * bulb + 3, height: 2 * bulb + 1 + 2 * caps};
}

// Cells of a bulb in the order sand settles into them: rows are given
// bottom-most first, each row fills from the centre outwards.
function bulbCells(cx, rows) {
    const cells = [];
    for (const [y, half] of rows) {
        cells.push([cx, y]);
        for (let d = 1; d <= half; d++)
            cells.push([cx - d, y], [cx + d, y]);
    }
    return cells;
}

// Occupied sand cells ("x,y") and the top row of the pile under the neck.
function sandCells(cx, topRows, bottomRows, capacity, progress, pile) {
    const upper = Math.round(capacity * (1 - progress));
    const sand = new Set();
    for (const [sx, sy] of bulbCells(cx, topRows).slice(0, upper))
        sand.add(`${sx},${sy}`);
    for (const [sx, sy] of bulbCells(cx, bottomRows).slice(0, capacity - upper)) {
        sand.add(`${sx},${sy}`);
        if (sx === cx)
            pile = Math.min(pile, sy);
    }
    return {sand, pile};
}

// Draws an hourglass whose sand has drained by `progress`. With frame >= 0 the
// falling stream is animated.
function drawHourglass(p, x, y, {bulb, caps, progress, frame, look}) {
    const {width, height} = hourglassSize(bulb, caps);
    const cx = bulb + 1;
    const neck = caps + bulb;
    const floor = height - caps - 1;

    // Thick caps get rounded outer edges.
    for (let i = 0; i < caps; i++) {
        const topInset = caps > 1 && i === 0 ? 1 : 0;
        const bottomInset = caps > 1 && i === caps - 1 ? 1 : 0;
        p.rect(look.cap[i], x + topInset, y + i, width - 2 * topInset, 1);
        p.rect(look.cap[i], x + bottomInset, y + height - caps + i, width - 2 * bottomInset, 1);
    }

    const topRows = [];
    const bottomRows = [];
    for (let i = 0; i < bulb; i++) {
        topRows.push([neck - 1 - i, i]);
        bottomRows.push([floor - i, bulb - 1 - i]);
    }
    for (const [row, half] of [...topRows, ...bottomRows]) {
        p.rect(look.glass, x + cx - half - 1, y + row);
        p.rect(look.glass, x + cx + half + 1, y + row);
    }

    const {sand, pile} = sandCells(cx, topRows, bottomRows, bulb * bulb, progress, floor + 1);
    for (const cell of sand) {
        const [sx, sy] = cell.split(',').map(Number);
        p.rect(look.sand, x + sx, y + sy);
    }

    const flowing = progress > 0 && progress < 1;
    p.rect(flowing ? look.sand : look.glass, x + cx, y + neck);
    if (flowing && frame >= 0) {
        for (let row = neck + 1; row < pile; row++) {
            if ((((row - frame) % 3) + 3) % 3 !== 0)
                p.rect(look.sand, x + cx, y + row);
        }
    }

    if (look.shine) {
        for (const [row, half] of topRows.slice(-3, -1)) {
            if (!sand.has(`${cx - half},${row}`))
                p.rect(look.shine, x + cx - half, y + row);
        }
    }
}

const PANEL = {bulb: 3, caps: 1, gap: 3, barCols: 24};
const PANEL_GLASS = {cap: [C.orange], glass: C.silver, sand: C.sand};

export function layoutPanel(state) {
    const glass = hourglassSize(PANEL.bulb, PANEL.caps);
    const pct = Math.floor(state.progress * 100);
    const label = TEXT.percent(pct);
    const barX = glass.width + PANEL.gap;
    const textX = barX + PANEL.barCols + 2 + PANEL.gap;
    const filled = Math.floor(state.progress * PANEL.barCols);
    const sand = Math.round(PANEL.bulb ** 2 * (1 - state.progress));

    return {
        width: textX + measureText(tiny, label),
        height: glass.height,
        progress: state.progress,
        pct,
        label,
        barX,
        textX,
        key: `${label}:${filled}:${sand}`,
    };
}

// Bar with a frame and one column per 1/cols of the year, shaded per season.
function drawBar(p, x, y, cols, progress, frame, empty) {
    const w = cols + 2;
    p.rect(frame, x + 1, y, w - 2, 1);
    p.rect(frame, x + 1, y + 4, w - 2, 1);
    p.rect(frame, x, y + 1, 1, 3);
    p.rect(frame, x + w - 1, y + 1, 1, 3);

    const filled = Math.floor(progress * cols);
    for (let i = 0; i < cols; i++) {
        const cx = x + 1 + i;
        if (i < filled) {
            const season = seasonOf(Math.floor((i * 12) / cols));
            p.rect(season.hi, cx, y + 1);
            p.rect(season.base, cx, y + 2);
            p.rect(season.lo, cx, y + 3);
        } else {
            p.rect(empty, cx, y + 1, 1, 3);
        }
    }
}

// fg is the panel text color as [r, g, b, a] in 0..1.
export function drawPanel(cr, L, unit, fg) {
    const p = new Painter(cr, unit);
    drawHourglass(p, 0, 0, {
        bulb: PANEL.bulb,
        caps: PANEL.caps,
        progress: L.progress,
        frame: -1,
        look: PANEL_GLASS,
    });
    drawBar(p, L.barX, 2, PANEL.barCols, L.progress, fg, [fg[0], fg[1], fg[2], fg[3] * 0.22]);
    drawText(p, tiny, L.label, L.textX, 2, fg);
    p.flush();
}

const CARD = {
    border: 2,
    pad: 6,
    content: 162,
    bulb: 5,
    caps: 2,
    grid: {label: 5, gap: 3, cell: 4, pitchX: 5, pitchY: 6},
};
const CARD_GLASS = {cap: [C.orange, C.red], glass: C.silver, sand: C.sand, shine: C.white};

export function layoutCard(state, quote) {
    const {border, pad, content, grid} = CARD;
    const x0 = border + pad;
    const glass = hourglassSize(CARD.bulb, CARD.caps);
    const percent = TEXT.percent(TEXT.decimal(Math.floor(state.progress * 1000) / 10));

    const headerY = x0;
    const gridY = headerY + glass.height + 7;
    const dividerY = gridY + 11 * grid.pitchY + grid.cell + 7;
    const quoteY = dividerY + 8;
    const lines = wrapText(big, quote.text, content);
    const authorY = quoteY + (lines.length - 1) * big.lineHeight + 14;
    const source = quote.source ? TEXT.upper(quote.source) : '';
    const sourceY = authorY + 8;

    return {
        width: content + 2 * x0,
        height: (source ? sourceY : authorY) + 6 + pad + border,
        state,
        x0,
        right: x0 + content,
        content,
        headerY,
        textX: x0 + glass.width + 6,
        percent,
        dayLabel: TEXT.dayOfYear(state.dayOfYear),
        leftLabel: TEXT.daysLeft(state.daysLeft),
        gridY,
        dividerY,
        quoteY,
        lines,
        author: `— ${TEXT.upper(quote.author)}`,
        authorY,
        source,
        sourceY,
        key: `${state.year}:${state.dayOfYear}:${percent}`,
    };
}

// Window with a double pixel border and rounded corners.
function drawWindow(p, w, h) {
    p.rect(C.night, 2, 2, w - 4, h - 4);
    p.flush();

    p.rect(C.white, 2, 0, w - 4, 1);
    p.rect(C.white, 2, h - 1, w - 4, 1);
    p.rect(C.white, 0, 2, 1, h - 4);
    p.rect(C.white, w - 1, 2, 1, h - 4);
    p.rect(C.white, 1, 1);
    p.rect(C.white, w - 2, 1);
    p.rect(C.white, 1, h - 2);
    p.rect(C.white, w - 2, h - 2);

    p.rect(C.slate, 2, 1, w - 4, 1);
    p.rect(C.slate, 2, h - 2, w - 4, 1);
    p.rect(C.slate, 1, 2, 1, h - 4);
    p.rect(C.slate, w - 2, 2, 1, h - 4);
}

// One row per month, one cell per day: past days in the season color,
// today highlighted, the rest of the year dark.
function drawYearGrid(p, L, blink) {
    const {grid} = CARD;
    const s = L.state;
    const cellX = L.x0 + grid.label + grid.gap;

    for (let m = 0; m < 12; m++) {
        const y = L.gridY + m * grid.pitchY;
        const initial = MONTH_INITIALS[m];
        const labelX = L.x0 + Math.floor((grid.label - measureText(tiny, initial)) / 2);
        const labelColor = m === s.month ? C.white : m < s.month ? C.silver : C.slate;
        drawText(p, tiny, initial, labelX, y, labelColor);

        const season = seasonOf(m);
        const days = daysInMonth(s.year, m);
        for (let d = 1; d <= days; d++) {
            let color = C.ink;
            if (m < s.month || (m === s.month && d < s.date))
                color = season.base;
            else if (m === s.month && d === s.date)
                color = blink ? season.hi : C.white;
            p.rect(color, cellX + (d - 1) * grid.pitchX, y, grid.cell, grid.cell);
        }
    }
}

// Whether a point (in card units) is on the quote or its attribution.
export function inQuoteArea(L, x, y) {
    const bottom = (L.source ? L.sourceY : L.authorY) + 6;
    return x >= L.x0 && x <= L.right && y >= L.quoteY - 3 && y <= bottom;
}

// frame < 0 draws a still image; otherwise it drives the small animations.
// `copied` shows a short confirmation next to the attribution.
export function drawCard(cr, L, unit, frame, copied = false) {
    const p = new Painter(cr, unit);
    const s = L.state;

    drawWindow(p, L.width, L.height);

    drawHourglass(p, L.x0, L.headerY, {
        bulb: CARD.bulb,
        caps: CARD.caps,
        progress: s.progress,
        frame,
        look: CARD_GLASS,
    });
    drawText(p, big, String(s.year), L.textX, L.headerY, C.sand);
    drawText(p, big, L.percent, L.right - measureText(big, L.percent), L.headerY, C.white);
    drawText(p, tiny, L.dayLabel, L.textX, L.headerY + 10, C.silver);
    drawText(p, tiny, L.leftLabel, L.right - measureText(tiny, L.leftLabel), L.headerY + 10, C.silver);

    drawYearGrid(p, L, frame >= 0 && Math.floor(frame / 2) % 2 === 1);

    for (let x = 0; x < L.content; x += 2)
        p.rect(C.slate, L.x0 + x, L.dividerY);

    L.lines.forEach((line, i) => {
        drawText(p, big, line, L.x0, L.quoteY + i * big.lineHeight, C.white);
    });
    drawText(p, tiny, L.author, L.right - measureText(tiny, L.author), L.authorY, C.sand);
    if (copied)
        drawText(p, tiny, TEXT.copied, L.x0, L.authorY, C.lime);
    if (L.source)
        drawText(p, tiny, L.source, L.right - measureText(tiny, L.source), L.sourceY, C.slate);

    p.flush();
}
