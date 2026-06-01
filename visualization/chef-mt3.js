/**
 * CHEF MT-3 tuner visualization for the Slopsmith tuner plugin.
 *
 * Inspired by classic chromatic pedal tuners:
 *   - Shiny black rectangular panel with chamfered edges and corner screws
 *   - 90° curved glass gauge arc spanning between the screw inner edges
 *   - 51 tick marks; glow fades in/out with audio signal presence
 *   - Red 7-segment display (bottom centre) with "#" symbol
 *   - Two rubber buttons flanked by panel labels: MODE (left), BRGHT. (right)
 *   - Standard mode: nearest tick cluster glows for current deviation
 *   - Strobe mode: groups of 3 bright ticks + lightspill drift with deviation
 *
 * Contract: window['_tunerViz_chef-mt3'](container) → { update(note, cents, freq, mode), destroy() }
 */
(function () {
    'use strict';

    // ── Module-level constants ─────────────────────────────────────────
    var _TUNER_MT3_IN_TUNE_THR        = 2;
    var _TUNER_MT3_GAUGE_CENTS        = 50;
    var _TUNER_MT3_TICK_COUNT         = 51;   // 0¢ centre + 25×2¢ per side
    var _TUNER_MT3_STROBE_GROUP_COUNT = 5;

    // ── Colours ────────────────────────────────────────────────────────
    var _MT3_COL_BG        = '#0a0a0a';
    var _MT3_COL_GAUGE_ARC = 'rgba(255,255,255,0.18)';
    var _MT3_COL_TICK_DIM  = 'rgba(255,255,255,0.45)';
    var _MT3_COL_TICK_LIT  = '#ff8800';
    var _MT3_COL_TICK_SPIL = 'rgba(255,136,0,0.52)';
    var _MT3_COL_SEG_LIT   = '#ff2200';
    var _MT3_COL_SEG_UNLIT = '#2a0000';
    var _MT3_COL_BUTTON    = '#1a1a1a';
    var _MT3_COL_LABEL     = '#c8c8c8';

    // ── Gauge SVG geometry ─────────────────────────────────────────────
    // viewBox "0 0 200 66": ratio 3.03 matches SVG element (width:100% height:auto on 5:3 panel)
    // 90° arc: 225°(−50¢) → 270°(apex) → 315°(+50¢); R=124, cy=138 → apex at y=14
    var _MT3_cx        = 100;
    var _MT3_cy        = 138;
    var _MT3_ARC_R     = 124;
    var _MT3_ARC_START = 5 * Math.PI / 4;
    var _MT3_ARC_SPAN  = Math.PI / 2;

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
        gaugeSvg.setAttribute('viewBox', '0 0 200 66');
        gaugeSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        gaugeSvg.style.position = 'absolute';
        gaugeSvg.style.top      = '5%';
        gaugeSvg.style.left     = '0';
        gaugeSvg.style.width    = '100%';
        gaugeSvg.style.height   = 'auto';
        gaugeSvg.style.overflow = 'visible';

        // SVG glow filter — applied to the glow tick group as a whole
        var _glowId     = 'mt3-glow-' + Math.random().toString(36).slice(2, 7);
        var _svgDefs    = document.createElementNS(_SVG_NS, 'defs');
        var _svgFilter  = document.createElementNS(_SVG_NS, 'filter');
        _svgFilter.setAttribute('id', _glowId);
        _svgFilter.setAttribute('x', '-60%'); _svgFilter.setAttribute('y', '-60%');
        _svgFilter.setAttribute('width', '220%'); _svgFilter.setAttribute('height', '220%');
        var _sfBlur  = document.createElementNS(_SVG_NS, 'feGaussianBlur');
        _sfBlur.setAttribute('stdDeviation', '1.8'); _sfBlur.setAttribute('result', 'blur');
        var _sfFlood = document.createElementNS(_SVG_NS, 'feFlood');
        _sfFlood.setAttribute('flood-color', '#ff8800'); _sfFlood.setAttribute('flood-opacity', '0.65');
        _sfFlood.setAttribute('result', 'col');
        var _sfComp  = document.createElementNS(_SVG_NS, 'feComposite');
        _sfComp.setAttribute('in', 'col'); _sfComp.setAttribute('in2', 'blur');
        _sfComp.setAttribute('operator', 'in'); _sfComp.setAttribute('result', 'glow');
        var _sfMerge = document.createElementNS(_SVG_NS, 'feMerge');
        var _sfMn1   = document.createElementNS(_SVG_NS, 'feMergeNode'); _sfMn1.setAttribute('in', 'glow');
        var _sfMn2   = document.createElementNS(_SVG_NS, 'feMergeNode'); _sfMn2.setAttribute('in', 'SourceGraphic');
        _sfMerge.appendChild(_sfMn1); _sfMerge.appendChild(_sfMn2);
        _svgFilter.appendChild(_sfBlur); _svgFilter.appendChild(_sfFlood);
        _svgFilter.appendChild(_sfComp); _svgFilter.appendChild(_sfMerge);
        _svgDefs.appendChild(_svgFilter);
        gaugeSvg.appendChild(_svgDefs);

        var _arcD = 'M ' + _MT3_ARC_SX.toFixed(2) + ' ' + _MT3_ARC_SY.toFixed(2) +
            ' A ' + _MT3_ARC_R + ' ' + _MT3_ARC_R + ' 0 0 1 ' +
            _MT3_ARC_EX.toFixed(2) + ' ' + _MT3_ARC_EY.toFixed(2);

        // Glass arc body — no dashed sheen overlay
        var arcBody = document.createElementNS(_SVG_NS, 'path');
        arcBody.setAttribute('d', _arcD);
        arcBody.setAttribute('fill', 'none');
        arcBody.setAttribute('stroke', _MT3_COL_GAUGE_ARC);
        arcBody.setAttribute('stroke-width', '16');
        arcBody.setAttribute('stroke-linecap', 'round');
        gaugeSvg.appendChild(arcBody);

        // dimGroup: base tick lines always shown at dim colour — constructed once, never updated
        var _dimGroup = document.createElementNS(_SVG_NS, 'g');
        gaugeSvg.appendChild(_dimGroup);

        // glowGroup: lit tick overlay with shared glow filter, opacity animated 0→1
        var _glowGroup = document.createElementNS(_SVG_NS, 'g');
        _glowGroup.setAttribute('filter', 'url(#' + _glowId + ')');
        _glowGroup.setAttribute('opacity', '0');
        gaugeSvg.appendChild(_glowGroup);

        var _mt3GlowTickEls = [];

        for (var i = 0; i < _TUNER_MT3_TICK_COUNT; i++) {
            var isMajor = (i % 5 === 0);
            var halfLen = isMajor ? 5 : 3;
            var a       = _MT3_ARC_START + (_MT3_ARC_SPAN / (_TUNER_MT3_TICK_COUNT - 1)) * i;
            var cosA    = Math.cos(a), sinA = Math.sin(a);
            var x1 = _MT3_cx + (_MT3_ARC_R - halfLen) * cosA;
            var y1 = _MT3_cy + (_MT3_ARC_R - halfLen) * sinA;
            var x2 = _MT3_cx + (_MT3_ARC_R + halfLen) * cosA;
            var y2 = _MT3_cy + (_MT3_ARC_R + halfLen) * sinA;

            var dimTick = document.createElementNS(_SVG_NS, 'line');
            dimTick.setAttribute('x1', String(x1)); dimTick.setAttribute('y1', String(y1));
            dimTick.setAttribute('x2', String(x2)); dimTick.setAttribute('y2', String(y2));
            dimTick.setAttribute('stroke', _MT3_COL_TICK_DIM);
            dimTick.setAttribute('stroke-width', '1');
            dimTick.setAttribute('stroke-linecap', 'round');
            _dimGroup.appendChild(dimTick);

            var glowTick = document.createElementNS(_SVG_NS, 'line');
            glowTick.setAttribute('x1', String(x1)); glowTick.setAttribute('y1', String(y1));
            glowTick.setAttribute('x2', String(x2)); glowTick.setAttribute('y2', String(y2));
            glowTick.setAttribute('stroke', 'none');
            glowTick.setAttribute('stroke-width', '1');
            glowTick.setAttribute('stroke-linecap', 'round');
            _glowGroup.appendChild(glowTick);
            _mt3GlowTickEls.push(glowTick);
        }

        // Arc-following labels
        [
            { t: 0.0, text: '-50', rOffset: +15, anchor: 'start'  },
            { t: 0.5, text:  '0',  rOffset: -26, anchor: 'middle' },
            { t: 1.0, text: '+50', rOffset: +15, anchor: 'end'    },
        ].forEach(function (lbl) {
            var ang = _MT3_ARC_START + lbl.t * _MT3_ARC_SPAN;
            var r   = _MT3_ARC_R + lbl.rOffset;
            var lx  = _MT3_cx + r * Math.cos(ang);
            var ly  = _MT3_cy + r * Math.sin(ang);
            var el  = document.createElementNS(_SVG_NS, 'text');
            el.setAttribute('x', String(lx));
            el.setAttribute('y', String(ly + 3));
            el.setAttribute('text-anchor', lbl.anchor);
            el.setAttribute('font-size', '7');
            el.setAttribute('fill', 'rgba(255,255,255,0.50)');
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

        // ── Buttons ───────────────────────────────────────────────────
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

        // ── Animation / glow state ────────────────────────────────────
        var _mt3Mode          = 'standard';
        var _mt3CurrentCents  = 0;
        var _mt3SmoothedCents = 0;
        var _mt3HasSignal     = false;
        var _mt3GlowOpacity   = 0;
        var _mt3RafId         = null;
        var _mt3LastTime      = null;
        var _mt3StrobeOffset  = 0;

        // Tick state: 0=dim, 1=spill, 2=bright  (computed each frame, never persisted between calls)
        var _mt3TickState     = [];
        var _mt3LastTickState = [];
        for (var ti = 0; ti < _TUNER_MT3_TICK_COUNT; ti++) {
            _mt3TickState.push(0);
            _mt3LastTickState.push(-1);   // -1 = unrendered, forces first paint
        }

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

        // ── Tick state helpers ────────────────────────────────────────
        function _clearTickStates() {
            for (var ti = 0; ti < _TUNER_MT3_TICK_COUNT; ti++) { _mt3TickState[ti] = 0; }
        }

        // Never downgrade: a bright centre tick won't be overwritten by a spill from another group
        function _setTickState(idx, level) {
            if (idx < 0 || idx >= _TUNER_MT3_TICK_COUNT) { return; }
            if (level > _mt3TickState[idx]) { _mt3TickState[idx] = level; }
        }

        // Standard mode: 1 bright + ±1 spill
        function _computeStandardStates(cents, hasSignal) {
            _clearTickStates();
            if (!hasSignal) { return; }
            var clamped   = Math.max(-_TUNER_MT3_GAUGE_CENTS, Math.min(_TUNER_MT3_GAUGE_CENTS, cents));
            var targetIdx = Math.round((clamped + _TUNER_MT3_GAUGE_CENTS) /
                (2 * _TUNER_MT3_GAUGE_CENTS / (_TUNER_MT3_TICK_COUNT - 1)));
            targetIdx = Math.max(0, Math.min(_TUNER_MT3_TICK_COUNT - 1, targetIdx));
            _setTickState(targetIdx,     2);
            _setTickState(targetIdx - 1, 1);
            _setTickState(targetIdx + 1, 1);
        }

        // Strobe mode: 3 bright ticks per group + ±1 spill on each outer edge
        function _computeStrobeStates() {
            _clearTickStates();
            for (var g = 0; g < _TUNER_MT3_STROBE_GROUP_COUNT; g++) {
                var baseAngle = _MT3_ARC_START + (g / _TUNER_MT3_STROBE_GROUP_COUNT) * _MT3_ARC_SPAN + _mt3StrobeOffset;
                var relAngle  = ((baseAngle - _MT3_ARC_START) % _MT3_ARC_SPAN + _MT3_ARC_SPAN) % _MT3_ARC_SPAN;
                var nearIdx   = Math.max(0, Math.min(_TUNER_MT3_TICK_COUNT - 1,
                    Math.round(relAngle / _MT3_ARC_SPAN * (_TUNER_MT3_TICK_COUNT - 1))));
                // 3 bright ticks centred at nearIdx
                _setTickState(nearIdx - 1, 2);
                _setTickState(nearIdx,     2);
                _setTickState(nearIdx + 1, 2);
                // Lightspill beyond the cluster
                _setTickState(nearIdx - 2, 1);
                _setTickState(nearIdx + 2, 1);
            }
        }

        // Apply current tick states to the glowGroup DOM — only write changed ticks
        function _applyTickStates() {
            for (var ti = 0; ti < _TUNER_MT3_TICK_COUNT; ti++) {
                var state = _mt3TickState[ti];
                if (state === _mt3LastTickState[ti]) { continue; }
                _mt3LastTickState[ti] = state;
                var el = _mt3GlowTickEls[ti];
                if (state === 2) {
                    el.setAttribute('stroke', _MT3_COL_TICK_LIT);
                    el.setAttribute('stroke-width', '3');
                } else if (state === 1) {
                    el.setAttribute('stroke', _MT3_COL_TICK_SPIL);
                    el.setAttribute('stroke-width', '2');
                } else {
                    el.setAttribute('stroke', 'none');
                    el.setAttribute('stroke-width', '1');
                }
            }
        }

        // ── RAF loop ──────────────────────────────────────────────────
        function _animateStrobe(now) {
            if (_mt3LastTime === null) { _mt3LastTime = now; }
            var dt = Math.min((now - _mt3LastTime) / 1000, 0.1);
            _mt3LastTime = now;

            // Smooth cents for strobe drift
            var lerpFactor = 1 - Math.exp(-10 * dt);
            _mt3SmoothedCents += (_mt3CurrentCents - _mt3SmoothedCents) * lerpFactor;

            // Animate glow opacity: fast fade-in (~120ms), slow fade-out (~400ms)
            var opacityTarget = _mt3HasSignal ? 1.0 : 0.0;
            var opacityRate   = _mt3HasSignal ? 8.0 : 2.5;
            _mt3GlowOpacity  += (opacityTarget - _mt3GlowOpacity) * (1 - Math.exp(-opacityRate * dt));
            _glowGroup.setAttribute('opacity', _mt3GlowOpacity.toFixed(3));

            // Advance strobe offset
            if (_mt3Mode === 'strobe' && Math.abs(_mt3SmoothedCents) > 0.1) {
                var absCents   = Math.min(_TUNER_MT3_GAUGE_CENTS, Math.abs(_mt3SmoothedCents));
                var normalized = Math.max(0, absCents - _TUNER_MT3_IN_TUNE_THR) / (_TUNER_MT3_GAUGE_CENTS - _TUNER_MT3_IN_TUNE_THR);
                var speed      = _MT3_ARC_SPAN * Math.pow(normalized, 0.9);
                if (_mt3SmoothedCents < 0) { speed = -speed; }
                _mt3StrobeOffset = ((_mt3StrobeOffset + speed * dt) % _MT3_ARC_SPAN + _MT3_ARC_SPAN) % _MT3_ARC_SPAN;
            }

            // Recompute and apply strobe tick states each frame
            if (_mt3Mode === 'strobe') { _computeStrobeStates(); }

            _applyTickStates();
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
                _clearTickStates();
            } else {
                _mt3Mode = 'standard';
                _computeStandardStates(_mt3CurrentCents, _mt3HasSignal);
            }
        });

        // ── Public: update ────────────────────────────────────────────
        function update(note, cents) {
            var hasNote = (note !== null && note !== undefined);
            _mt3HasSignal    = hasNote;
            _mt3CurrentCents = hasNote ? (cents || 0) : 0;
            if (_mt3Mode === 'standard') { _computeStandardStates(_mt3CurrentCents, hasNote); }
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
