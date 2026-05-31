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
    var _TUNER_STROBE_N    = 4;    // segments fitting in 180° (plus one trailing gap)
    var _TUNER_STROBE_R    = 60;   // arc radius in SVG units (fills 120-wide viewBox)
    var _TUNER_IN_TUNE_THR = 2;    // cents threshold for in-tune state
    var _TUNER_ARROW_THR   = 3;    // cents threshold for arrow direction

    var _SVG_NS = 'http://www.w3.org/2000/svg';

    // ── Colours (custom palette; no Tailwind token equivalents) ──────
    var _COL_BG         = '#04041a';   // dark navy background
    var _COL_TICK       = '#7ad400';   // yellow-green gauge ticks
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

        // ── Mode tabs (full-width bar, ~12.5% height) ────────────────
        var tabsWrap = document.createElement('div');
        tabsWrap.style.position      = 'absolute';
        tabsWrap.style.top           = '0';
        tabsWrap.style.left          = '0';
        tabsWrap.style.right         = '0';
        tabsWrap.style.height        = '12.5%';
        tabsWrap.style.display       = 'flex';
        tabsWrap.style.alignItems    = 'flex-end';
        tabsWrap.style.justifyContent = 'flex-end';
        tabsWrap.style.borderBottom  = '2px solid ' + _COL_TAB_ACT_BG;
        tabsWrap.style.zIndex        = '10';

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

        // ── Gauge + arrows zone (25%→50% from top) ───────────────────
        var gaugeZone = document.createElement('div');
        gaugeZone.style.position      = 'absolute';
        gaugeZone.style.top           = '25%';
        gaugeZone.style.left          = '0';
        gaugeZone.style.right         = '0';
        gaugeZone.style.height        = '25%';
        gaugeZone.style.display       = 'flex';
        gaugeZone.style.flexDirection = 'column';
        gaugeZone.style.justifyContent = 'center';
        gaugeZone.style.zIndex        = '5';

        // Chromatic gauge — ends at 12.5% from each edge
        var gaugeOuter = document.createElement('div');
        gaugeOuter.style.position    = 'relative';
        gaugeOuter.style.marginLeft  = '12.5%';
        gaugeOuter.style.marginRight = '12.5%';
        gaugeOuter.style.flexShrink  = '0';

        var gaugeBg = document.createElement('div');
        gaugeBg.style.position        = 'absolute';
        gaugeBg.style.top             = '50%';
        gaugeBg.style.left            = '0';
        gaugeBg.style.right           = '0';
        gaugeBg.style.height          = '0.77em';
        gaugeBg.style.transform       = 'translateY(-50%)';
        gaugeBg.style.backgroundColor = 'rgba(0,60,20,0.7)';
        gaugeBg.style.borderRadius    = '2px';
        gaugeOuter.appendChild(gaugeBg);

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
        gaugeZone.appendChild(gaugeOuter);

        // Spacer: 1/3 of regular tick height (1/3 * 55% * 1.4em ≈ 0.257em)
        var gaugeArrowGap = document.createElement('div');
        gaugeArrowGap.style.height     = '0.257em';
        gaugeArrowGap.style.flexShrink = '0';
        gaugeZone.appendChild(gaugeArrowGap);

        // Direction arrows SVG — outer edges at ±10¢, gap 15% (~3¢)
        var arrowSvg = document.createElementNS(_SVG_NS, 'svg');
        arrowSvg.setAttribute('viewBox', '0 0 100 10');
        arrowSvg.setAttribute('preserveAspectRatio', 'none');
        arrowSvg.style.alignSelf = 'center';
        arrowSvg.style.width     = '15%';
        arrowSvg.style.height    = '0.77rem';
        arrowSvg.style.flexShrink = '0';
        arrowSvg.style.overflow  = 'visible';

        var arrowLPoly = document.createElementNS(_SVG_NS, 'polygon');
        arrowLPoly.setAttribute('points', '0,0 0,10 42.5,5');
        arrowLPoly.setAttribute('fill', _COL_ARROW_DIM);

        var arrowRPoly = document.createElementNS(_SVG_NS, 'polygon');
        arrowRPoly.setAttribute('points', '100,0 100,10 57.5,5');
        arrowRPoly.setAttribute('fill', _COL_ARROW_DIM);

        arrowSvg.appendChild(arrowLPoly);
        arrowSvg.appendChild(arrowRPoly);
        gaugeZone.appendChild(arrowSvg);
        panel.appendChild(gaugeZone);

        // Keep refs for colour updates
        var arrowL = arrowLPoly;
        var arrowR = arrowRPoly;

        // ── Note name display ─────────────────────────────────────────
        // Horizontal: center of note letter at 12.5% from left.
        // font-size set on wrapper so `ch` resolves to the note character width.
        // noteLetter is width:1ch so the accidental never shifts the F position.
        var noteWrap = document.createElement('div');
        noteWrap.style.position   = 'absolute';
        noteWrap.style.left       = 'calc(12.5% - 0.5ch)';
        noteWrap.style.top        = '67%';
        noteWrap.style.transform  = 'translateY(-50%)';
        noteWrap.style.height     = '25%';
        noteWrap.style.display    = 'flex';
        noteWrap.style.alignItems = 'center';
        noteWrap.style.fontSize   = '3.2rem';
        noteWrap.style.color      = _COL_NOTE;
        noteWrap.style.zIndex     = '5';
        noteWrap.style.overflow   = 'visible';

        var noteLetter = document.createElement('span');
        noteLetter.style.display    = 'inline-block';
        noteLetter.style.width      = '1ch';
        noteLetter.style.flexShrink = '0';
        noteLetter.style.fontWeight = '700';
        noteLetter.style.lineHeight = '1';
        noteLetter.textContent      = '-';

        var noteAccidental = document.createElement('span');
        noteAccidental.style.fontSize   = '1.7rem';
        noteAccidental.style.fontWeight = '700';
        noteAccidental.style.lineHeight = '1';
        noteAccidental.style.alignSelf  = 'flex-start';
        noteAccidental.style.marginTop  = '0.15em';
        noteAccidental.textContent      = '';

        noteWrap.appendChild(noteLetter);
        noteWrap.appendChild(noteAccidental);
        panel.appendChild(noteWrap);

        // ── Octave display ────────────────────────────────────────────
        // Center of digit at 12.5% from right; width:1ch pins the element size.
        var octaveEl = document.createElement('div');
        octaveEl.style.position   = 'absolute';
        octaveEl.style.right      = 'calc(12.5% - 0.5ch)';
        octaveEl.style.top        = '67%';
        octaveEl.style.transform  = 'translateY(-50%)';
        octaveEl.style.height     = '25%';
        octaveEl.style.width      = '1ch';
        octaveEl.style.display    = 'flex';
        octaveEl.style.alignItems = 'center';
        octaveEl.style.fontSize   = '3.2rem';
        octaveEl.style.fontWeight = '700';
        octaveEl.style.lineHeight = '1';
        octaveEl.style.color      = _COL_NOTE;
        octaveEl.style.zIndex     = '5';
        octaveEl.textContent      = '-';
        panel.appendChild(octaveEl);

        // ── Strobe semicircle SVG (bottom-centre) ─────────────────────
        // Arc is a ∩ shape (upward arch) positioned at the bottom of the panel.
        // Diamonds arranged from left through top to right around the arc.
        // Strobe SVG: viewBox 120×72, R=60 fills full width.
        // gap = (2/3)*dash; 4 dashes + 4 gaps = halfCirc → (4 + 4*2/3)*dash = halfCirc → dash = 3*halfCirc/20
        var _sVB_W = 120, _sVB_H = 72;
        var _scx = 60, _scy = _sVB_H;
        var _halfCirc  = Math.PI * _TUNER_STROBE_R;
        var _dashLen   = 3 * _halfCirc / 20;
        var _gapLen    = (2 / 3) * _dashLen;

        var strobeSvg = document.createElementNS(_SVG_NS, 'svg');
        strobeSvg.setAttribute('viewBox', '0 0 ' + _sVB_W + ' ' + _sVB_H);
        strobeSvg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
        strobeSvg.setAttribute('class', 'absolute');
        strobeSvg.style.bottom    = '0';
        strobeSvg.style.left      = '50%';
        strobeSvg.style.transform = 'translateX(-50%)';
        strobeSvg.style.width    = '33%';
        strobeSvg.style.overflow = 'visible';
        strobeSvg.style.zIndex   = '4';

        // Dashed semicircle arc (∩ upward arch)
        var arcPath = document.createElementNS(_SVG_NS, 'path');
        arcPath.setAttribute('d', 'M ' + (_scx - _TUNER_STROBE_R) + ' ' + _scy +
            ' A ' + _TUNER_STROBE_R + ' ' + _TUNER_STROBE_R + ' 0 1 1 ' +
            (_scx + _TUNER_STROBE_R) + ' ' + _scy);
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', _COL_STROBE);
        arcPath.setAttribute('stroke-width', String(_dashLen));
        arcPath.setAttribute('stroke-dasharray', _dashLen + ' ' + _gapLen);
        arcPath.setAttribute('stroke-linecap', 'butt');
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
