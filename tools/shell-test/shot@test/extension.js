// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Test harness for tools/shell-test/run.sh: screenshots the stoic-hourglass
// indicator and its menu, then cycles disable/enable.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const OUT = GLib.getenv('SHOT_DIR');
const UUID = 'stoic-hourglass@mhammedyildirim.github.io';

const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

async function shot(name) {
    const shooter = new Shell.Screenshot();
    const stream = Gio.File.new_for_path(`${OUT}/${name}`).replace(null, false, Gio.FileCreateFlags.NONE, null);
    await new Promise((resolve, reject) => {
        shooter.screenshot(false, stream, (obj, res) => {
            try {
                obj.screenshot_finish(res);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    });
    stream.close(null);
    console.log(`SHOT saved ${name}`);
}

export default class Harness extends Extension {
    enable() {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
            this._run().catch(e => console.log(`SHOT-ERROR ${e}\n${e.stack}`))
                .finally(() => global.context.terminate());
            return GLib.SOURCE_REMOVE;
        });
    }

    async _run() {
        Main.overview.hide();
        await wait(1500);
        const ind = Main.panel.statusArea[UUID];
        console.log(`SHOT indicator=${!!ind} size=${ind?.width}x${ind?.height} name="${ind?.accessible_name}"`);
        await shot('panel.png');
        ind.menu.open();
        await wait(1300);
        await shot('menu.png');

        // Click the middle of the quote and check the clipboard.
        const card = ind._card;
        const L = ind._cardLayout;
        const unit = card.width / L.width;
        const [cx, cy] = card.get_transformed_position();
        const at = (ux, uy) => ({get_coords: () => [cx + ux * unit, cy + uy * unit], get_button: () => 1});
        console.log(`SHOT outside-quote=${ind._quotePoint(at(L.x0 + 10, L.gridY + 5))}`);
        ind._onCardClick(at(L.x0 + 20, L.quoteY + 4));
        const copied = await new Promise(resolve =>
            St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_c, text) => resolve(text)));
        const expected = '"' + ind._quote.text + '" — ' + ind._quote.author;
        console.log(`SHOT clipboard=${copied === expected} menu-open=${ind.menu.isOpen}`);
        await wait(300);
        await shot('copied.png');
        ind.menu.close();
        await wait(400);
        // Switch the language at runtime, then back.
        ind._settings.set_string('language', 'tr');
        await wait(300);
        console.log(`SHOT lang-tr name="${ind.accessible_name}"`);
        ind.menu.open();
        await wait(800);
        await shot('menu-tr.png');
        ind.menu.close();
        ind._settings.set_string('language', 'en');
        await wait(300);
        console.log(`SHOT lang-en name="${ind.accessible_name}"`);
        ind._settings.set_string('language', 'auto');

        // Same call the right click makes.
        Main.extensionManager.lookup(UUID).stateObj.openPreferences();
        let prefsWindow = null;
        for (let i = 0; i < 40 && !prefsWindow; i++) {
            await wait(250);
            prefsWindow = global.get_window_actors().map(a => a.meta_window)
                .find(w => w.get_title() === 'Stoic Hourglass');
        }
        console.log(`SHOT prefs-window=${!!prefsWindow}`);
        await wait(500);
        await shot('prefs.png');
        prefsWindow?.delete(global.get_current_time());

        Main.extensionManager.disableExtension(UUID);
        await wait(400);
        console.log(`SHOT after-disable indicator=${!!Main.panel.statusArea[UUID]}`);
        Main.extensionManager.enableExtension(UUID);
        await wait(800);
        const again = Main.panel.statusArea[UUID];
        console.log(`SHOT after-enable indicator=${!!again}`);
        again.menu.open();
        await wait(700);
        again.menu.close();
        await wait(300);
        console.log('SHOT DONE');
    }

    disable() {}
}
