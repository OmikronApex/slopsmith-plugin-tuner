/**
 * YIN pitch detection worker.
 *
 * Receives { samples: Float32Array, sampleRate: number }, posts back
 * { freq, confidence, rms }. The samples ArrayBuffer should be passed
 * as transferable so no copy occurs across the worker boundary.
 */
self.onmessage = (e) => {
    const { samples, sampleRate } = e.data;
    self.postMessage(_yinDetect(samples, sampleRate));
};

function _yinDetect(buffer, sampleRate) {
    const threshold = 0.15;
    const halfLen = Math.floor(buffer.length / 2);
    const yinBuffer = new Float32Array(halfLen);

    let rms = 0;
    for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / buffer.length);
    if (rms < 0.01) return { freq: 0, confidence: 0, rms };

    let runningSum = 0;
    yinBuffer[0] = 1;
    for (let tau = 1; tau < halfLen; tau++) {
        let sum = 0;
        for (let i = 0; i < halfLen; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        yinBuffer[tau] = sum;
        runningSum += sum;
        yinBuffer[tau] = runningSum > 0 ? yinBuffer[tau] * tau / runningSum : 1;
    }

    // Collect every local minimum below the threshold rather than stopping at
    // the first (smallest-tau, highest-frequency) one. As a low string decays,
    // its 2nd harmonic can dip below the threshold too — taking the first
    // minimum then locks onto the octave-up overtone (E1 → E2/D2 drift).
    const candidates = [];
    let bestVal = 1;
    let t = 2;
    while (t < halfLen) {
        if (yinBuffer[t] < threshold) {
            while (t + 1 < halfLen && yinBuffer[t + 1] < yinBuffer[t]) t++;
            candidates.push({ tau: t, val: yinBuffer[t] });
            if (yinBuffer[t] < bestVal) bestVal = yinBuffer[t];
        }
        t++;
    }
    if (candidates.length === 0) return { freq: 0, confidence: 0, rms };

    // Prefer the lowest frequency (largest tau) whose CMNDF is still within 2× of
    // the best candidate — i.e. a credible fundamental, not a faint sub-octave.
    let tau = candidates[0].tau;
    for (let i = candidates.length - 1; i >= 0; i--) {
        if (candidates[i].val < bestVal * 2) { tau = candidates[i].tau; break; }
    }

    const s0 = yinBuffer[tau - 1];
    const s1 = yinBuffer[tau];
    const s2 = tau + 1 < halfLen ? yinBuffer[tau + 1] : yinBuffer[tau];
    const denom = s0 - 2 * s1 + s2;
    const betterTau = denom === 0 ? tau : tau + (s0 - s2) / (2 * denom);

    return { freq: sampleRate / betterTau, confidence: 1 - yinBuffer[tau], rms };
}
