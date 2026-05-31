(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_PT_IN_TUNE_THR  = 2;
    var _TUNER_PT_LED_COUNT    = 9;
    var _TUNER_PT_CENTS_RANGE  = 40;

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

    window['_tunerViz_pt-100'] = function (container) {
        'use strict';

        // ── Chrome bezel ──────────────────────────────────────────────
        // 4:3 aspect ratio; top is a pronounced semi-circle, bottom a shallow curve
        var panel = document.createElement('div');
        panel.style.position    = 'relative';
        panel.style.width       = '100%';
        panel.style.aspectRatio = '4 / 3';
        panel.style.background  = 'linear-gradient(160deg, #e0e0e0 0%, #a8a8a8 30%, #c8c8c8 55%, #888 100%)';
        // top corners: large radius (semi-circle); bottom corners: shallow curve
        panel.style.borderRadius = '50% 50% 18% 18% / 52% 52% 14% 14%';
        panel.style.padding      = '4% 5%';
        panel.style.boxSizing    = 'border-box';
        panel.style.userSelect   = 'none';
        panel.style.overflow     = 'hidden';

        // ── Black panel face ──────────────────────────────────────────
        var face = document.createElement('div');
        face.style.position     = 'relative';
        face.style.width        = '100%';
        face.style.height       = '100%';
        face.style.background   = '#080808';
        face.style.borderRadius = '47% 47% 13% 13% / 48% 48% 11% 11%';
        face.style.overflow     = 'hidden';
        panel.appendChild(face);

        // ── LED arc ───────────────────────────────────────────────────
        // Shallow parabolic arc: LEDs span x=10%–90%, centre at top y=10%,
        // edges drop to y=17% — matches the gentle curve on the physical unit.
        var leds = [];
        for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) {
            var xPct = 10 + i * (80 / 8);          // 10 % → 90 %
            var dx   = (xPct - 50) / 40;            // −1 at edges, 0 at centre
            var yPct = 10 + 7 * dx * dx;            // 10 % at centre, 17 % at edges

            var led = document.createElement('div');
            led.style.position     = 'absolute';
            led.style.left         = xPct.toFixed(2) + '%';
            led.style.top          = yPct.toFixed(2) + '%';
            led.style.transform    = 'translate(-50%, -50%)';
            led.style.width        = '5%';
            led.style.aspectRatio  = '1 / 1';
            led.style.borderRadius = '50%';

            var isCentre = (i === 4);
            led.style.background = isCentre
                ? 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)'
                : 'radial-gradient(circle at 35% 35%, #00003a, #00001a)';
            led.style.border    = '1px solid ' + (isCentre ? '#400' : '#004');
            led.style.boxShadow = 'none';

            face.appendChild(led);
            leds.push(led);
        }

        // ── White divider line ────────────────────────────────────────
        // Separates the LED arc zone from the label / display zone below.
        var divider = document.createElement('div');
        divider.style.cssText = [
            'position:absolute',
            'left:3%',
            'right:3%',
            'top:24%',
            'height:1px',
            'background:#ffffff',
            'opacity:0.7',
            'pointer-events:none'
        ].join(';');
        face.appendChild(divider);

        // ── Range labels ──────────────────────────────────────────────
        // Sit just below the white divider line.
        function _makeLabel(text, leftPct) {
            var el = document.createElement('div');
            el.style.position   = 'absolute';
            el.style.left       = leftPct + '%';
            el.style.top        = '26%';
            el.style.transform  = 'translateX(-50%)';
            el.style.color      = '#cccccc';
            el.style.fontSize   = '50%';
            el.style.fontWeight = 'bold';
            el.style.fontFamily = 'sans-serif';
            el.style.lineHeight = '1';
            el.textContent      = text;
            face.appendChild(el);
        }

        _makeLabel('-40', 10);
        _makeLabel('b',   3.5);   // flat symbol on the reference (below -40 LED)
        _makeLabel('0',   50);
        _makeLabel('+40', 90);

        // ── LCD display (letter + # symbol inside one box) ────────────
        // Centred horizontally; occupies middle band of the panel face.
        var displayWrap = document.createElement('div');
        displayWrap.style.cssText = [
            'position:absolute',
            'left:50%',
            'top:33%',
            'transform:translateX(-50%)',
            'width:38%',
            'height:44%',
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

        // "#" symbol — inside the display box, right side
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

        // ── BATT. LED (always lit) ────────────────────────────────────
        var battWrap = document.createElement('div');
        battWrap.style.cssText = 'position:absolute;left:4%;bottom:8%;display:flex;align-items:center;gap:5%;pointer-events:none';

        var battLed = document.createElement('div');
        battLed.style.cssText = [
            'width:6%',
            'aspect-ratio:1/1',
            'border-radius:50%',
            'background:radial-gradient(circle at 35% 35%, #ff6644, #cc1100)',
            'box-shadow:0 0 5px 1px #ff3300, 0 0 10px 2px #aa1100',
            'border:1px solid #ff2200',
            'flex-shrink:0'
        ].join(';');

        var battLabel = document.createElement('span');
        battLabel.style.cssText = 'color:#cccccc;font-size:52%;font-weight:bold;letter-spacing:0.05em;font-family:sans-serif;';
        battLabel.textContent = 'BATT.';

        battWrap.appendChild(battLed);
        battWrap.appendChild(battLabel);
        face.appendChild(battWrap);

        // ── Brand label ───────────────────────────────────────────────
        var brandLabel = document.createElement('div');
        brandLabel.style.cssText = [
            'position:absolute',
            'bottom:8%',
            'left:50%',
            'transform:translateX(-50%)',
            'color:#cccccc',
            'font-size:60%',
            'font-weight:bold',
            'letter-spacing:0.1em',
            'font-family:sans-serif',
            'pointer-events:none'
        ].join(';');
        brandLabel.textContent = 'PT-100';
        face.appendChild(brandLabel);

        container.appendChild(panel);

        // ── Helpers ───────────────────────────────────────────────────

        function _setLed(index, lit) {
            var led      = leds[index];
            var isCentre = (index === 4);
            if (lit) {
                if (isCentre) {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #ff6644, #cc1100)';
                    led.style.boxShadow  = '0 0 5px 2px #ff3300, 0 0 10px 4px #aa1100';
                    led.style.border     = '1px solid #ff4400';
                } else {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #4488ff, #0033cc)';
                    led.style.boxShadow  = '0 0 5px 2px #2266ff, 0 0 10px 4px #0022aa';
                    led.style.border     = '1px solid #3366ff';
                }
            } else {
                if (isCentre) {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)';
                    led.style.boxShadow  = 'none';
                    led.style.border     = '1px solid #400';
                } else {
                    led.style.background = 'radial-gradient(circle at 35% 35%, #00003a, #00001a)';
                    led.style.boxShadow  = 'none';
                    led.style.border     = '1px solid #004';
                }
            }
        }

        function _updateLeds(cents, hasSignal) {
            if (!hasSignal) {
                for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) _setLed(i, false);
                return;
            }
            var c = Math.max(-_TUNER_PT_CENTS_RANGE, Math.min(_TUNER_PT_CENTS_RANGE, cents));
            var targetIdx = 4 + Math.round(c / 10);
            targetIdx = Math.max(0, Math.min(8, targetIdx));

            for (var j = 0; j < _TUNER_PT_LED_COUNT; j++) {
                var lit;
                if (c >= 0) {
                    lit = (j >= 4 && j <= targetIdx);
                } else {
                    lit = (j <= 4 && j >= targetIdx);
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

        // ── Public API ────────────────────────────────────────────────
        function update(note, cents, freq) {
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
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };

}());
