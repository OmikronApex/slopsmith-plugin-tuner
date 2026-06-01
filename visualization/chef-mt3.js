/**
 * CHEF MT-3 tuner visualization for the Slopsmith tuner plugin.
 *
 * Inspired by classic chromatic pedal tuners:
 *   - Shiny black rectangular panel with chamfered edges and corner screws
 *   - Curved glass gauge arc with tick lines and −50/0/+50 labels
 *   - Red 7-segment display (bottom centre) with "#" symbol
 *   - Two rubber buttons: MODE (left) toggles standard/strobe, BRGHT. (right) decorative
 *   - Standard mode: 3 orange marker lights track deviation along the arc
 *   - Strobe mode: 5×2 dot groups drift left/right proportional to deviation
 *
 * Contract: window['_tunerViz_chef-mt3'](container) → { update(note, cents, freq, mode), destroy() }
 *   - note: string | null  (null = no signal)
 *   - cents: number        (deviation from target, −50…+50)
 *   - freq:  number        (detected frequency in Hz)
 *   - mode:  'free' | 'auto' | 'manual'  (tuning mode from screen.js)
 */
(function () {
    'use strict';

    // ── Module-level constants ─────────────────────────────────────────
    var _TUNER_MT3_IN_TUNE_THR      = 2;   // cents threshold for in-tune
    var _TUNER_MT3_GAUGE_CENTS      = 50;  // ±50 range
    var _TUNER_MT3_TICK_COUNT       = 11;  // tick lines along the arc
    var _TUNER_MT3_MARKER_COUNT     = 3;   // standard mode markers
    var _TUNER_MT3_STROBE_GROUP_COUNT = 5; // strobe mode groups

    // ── Colours ────────────────────────────────────────────────────────
    var _MT3_COL_BG          = '#0a0a0a';
    var _MT3_COL_GAUGE_ARC   = 'rgba(255,255,255,0.18)';
    var _MT3_COL_TICK        = 'rgba(255,255,255,0.55)';
    var _MT3_COL_MARKER_LIT  = '#ff8800';
    var _MT3_COL_SEG_LIT     = '#ff2200';
    var _MT3_COL_SEG_UNLIT   = '#2a0000';
    var _MT3_COL_BUTTON      = '#1a1a1a';
    var _MT3_COL_LABEL       = '#c8c8c8';

    // ── Gauge SVG geometry ─────────────────────────────────────────────
    // viewBox 200×110; arc centre at (100,110); radius 90
    // Arc spans angle π (left/−50¢) → 2π (right/+50¢)
    var _MT3_VB_W = 200, _MT3_VB_H = 110;
    var _MT3_cx   = 100,  _MT3_cy  = 110;
    var _MT3_ARC_R = 90;

    var _SVG_NS = 'http://www.w3.org/2000/svg';

    // ── 8-segment lookup table ─────────────────────────────────────────
    // Indices: [a, b, c, d, e, f, g1, g2]  (g1=left-half centre, g2=right-half)
    var _TUNER_MT3_SEGMENTS = {
        //         a      b      c      d      e      f      g1     g2
        'A': [ true,  true,  true,  false, true,  true,  true,  true  ],
        'B': [ false, false, true,  true,  true,  true,  true,  true  ],
        'C': [ true,  false, false, true,  true,  true,  false, false ],
        'D': [ false, true,  true,  true,  true,  false, true,  true  ],
        'E': [ true,  false, false, true,  true,  true,  true,  false ],
        'F': [ true,  false, false, false, true,  true,  true,  false ],
        'G': [ true,  false, true,  true,  true,  true,  false, true  ],
        ' ': [ false, false, false, false, false, false, false, false ],
    };

    var _segKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g1', 'g2'];

    window['_tunerViz_chef-mt3'] = function (container) {
        'use strict';

        // ── Root panel ────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.style.position        = 'relative';
        panel.style.overflow        = 'hidden';
        panel.style.aspectRatio     = '5 / 3';
        panel.style.minHeight       = '120px';
        panel.style.backgroundColor = _MT3_COL_BG;
        panel.style.border          = '2px solid #505050';
        panel.style.borderRadius    = '6px';
        panel.style.userSelect      = 'none';
        panel.style.fontFamily      = 'monospace';

        // ── Corner screws ─────────────────────────────────────────────
        [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].forEach(function (pos) {
            var s = document.createElement('div');
            s.style.position      = 'absolute';
            s.style[pos[0]]       = '3%';
            s.style[pos[1]]       = '2%';
            s.style.width         = '4%';
            s.style.height        = '0';
            s.style.paddingBottom = '4%';
            s.style.borderRadius  = '50%';
            s.style.background    = 'radial-gradient(circle at 35% 35%, #666, #222)';
            s.style.boxShadow     = '0 1px 3px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.12)';
            s.style.zIndex        = '5';
            var slot = document.createElement('div');
            slot.style.position        = 'absolute';
            slot.style.top             = '45%';
            slot.style.left            = '15%';
            slot.style.right           = '15%';
            slot.style.height          = '10%';
            slot.style.backgroundColor = '#111';
            s.appendChild(slot);
            panel.appendChild(s);
        });

        // ── Gauge SVG ─────────────────────────────────────────────────
        var gaugeSvg = document.createElementNS(_SVG_NS, 'svg');
        gaugeSvg.setAttribute('viewBox', '0 0 ' + _MT3_VB_W + ' ' + _MT3_VB_H);
        gaugeSvg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
        gaugeSvg.style.position   = 'absolute';
        gaugeSvg.style.top        = '5%';
        gaugeSvg.style.left       = '0';
        gaugeSvg.style.right      = '0';
        gaugeSvg.style.width      = '100%';
        gaugeSvg.style.height     = '55%';
        gaugeSvg.style.overflow   = 'visible';

        // Glass arc body (wide stroke for volume/glass appearance)
        var arcBody = document.createElementNS(_SVG_NS, 'path');
        arcBody.setAttribute('d', 'M ' + (_MT3_cx - _MT3_ARC_R) + ' ' + _MT3_cy +
            ' A ' + _MT3_ARC_R + ' ' + _MT3_ARC_R + ' 0 0 1 ' + (_MT3_cx + _MT3_ARC_R) + ' ' + _MT3_cy);
        arcBody.setAttribute('fill', 'none');
        arcBody.setAttribute('stroke', _MT3_COL_GAUGE_ARC);
        arcBody.setAttribute('stroke-width', '18');
        arcBody.setAttribute('stroke-linecap', 'round');
        gaugeSvg.appendChild(arcBody);

        // Glass sheen — dashed highlight along the inner edge of arc
        var arcSheen = document.createElementNS(_SVG_NS, 'path');
        arcSheen.setAttribute('d', 'M ' + (_MT3_cx - _MT3_ARC_R) + ' ' + _MT3_cy +
            ' A ' + _MT3_ARC_R + ' ' + _MT3_ARC_R + ' 0 0 1 ' + (_MT3_cx + _MT3_ARC_R) + ' ' + _MT3_cy);
        arcSheen.setAttribute('fill', 'none');
        arcSheen.setAttribute('stroke', 'rgba(255,255,255,0.35)');
        arcSheen.setAttribute('stroke-width', '2.5');
        arcSheen.setAttribute('stroke-dasharray', '10 8');
        arcSheen.setAttribute('stroke-linecap', 'round');
        gaugeSvg.appendChild(arcSheen);

        // Tick lines — radial lines at 11 evenly-spaced angles
        for (var i = 0; i < _TUNER_MT3_TICK_COUNT; i++) {
            var a = Math.PI + (Math.PI / (_TUNER_MT3_TICK_COUNT - 1)) * i;
            var innerR = _MT3_ARC_R - 7;
            var outerR = _MT3_ARC_R;
            var x1 = _MT3_cx + innerR * Math.cos(a);
            var y1 = _MT3_cy + innerR * Math.sin(a);
            var x2 = _MT3_cx + outerR * Math.cos(a);
            var y2 = _MT3_cy + outerR * Math.sin(a);
            var tick = document.createElementNS(_SVG_NS, 'line');
            tick.setAttribute('x1', String(x1));
            tick.setAttribute('y1', String(y1));
            tick.setAttribute('x2', String(x2));
            tick.setAttribute('y2', String(y2));
            tick.setAttribute('stroke', _MT3_COL_TICK);
            tick.setAttribute('stroke-width', '1.5');
            gaugeSvg.appendChild(tick);
        }

        // Arc labels — −50, 0, +50
        [
            { cents: -50, text: '-50' },
            { cents:   0, text:  '0'  },
            { cents:  50, text: '+50' },
        ].forEach(function (lbl) {
            var t   = (lbl.cents + 50) / 100;
            var ang = Math.PI + t * Math.PI;
            var lx  = _MT3_cx + (_MT3_ARC_R + 8) * Math.cos(ang);
            var ly  = _MT3_cy + (_MT3_ARC_R + 8) * Math.sin(ang);
            var el  = document.createElementNS(_SVG_NS, 'text');
            el.setAttribute('x', String(lx));
            el.setAttribute('y', String(ly + 4));
            el.setAttribute('text-anchor', lbl.cents === 0 ? 'middle' : (lbl.cents < 0 ? 'end' : 'start'));
            el.setAttribute('font-size', '8');
            el.setAttribute('fill', 'rgba(255,255,255,0.5)');
            el.textContent = lbl.text;
            gaugeSvg.appendChild(el);
        });

        // Standard mode: 3 marker circles (hidden initially)
        var _mt3MarkerEls = [];
        for (var m = 0; m < _TUNER_MT3_MARKER_COUNT; m++) {
            var mk = document.createElementNS(_SVG_NS, 'circle');
            mk.setAttribute('cx', String(_MT3_cx));
            mk.setAttribute('cy', String(_MT3_cy - (_MT3_ARC_R - 9)));
            mk.setAttribute('r', '4');
            mk.setAttribute('fill', _MT3_COL_MARKER_LIT);
            mk.style.opacity = '0';
            gaugeSvg.appendChild(mk);
            _mt3MarkerEls.push(mk);
        }

        // Strobe mode: 10 dot elements (5 groups × 2 dots each), hidden initially
        var _mt3StrobeEls = [];
        for (var s = 0; s < _TUNER_MT3_STROBE_GROUP_COUNT * 2; s++) {
            var sd = document.createElementNS(_SVG_NS, 'circle');
            sd.setAttribute('cx', String(_MT3_cx));
            sd.setAttribute('cy', String(_MT3_cy - (_MT3_ARC_R - 9)));
            sd.setAttribute('r', '3.5');
            sd.setAttribute('fill', _MT3_COL_MARKER_LIT);
            sd.style.opacity = '0';
            gaugeSvg.appendChild(sd);
            _mt3StrobeEls.push(sd);
        }

        panel.appendChild(gaugeSvg);

        // ── 7-segment display ─────────────────────────────────────────
        var displayWrap = document.createElement('div');
        displayWrap.style.position        = 'absolute';
        displayWrap.style.bottom          = '18%';
        displayWrap.style.left            = '50%';
        displayWrap.style.transform       = 'translateX(-50%)';
        displayWrap.style.width           = '18%';
        displayWrap.style.height          = '22%';
        displayWrap.style.background      = '#0d0000';
        displayWrap.style.borderRadius    = '3px';
        displayWrap.style.border          = '1px solid #2a0000';
        displayWrap.style.display         = 'flex';
        displayWrap.style.alignItems      = 'center';
        displayWrap.style.justifyContent  = 'center';
        displayWrap.style.padding         = '4%';
        displayWrap.style.boxSizing       = 'border-box';
        displayWrap.style.boxShadow       = 'inset 0 0 8px #000';
        panel.appendChild(displayWrap);

        // Segment SVG (same polygon geometry as pp-tiny)
        var segSvg = document.createElementNS(_SVG_NS, 'svg');
        segSvg.setAttribute('viewBox', '0 0 100 200');
        segSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        segSvg.style.width         = '55%';
        segSvg.style.aspectRatio   = '1 / 2';
        segSvg.style.flexShrink    = '0';
        segSvg.style.overflow      = 'visible';
        displayWrap.appendChild(segSvg);

        var _mt3SegEls = {};

        function _makeSegPoly(key, points) {
            var el = document.createElementNS(_SVG_NS, 'polygon');
            el.setAttribute('points', points);
            el.setAttribute('fill', _MT3_COL_SEG_UNLIT);
            segSvg.appendChild(el);
            _mt3SegEls[key] = el;
        }

        _makeSegPoly('a',  '11,5    89,5    95,13   89,21   11,21   5,13');
        _makeSegPoly('b',  '87,26   95,32   95,81   87,87   79,81   79,32');
        _makeSegPoly('c',  '87,113  95,119  95,168  87,174  79,168  79,119');
        _makeSegPoly('d',  '11,179  89,179  95,187  89,195  11,195  5,187');
        _makeSegPoly('e',  '13,113  21,119  21,168  13,174  5,168   5,119');
        _makeSegPoly('f',  '13,26   21,32   21,81   13,87   5,81    5,32');
        _makeSegPoly('g1', '11,92   42.5,92 48.5,100 42.5,108 11,108 5,100');
        _makeSegPoly('g2', '57.5,92 89,92   95,100  89,108  57.5,108 51.5,100');

        // "#" symbol SVG
        var sharpSvg = document.createElementNS(_SVG_NS, 'svg');
        sharpSvg.setAttribute('viewBox', '0 0 90 90');
        sharpSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        sharpSvg.style.position      = 'absolute';
        sharpSvg.style.top           = '54%';
        sharpSvg.style.right         = '6%';
        sharpSvg.style.width         = '22%';
        sharpSvg.style.aspectRatio   = '1 / 1';
        sharpSvg.style.overflow      = 'visible';
        sharpSvg.style.pointerEvents = 'none';
        displayWrap.appendChild(sharpSvg);

        var _mt3SharpParts = [];
        function _makeSharpPoly(points) {
            var el = document.createElementNS(_SVG_NS, 'polygon');
            el.setAttribute('points', points);
            el.setAttribute('fill', _MT3_COL_SEG_UNLIT);
            sharpSvg.appendChild(el);
            _mt3SharpParts.push(el);
        }
        _makeSharpPoly('28.3,0   33.3,4   33.3,86  28.3,90  23.3,86  23.3,4');
        _makeSharpPoly('61.7,0   66.7,4   66.7,86  61.7,90  56.7,86  56.7,4');
        _makeSharpPoly('4,23.3   86,23.3  90,28.3  86,33.3  4,33.3   0,28.3');
        _makeSharpPoly('4,56.7   86,56.7  90,61.7  86,66.7  4,66.7   0,61.7');

        // ── MODE button (left) ────────────────────────────────────────
        var _mt3ModeBtn = document.createElement('div');
        _mt3ModeBtn.style.position        = 'absolute';
        _mt3ModeBtn.style.bottom          = '5%';
        _mt3ModeBtn.style.left            = 'calc(50% - 22%)';
        _mt3ModeBtn.style.width           = '10%';
        _mt3ModeBtn.style.height          = '14%';
        _mt3ModeBtn.style.backgroundColor = _MT3_COL_BUTTON;
        _mt3ModeBtn.style.borderRadius    = '3px';
        _mt3ModeBtn.style.border          = '1px solid #333';
        _mt3ModeBtn.style.boxShadow       = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
        _mt3ModeBtn.style.cursor          = 'pointer';
        _mt3ModeBtn.style.display         = 'flex';
        _mt3ModeBtn.style.alignItems      = 'center';
        _mt3ModeBtn.style.justifyContent  = 'center';

        var modeLbl = document.createElement('span');
        modeLbl.style.color        = _MT3_COL_LABEL;
        modeLbl.style.fontSize     = '0.45em';
        modeLbl.style.letterSpacing = '0.03em';
        modeLbl.style.pointerEvents = 'none';
        modeLbl.textContent        = 'MODE';
        _mt3ModeBtn.appendChild(modeLbl);
        panel.appendChild(_mt3ModeBtn);

        // ── BRGHT. button (right) ─────────────────────────────────────
        var brightBtn = document.createElement('div');
        brightBtn.style.position        = 'absolute';
        brightBtn.style.bottom          = '5%';
        brightBtn.style.left            = 'calc(50% + 12%)';
        brightBtn.style.width           = '10%';
        brightBtn.style.height          = '14%';
        brightBtn.style.backgroundColor = _MT3_COL_BUTTON;
        brightBtn.style.borderRadius    = '3px';
        brightBtn.style.border          = '1px solid #333';
        brightBtn.style.boxShadow       = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
        brightBtn.style.cursor          = 'default';
        brightBtn.style.display         = 'flex';
        brightBtn.style.alignItems      = 'center';
        brightBtn.style.justifyContent  = 'center';

        var brightLbl = document.createElement('span');
        brightLbl.style.color        = _MT3_COL_LABEL;
        brightLbl.style.fontSize     = '0.45em';
        brightLbl.style.letterSpacing = '0.03em';
        brightLbl.style.pointerEvents = 'none';
        brightLbl.textContent        = 'BRGHT.';
        brightBtn.appendChild(brightLbl);
        panel.appendChild(brightBtn);

        // ── Brand label ───────────────────────────────────────────────
        var brandLbl = document.createElement('div');
        brandLbl.style.position   = 'absolute';
        brandLbl.style.top        = '4%';
        brandLbl.style.right      = '3%';
        brandLbl.style.color      = _MT3_COL_LABEL;
        brandLbl.style.fontSize   = '0.55em';
        brandLbl.style.fontWeight = '600';
        brandLbl.style.letterSpacing = '0.06em';
        brandLbl.textContent      = 'CHEF MT-3';
        panel.appendChild(brandLbl);

        container.appendChild(panel);

        // ── Animation state ───────────────────────────────────────────
        var _mt3Mode          = 'standard';
        var _mt3CurrentCents  = 0;
        var _mt3SmoothedCents = 0;
        var _mt3RafId         = null;
        var _mt3LastTime      = null;
        var _mt3StrobeOffset  = 0;   // angle accumulator (radians) for strobe drift

        // ── Helpers ───────────────────────────────────────────────────
        function _setSegment(el, lit) {
            el.setAttribute('fill', lit ? _MT3_COL_SEG_LIT : _MT3_COL_SEG_UNLIT);
            el.style.filter = lit ? 'drop-shadow(0 0 5px #ff2200)' : 'none';
        }

        function _renderNote(letter) {
            var map = _TUNER_MT3_SEGMENTS[letter] || _TUNER_MT3_SEGMENTS[' '];
            for (var k = 0; k < _segKeys.length; k++) {
                _setSegment(_mt3SegEls[_segKeys[k]], map[k]);
            }
        }

        function _setSharp(lit) {
            for (var p = 0; p < _mt3SharpParts.length; p++) {
                _mt3SharpParts[p].setAttribute('fill', lit ? _MT3_COL_SEG_LIT : _MT3_COL_SEG_UNLIT);
            }
        }

        function _positionMarkersStandard(cents, hasSignal) {
            var mi;
            if (!hasSignal) {
                for (mi = 0; mi < _TUNER_MT3_MARKER_COUNT; mi++) {
                    _mt3MarkerEls[mi].style.opacity = '0';
                }
                return;
            }
            var clampedCents = Math.max(-_TUNER_MT3_GAUGE_CENTS, Math.min(_TUNER_MT3_GAUGE_CENTS, cents));
            var t            = (clampedCents + _TUNER_MT3_GAUGE_CENTS) / (2 * _TUNER_MT3_GAUGE_CENTS);
            var targetAngle  = Math.PI + t * Math.PI;
            var offsets      = [-4, 0, 4];
            var r            = _MT3_ARC_R - 9;
            for (mi = 0; mi < _TUNER_MT3_MARKER_COUNT; mi++) {
                var a  = targetAngle + offsets[mi] * Math.PI / 180;
                var cx = _MT3_cx + r * Math.cos(a);
                var cy = _MT3_cy + r * Math.sin(a);
                _mt3MarkerEls[mi].setAttribute('cx', String(cx));
                _mt3MarkerEls[mi].setAttribute('cy', String(cy));
                _mt3MarkerEls[mi].setAttribute('r', '4');
                _mt3MarkerEls[mi].setAttribute('fill', _MT3_COL_MARKER_LIT);
                _mt3MarkerEls[mi].style.filter  = 'drop-shadow(0 0 4px #ff8800)';
                _mt3MarkerEls[mi].style.opacity = '1';
            }
        }

        // ── Strobe RAF loop ───────────────────────────────────────────
        function _animateStrobe(now) {
            if (_mt3LastTime === null) { _mt3LastTime = now; }
            var dt = Math.min((now - _mt3LastTime) / 1000, 0.1);
            _mt3LastTime = now;

            var lerpFactor = 1 - Math.exp(-10 * dt);
            _mt3SmoothedCents += (_mt3CurrentCents - _mt3SmoothedCents) * lerpFactor;

            if (_mt3Mode === 'strobe' && Math.abs(_mt3SmoothedCents) > 0.1) {
                var absCents   = Math.min(_TUNER_MT3_GAUGE_CENTS, Math.abs(_mt3SmoothedCents));
                var normalized = Math.max(0, absCents - _TUNER_MT3_IN_TUNE_THR) / (_TUNER_MT3_GAUGE_CENTS - _TUNER_MT3_IN_TUNE_THR);
                var speed      = Math.PI * Math.pow(normalized, 0.9);
                // Sharp (cents > 0) → drift right → angle increases (π→2π is left→right)
                if (_mt3SmoothedCents < 0) { speed = -speed; }
                _mt3StrobeOffset = ((_mt3StrobeOffset + speed * dt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            }

            if (_mt3Mode === 'strobe') {
                var r = _MT3_ARC_R - 9;
                for (var g = 0; g < _TUNER_MT3_STROBE_GROUP_COUNT; g++) {
                    var baseAngle = Math.PI + (g / _TUNER_MT3_STROBE_GROUP_COUNT) * Math.PI + _mt3StrobeOffset;
                    var dotOffsets = [-2, 2];
                    for (var d = 0; d < 2; d++) {
                        var elIdx = g * 2 + d;
                        var ang   = baseAngle + dotOffsets[d] * Math.PI / 180;
                        var cx    = _MT3_cx + r * Math.cos(ang);
                        var cy    = _MT3_cy + r * Math.sin(ang);
                        _mt3StrobeEls[elIdx].setAttribute('cx', String(cx));
                        _mt3StrobeEls[elIdx].setAttribute('cy', String(cy));
                        _mt3StrobeEls[elIdx].style.opacity = '1';
                        _mt3StrobeEls[elIdx].style.filter  = 'drop-shadow(0 0 3px #ff8800)';
                    }
                }
            }

            _mt3RafId = requestAnimationFrame(_animateStrobe);
        }

        _mt3RafId = requestAnimationFrame(_animateStrobe);

        // ── MODE button click handler ─────────────────────────────────
        _mt3ModeBtn.addEventListener('click', function () {
            // Brief press feedback
            _mt3ModeBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.9)';
            setTimeout(function () {
                _mt3ModeBtn.style.boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
            }, 120);

            if (_mt3Mode === 'standard') {
                _mt3Mode = 'strobe';
                _mt3StrobeOffset = 0;
                // Hide standard markers
                for (var mi2 = 0; mi2 < _TUNER_MT3_MARKER_COUNT; mi2++) {
                    _mt3MarkerEls[mi2].style.opacity = '0';
                }
            } else {
                _mt3Mode = 'standard';
                // Hide strobe dots
                for (var si2 = 0; si2 < _mt3StrobeEls.length; si2++) {
                    _mt3StrobeEls[si2].style.opacity = '0';
                }
                // Re-position standard markers at last known deviation
                _positionMarkersStandard(_mt3CurrentCents, _mt3CurrentCents !== 0 || _mt3SmoothedCents !== 0);
            }
        });

        // ── Public: update ────────────────────────────────────────────
        function update(note, cents) {
            var hasNote = (note !== null && note !== undefined);

            _mt3CurrentCents = hasNote ? (cents || 0) : 0;

            if (_mt3Mode === 'standard') {
                _positionMarkersStandard(_mt3CurrentCents, hasNote);
            }
            // In strobe mode, markers are driven by RAF; hide standard ones
            if (_mt3Mode === 'strobe') {
                for (var i = 0; i < _TUNER_MT3_MARKER_COUNT; i++) {
                    _mt3MarkerEls[i].style.opacity = '0';
                }
            }

            if (hasNote) {
                var letter  = note.charAt(0);
                var isSharp = note.length > 1 && note.charAt(1) === '#';
                _renderNote(letter);
                _setSharp(isSharp);
            } else {
                _renderNote(' ');
                _setSharp(false);
            }
        }

        // ── Public: destroy ───────────────────────────────────────────
        function destroy() {
            if (_mt3RafId) { cancelAnimationFrame(_mt3RafId); _mt3RafId = null; }
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };
})();
