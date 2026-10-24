// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Calendar math and the daily quote pick.
import {QUOTES as QUOTES_EN} from './quotes-en.js';
import {QUOTES as QUOTES_TR} from './quotes-tr.js';
import {LANG} from './strings.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function yearState(now) {
    const year = now.getFullYear();
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    const progress = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
    // Day counts use UTC midnights so DST shifts cannot skew them.
    const today = Date.UTC(year, now.getMonth(), now.getDate());
    const dayOfYear = Math.round((today - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
    const daysInYear = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS);

    return {
        year,
        month: now.getMonth(),
        date: now.getDate(),
        dayOfYear,
        daysInYear,
        daysLeft: daysInYear - dayOfYear,
        progress,
    };
}

export function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// mulberry32: tiny deterministic PRNG, good enough for a shuffle.
function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Every year gets its own shuffled order, so a quote never repeats within a
// year (with >= 366 quotes) and the same date shows a new quote next year.
function yearOrder(year, quotes) {
    const random = prng(year * 2654435761);
    const order = quotes.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

export function quoteForDay(year, dayOfYear) {
    const quotes = LANG === 'tr' ? QUOTES_TR : QUOTES_EN;
    const order = yearOrder(year, quotes);
    return quotes[order[(dayOfYear - 1) % order.length]];
}
