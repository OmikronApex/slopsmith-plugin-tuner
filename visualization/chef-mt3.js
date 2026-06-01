/**
 * CHEF MT-3 tuner visualization for the Slopsmith tuner plugin.
 *
 * Inspired by classic chromatic pedal tuners:
 *   - Shiny black rectangular panel with chamfered edges and corner screws
 *   - 90° curved glass gauge arc spanning between the screw inner edges
 *   - 51 tick marks glow orange to indicate deviation (2-cent resolution)
 *   - Red 7-segment display (bottom centre) with "#" symbol
 *   - Two rubber buttons flanked by panel labels: MODE (left), BRGHT. (right)
 *   - Standard mode: nearest tick cluster glows for current deviation
 *   - Strobe mode: tick clusters drift left/right proportional to deviation
 *
 * Contract: window['_tunerViz_chef-mt3'](container) → { update(note, cents, freq, mode), destroy() }
 *   - note: string | null  (null = no signal)
 *   - cents: number        (deviation from target, −50…+50)
 */
(function () {
    'use strict';

    // ── Module-level constants ─────────────────────────────────────────
    var _TUNER_MT3_IN_TUNE_THR        = 2;   // cents threshold for in-tune
    var _TUNER_MT3_GAUGE_CENTS        = 50;  // ±50 range
    var _TUNER_MT3_TICK_COUNT         = 51;  // 0¢ + 25 ticks × 2¢ per side
    var _TUNER_MT3_STROBE_GROUP_COUNT = 5;

    // ── Colours ────────────────────────────────────────────────────────
    var _MT3_COL_BG        = '#0a0a0a';
    var _MT3_COL_GAUGE_ARC = 'rgba(255,255,255,0.18)';
    var _MT3_COL_TICK_DIM  = 'rgba(255,255,255,0.45)';
    var _MT3_COL_TICK_LIT  = '#ff8800';
    var _MT3_COL_SEG_LIT   = '#ff2200';
    var _MT3_COL_SEG_UNLIT = '#2a0000';
    var _MT3_COL_BUTTON    = '#1a1a1a';
    var _MT3_COL_LABEL     = '#c8c8c8';

    // ── Gauge SVG geometry ─────────────────────────────────────────────
    // 90° arc: 225° (−50¢) → 270° (0¢, apex) → 315° (+50¢)
    // R=124 so arc endpoints align with screw inner edges (6% from each side of 200-wide viewBox)
    // cy=138 so apex (cy−R=14) sits just below the SVG top
    var _MT3_cx      = 100;
    var _MT3_cy      = 138;
    var _MT3_ARC_R   = 124;
    var _MT3_ARC_START = 5 * Math.PI / 4;    // 225°
    var _MT3_ARC_SPAN  = Math.PI / 2;         // 90°

    var _MT3_ARC_SX = _MT3_cx + _MT3_ARC_R * Math.cos(_MT3_ARC_START);
    var _MT3_ARC_SY = _MT3_cy + _MT3_ARC_R * Math.sin(_MT3_ARC_START);
    var _MT3_ARC_EX = _MT3_cx + _MT3_ARC_R * Math.cos(_MT3_ARC_START + _MT3_ARC_SPAN);
    var _MT3_ARC_EY = _MT3_cy + _MT3_ARC_R * Math.sin(_MT3_ARC_START + _MT3_ARC_SPAN);

    var _SVG_NS = 'http://www.w3.org/2000/svg';

    // ── 8-segment lookup table ─────────────────────────────────────────
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
        [['top','left'],['top','right'],['bottom','left'],['bottom','right']].forEach(function (pos) {
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
        gaugeSvg.setAttribute('viewBox', '0 0 200 110');
        gaugeSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        gaugeSvg.style.position = 'absolute';
        gaugeSvg.style.top      = '5%';
        gaugeSvg.style.left     = '0';
        gaugeSvg.style.right    = '0';
        gaugeSvg.style.width    = '100%';
        gaugeSvg.style.height   = '55%';
        gaugeSvg.style.overflow = 'visible';

        var _arcD = 'M ' + _MT3_ARC_SX.toFixed(2) + ' ' + _MT3_ARC_SY.toFixed(2) +
            ' A ' + _MT3_ARC_R + ' ' + _MT3_ARC_R + ' 0 0 1 ' +
            _MT3_ARC_EX.toFixed(2) + ' ' + _MT3_ARC_EY.toFixed(2);

        // Glass arc body
        var arcBody = document.createElementNS(_SVG_NS, 'path');
        arcBody.setAttribute('d', _arcD);
        arcBody.setAttribute('fill', 'none');
        arcBody.setAttribute('stroke', _MT3_COL_GAUGE_ARC);
        arcBody.setAttribute('stroke-width', '16');
        arcBody.setAttribute('stroke-linecap', 'round');
        gaugeSvg.appendChild(arcBody);

        // Glass sheen
        var arcSheen = document.createElementNS(_SVG_NS, 'path');
        arcSheen.setAttribute('d', _arcD);
        arcSheen.setAttribute('fill', 'none');
        arcSheen.setAttribute('stroke', 'rgba(255,255,255,0.35)');
        arcSheen.setAttribute('stroke-width', '2');
        arcSheen.setAttribute('stroke-dasharray', '6 5');
        arcSheen.setAttribute('stroke-linecap', 'round');
        gaugeSvg.appendChild(arcSheen);

        // Tick lines — 51 ticks, 2-cent resolution
        // Every 5th tick (10-cent marks) is longer; stored for live glow updates
        var _mt3TickEls = [];
        for (var i = 0; i < _TUNER_MT3_TICK_COUNT; i++) {
            var isMajor = (i % 5 === 0);
            var a       = _MT3_ARC_START + (_MT3_ARC_SPAN / (_TUNER_MT3_TICK_COUNT - 1)) * i;
            var innerR  = _MT3_ARC_R - (isMajor ? 9 : 5);
            var x1 = _MT3_cx + innerR * Math.cos(a);
            var y1 = _MT3_cy + innerR * Math.sin(a);
            var x2 = _MT3_cx + _MT3_ARC_R * Math.cos(a);
            var y2 = _MT3_cy + _MT3_ARC_R * Math.sin(a);
            var tick = document.createElementNS(_SVG_NS, 'line');
            tick.setAttribute('x1', String(x1));
            tick.setAttribute('y1', String(y1));
            tick.setAttribute('x2', String(x2));
            tick.setAttribute('y2', String(y2));
            tick.setAttribute('stroke', _MT3_COL_TICK_DIM);
            tick.setAttribute('stroke-width', isMajor ? '2' : '1');
            tick.setAttribute('stroke-linecap', 'round');
            gaugeSvg.appendChild(tick);
            _mt3TickEls.push(tick);
        }

        // Arc labels — on a horizontal baseline below the arc ends
        var _lblY = _MT3_ARC_SY + 13;
        [{x: _MT3_ARC_SX, text: '-50'}, {x: _MT3_cx, text: '0'}, {x: _MT3_ARC_EX, text: '+50'}]
        .forEach(function (lbl) {
            var el = document.createElementNS(_SVG_NS, 'text');
            el.setAttribute('x', String(lbl.x));
            el.setAttribute('y', String(_lblY));
            el.setAttribute('text-anchor', 'middle');
            el.setAttribute('font-size', '8');
            el.setAttribute('fill', 'rgba(255,255,255,0.45)');
            el.textContent = lbl.text;
            gaugeSvg.appendChild(el);
        });

        panel.appendChild(gaugeSvg);

        // ── 7-segment display ─────────────────────────────────────────
        var displayWrap = document.createElement('div');
        displayWrap.style.position       = 'absolute';
        displayWrap.style.bottom         = '5%';
        displayWrap.style.left           = '50%';
        displayWrap.style.transform      = 'translateX(-50%)';
        displayWrap.style.width          = '18%';
        displayWrap.style.height         = '22%';
        displayWrap.style.background     = '#0d0000';
        displayWrap.style.borderRadius   = '3px';
        displayWrap.style.border         = '1px solid #2a0000';
        displayWrap.style.display        = 'flex';
        displayWrap.style.alignItems     = 'center';
        displayWrap.style.justifyContent = 'center';
        displayWrap.style.padding        = '4%';
        displayWrap.style.boxSizing      = 'border-box';
        displayWrap.style.boxShadow      = 'inset 0 0 8px #000';
        panel.appendChild(displayWrap);

        var segSvg = document.createElementNS(_SVG_NS, 'svg');
        segSvg.setAttribute('viewBox', '0 0 100 200');
        segSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        segSvg.style.width       = '55%';
        segSvg.style.aspectRatio = '1 / 2';
        segSvg.style.flexShrink  = '0';
        segSvg.style.overflow    = 'visible';
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
        function _makeSharpPoly(pts) {
            var el = document.createElementNS(_SVG_NS, 'polygon');
            el.setAttribute('points', pts);
            el.setAttribute('fill', _MT3_COL_SEG_UNLIT);
            sharpSvg.appendChild(el);
            _mt3SharpParts.push(el);
        }
        _makeSharpPoly('28.3,0   33.3,4   33.3,86  28.3,90  23.3,86  23.3,4');
        _makeSharpPoly('61.7,0   66.7,4   66.7,86  61.7,90  56.7,86  56.7,4');
        _makeSharpPoly('4,23.3   86,23.3  90,28.3  86,33.3  4,33.3   0,28.3');
        _makeSharpPoly('4,56.7   86,56.7  90,61.7  86,66.7  4,66.7   0,61.7');

        // ── Buttons (vertical centre aligns with display) ─────────────
        // Display: bottom:5%, height:22% → centre at bottom 16%
        // Buttons: height:14% → bottom = 16% - 7% = 9%
        var _mt3ModeBtn = document.createElement('div');
        _mt3ModeBtn.style.position        = 'absolute';
        _mt3ModeBtn.style.bottom          = '9%';
        _mt3ModeBtn.style.left            = 'calc(50% - 22%)';
        _mt3ModeBtn.style.width           = '10%';
        _mt3ModeBtn.style.height          = '14%';
        _mt3ModeBtn.style.backgroundColor = _MT3_COL_BUTTON;
        _mt3ModeBtn.style.borderRadius    = '3px';
        _mt3ModeBtn.style.border          = '1px solid #333';
        _mt3ModeBtn.style.boxShadow       = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
        _mt3ModeBtn.style.cursor          = 'pointer';
        panel.appendChild(_mt3ModeBtn);

        var brightBtn = document.createElement('div');
        brightBtn.style.position        = 'absolute';
        brightBtn.style.bottom          = '9%';
        brightBtn.style.left            = 'calc(50% + 12%)';
        brightBtn.style.width           = '10%';
        brightBtn.style.height          = '14%';
        brightBtn.style.backgroundColor = _MT3_COL_BUTTON;
        brightBtn.style.borderRadius    = '3px';
        brightBtn.style.border          = '1px solid #333';
        brightBtn.style.boxShadow       = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
        brightBtn.style.cursor          = 'default';
        panel.appendChild(brightBtn);

        // Panel labels below buttons
        [{text: 'MODE', left: 'calc(50% - 22%)'}, {text: 'BRGHT.', left: 'calc(50% + 12%)'}]
        .forEach(function (lbl) {
            var el = document.createElement('div');
            el.style.position      = 'absolute';
            el.style.bottom        = '4%';
            el.style.left          = lbl.left;
            el.style.width         = '10%';
            el.style.textAlign     = 'center';
            el.style.color         = _MT3_COL_LABEL;
            el.style.fontSize      = '0.38em';
            el.style.letterSpacing = '0.05em';
            el.style.pointerEvents = 'none';
            el.textContent         = lbl.text;
            panel.appendChild(el);
        });

        // Brand label
        var brandLbl = document.createElement('div');
        brandLbl.style.position      = 'absolute';
        brandLbl.style.top           = '4%';
        brandLbl.style.right         = '3%';
        brandLbl.style.color         = _MT3_COL_LABEL;
        brandLbl.style.fontSize      = '0.55em';
        brandLbl.style.fontWeight    = '600';
        brandLbl.style.letterSpacing = '0.06em';
        brandLbl.textContent         = 'CHEF MT-3';
        panel.appendChild(brandLbl);

        container.appendChild(panel);

        // ── Animation state ───────────────────────────────────────────
        var _mt3Mode          = 'standard';
        var _mt3CurrentCents  = 0;
        var _mt3SmoothedCents = 0;
        var _mt3RafId         = null;
        var _mt3LastTime      = null;
        var _mt3StrobeOffset  = 0;

        // ── Segment helpers ───────────────────────────────────────────
        function _setSegment(el, lit) {
            el.setAttribute('fill', lit ? _MT3_COL_SEG_LIT : _MT3_COL_SEG_UNLIT);
            el.style.filter = lit ? 'drop-shadow(0 0 5px #ff2200)' : 'none';
        }
        function _renderNote(letter) {
            var map = _TUNER_MT3_SEGMENTS[letter] || _TUNER_MT3_SEGMENTS[' '];
            for (var k = 0; k < _segKeys.length; k++) { _setSegment(_mt3SegEls[_segKeys[k]], map[k]); }
        }
        function _setSharp(lit) {
            for (var p = 0; p < _mt3SharpParts.length; p++) {
                _mt3SharpParts[p].setAttribute('fill', lit ? _MT3_COL_SEG_LIT : _MT3_COL_SEG_UNLIT);
            }
        }

        // ── Tick glow helpers ─────────────────────────────────────────
        function _dimAllTicks() {
            for (var ti = 0; ti < _TUNER_MT3_TICK_COUNT; ti++) {
                var isMajor = (ti % 5 === 0);
                _mt3TickEls[ti].setAttribute('stroke', _MT3_COL_TICK_DIM);
                _mt3TickEls[ti].setAttribute('stroke-width', isMajor ? '2' : '1');
                _mt3TickEls[ti].style.filter = 'none';
            }
        }

        // Light up a tick at index with given intensity (0=center, 1=adjacent, 2=outer)
        function _litTick(idx, intensity) {
            if (idx < 0 || idx >= _TUNER_MT3_TICK_COUNT) { return; }
            if (intensity === 0) {
                _mt3TickEls[idx].setAttribute('stroke', _MT3_COL_TICK_LIT);
                _mt3TickEls[idx].setAttribute('stroke-width', '3');
                _mt3TickEls[idx].style.filter = 'drop-shadow(0 0 4px #ff8800)';
            } else {
                // Only upgrade, never downgrade an already-brighter tick
                var curStroke = _mt3TickEls[idx].getAttribute('stroke');
                if (curStroke === _MT3_COL_TICK_LIT) { return; }
                _mt3TickEls[idx].setAttribute('stroke', 'rgba(255,136,0,0.55)');
                _mt3TickEls[idx].setAttribute('stroke-width', '2');
                _mt3TickEls[idx].style.filter = 'drop-shadow(0 0 2px #ff8800)';
            }
        }

        // Standard mode: light ticks near the current deviation
        function _highlightTicks(cents, hasSignal) {
            _dimAllTicks();
            if (!hasSignal) { return; }
            var clamped   = Math.max(-_TUNER_MT3_GAUGE_CENTS, Math.min(_TUNER_MT3_GAUGE_CENTS, cents));
            // Tick index 0 = −50¢, 25 = 0¢, 50 = +50¢  (2¢ per step)
            var targetIdx = Math.round((clamped + _TUNER_MT3_GAUGE_CENTS) / (2 * _TUNER_MT3_GAUGE_CENTS / (_TUNER_MT3_TICK_COUNT - 1)));
            targetIdx     = Math.max(0, Math.min(_TUNER_MT3_TICK_COUNT - 1, targetIdx));
            _litTick(targetIdx,     0);
            _litTick(targetIdx - 1, 1);
            _litTick(targetIdx + 1, 1);
        }

        // Strobe mode: 5 tick clusters drift across the arc
        function _updateStrobeTicks() {
            _dimAllTicks();
            for (var g = 0; g < _TUNER_MT3_STROBE_GROUP_COUNT; g++) {
                var baseAngle = _MT3_ARC_START + (g / _TUNER_MT3_STROBE_GROUP_COUNT) * _MT3_ARC_SPAN + _mt3StrobeOffset;
                // Wrap angle within arc span
                var relAngle  = ((baseAngle - _MT3_ARC_START) % _MT3_ARC_SPAN + _MT3_ARC_SPAN) % _MT3_ARC_SPAN;
                var floatIdx  = relAngle / _MT3_ARC_SPAN * (_TUNER_MT3_TICK_COUNT - 1);
                var nearIdx   = Math.max(0, Math.min(_TUNER_MT3_TICK_COUNT - 1, Math.round(floatIdx)));
                _litTick(nearIdx,     0);
                _litTick(nearIdx - 1, 1);
                _litTick(nearIdx + 1, 1);
            }
        }

        // ── Strobe RAF loop ───────────────────────────────────────────
        function _animateStrobe(now) {
            if (_mt3LastTime === null) { _mt3LastTime = now; }
            var dt = Math.min((now - _mt3LastTime) / 1000, 0.1);
            _mt3LastTime = now;

            var lerpFactor = 1 - Math.exp(-10 * dt);
            _mt3SmoothedCents += (_mt3CurrentCents - _mt3SmoothedCents) * lerpFactor;

            if (_mt3Mode === 'strobe') {
                if (Math.abs(_mt3SmoothedCents) > 0.1) {
                    var absCents   = Math.min(_TUNER_MT3_GAUGE_CENTS, Math.abs(_mt3SmoothedCents));
                    var normalized = Math.max(0, absCents - _TUNER_MT3_IN_TUNE_THR) / (_TUNER_MT3_GAUGE_CENTS - _TUNER_MT3_IN_TUNE_THR);
                    var speed      = _MT3_ARC_SPAN * Math.pow(normalized, 0.9);
                    if (_mt3SmoothedCents < 0) { speed = -speed; }
                    _mt3StrobeOffset = ((_mt3StrobeOffset + speed * dt) % _MT3_ARC_SPAN + _MT3_ARC_SPAN) % _MT3_ARC_SPAN;
                }
                _updateStrobeTicks();
            }

            _mt3RafId = requestAnimationFrame(_animateStrobe);
        }
        _mt3RafId = requestAnimationFrame(_animateStrobe);

        // ── MODE button ───────────────────────────────────────────────
        _mt3ModeBtn.addEventListener('click', function () {
            _mt3ModeBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.9)';
            setTimeout(function () {
                _mt3ModeBtn.style.boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)';
            }, 120);
            if (_mt3Mode === 'standard') {
                _mt3Mode = 'strobe';
                _mt3StrobeOffset = 0;
                _dimAllTicks();
            } else {
                _mt3Mode = 'standard';
                _highlightTicks(_mt3CurrentCents, _mt3CurrentCents !== 0);
            }
        });

        // ── Public: update ────────────────────────────────────────────
        function update(note, cents) {
            var hasNote = (note !== null && note !== undefined);
            _mt3CurrentCents = hasNote ? (cents || 0) : 0;
            if (_mt3Mode === 'standard') { _highlightTicks(_mt3CurrentCents, hasNote); }
            if (hasNote) {
                _renderNote(note.charAt(0));
                _setSharp(note.length > 1 && note.charAt(1) === '#');
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
