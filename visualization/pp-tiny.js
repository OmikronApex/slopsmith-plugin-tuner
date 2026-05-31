(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_PT_IN_TUNE_THR  = 2;
    var _TUNER_PT_LED_COUNT    = 11;
    var _TUNER_PT_CENTS_RANGE  = 50;

    // Display colours
    var _TUNER_PT_LIT   = '#ff2200';
    var _TUNER_PT_UNLIT = '#1a0000';
    var _TUNER_PT_GLOW  = '0 0 6px 1px #ff2200, 0 0 12px 2px #cc1100';
    var _TUNER_PT_BG    = '#0d0000';

    // ── 8-segment map ─────────────────────────────────────────────────
    // Segments indexed: [a, b, c, d, e, f, g1, g2]
    var _TUNER_PT_SEGMENTS = {
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

    window['_tunerViz_pp-tiny'] = function (container) {
        'use strict';

        // ── Chrome bezel ──────────────────────────────────────────────
        // 4:3 panel. After uniform 4% padding:
        //   face_width  = 0.92 × W,  face_height = 0.67 × W  (W = panel width)
        //   face_aspect = 0.92 / 0.67 ≈ 1.373
        // Border-radius ry for a true visual semicircle top:
        //   ry_panel = (W/2) / (0.75W) = 66.7 %
        //   ry_face  = (0.46W) / (0.67W) ≈ 68.7 % → 69 %
        // Rectangle height below the semicircle, as a fraction of panel width.
        var _RECT_RATIO = 0.28;

        var panel = document.createElement('div');
        panel.style.position   = 'relative';
        panel.style.width      = '100%';
        panel.style.background = 'linear-gradient(160deg, #e0e0e0 0%, #a8a8a8 30%, #c8c8c8 55%, #888 100%)';
        panel.style.padding    = '4%';
        panel.style.boxSizing  = 'border-box';
        panel.style.userSelect = 'none';
        panel.style.overflow   = 'hidden';

        // ── Black panel face ──────────────────────────────────────────
        var face = document.createElement('div');
        face.style.position   = 'relative';
        face.style.width      = '100%';
        face.style.height     = '100%';
        face.style.background = '#080808';
        face.style.overflow   = 'hidden';
        panel.appendChild(face);

        // Compute and apply the semicircle+rectangle shape.
        // panel height  = radius + rectH  = w/2 + w*_RECT_RATIO
        // border-radius = radius px on top corners, fixed px on bottom corners.
        function _reshape() {
            var w = panel.offsetWidth;
            if (!w) return;
            var r    = w / 2;
            var pad  = w * 0.04;
            var rectH = w * _RECT_RATIO;
            panel.style.height       = (r + rectH) + 'px';
            panel.style.borderRadius = r + 'px ' + r + 'px 10px 10px';
            var fr = r - pad;
            face.style.borderRadius  = fr + 'px ' + fr + 'px 8px 8px';
        }

        var _ro = new ResizeObserver(_reshape);
        _ro.observe(panel);

        // ── Arc geometry ──────────────────────────────────────────────
        // Face aspect = face_width / face_height = 0.92 / 0.67 ≈ 1.373.
        // Element arcs share centre (50%, 50%) of face — same as the face's
        // border-radius arc centre (ry = 69% ≈ face_width/2 / face_height).
        // For a visually circular arc: ry_element = r × _ARC_ASPECT.
        //
        // Radii (r in % of face_width):
        //   LEDs    r = 34  → top at (50%,  3%), sides at (16%, 50%) / (84%, 50%)
        //   line    r = 29  → top at (50%, 10%), sides at (21%, 50%) / (79%, 50%)
        //   labels  r = 24  → top at (50%, 17%), sides at (26%, 50%) / (74%, 50%)
        //
        // Angles: 180° – i×18° for i = 0..10 (11 bulbs, 18° step = 180°/10).

        var _ARC_CX         = 50;
        var _ARC_CY         = 50;
        var _ARC_R_LEDS     = 40;
        var _ARC_R_LINE     = 35;
        var _ARC_R_LABELS   = 30;
        var _ARC_CENTRE_IDX = Math.floor(_TUNER_PT_LED_COUNT / 2); // 5

        function _arcPoint(i, r) {
            var angleDeg = 180 - i * (180 / (_TUNER_PT_LED_COUNT - 1));
            var rad = angleDeg * Math.PI / 180;
            return {
                x: _ARC_CX + r * Math.cos(rad),
                y: _ARC_CY - r * Math.sin(rad),
            };
        }

        // ── 1. LED arc ────────────────────────────────────────────────
        var leds = [];
        for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) {
            var pt  = _arcPoint(i, _ARC_R_LEDS);

            var led = document.createElement('div');
            led.style.position     = 'absolute';
            led.style.left         = pt.x.toFixed(2) + '%';
            led.style.top          = pt.y.toFixed(2) + '%';
            led.style.transform    = 'translate(-50%, -50%)';
            led.style.width        = '5%';
            led.style.aspectRatio  = '1 / 1';
            led.style.borderRadius = '50%';

            var isCentre = (i === _ARC_CENTRE_IDX);
            led.style.background = isCentre
                ? 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)'
                : 'radial-gradient(circle at 35% 35%, #2a2000, #141000)';
            led.style.border    = '1px solid ' + (isCentre ? '#400' : '#420');
            led.style.boxShadow = 'none';

            face.appendChild(led);
            leds.push(led);
        }

        // ── 2. White separator arc (SVG) ──────────────────────────────
        // Semicircle from (cx−r, cy) to (cx+r, cy) through the top.
        // viewBox "0 0 100 100" fills the square face exactly; rx=ry gives a
        // true circle. sweep=1 (clockwise in SVG y-down space) draws upward.
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible';

        var x0Line = _ARC_CX - _ARC_R_LINE;
        var x1Line = _ARC_CX + _ARC_R_LINE;
        var arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arcPath.setAttribute('d',
            'M ' + x0Line + ',' + _ARC_CY +
            ' A ' + _ARC_R_LINE + ',' + _ARC_R_LINE + ' 0 0 1 ' +
            x1Line + ',' + _ARC_CY);
        arcPath.setAttribute('stroke', 'rgba(255,255,255,0.65)');
        arcPath.setAttribute('stroke-width', '0.8');
        arcPath.setAttribute('fill', 'none');
        svg.appendChild(arcPath);
        face.appendChild(svg);

        // ── 3. Range labels ───────────────────────────────────────────
        var labelDefs = [
            { text: '-50', i: 0 },
            { text:  '0',  i: _ARC_CENTRE_IDX },
            { text: '+50', i: _TUNER_PT_LED_COUNT - 1 },
        ];
        labelDefs.forEach(function (d) {
            var pt = _arcPoint(d.i, _ARC_R_LABELS);
            var el = document.createElement('div');
            el.style.position   = 'absolute';
            el.style.left       = pt.x.toFixed(2) + '%';
            el.style.top        = pt.y.toFixed(2) + '%';
            el.style.transform  = 'translate(-50%, -50%)';
            el.style.color      = '#cccccc';
            el.style.fontSize   = '50%';
            el.style.fontWeight = 'bold';
            el.style.fontFamily = 'sans-serif';
            el.style.lineHeight = '1';
            el.textContent      = d.text;
            face.appendChild(el);
        });

        // ── 4. LCD display (letter + # inside one box) ────────────────
        // top=30%, height=40% → bottom=70%, centre=50%.
        var displayWrap = document.createElement('div');
        displayWrap.style.cssText = [
            'position:absolute',
            'left:50%',
            'top:30%',
            'transform:translateX(-50%)',
            'width:38%',
            'height:40%',
            'background:' + _TUNER_PT_BG,
            'border-radius:3px',
            'border:1px solid #2a0000',
            'display:flex',
            'flex-direction:row',
            'align-items:center',
            'justify-content:center',
            'gap:4%',
            'padding:4%',
            'box-sizing:border-box',
            'box-shadow:inset 0 0 8px #000'
        ].join(';');
        face.appendChild(displayWrap);

        // Letter digit (8-segment)
        var segContainer = document.createElement('div');
        segContainer.style.cssText = 'position:relative;flex:0 0 42%;height:80%;';
        displayWrap.appendChild(segContainer);

        var segmentEls = {};

        function _makeSeg(key, cssText) {
            var el = document.createElement('div');
            el.style.cssText = cssText + ';position:absolute;background:' + _TUNER_PT_UNLIT + ';border-radius:2px;transition:background 0.05s,box-shadow 0.05s;';
            segContainer.appendChild(el);
            segmentEls[key] = el;
        }

        var bw = '18%';
        _makeSeg('a',  'top:0%;left:10%;width:80%;height:' + bw);
        _makeSeg('b',  'top:4%;right:0%;width:' + bw + ';height:43%');
        _makeSeg('c',  'bottom:4%;right:0%;width:' + bw + ';height:43%');
        _makeSeg('d',  'bottom:0%;left:10%;width:80%;height:' + bw);
        _makeSeg('e',  'bottom:4%;left:0%;width:' + bw + ';height:43%');
        _makeSeg('f',  'top:4%;left:0%;width:' + bw + ';height:43%');
        _makeSeg('g1', 'top:50%;left:8%;width:34%;height:' + bw + ';transform:translateY(-50%)');
        _makeSeg('g2', 'top:50%;right:8%;width:34%;height:' + bw + ';transform:translateY(-50%)');

        // "#" symbol inside the display box
        var sharpEl = document.createElement('div');
        sharpEl.style.cssText = [
            'flex:0 0 30%',
            'height:75%',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'color:' + _TUNER_PT_UNLIT,
            'font-size:200%',
            'font-weight:bold',
            'font-family:sans-serif',
            'line-height:1',
            'text-shadow:none',
            'pointer-events:none'
        ].join(';');
        sharpEl.textContent = '#';
        displayWrap.appendChild(sharpEl);

        // ── 5. AUTO LED (lit when mode is 'free' or 'auto') ──────────
        // Anchored to the display's right edge (≈69%) at the display's
        // vertical midpoint (54% + 20% = 74%).
        var autoWrap = document.createElement('div');
        autoWrap.style.cssText = 'position:absolute;left:72%;top:67%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:4%;pointer-events:none';

        var autoLed = document.createElement('div');
        autoLed.style.cssText = [
            'width:6%',
            'aspect-ratio:1/1',
            'border-radius:50%',
            'background:radial-gradient(circle at 35% 35%, #3a0000, #1a0000)',
            'box-shadow:none',
            'border:1px solid #400',
            'flex-shrink:0'
        ].join(';');

        var autoLabel = document.createElement('span');
        autoLabel.style.cssText = 'color:#cccccc;font-size:52%;font-weight:bold;letter-spacing:0.05em;font-family:sans-serif;';
        autoLabel.textContent = 'AUTO';

        autoWrap.appendChild(autoLed);
        autoWrap.appendChild(autoLabel);
        face.appendChild(autoWrap);

        // ── Brand label ───────────────────────────────────────────────
        var brandLabel = document.createElement('div');
        brandLabel.style.cssText = [
            'position:absolute',
            'bottom:4%',
            'left:50%',
            'transform:translateX(-50%)',
            'color:#cccccc',
            'font-size:60%',
            'font-weight:bold',
            'letter-spacing:0.1em',
            'font-family:sans-serif',
            'pointer-events:none'
        ].join(';');
        brandLabel.textContent = 'PP-Tiny';
        face.appendChild(brandLabel);

        container.appendChild(panel);
        _reshape();

        // ── Helpers ───────────────────────────────────────────────────

        function _setLed(index, lit) {
            var led      = leds[index];
            var isCentre = (index === _ARC_CENTRE_IDX);
            if (lit) {
                if (isCentre) {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #ff6644, #cc1100)';
                    led.style.boxShadow  = '0 0 5px 2px #ff3300, 0 0 10px 4px #aa1100';
                    led.style.border     = '1px solid #ff4400';
                } else {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #ffee66, #cc9900)';
                    led.style.boxShadow  = '0 0 5px 2px #ffcc00, 0 0 10px 4px #aa8800';
                    led.style.border     = '1px solid #ffbb00';
                }
            } else {
                if (isCentre) {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)';
                    led.style.boxShadow  = 'none';
                    led.style.border     = '1px solid #400';
                } else {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #2a2000, #141000)';
                    led.style.boxShadow  = 'none';
                    led.style.border     = '1px solid #420';
                }
            }
        }

        function _updateLeds(cents, hasSignal) {
            if (!hasSignal) {
                for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) _setLed(i, false);
                return;
            }
            var c = Math.max(-_TUNER_PT_CENTS_RANGE, Math.min(_TUNER_PT_CENTS_RANGE, cents));
            var targetIdx = _ARC_CENTRE_IDX + Math.round(c / 10);
            targetIdx = Math.max(0, Math.min(_TUNER_PT_LED_COUNT - 1, targetIdx));

            for (var j = 0; j < _TUNER_PT_LED_COUNT; j++) {
                var lit;
                if (c >= 0) {
                    lit = (j >= _ARC_CENTRE_IDX && j <= targetIdx);
                } else {
                    lit = (j <= _ARC_CENTRE_IDX && j >= targetIdx);
                }
                _setLed(j, lit);
            }
        }

        var _segKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g1', 'g2'];

        function _setSegment(segEl, lit) {
            segEl.style.background = lit ? _TUNER_PT_LIT  : _TUNER_PT_UNLIT;
            segEl.style.boxShadow  = lit ? _TUNER_PT_GLOW : 'none';
        }

        function _renderNote(letter) {
            var map = _TUNER_PT_SEGMENTS[letter ? letter.toUpperCase() : ' '] || _TUNER_PT_SEGMENTS[' '];
            for (var k = 0; k < _segKeys.length; k++) {
                _setSegment(segmentEls[_segKeys[k]], map[k]);
            }
        }

        function _setSharp(lit) {
            sharpEl.style.color      = lit ? _TUNER_PT_LIT  : _TUNER_PT_UNLIT;
            sharpEl.style.textShadow = lit ? _TUNER_PT_GLOW : 'none';
        }

        function _setAuto(mode) {
            var lit = (mode === 'free' || mode === 'auto');
            autoLed.style.background = lit
                ? 'radial-gradient(circle at 35% 35%, #ff6644, #cc1100)'
                : 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)';
            autoLed.style.boxShadow  = lit ? '0 0 5px 1px #ff3300, 0 0 10px 2px #aa1100' : 'none';
            autoLed.style.border     = lit ? '1px solid #ff2200' : '1px solid #400';
        }

        // ── Public API ────────────────────────────────────────────────
        function update(note, cents, freq, mode) {
            _setAuto(mode);
            if (note === null) {
                _updateLeds(0, false);
                _renderNote(' ');
                _setSharp(false);
                return;
            }
            var letter  = note[0];
            var isSharp = note.length > 1 && note[1] === '#';
            _updateLeds(cents, true);
            _renderNote(letter);
            _setSharp(isSharp);
        }

        function destroy() {
            _ro.disconnect();
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };

}());
