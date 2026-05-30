/**
 * Analogue gauge tuner visualization for the Slopsmith tuner plugin.
 *
 * Contract: window['_tunerViz_analogue-gauge'](container) → { update(note, cents, freq), destroy() }
 *   - note: string | null  (null = no signal)
 *   - cents: number        (deviation from target, −50…+50)
 *   - freq: number         (detected frequency in Hz)
 *
 * Layout:
 *   - Frequency drum slot: upper panel area, visible behind/above the needle
 *   - Semicircular needle gauge: centre of panel
 *   - Note name drum slot: below the needle
 *   - Lightbulb: adjacent to the note drum, glows red/orange within ±2 cents
 */
(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_LABEL_H = 28;           // px height of each drum label
    var _TUNER_NEEDLE_HALF_SWEEP = 70; // degrees from centre to arc extreme
    var _TUNER_IN_TUNE_THRESHOLD = 2;  // cents threshold for lightbulb
    var _TUNER_STRIP_START_MIDI = 36;  // C2
    var _TUNER_STRIP_END_MIDI = 72;    // C5
    var _TUNER_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    window['_tunerViz_analogue-gauge'] = function (container) {
        'use strict';

        // ── Helper: MIDI → Hz ─────────────────────────────────────────
        function _midiToFreq(m) { return Math.pow(2, (m - 69) / 12) * 440; }

        // ── Outer panel ───────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.className = 'w-full relative bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex flex-col items-center py-3 px-3 gap-2';

        // ── Frequency drum slot (upper, behind needle area) ───────────
        var freqWindow = document.createElement('div');
        freqWindow.className = 'w-full relative overflow-hidden rounded border border-gray-700 bg-gray-950';
        freqWindow.style.height = (_TUNER_LABEL_H * 2) + 'px';

        var freqStrip = document.createElement('div');
        freqStrip.className = 'absolute w-full';

        // Generate frequency labels
        for (var fm = _TUNER_STRIP_START_MIDI; fm <= _TUNER_STRIP_END_MIDI; fm++) {
            var fLabel = document.createElement('div');
            fLabel.className = 'flex items-center justify-center text-xs font-mono text-cyan-400 select-none';
            fLabel.style.height = _TUNER_LABEL_H + 'px';
            fLabel.textContent = _midiToFreq(fm).toFixed(1) + ' Hz';
            freqStrip.appendChild(fLabel);
        }
        freqWindow.appendChild(freqStrip);

        // Centre-line marker for the freq window
        var freqMark = document.createElement('div');
        freqMark.className = 'absolute left-0 right-0 border-t border-gray-600 pointer-events-none z-10';
        freqMark.style.top = (_TUNER_LABEL_H) + 'px'; // centre of 2-label window
        freqWindow.appendChild(freqMark);

        panel.appendChild(freqWindow);

        // ── Needle gauge (centre) ─────────────────────────────────────
        var gaugeWrap = document.createElement('div');
        gaugeWrap.className = 'relative flex items-end justify-center w-full';
        gaugeWrap.style.height = '90px';

        // SVG arc + graduation marks
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 200 100');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.bottom = '0';
        svg.style.left = '0';

        // Arc path: semicircle from bottom-left to bottom-right, radius 90
        var arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arcPath.setAttribute('d', 'M 20 100 A 80 80 0 0 1 180 100');
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', '#4b5563');
        arcPath.setAttribute('stroke-width', '2');
        svg.appendChild(arcPath);

        // Graduation marks: −50, −25, 0, +25, +50
        var _GRAD_MARKS = [
            { cents: -50, label: '-50' },
            { cents: -25, label: '-25' },
            { cents:   0, label:  '0'  },
            { cents:  25, label: '+25' },
            { cents:  50, label: '+50' }
        ];
        var cx = 100, cy = 100, r = 80;
        _GRAD_MARKS.forEach(function (m) {
            var angleDeg = (m.cents / 50) * _TUNER_NEEDLE_HALF_SWEEP; // −70 to +70
            var angleRad = (angleDeg - 90) * Math.PI / 180; // −90° offset: 0 points up
            var x1 = cx + (r - 6) * Math.cos(angleRad);
            var y1 = cy + (r - 6) * Math.sin(angleRad);
            var x2 = cx + r * Math.cos(angleRad);
            var y2 = cy + r * Math.sin(angleRad);
            var tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x1.toFixed(1));
            tick.setAttribute('y1', y1.toFixed(1));
            tick.setAttribute('x2', x2.toFixed(1));
            tick.setAttribute('y2', y2.toFixed(1));
            tick.setAttribute('stroke', m.cents === 0 ? '#6ee7b7' : '#6b7280');
            tick.setAttribute('stroke-width', m.cents === 0 ? '2.5' : '1.5');
            svg.appendChild(tick);

            // Label
            var lx = cx + (r - 16) * Math.cos(angleRad);
            var ly = cy + (r - 16) * Math.sin(angleRad);
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx.toFixed(1));
            text.setAttribute('y', ly.toFixed(1));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-size', '7');
            text.setAttribute('fill', '#9ca3af');
            text.setAttribute('font-family', 'monospace');
            text.textContent = m.label;
            svg.appendChild(text);
        });

        gaugeWrap.appendChild(svg);

        // Needle: a thin div pivoting at its bottom-centre
        var needleEl = document.createElement('div');
        needleEl.className = 'absolute bg-white rounded-full';
        needleEl.style.width = '2px';
        needleEl.style.height = '72px';
        needleEl.style.bottom = '0px';
        needleEl.style.left = '50%';
        needleEl.style.marginLeft = '-1px';
        needleEl.style.transformOrigin = 'bottom center';
        needleEl.style.transform = 'rotate(0deg)';
        gaugeWrap.appendChild(needleEl);

        // Pivot dot
        var pivotDot = document.createElement('div');
        pivotDot.className = 'absolute w-3 h-3 rounded-full bg-gray-400 border border-gray-600';
        pivotDot.style.bottom = '-6px';
        pivotDot.style.left = '50%';
        pivotDot.style.marginLeft = '-6px';
        gaugeWrap.appendChild(pivotDot);

        panel.appendChild(gaugeWrap);

        // ── Note drum + lightbulb row ─────────────────────────────────
        var noteRow = document.createElement('div');
        noteRow.className = 'flex items-center gap-2 w-full';

        // Note drum slot
        var noteWindow = document.createElement('div');
        noteWindow.className = 'flex-1 relative overflow-hidden rounded border border-gray-700 bg-gray-950';
        noteWindow.style.height = (_TUNER_LABEL_H * 2) + 'px';

        var noteStrip = document.createElement('div');
        noteStrip.className = 'absolute w-full';

        // Generate note labels
        for (var nm = _TUNER_STRIP_START_MIDI; nm <= _TUNER_STRIP_END_MIDI; nm++) {
            var nLabel = document.createElement('div');
            nLabel.className = 'flex items-center justify-center text-base font-bold text-white select-none';
            nLabel.style.height = _TUNER_LABEL_H + 'px';
            nLabel.textContent = _TUNER_NOTE_NAMES[nm % 12];
            noteStrip.appendChild(nLabel);
        }
        noteWindow.appendChild(noteStrip);

        // Centre-line marker for the note window
        var noteMark = document.createElement('div');
        noteMark.className = 'absolute left-0 right-0 border-t border-gray-600 pointer-events-none z-10';
        noteMark.style.top = (_TUNER_LABEL_H) + 'px';
        noteWindow.appendChild(noteMark);

        noteRow.appendChild(noteWindow);

        // Lightbulb element
        var bulbEl = document.createElement('div');
        bulbEl.className = 'w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex-shrink-0';
        noteRow.appendChild(bulbEl);

        panel.appendChild(noteRow);
        container.appendChild(panel);

        // ── State ─────────────────────────────────────────────────────
        var currentDrumY = 0;
        var targetDrumY = 0;
        var currentAngle = 0;
        var targetAngle = 0;
        var frozen = true;
        var lastTime = performance.now();
        var rafId = null;
        var prevNote = null;

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
            needleEl.style.transform = 'rotate(' + currentAngle + 'deg)';

            rafId = requestAnimationFrame(_animate);
        }

        rafId = requestAnimationFrame(_animate);

        // ── Drum positioning ──────────────────────────────────────────
        function _computeDrumY(freq, cents) {
            var midi = 69 + 12 * Math.log2(freq / 440);
            var midiRounded = Math.round(midi);
            var idx = Math.max(0, Math.min(_TUNER_STRIP_END_MIDI - _TUNER_STRIP_START_MIDI, midiRounded - _TUNER_STRIP_START_MIDI));
            // Centre the matched label in the 2-label window; window centre = _TUNER_LABEL_H from top
            var centreY = -idx * _TUNER_LABEL_H + _TUNER_LABEL_H * 0.5;
            // cents offset: +50 → half label up (negative = strip moves up), −50 → half label down
            var centOffset = -(cents / 50) * (_TUNER_LABEL_H / 2);
            return centreY + centOffset;
        }

        // ── Public API ────────────────────────────────────────────────
        function update(note, cents, freq) {
            if (note === null) {
                frozen = true;
                targetAngle = 0;
                // lightbulb unlit
                bulbEl.className = 'w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex-shrink-0';
                return;
            }

            frozen = false;

            // Snap on note change
            if (note !== prevNote) {
                var snapY = _computeDrumY(freq, cents);
                currentDrumY = snapY;
                targetDrumY = snapY;
            } else {
                targetDrumY = _computeDrumY(freq, cents);
            }
            prevNote = note;

            // Needle
            targetAngle = (cents / 50) * _TUNER_NEEDLE_HALF_SWEEP;

            // Lightbulb
            if (Math.abs(cents) <= _TUNER_IN_TUNE_THRESHOLD) {
                bulbEl.className = 'w-6 h-6 rounded-full bg-orange-400 border border-orange-300 flex-shrink-0 shadow-[0_0_10px_4px_rgba(251,146,60,0.8)]';
            } else {
                bulbEl.className = 'w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex-shrink-0';
            }
        }

        function destroy() {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            panel.remove();
        }

        return { update: update, destroy: destroy };
    };
})();
