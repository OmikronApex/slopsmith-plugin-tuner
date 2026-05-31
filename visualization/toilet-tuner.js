/**
 * Toilet Tuner visualization for the Slopsmith tuner plugin.
 *
 * Bathroom scene background; plunger slides left/right over the bowl based on
 * cents deviation; dips into bowl when in tune (±2 cents); wall calendar shows
 * the detected note name.
 *
 * Contract: window['_tunerViz_toilet-tuner'](container) → { update(note, cents, freq), destroy() }
 *   - note:  string | null  (null = no signal)
 *   - cents: number         (deviation from target, −50…+50)
 *   - freq:  number         (detected frequency in Hz)
 */
(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────
    var _TUNER_TT_IN_TUNE_THR  = 2;
    var _TUNER_TT_ASSET_BASE   = '/api/plugins/tuner/assets/';

    // Horizontal plunger range (% of panel width, applied to plunger left edge)
    var _TUNER_TT_LEFT_PCT     = 30;
    var _TUNER_TT_RIGHT_PCT    = 68;
    var _TUNER_TT_CENTRE_PCT   = 49;

    // Vertical plunger position (% of panel height)
    var _TUNER_TT_RAISED_TOP   = 35;
    var _TUNER_TT_DIPPED_TOP   = 52;

    window['_tunerViz_toilet-tuner'] = function (container) {
        'use strict';

        // ── Root panel — 1:1 square, full width ───────────────────────
        // padding-bottom: 100% trick: reliable square even with all-absolute children
        var panel = document.createElement('div');
        panel.className = 'relative w-full overflow-hidden select-none';
        panel.style.height        = '0';
        panel.style.paddingBottom = '100%';

        // ── Background ────────────────────────────────────────────────
        var bgImg = document.createElement('img');
        bgImg.src = _TUNER_TT_ASSET_BASE + 'Bathroom.svg';
        bgImg.style.position = 'absolute';
        bgImg.style.top      = '0';
        bgImg.style.left     = '0';
        bgImg.style.width    = '100%';
        bgImg.style.height   = '100%';
        bgImg.style.objectFit = 'cover';
        bgImg.className = 'pointer-events-none';
        panel.appendChild(bgImg);

        // ── Note label (over calendar on wall) ────────────────────────
        var noteEl = document.createElement('div');
        noteEl.className = 'absolute font-bold pointer-events-none';
        noteEl.style.right      = '9%';
        noteEl.style.top        = '9%';
        noteEl.style.fontSize   = '1.4rem';
        noteEl.style.color      = '#303332';
        noteEl.textContent      = '–';
        panel.appendChild(noteEl);

        // ── Plunger ───────────────────────────────────────────────────
        var plungerEl = document.createElement('img');
        plungerEl.src = _TUNER_TT_ASSET_BASE + 'Plunger.svg';
        plungerEl.className = 'absolute pointer-events-none';
        plungerEl.style.width     = '6%';
        plungerEl.style.left      = _TUNER_TT_CENTRE_PCT + '%';
        plungerEl.style.top       = _TUNER_TT_RAISED_TOP + '%';
        plungerEl.style.transform = 'translateX(-50%)';
        panel.appendChild(plungerEl);

        // ── Toilet bowl overlay (hides plunger cup when dipped) ───────
        var bowlEl = document.createElement('img');
        bowlEl.src = _TUNER_TT_ASSET_BASE + 'Toiletbowl.svg';
        bowlEl.className = 'absolute pointer-events-none';
        bowlEl.style.left       = '38%';
        bowlEl.style.top        = '52%';
        bowlEl.style.width      = '14%';
        bowlEl.style.visibility = 'hidden';
        panel.appendChild(bowlEl);

        container.appendChild(panel);

        // ── State ─────────────────────────────────────────────────────
        var _rafId        = null;
        var _currentNote  = null;
        var _currentCents = 0;
        var _plungerDipped = false;
        var _lastTime     = null;
        var _leftPct      = _TUNER_TT_CENTRE_PCT;
        var _topPct       = _TUNER_TT_RAISED_TOP;

        // ── Animation loop ────────────────────────────────────────────
        function _animate(now) {
            var dt = Math.min(((now - (_lastTime || now)) / 1000), 0.1);
            _lastTime = now;

            var inTune = _currentNote !== null && Math.abs(_currentCents) <= _TUNER_TT_IN_TUNE_THR;
            var targetLeft = _currentNote === null
                ? _TUNER_TT_CENTRE_PCT
                : _TUNER_TT_CENTRE_PCT + (_currentCents / 50) * (_TUNER_TT_RIGHT_PCT - _TUNER_TT_CENTRE_PCT);

            if (inTune && !_plungerDipped) {
                // Glide to centre first, then dip
                _leftPct += (targetLeft - _leftPct) * 8 * dt;
                if (Math.abs(_leftPct - _TUNER_TT_CENTRE_PCT) < 0.5) {
                    _topPct = _TUNER_TT_DIPPED_TOP;
                    _plungerDipped = true;
                    bowlEl.style.visibility = 'visible';
                }
            } else if (!inTune && _plungerDipped) {
                // Rise immediately, then re-enable horizontal tracking
                _topPct = _TUNER_TT_RAISED_TOP;
                _plungerDipped = false;
                bowlEl.style.visibility = 'hidden';
            }

            if (!_plungerDipped) {
                _leftPct += (targetLeft - _leftPct) * 8 * dt;
                _topPct  += (_TUNER_TT_RAISED_TOP - _topPct) * 6 * dt;
            }

            plungerEl.style.left = _leftPct.toFixed(2) + '%';
            plungerEl.style.top  = _topPct.toFixed(2)  + '%';

            _rafId = requestAnimationFrame(_animate);
        }

        // ── Public API ────────────────────────────────────────────────
        function update(note, cents) {
            _currentNote  = note;
            _currentCents = note === null ? 0 : cents;
            noteEl.textContent = note || '–';
        }

        function destroy() {
            if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
            panel.remove();
        }

        _rafId = requestAnimationFrame(_animate);

        return { update: update, destroy: destroy };
    };

})();
