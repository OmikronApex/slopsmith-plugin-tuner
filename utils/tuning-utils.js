(function () {
    function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); }
    function midiToFreq(m) { return Math.pow(2, (m - 69) / 12) * 440; }

    const _NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    function midiToNote(m) { return _NOTE_NAMES[Math.round(m) % 12]; }

    function offsetsToFreqs(offsets, isBass) {
        const guitarBase = [40, 45, 50, 55, 59, 64];
        const bassBase   = [28, 33, 38, 43];
        const base = isBass ? bassBase : guitarBase;
        return offsets.map((offset, i) => {
            const root = i < base.length ? base[i] : base[base.length - 1];
            return midiToFreq(root + offset);
        });
    }

    function getTuningName(offsets) {
        if (!offsets || offsets.length === 0) return 'Unknown';
        const len = offsets.length;
        if (len !== 6 && len !== 4) return offsets.join(' ');

        const standard = {
            0: 'E Standard', '-1': 'Eb Standard', '-2': 'D Standard',
            '-3': 'C# Standard', '-4': 'C Standard', '-5': 'B Standard',
            '-6': 'Bb Standard', '-7': 'A Standard',
            '1': 'F Standard', '2': 'F# Standard',
        };
        if (offsets.every(o => o === offsets[0])) return standard[offsets[0]] || offsets.join(' ');

        if (offsets[0] === offsets[1] - 2 && offsets.slice(1).every(o => o === offsets[1])) {
            const names = ['E','F','F#','G','Ab','A','Bb','B','C','C#','D','Eb'];
            let idx = (offsets[0] + (len === 4 ? 4 : 0)) % 12;
            if (idx < 0) idx += 12;
            return `Drop ${names[idx]}`;
        }

        if (len === 6) {
            const named = {
                '-2,0,0,0,0,0': 'Drop D', '-4,-2,-2,-2,-2,-2': 'Drop C',
                '-2,-2,0,0,0,0': 'Double Drop D', '0,0,0,-1,0,0': 'Open G',
                '-2,-2,0,0,-2,-2': 'Open D', '-2,0,0,0,-2,0': 'DADGAD',
                '0,2,2,1,0,0': 'Open E', '-2,0,0,2,3,2': 'Open D (alt)',
            };
            if (named[offsets.join(',')]) return named[offsets.join(',')];
        }

        return offsets.join(' ');
    }

    window._tunerUtils = { freqToMidi, midiToFreq, midiToNote, offsetsToFreqs, getTuningName };
})();
