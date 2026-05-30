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
    var _TUNER_LABEL_H = 22;           // px height of each drum label
    var _TUNER_NEEDLE_HALF_SWEEP = 75; // degrees from centre to arc extreme (±50 cents)
    var _TUNER_IN_TUNE_THRESHOLD = 2;
    var _TUNER_STRIP_START_MIDI = 14;  // ~18 Hz — covers 20 Hz minimum
    var _TUNER_STRIP_END_MIDI = 84;    // ~1047 Hz C6
    var _TUNER_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    // SVG gauge geometry — viewBox 200 × 110, pivot at bottom-centre
    var _SVG_CX = 100, _SVG_CY = 110, _SVG_R = 100, _SVG_NEEDLE_LEN = 92;

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
        gaugeFace.className = 'w-full relative rounded';
        gaugeFace.style.backgroundColor = '#e8e0cc';
        gaugeFace.style.height = '110px';

        // Frequency drum window — centred inside the gauge, behind the needle
        var freqWindow = document.createElement('div');
        freqWindow.style.position = 'absolute';
        freqWindow.style.overflow = 'hidden';
        freqWindow.style.backgroundColor = '#fff';
        freqWindow.style.border = '1px solid #bbb';
        freqWindow.style.width = '104px';
        freqWindow.style.height = (_TUNER_LABEL_H * 2) + 'px';
        freqWindow.style.left = 'calc(50% - 52px)';
        freqWindow.style.top = '34px';
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
            fLabel.style.fontSize = '10px';
            fLabel.style.fontFamily = 'monospace';
            fLabel.style.fontWeight = 'bold';
            fLabel.style.color = '#111';
            fLabel.style.userSelect = 'none';
            fLabel.textContent = _midiToFreq(fm).toFixed(1) + ' Hz';
            freqStrip.appendChild(fLabel);
        }
        freqWindow.appendChild(freqStrip);
        gaugeFace.appendChild(freqWindow);

        // SVG — arc, tick marks, needle, pivot (z above freq window)
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 200 110');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '2';

        // Arc: edge-to-edge semicircle, centre at bottom-centre of viewBox
        var arcPath = document.createElementNS(svgNS, 'path');
        arcPath.setAttribute('d', 'M 0 110 A 100 100 0 0 1 200 110');
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', '#222');
        arcPath.setAttribute('stroke-width', '1.5');
        svg.appendChild(arcPath);

        // Tick marks: red at ±50, grey elsewhere
        [-50, -25, 0, 25, 50].forEach(function (c) {
            var isExtreme = Math.abs(c) === 50;
            var angleDeg = (c / 50) * _TUNER_NEEDLE_HALF_SWEEP;
            var angleRad = (angleDeg - 90) * Math.PI / 180;
            var tickLen = isExtreme ? 10 : 6;
            var tick = document.createElementNS(svgNS, 'line');
            tick.setAttribute('x1', (_SVG_CX + (_SVG_R - tickLen) * Math.cos(angleRad)).toFixed(1));
            tick.setAttribute('y1', (_SVG_CY + (_SVG_R - tickLen) * Math.sin(angleRad)).toFixed(1));
            tick.setAttribute('x2', (_SVG_CX + _SVG_R * Math.cos(angleRad)).toFixed(1));
            tick.setAttribute('y2', (_SVG_CY + _SVG_R * Math.sin(angleRad)).toFixed(1));
            tick.setAttribute('stroke', isExtreme ? '#cc2200' : '#222');
            tick.setAttribute('stroke-width', isExtreme ? '2.5' : '1.5');
            svg.appendChild(tick);
        });

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
        noteRow.className = 'flex items-center gap-3 justify-center';

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
            nLabel.style.fontSize = '14px';
            nLabel.style.fontWeight = 'bold';
            nLabel.style.color = '#111';
            nLabel.style.userSelect = 'none';
            nLabel.textContent = _TUNER_NOTE_NAMES[nm % 12];
            noteStrip.appendChild(nLabel);
        }
        noteWindow.appendChild(noteStrip);
        noteRow.appendChild(noteWindow);

        // Lightbulb — rounded dome, glows red when in tune
        var bulbEl = document.createElement('div');
        bulbEl.style.width = '20px';
        bulbEl.style.height = '20px';
        bulbEl.style.borderRadius = '50%';
        bulbEl.style.backgroundColor = '#2a1010';
        bulbEl.style.border = '2px solid #4a2020';
        bulbEl.style.flexShrink = '0';
        noteRow.appendChild(bulbEl);

        panel.appendChild(noteRow);
        container.appendChild(panel);

        // ── State ─────────────────────────────────────────────────────
        var currentDrumY = 0, targetDrumY = 0;
        var currentAngle = 0, targetAngle = 0;
        var frozen = true;
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
            var idx = Math.max(0, Math.min(_TUNER_STRIP_END_MIDI - _TUNER_STRIP_START_MIDI, Math.round(midi) - _TUNER_STRIP_START_MIDI));
            return _TUNER_LABEL_H * (0.5 - idx) - (cents / 50) * (_TUNER_LABEL_H / 2);
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

            frozen = false;
            var newY = _computeDrumY(freq, cents);
            if (note !== prevNote) { currentDrumY = newY; }
            targetDrumY = newY;
            prevNote = note;

            targetAngle = (cents / 50) * _TUNER_NEEDLE_HALF_SWEEP;

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
