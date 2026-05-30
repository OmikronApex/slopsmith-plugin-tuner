/**
 * Analogue gauge tuner visualization for the Slopsmith tuner plugin.
 *
 * Contract: window['_tunerViz_analogue-gauge'](container) → { update(note, cents, freq), destroy() }
 *   - note: string | null  (null = no signal)
 *   - cents: number        (deviation from target, −50…+50)
 *   - freq: number         (detected frequency in Hz)
 *
 * Layout (vintage analogue instrument panel):
 *   - Off-white panel face
 *   - Full-width black gauge section; frequency drum window centred inside it
 *   - Red SVG needle sweeps over the freq drum window
 *   - Note name drum + lightbulb below the gauge
 */
(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_LABEL_H = 12;           // px height of each drum label
    var _TUNER_NEEDLE_HALF_SWEEP = 90; // degrees — ±50 cents = horizontal (180° apart)
    var _TUNER_IN_TUNE_THRESHOLD = 2;
    var _TUNER_STRIP_START_MIDI = 14;  // ~18 Hz — covers 20 Hz minimum
    var _TUNER_STRIP_END_MIDI = 84;    // ~1047 Hz C6
    var _TUNER_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    // SVG gauge geometry — viewBox 200 × 110, pivot at bottom-centre
    // R=95 keeps arc endpoints ~5 SVG units from the viewBox edges to prevent clipping
    var _SVG_CX = 100, _SVG_CY = 110, _SVG_R = 95, _SVG_NEEDLE_LEN = 88;

    window['_tunerViz_analogue-gauge'] = function (container) {
        'use strict';

        var svgNS = 'http://www.w3.org/2000/svg';

        function _midiToFreq(m) { return Math.pow(2, (m - 69) / 12) * 440; }

        // ── Panel (off-white, vintage) ────────────────────────────────
        var panel = document.createElement('div');
        panel.className = 'w-full relative flex flex-col items-center gap-2 p-3 rounded-lg';
        panel.style.backgroundColor = '#e8e0cc';
        panel.style.border = '2px solid #b0a080';

        // ── Gauge section (full-width, black face) ────────────────────
        var gaugeFace = document.createElement('div');
        gaugeFace.className = 'w-full relative';
        gaugeFace.style.backgroundColor = '#e8e0cc';
        gaugeFace.style.height = '95px'; // matches cropped viewBox height (110-15)

        // Frequency drum window — centred inside the gauge, behind the needle
        var freqWindow = document.createElement('div');
        freqWindow.style.position = 'absolute';
        freqWindow.style.overflow = 'hidden';
        freqWindow.style.backgroundColor = '#fff';
        freqWindow.style.border = '1px solid #bbb';
        freqWindow.style.width = '104px';
        freqWindow.style.height = (_TUNER_LABEL_H * 2) + 'px';
        freqWindow.style.left = 'calc(50% - 52px)';
        freqWindow.style.top = '39px'; // half needle from pivot: 95 - 88/2 - 24/2 = 39
        freqWindow.style.zIndex = '1';

        var freqStrip = document.createElement('div');
        freqStrip.style.position = 'absolute';
        freqStrip.style.width = '100%';

        for (var fm = _TUNER_STRIP_START_MIDI; fm <= _TUNER_STRIP_END_MIDI; fm++) {
            var fLabel = document.createElement('div');
            fLabel.style.height = _TUNER_LABEL_H + 'px';
            fLabel.style.display = 'flex';
            fLabel.style.alignItems = 'center';
            fLabel.style.justifyContent = 'center';
            fLabel.style.fontSize = '11px';
            fLabel.style.fontFamily = 'monospace';
            fLabel.style.fontWeight = 'bold';
            fLabel.style.color = '#111';
            fLabel.style.userSelect = 'none';
            fLabel.textContent = _midiToFreq(fm).toFixed(1) + ' Hz';
            freqStrip.appendChild(fLabel);
        }
        freqWindow.appendChild(freqStrip);

        var freqIdle = document.createElement('div');
        freqIdle.style.position = 'absolute';
        freqIdle.style.inset = '0';
        freqIdle.style.display = 'flex';
        freqIdle.style.alignItems = 'center';
        freqIdle.style.justifyContent = 'center';
        freqIdle.style.backgroundColor = '#fff';
        freqIdle.style.fontSize = '11px';
        freqIdle.style.fontFamily = 'monospace';
        freqIdle.style.fontWeight = 'bold';
        freqIdle.style.color = '#111';
        freqIdle.style.zIndex = '2';
        freqIdle.textContent = '---';
        freqWindow.appendChild(freqIdle);

        gaugeFace.appendChild(freqWindow);

        // SVG — arc, tick marks, needle, pivot (z above freq window)
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 15 200 95'); // crop 15px dead space above arc top
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '2';
        svg.style.overflow = 'visible'; // prevent viewBox from clipping arc edges

        // Arc: R=95 keeps endpoints ~5 SVG units from the viewBox edges
        var arcPath = document.createElementNS(svgNS, 'path');
        arcPath.setAttribute('d', 'M 5 110 A 95 95 0 0 1 195 110');
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', '#222');
        arcPath.setAttribute('stroke-width', '1.5');
        svg.appendChild(arcPath);

        // Tick marks: long every 10 cents, 4 short between each (every 2 cents).
        // 5 outermost marks on each side (|c| >= 42) in red.
        for (var tc = -50; tc <= 50; tc += 2) {
            var isLong  = (tc % 10 === 0);
            var isRed   = Math.abs(tc) >= 42;
            var tLen    = isLong ? 10 : 5;
            var tColor  = isRed ? '#cc2200' : '#222';
            var tWidth  = isLong ? 1.5 : 1;
            var tAngleRad = ((tc / 50) * _TUNER_NEEDLE_HALF_SWEEP - 90) * Math.PI / 180;
            var ttick = document.createElementNS(svgNS, 'line');
            ttick.setAttribute('x1', (_SVG_CX + (_SVG_R - tLen) * Math.cos(tAngleRad)).toFixed(1));
            ttick.setAttribute('y1', (_SVG_CY + (_SVG_R - tLen) * Math.sin(tAngleRad)).toFixed(1));
            ttick.setAttribute('x2', (_SVG_CX + _SVG_R * Math.cos(tAngleRad)).toFixed(1));
            ttick.setAttribute('y2', (_SVG_CY + _SVG_R * Math.sin(tAngleRad)).toFixed(1));
            ttick.setAttribute('stroke', tColor);
            ttick.setAttribute('stroke-width', String(tWidth));
            svg.appendChild(ttick);
        }

        // Needle line (pivot at SVG bottom-centre; x2/y2 updated in RAF)
        var needleLine = document.createElementNS(svgNS, 'line');
        needleLine.setAttribute('x1', '100');
        needleLine.setAttribute('y1', '110');
        needleLine.setAttribute('x2', '100');
        needleLine.setAttribute('y2', String(110 - _SVG_NEEDLE_LEN)); // initial: 0 cents
        needleLine.setAttribute('stroke', '#cc2200');
        needleLine.setAttribute('stroke-width', '2');
        needleLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(needleLine);

        // Pivot cap
        var pivotCap = document.createElementNS(svgNS, 'circle');
        pivotCap.setAttribute('cx', '100');
        pivotCap.setAttribute('cy', '110');
        pivotCap.setAttribute('r', '5');
        pivotCap.setAttribute('fill', '#cc2200');
        svg.appendChild(pivotCap);

        gaugeFace.appendChild(svg);
        panel.appendChild(gaugeFace);

        // ── Note drum + lightbulb row (below gauge) ───────────────────
        var noteRow = document.createElement('div');
        noteRow.className = 'w-full relative flex justify-center items-center';

        var noteWindow = document.createElement('div');
        noteWindow.style.position = 'relative';
        noteWindow.style.overflow = 'hidden';
        noteWindow.style.backgroundColor = '#fff';
        noteWindow.style.border = '1px solid #999';
        noteWindow.style.width = '48px';
        noteWindow.style.height = (_TUNER_LABEL_H * 2) + 'px';

        var noteStrip = document.createElement('div');
        noteStrip.style.position = 'absolute';
        noteStrip.style.width = '100%';

        for (var nm = _TUNER_STRIP_START_MIDI; nm <= _TUNER_STRIP_END_MIDI; nm++) {
            var nLabel = document.createElement('div');
            nLabel.style.height = _TUNER_LABEL_H + 'px';
            nLabel.style.display = 'flex';
            nLabel.style.alignItems = 'center';
            nLabel.style.justifyContent = 'center';
            nLabel.style.fontSize = '10px';
            nLabel.style.fontWeight = 'bold';
            nLabel.style.color = '#111';
            nLabel.style.userSelect = 'none';
            nLabel.textContent = _TUNER_NOTE_NAMES[nm % 12];
            noteStrip.appendChild(nLabel);
        }
        noteWindow.appendChild(noteStrip);

        var noteIdle = document.createElement('div');
        noteIdle.style.position = 'absolute';
        noteIdle.style.inset = '0';
        noteIdle.style.display = 'flex';
        noteIdle.style.alignItems = 'center';
        noteIdle.style.justifyContent = 'center';
        noteIdle.style.backgroundColor = '#fff';
        noteIdle.style.fontSize = '10px';
        noteIdle.style.fontWeight = 'bold';
        noteIdle.style.color = '#111';
        noteIdle.style.zIndex = '2';
        noteIdle.textContent = '---';
        noteWindow.appendChild(noteIdle);

        // Lightbulb — absolutely offset from panel centre so note window stays centred
        // noteWindow is 48px wide → bulb left edge = 50% + 24px (half window) + 6px gap
        var bulbEl = document.createElement('div');
        bulbEl.style.position = 'absolute';
        bulbEl.style.left = 'calc(50% + 30px)';
        bulbEl.style.top = '50%';
        bulbEl.style.transform = 'translateY(-50%)';
        bulbEl.style.width = '20px';
        bulbEl.style.height = '20px';
        bulbEl.style.borderRadius = '50%';
        bulbEl.style.backgroundColor = '#2a1010';
        bulbEl.style.border = '2px solid #4a2020';
        noteRow.appendChild(noteWindow);
        noteRow.appendChild(bulbEl);

        panel.appendChild(noteRow);
        container.appendChild(panel);

        // ── State ─────────────────────────────────────────────────────
        var currentDrumY = 0, targetDrumY = 0;
        var currentAngle = 0, targetAngle = 0;
        var frozen = true;
        var hasEverHadSignal = false;
        var lastTime = performance.now();
        var rafId = null;
        var prevNote = null;

        // ── Needle SVG update ─────────────────────────────────────────
        function _setNeedle(angleDeg) {
            var rad = (angleDeg - 90) * Math.PI / 180;
            needleLine.setAttribute('x2', (_SVG_CX + _SVG_NEEDLE_LEN * Math.cos(rad)).toFixed(1));
            needleLine.setAttribute('y2', (_SVG_CY + _SVG_NEEDLE_LEN * Math.sin(rad)).toFixed(1));
        }

        // ── Drum position ─────────────────────────────────────────────
        function _computeDrumY(freq, cents) {
            var midi = 69 + 12 * Math.log2(freq / 440);
            // Use target MIDI (back out cents deviation) so the drum stays locked on
            // the target note. screen.js passes unclamped cents, so clamp to ±50 here.
            var targetMidi = midi - cents / 100;
            var clamped = Math.max(-50, Math.min(50, cents));
            var idx = Math.max(0, Math.min(_TUNER_STRIP_END_MIDI - _TUNER_STRIP_START_MIDI, Math.round(targetMidi) - _TUNER_STRIP_START_MIDI));
            return _TUNER_LABEL_H * (0.5 - idx) - (clamped / 50) * (_TUNER_LABEL_H / 2);
        }

        // ── Animation loop ────────────────────────────────────────────
        function _animate() {
            var now = performance.now();
            var dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;
            var lf = 1 - Math.exp(-10 * dt);

            if (!frozen) {
                currentDrumY += (targetDrumY - currentDrumY) * lf;
                freqStrip.style.transform = 'translateY(' + currentDrumY + 'px)';
                noteStrip.style.transform = 'translateY(' + currentDrumY + 'px)';
            }

            currentAngle += (targetAngle - currentAngle) * lf;
            _setNeedle(currentAngle);

            rafId = requestAnimationFrame(_animate);
        }

        rafId = requestAnimationFrame(_animate);

        // ── Public API ────────────────────────────────────────────────
        function update(note, cents, freq) {
            if (note === null) {
                frozen = true;
                targetAngle = 0;
                bulbEl.style.backgroundColor = '#2a1010';
                bulbEl.style.border = '2px solid #4a2020';
                bulbEl.style.boxShadow = 'none';
                return;
            }

            if (!hasEverHadSignal) {
                hasEverHadSignal = true;
                freqIdle.style.display = 'none';
                noteIdle.style.display = 'none';
            }

            frozen = false;
            var newY = _computeDrumY(freq, cents);
            if (note !== prevNote) { currentDrumY = newY; }
            targetDrumY = newY;
            prevNote = note;

            targetAngle = (Math.max(-50, Math.min(50, cents)) / 50) * _TUNER_NEEDLE_HALF_SWEEP;

            if (Math.abs(cents) <= _TUNER_IN_TUNE_THRESHOLD) {
                bulbEl.style.backgroundColor = '#cc3300';
                bulbEl.style.border = '2px solid #ff5522';
                bulbEl.style.boxShadow = '0 0 10px 4px rgba(200,50,0,0.85)';
            } else {
                bulbEl.style.backgroundColor = '#2a1010';
                bulbEl.style.border = '2px solid #4a2020';
                bulbEl.style.boxShadow = 'none';
            }
        }

        function destroy() {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };
})();
