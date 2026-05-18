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

    let tau = 2;
    while (tau < halfLen) {
        if (yinBuffer[tau] < threshold) {
            while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
            break;
        }
        tau++;
    }
    if (tau === halfLen) return { freq: 0, confidence: 0, rms };

    const s0 = yinBuffer[tau - 1];
    const s1 = yinBuffer[tau];
    const s2 = tau + 1 < halfLen ? yinBuffer[tau + 1] : yinBuffer[tau];
    const denom = s0 - 2 * s1 + s2;
    const betterTau = denom === 0 ? tau : tau + (s0 - s2) / (2 * denom);

    return { freq: sampleRate / betterTau, confidence: 1 - yinBuffer[tau], rms };
}
