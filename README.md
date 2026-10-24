# Stoic Hourglass

A pixel-art GNOME Shell extension that shows the progress of the year in the top bar, with a new Stoic quote every day.

- **Panel:** an hourglass whose sand runs down over the year, a season-coloured progress bar and the percentage.
- **Click:** opens a retro window with the year, the precise percentage, the day of the year and the days left, a grid with one row per month and one cell per day (past days in the season's colour, today blinking), and the quote of the day. Click the quote to copy it to the clipboard.
- **Right-click:** opens the preferences, where you can pick the language: Automatic, Turkish or English. Changes apply immediately.
- **Quotes:** 369 English quotes taken from published translations of Marcus Aurelius, Seneca, Epictetus and others, and a separate list of 391 Turkish quotes. Each year shows them in a different order, with no repeats within a year. English translations used: George Long, Gregory Hays, C. R. Haines and A. S. L. Farquharson (Marcus Aurelius); Richard M. Gummere and Aubrey Stewart (Seneca); W. A. Oldfather, Hastings Crossley and T. W. Higginson (Epictetus), collected via Wikiquote and Project Gutenberg.
- **Language:** follows the session language by default (`LANGUAGE`, `LC_MESSAGES`, `LANG`; not the date and number formats): Turkish sessions get Turkish, everything else gets English.
- Everything is drawn with hand-made bitmap fonts (including Turkish letters), independent of the system font. Palette: [Sweetie 16](https://lospec.com/palette-list/sweetie-16) by GrafxKid.
- Animations run only while the window is open and stop when animations are disabled in the system settings.

Supports GNOME Shell 46, 47, 48, 49, 50 and 51.

## Installation

```bash
./install.sh
```

On Wayland, GNOME Shell only picks up new extensions at login: log out and back in once. The same applies to updates; the script copies the files and the new code loads at the next login.

To remove it:

```bash
gnome-extensions disable stoic-hourglass@mhammedyildirim.github.io
rm -rf ~/.local/share/gnome-shell/extensions/stoic-hourglass@mhammedyildirim.github.io
```

## Development

- `[STOIC_HOURGLASS_LANG=tr|en] gjs -m tools/preview.js <out-dir> [YYYY-MM-DD] [zoom] [quote-index]` renders the panel and the window to PNG files, and checks the quote lists (missing glyphs, duplicates, repeats within a year) and the calendar maths (leap years, end of year).
- `tools/shell-test/run.sh [out-dir]` runs the extension inside an isolated headless GNOME Shell, takes screenshots of the panel and the open window, tests copying, the language switch and the preferences window, and cycles disable/enable. It does not touch the desktop session, so it is the way to test on Wayland without logging out.
- `tools/version-test/all.sh` runs the same test in Docker on every supported GNOME release (Ubuntu 24.04 → 46, Fedora 41 → 47, Debian 13 → 48, Fedora 43/44/45 → 49/50/51). Set `WORK=<dir>` to choose where the output goes.

| File | Purpose |
|---|---|
| `extension.js` | Panel button, window, timers, right-click |
| `prefs.js` | Preferences window (language) |
| `pixel.js` | All drawing: hourglass, bar, window, text layout |
| `font.js` | 5x7 and 3x5 bitmap fonts |
| `year.js` | Day and percentage maths, picking the quote of the day |
| `quotes-en.js`, `quotes-tr.js` | English and Turkish quote lists (independent of each other) |
| `strings.js` | Language detection and UI text |
| `schemas/` | GSettings schema for the preferences |

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
