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

    // Collect every local minimum below the threshold.
    const candidates = [];
    let bestTau = -1, bestVal = 1;
    let t = 2;
    while (t < halfLen) {
        if (yinBuffer[t] < threshold) {
            while (t + 1 < halfLen && yinBuffer[t + 1] < yinBuffer[t]) t++;
            candidates.push({ tau: t, val: yinBuffer[t] });
            if (yinBuffer[t] < bestVal) { bestVal = yinBuffer[t]; bestTau = t; }
        }
        t++;
    }
    if (candidates.length === 0) return { freq: 0, confidence: 0, rms };

    // Start from the global minimum (deepest dip = most reliable period).
    // Then octave-correct in BOTH directions:
    //  - undertone guard: if our pick is a multiple of a smaller-tau candidate
    //    with a comparably deep dip, that smaller tau is the true fundamental.
    //  - overtone guard handled implicitly: an octave-up overtone only wins the
    //    global min when its dip is genuinely deeper, which the multiple check
    //    below does not override.
    let tau = bestTau;
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.tau >= tau) break;                       // only consider smaller tau (higher freq)
        const ratio = tau / c.tau;
        const nearest = Math.round(ratio);
        if (nearest >= 2 && Math.abs(ratio - nearest) < 0.05 && c.val < bestVal * 1.5) {
            tau = c.tau;                               // pick is an undertone of c → use c
            break;
        }
    }

    const s0 = yinBuffer[tau - 1];
    const s1 = yinBuffer[tau];
    const s2 = tau + 1 < halfLen ? yinBuffer[tau + 1] : yinBuffer[tau];
    const denom = s0 - 2 * s1 + s2;
    const betterTau = denom === 0 ? tau : tau + (s0 - s2) / (2 * denom);

    return { freq: sampleRate / betterTau, confidence: 1 - yinBuffer[tau], rms };
}
