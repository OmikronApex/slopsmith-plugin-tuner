/**
 * Axe-Fx III style tuner visualization for the Slopsmith tuner plugin.
 *
 * Emulates the Fractal Audio Axe-Fx III hardware tuner display:
 *   - Dark navy LCD background
 *   - Horizontal chromatic tick-mark gauge (top)
 *   - Inward-pointing directional arrows (▶ ◀) below gauge
 *   - Large note name (lower-left) and octave number (lower-right)
 *   - Pink/magenta diamond strobe semicircle (bottom centre)
 *   - Mode tabs Free / Auto / Manual (top-right)
 *
 * Contract: window['_tunerViz_axe-fx-iii'](container) → { update(note, cents, freq, mode), destroy() }
 *   - note: string | null  (null = no signal)
 *   - cents: number        (deviation from target, −50…+50)
 *   - freq:  number        (detected frequency in Hz)
 *   - mode:  'free' | 'auto' | 'manual'  (tuning mode from screen.js)
 */
(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_TICK_COUNT  = 11;
    var _TUNER_STROBE_N    = 11;   // diamond segments in strobe arc
    var _TUNER_STROBE_R    = 42;   // arc radius in SVG units
    var _TUNER_IN_TUNE_THR = 2;    // cents threshold for in-tune state
    var _TUNER_ARROW_THR   = 3;    // cents threshold for arrow direction

    var _SVG_NS = 'http://www.w3.org/2000/svg';

    // ── Colours (custom palette; no Tailwind token equivalents) ──────
    var _COL_BG         = '#04041a';   // dark navy background
    var _COL_TICK       = '#00c878';   // green/teal gauge ticks
    var _COL_MARKER     = '#ffffff';   // white pitch-position marker
    var _COL_NOTE       = '#ffffff';   // white note/octave text
    var _COL_ARROW_TEAL = '#10b878';   // teal ▶ arrow
    var _COL_ARROW_WH   = '#e8e8e8';   // near-white ◀ arrow
    var _COL_ARROW_DIM  = '#1e3030';   // dimmed arrow colour
    var _COL_STROBE     = '#e83060';   // pink/magenta diamond fill
    var _COL_TAB_ACT_BG = '#2060d8';   // active tab background (blue)
    var _COL_TAB_ACT_FG = '#ffffff';   // active tab text
    var _COL_TAB_DIM    = '#506080';   // inactive tab text

    window['_tunerViz_axe-fx-iii'] = function (container) {
        'use strict';

        // ── Root panel ────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.className = 'relative w-full overflow-hidden font-mono select-none';
        panel.style.backgroundColor = _COL_BG;
        panel.style.aspectRatio = '16 / 9';
        panel.style.minHeight = '120px';

        // ── Mode tabs (top-right) ─────────────────────────────────────
        var tabsWrap = document.createElement('div');
        tabsWrap.className = 'absolute top-0 right-0 flex';
        tabsWrap.style.zIndex = '10';

        var _tabNames = ['Free', 'Auto', 'Manual'];
        var _tabEls = _tabNames.map(function (name) {
            var tab = document.createElement('span');
            tab.className = 'px-2 py-px text-xs leading-none';
            tab.style.borderRadius = '2px 2px 0 0';
            tab.style.cursor = 'default';
            tab.textContent = name;
            tabsWrap.appendChild(tab);
            return tab;
        });
        panel.appendChild(tabsWrap);

        // ── Chromatic gauge strip (upper area) ───────────────────────
        // Outer wrapper: sets width and position, contains bg + ticks
        var gaugeOuter = document.createElement('div');
        gaugeOuter.className = 'absolute';
        gaugeOuter.style.top       = '12%';
        gaugeOuter.style.left      = '50%';
        gaugeOuter.style.transform = 'translateX(-50%)';
        gaugeOuter.style.width     = '55%';
        gaugeOuter.style.zIndex    = '5';

        // Dark green background panel — height = regular tick height
        var TICK_REG_H = 10;   // px in SVG-like units; we use em below
        var gaugeBg = document.createElement('div');
        gaugeBg.style.position        = 'absolute';
        gaugeBg.style.top             = '50%';
        gaugeBg.style.left            = '0';
        gaugeBg.style.right           = '0';
        gaugeBg.style.height          = '0.55em';
        gaugeBg.style.transform       = 'translateY(-50%)';
        gaugeBg.style.backgroundColor = 'rgba(0,60,20,0.7)';
        gaugeBg.style.borderRadius    = '2px';
        gaugeOuter.appendChild(gaugeBg);

        // Tick container
        var gaugeWrap = document.createElement('div');
        gaugeWrap.className = 'relative flex items-center justify-between';
        gaugeWrap.style.height = '1.4em';

        var _tickEls = [];
        for (var i = 0; i < _TUNER_TICK_COUNT; i++) {
            var isCentre = (i === Math.floor(_TUNER_TICK_COUNT / 2));
            var tick = document.createElement('div');
            tick.style.width           = '2px';
            tick.style.height          = isCentre ? '100%' : '55%';
            tick.style.backgroundColor = _COL_TICK;
            tick.style.borderRadius    = '1px';
            tick.style.flexShrink      = '0';
            gaugeWrap.appendChild(tick);
            _tickEls.push(tick);
        }

        // White pitch-position marker
        var marker = document.createElement('div');
        marker.style.position        = 'absolute';
        marker.style.top             = '0';
        marker.style.bottom          = '0';
        marker.style.width           = '3px';
        marker.style.backgroundColor = _COL_MARKER;
        marker.style.left            = '50%';
        marker.style.transform       = 'translateX(-50%)';
        marker.style.display         = 'none';
        marker.style.zIndex          = '6';
        marker.style.boxShadow       = '0 0 6px 1px rgba(255,255,255,0.6)';
        gaugeWrap.appendChild(marker);

        gaugeOuter.appendChild(gaugeWrap);
        panel.appendChild(gaugeOuter);

        // ── Direction arrows ▶ ◀ (centre area, slightly left of mid) ──
        var arrowsWrap = document.createElement('div');
        arrowsWrap.className = 'absolute flex items-center';
        arrowsWrap.style.top       = '38%';
        arrowsWrap.style.left      = '50%';
        arrowsWrap.style.transform = 'translateX(-50%)';
        arrowsWrap.style.gap       = '4px';
        arrowsWrap.style.zIndex    = '5';

        var arrowL = document.createElement('div');   // teal ▶ (player must raise pitch)
        arrowL.style.fontSize   = '1.6rem';
        arrowL.style.lineHeight = '1';
        arrowL.style.color      = _COL_ARROW_DIM;
        arrowL.textContent      = '▶';

        var arrowR = document.createElement('div');   // white ◀ (player must lower pitch)
        arrowR.style.fontSize   = '1.6rem';
        arrowR.style.lineHeight = '1';
        arrowR.style.color      = _COL_ARROW_DIM;
        arrowR.textContent      = '◀';

        arrowsWrap.appendChild(arrowL);
        arrowsWrap.appendChild(arrowR);
        panel.appendChild(arrowsWrap);

        // ── Note name display (bottom-left) ───────────────────────────
        var noteWrap = document.createElement('div');
        noteWrap.className = 'absolute bottom-0 left-0 flex items-end leading-none';
        noteWrap.style.paddingLeft   = '4%';
        noteWrap.style.paddingBottom = '4%';
        noteWrap.style.color         = _COL_NOTE;
        noteWrap.style.zIndex        = '5';

        var noteLetter = document.createElement('span');
        noteLetter.style.fontSize  = '3.2rem';
        noteLetter.style.fontWeight = '700';
        noteLetter.textContent      = '-';

        var noteAccidental = document.createElement('span');
        noteAccidental.style.fontSize     = '1.7rem';
        noteAccidental.style.fontWeight   = '700';
        noteAccidental.style.marginBottom = '0.3rem';
        noteAccidental.style.marginLeft   = '1px';
        noteAccidental.textContent        = '';

        noteWrap.appendChild(noteLetter);
        noteWrap.appendChild(noteAccidental);
        panel.appendChild(noteWrap);

        // ── Octave display (bottom-right) ─────────────────────────────
        var octaveEl = document.createElement('div');
        octaveEl.className = 'absolute bottom-0 right-0 leading-none';
        octaveEl.style.paddingRight  = '4%';
        octaveEl.style.paddingBottom = '4%';
        octaveEl.style.fontSize      = '3.2rem';
        octaveEl.style.fontWeight    = '700';
        octaveEl.style.color         = _COL_NOTE;
        octaveEl.style.zIndex        = '5';
        octaveEl.textContent         = '-';
        panel.appendChild(octaveEl);

        // ── Strobe semicircle SVG (bottom-centre) ─────────────────────
        // Arc is a ∩ shape (upward arch) positioned at the bottom of the panel.
        // Diamonds arranged from left through top to right around the arc.
        var strobeSvg = document.createElementNS(_SVG_NS, 'svg');
        strobeSvg.setAttribute('viewBox', '0 0 120 65');
        strobeSvg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
        strobeSvg.setAttribute('class', 'absolute');
        strobeSvg.style.bottom    = '0';
        strobeSvg.style.left      = '50%';
        strobeSvg.style.transform = 'translateX(-50%)';
        strobeSvg.style.width     = '36%';
        strobeSvg.style.maxWidth  = '200px';
        strobeSvg.style.zIndex    = '4';

        // Dashed semicircle arc (∩ upward arch)
        var _scx = 60, _scy = 65;
        var arcPath = document.createElementNS(_SVG_NS, 'path');
        // M left-point, arc to right-point, upward (sweep-flag=0, large-arc=1)
        var lx = _scx - _TUNER_STROBE_R, ly = _scy;
        var rx = _scx + _TUNER_STROBE_R, ry = _scy;
        arcPath.setAttribute('d', 'M ' + lx + ' ' + ly + ' A ' + _TUNER_STROBE_R + ' ' + _TUNER_STROBE_R + ' 0 1 1 ' + rx + ' ' + ry);
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', _COL_STROBE);
        arcPath.setAttribute('stroke-width', '4');
        // 11 dashes with gaps — circumference ≈ π*R
        var halfCirc = Math.PI * _TUNER_STROBE_R;
        var dashLen  = halfCirc / (_TUNER_STROBE_N * 2 - 1);
        arcPath.setAttribute('stroke-dasharray', dashLen + ' ' + dashLen);
        arcPath.setAttribute('stroke-linecap', 'round');
        strobeSvg.appendChild(arcPath);
        panel.appendChild(strobeSvg);

        container.appendChild(panel);

        // ── Internal state ────────────────────────────────────────────
        var _rafId       = null;
        var _currentMode = 'free';

        // ── Helper: update mode tab highlights ────────────────────────
        function _updateTabs(mode) {
            var map = { free: 0, auto: 1, manual: 2 };
            var active = (map[mode] !== undefined) ? map[mode] : 0;
            _tabEls.forEach(function (tab, i) {
                if (i === active) {
                    tab.style.backgroundColor = _COL_TAB_ACT_BG;
                    tab.style.color           = _COL_TAB_ACT_FG;
                } else {
                    tab.style.backgroundColor = 'transparent';
                    tab.style.color           = _COL_TAB_DIM;
                }
            });
        }

        // Initialise tabs
        _updateTabs('free');

        // ── Public: update (stubs wired in Story 4.2 and 4.3) ────────
        function update(note, cents, freq, mode) {
            if (mode !== undefined) { _currentMode = mode; }
            _updateTabs(_currentMode);
            // Gauge, arrows, note/octave wired in Story 4.2
            // Strobe animation wired in Story 4.3
        }

        // ── Public: destroy ───────────────────────────────────────────
        function destroy() {
            if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };
})();
