// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 mhammedyildirim
// Stoic Hourglass: pixel-art year progress in the top bar and a daily Stoic quote.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {UNIT_PX, drawCard, drawPanel, inQuoteArea, layoutCard, layoutPanel} from './pixel.js';
import {TEXT, setLanguage} from './strings.js';
import {quoteForDay, yearState} from './year.js';

const REFRESH_SECONDS = 30;
const FRAME_MS = 250;
const COPIED_MS = 1500;

// Sizes go through CSS so St applies the global scale factor for us.
function applyLayout(area, next, prev) {
    if (!prev || prev.width !== next.width || prev.height !== next.height)
        area.set_style(`width: ${next.width * UNIT_PX}px; height: ${next.height * UNIT_PX}px;`);
    if (!prev || prev.key !== next.key)
        area.queue_repaint();
}

const StoicHourglassIndicator = GObject.registerClass(
class StoicHourglassIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, 'Stoic Hourglass');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._settings.connectObject('changed::language', () => this._applyLanguage(), this);
        setLanguage(this._settings.get_string('language'));

        this._state = null;
        this._quote = null;
        this._panelLayout = null;
        this._cardLayout = null;
        this._frame = -1;
        this._frameId = 0;
        this._copiedId = 0;
        this._handCursor = false;

        this._panelArea = new St.DrawingArea({y_align: Clutter.ActorAlign.CENTER});
        this._panelArea.connect('repaint', area => this._repaintPanel(area));
        this.add_child(this._panelArea);

        this.menu.box.add_style_class_name('stoic-hourglass-menu');
        // Clicking the quote copies it.
        this._card = new St.DrawingArea({reactive: true});
        this._card.connect('repaint', area => this._repaintCard(area));
        this._card.connect('motion-event', (_area, event) => this._onCardMotion(event));
        this._card.connect('leave-event', () => this._setHandCursor(false));
        this._card.connect('button-release-event', (_area, event) => this._onCardClick(event));
        const cardItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'stoic-hourglass-card-item',
        });
        cardItem.add_child(this._card);
        this.menu.addMenuItem(cardItem);

        this._menuToggledId = this.menu.connect('open-state-changed', (_menu, open) => this._onMenuToggled(open));

        this._refreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_SECONDS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    _applyLanguage() {
        setLanguage(this._settings.get_string('language'));
        this._state = null;
        this._refresh();
        this._panelArea.queue_repaint();
        this._card.queue_repaint();
    }

    // Right click opens the preferences; other clicks behave as usual.
    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS && event.get_button() === Clutter.BUTTON_SECONDARY) {
            this.menu.close();
            this._extension.openPreferences();
            return Clutter.EVENT_STOP;
        }
        return super.vfunc_event(event);
    }

    _refresh() {
        const state = yearState(new Date());
        if (!this._state || this._state.year !== state.year || this._state.dayOfYear !== state.dayOfYear) {
            this._quote = quoteForDay(state.year, state.dayOfYear);
            this._card.accessible_name = `${this._quote.text} — ${this._quote.author}`;
        }
        this._state = state;

        const panel = layoutPanel(state);
        const prevPanel = this._panelLayout;
        this._panelLayout = panel;
        applyLayout(this._panelArea, panel, prevPanel);
        this.accessible_name = TEXT.progress(panel.pct);

        const card = layoutCard(state, this._quote);
        const prevCard = this._cardLayout;
        this._cardLayout = card;
        applyLayout(this._card, card, prevCard);
    }

    _repaintPanel(area) {
        if (!this._panelLayout)
            return;
        const cr = area.get_context();
        try {
            const [width] = area.get_surface_size();
            const fg = area.get_theme_node().get_foreground_color();
            drawPanel(cr, this._panelLayout, width / this._panelLayout.width,
                [fg.red / 255, fg.green / 255, fg.blue / 255, fg.alpha / 255]);
        } finally {
            cr.$dispose();
        }
    }

    _repaintCard(area) {
        if (!this._cardLayout)
            return;
        const cr = area.get_context();
        try {
            const [width] = area.get_surface_size();
            drawCard(cr, this._cardLayout, width / this._cardLayout.width, this._frame, this._copiedId !== 0);
        } finally {
            cr.$dispose();
        }
    }

    _onMenuToggled(open) {
        if (!open) {
            this._stopAnimation();
            this._setHandCursor(false);
            this._card.queue_repaint();
            return;
        }
        this._refresh();
        if (St.Settings.get().enable_animations && !this._frameId) {
            this._frame = 0;
            this._frameId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FRAME_MS, () => {
                this._frame++;
                this._card.queue_repaint();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    _stopAnimation() {
        if (this._frameId) {
            GLib.source_remove(this._frameId);
            this._frameId = 0;
        }
        this._frame = -1;
    }

    // Whether the event happened on the quote text or its attribution.
    _quotePoint(event) {
        const [x, y] = event.get_coords();
        const [ok, lx, ly] = this._card.transform_stage_point(x, y);
        if (!ok)
            return false;
        const unit = this._card.width / this._cardLayout.width;
        return inQuoteArea(this._cardLayout, lx / unit, ly / unit);
    }

    _onCardMotion(event) {
        this._setHandCursor(this._quotePoint(event));
        return Clutter.EVENT_PROPAGATE;
    }

    _setHandCursor(on) {
        if (on === this._handCursor)
            return;
        this._handCursor = on;
        global.display.set_cursor(on ? Meta.Cursor.POINTING_HAND : Meta.Cursor.DEFAULT);
    }

    _onCardClick(event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._quotePoint(event))
            return Clutter.EVENT_PROPAGATE;

        const {text, author} = this._quote;
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, `"${text}" — ${author}`);

        if (this._copiedId)
            GLib.source_remove(this._copiedId);
        this._copiedId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, COPIED_MS, () => {
            this._copiedId = 0;
            this._card.queue_repaint();
            return GLib.SOURCE_REMOVE;
        });
        this._card.queue_repaint();
        return Clutter.EVENT_STOP;
    }

    destroy() {
        if (this._refreshId) {
            GLib.source_remove(this._refreshId);
            this._refreshId = 0;
        }
        if (this._copiedId) {
            GLib.source_remove(this._copiedId);
            this._copiedId = 0;
        }
        this._stopAnimation();
        this._setHandCursor(false);
        this.menu.disconnect(this._menuToggledId);
        this._settings.disconnectObject(this);
        this._settings = null;
        super.destroy();
    }
});

export default class StoicHourglassExtension extends Extension {
    enable() {
        this._indicator = new StoicHourglassIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'left');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        setLanguage();
    }
}
