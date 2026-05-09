// Guitar/Bass Tuner Plugin for Slopsmith
(function() {
    const _TUNER_MIN_YIN_SAMPLES = 4096;
    const _TUNER_FRAME_SIZE = 2048;
    const _TUNER_MIN_DETECTABLE_HZ = 30;

    let enabled = false;
    let audioCtx = null;
    let sourceNode = null;
    let stream = null;
    let processor = null;
    let gainNode = null;
    let accumBuffer = new Float32Array(0);
    let pendingBuffer = null;
    let detectInterval = null;
    let processingFrame = false;

    let uiContainer = null;
    let freqDisplay = null;
    let noteDisplay = null;
    let centsDisplay = null;
    let gaugeEl = null;
    let gaugeNeedle = null;
    let tuningSelect = null;
    let stringNoteContainer = null;
    let manualTargetFreq = null;

    const DEFAULT_TUNINGS = {
        "Guitar": {
            "Guitar Standard": [82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
            "Guitar Drop D": [73.42, 110.00, 146.83, 196.00, 246.94, 329.63],
            "Guitar Open G": [73.42, 98.00, 146.83, 196.00, 246.94, 293.66],
            "Guitar DADGAD": [73.42, 110.00, 146.83, 196.00, 220.00, 293.66],
            "Guitar Open E": [82.41, 123.47, 164.81, 207.65, 246.94, 329.63]
        },
        "Bass": {
            "Bass 4-string Standard": [41.20, 55.00, 73.42, 98.00],
            "Bass 4-string Drop D": [36.71, 55.00, 73.42, 98.00],
            "Bass 4-string D-Standard": [36.71, 48.99, 65.41, 87.31],
            "Bass 4-string Drop C": [32.70, 48.99, 65.41, 87.31],
            "Bass 5-string Standard": [30.87, 41.20, 55.00, 73.42, 98.00],
        }
    };

    let tunings = {};
    // Initial population (will be overwritten by loadConfig)
    Object.keys(DEFAULT_TUNINGS).forEach(group => {
        Object.assign(tunings, DEFAULT_TUNINGS[group]);
    });
    
    let selectedTuning = tunings["Guitar Standard"];
    let selectedTuningName = "Guitar Standard";

    async function loadConfig() {
        try {
            const resp = await fetch('/api/plugins/tuner/config');
            const config = await resp.json();
            
            // Rebuild tunings list
            tunings = {};
            // Add visible defaults
            Object.keys(DEFAULT_TUNINGS).forEach(groupName => {
                const group = DEFAULT_TUNINGS[groupName];
                Object.keys(group).forEach(name => {
                    if (!config.disabledTunings || !config.disabledTunings.includes(name)) {
                        tunings[name] = group[name];
                    }
                });
            });
            // Add custom
            if (config.customTunings) {
                Object.assign(tunings, config.customTunings);
            }

            if (config.lastTuning && tunings[config.lastTuning]) {
                selectedTuningName = config.lastTuning;
                selectedTuning = tunings[selectedTuningName];
            } else {
                // Fallback to first available if last is gone/disabled
                const first = Object.keys(tunings)[0];
                if (first) {
                    selectedTuningName = first;
                    selectedTuning = tunings[selectedTuningName];
                }
            }

            if (tuningSelect) {
                renderTuningOptions();
                tuningSelect.value = selectedTuningName;
            }
            if (uiContainer && !uiContainer.classList.contains('hidden')) {
                renderStringNotes();
            }
        } catch (e) {
            console.error('Tuner: Failed to load config', e);
        }
    }

    function renderTuningOptions() {
        if (!tuningSelect) return;
        tuningSelect.innerHTML = '';
        for (const name in tunings) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            tuningSelect.appendChild(opt);
        }
    }

    window._tunerReloadConfig = loadConfig;

    async function saveConfig() {
        try {
            await fetch('/api/plugins/tuner/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastTuning: selectedTuningName })
            });
        } catch (e) {
            console.error('Tuner: Failed to save config', e);
        }
    }

    function initUI() {
        if (uiContainer) return;

        uiContainer = document.createElement('div');
        uiContainer.id = 'tuner-plugin-ui';
        uiContainer.className = 'fixed bottom-20 right-5 w-72 bg-dark-800/95 border border-gray-800 rounded-xl p-4 text-white z-[1000] hidden flex-col items-center shadow-2xl backdrop-blur-md';

        const title = document.createElement('div');
        title.className = 'font-bold text-xs mb-3 text-gray-500 uppercase tracking-wider';
        title.textContent = 'TUNER';
        uiContainer.appendChild(title);

        tuningSelect = document.createElement('select');
        tuningSelect.className = 'w-full bg-dark-700 text-sm text-gray-200 border border-gray-800 mb-4 p-2 rounded-lg outline-none focus:border-accent transition';
        renderTuningOptions();
        tuningSelect.value = selectedTuningName;
        tuningSelect.onchange = (e) => {
            selectedTuningName = e.target.value;
            selectedTuning = tunings[selectedTuningName];
            manualTargetFreq = null;
            renderStringNotes();
            saveConfig();
        };
        uiContainer.appendChild(tuningSelect);

        stringNoteContainer = document.createElement('div');
        stringNoteContainer.className = 'flex justify-between w-full mb-4 gap-1';
        uiContainer.appendChild(stringNoteContainer);
        renderStringNotes();

        noteDisplay = document.createElement('div');
        noteDisplay.className = 'text-5xl font-black my-2 h-16 flex items-center justify-center';
        noteDisplay.textContent = '--';
        uiContainer.appendChild(noteDisplay);

        freqDisplay = document.createElement('div');
        freqDisplay.className = 'text-xs text-gray-500 mb-3 font-mono';
        freqDisplay.textContent = '0.0 Hz';
        uiContainer.appendChild(freqDisplay);

        // Gauge
        gaugeEl = document.createElement('div');
        gaugeEl.className = 'w-full h-2.5 bg-dark-900 border border-gray-800 rounded-full relative overflow-hidden mb-1.5';
        
        const centerMarker = document.createElement('div');
        centerMarker.className = 'absolute left-1/2 top-0 bottom-0 w-0.5 bg-accent z-10';
        gaugeEl.appendChild(centerMarker);

        gaugeNeedle = document.createElement('div');
        gaugeNeedle.className = 'absolute left-1/2 top-0 bottom-0 w-1 bg-white transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)]';
        gaugeEl.appendChild(gaugeNeedle);
        
        uiContainer.appendChild(gaugeEl);

        centsDisplay = document.createElement('div');
        centsDisplay.className = 'text-sm font-bold tracking-tight';
        centsDisplay.textContent = '0 cents';
        uiContainer.appendChild(centsDisplay);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'mt-5 w-full bg-dark-700 hover:bg-dark-600 border border-gray-800 text-gray-300 text-xs py-2 rounded-lg transition-colors uppercase font-semibold tracking-wide';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = disable;
        uiContainer.appendChild(closeBtn);

        document.body.appendChild(uiContainer);
    }

    async function enable() {
        if (enabled) return;
        await loadConfig();
        initUI();
        uiContainer.classList.remove('hidden');
        uiContainer.classList.add('flex');

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                }
            });

            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaStreamSource(stream);
            gainNode = audioCtx.createGain();
            gainNode.gain.value = 1.0;
            sourceNode.connect(gainNode);

            processor = audioCtx.createScriptProcessor(_TUNER_FRAME_SIZE, 1, 1);
            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                const combined = new Float32Array(accumBuffer.length + input.length);
                combined.set(accumBuffer);
                combined.set(input, accumBuffer.length);
                
                if (combined.length >= _TUNER_MIN_YIN_SAMPLES) {
                    pendingBuffer = combined.slice(combined.length - _TUNER_MIN_YIN_SAMPLES);
                    accumBuffer = new Float32Array(0);
                } else {
                    accumBuffer = combined;
                }
            };

            gainNode.connect(processor);
            processor.connect(audioCtx.destination);

            detectInterval = setInterval(() => {
                if (processingFrame || !pendingBuffer) return;
                const buf = pendingBuffer;
                pendingBuffer = null;
                processingFrame = true;
                
                const result = _tunerYinDetect(buf, audioCtx.sampleRate);
                updateUI(result);
                processingFrame = false;
            }, 50);

            enabled = true;
        } catch (e) {
            console.error('Tuner: Failed to start audio', e);
            alert('Tuner: Could not access microphone.');
            disable();
        }
    }

    function disable() {
        enabled = false;
        if (uiContainer) {
            uiContainer.classList.add('hidden');
            uiContainer.classList.remove('flex');
        }
        if (detectInterval) { clearInterval(detectInterval); detectInterval = null; }
        if (processor) { processor.disconnect(); processor = null; }
        if (gainNode) { gainNode.disconnect(); gainNode = null; }
        if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
    }

    function _tunerYinDetect(buffer, sampleRate) {
        const threshold = 0.15;
        const halfLen = Math.floor(buffer.length / 2);
        const yinBuffer = new Float32Array(halfLen);

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
            yinBuffer[tau] *= tau / runningSum;
        }

        let tau = 2;
        while (tau < halfLen) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
                break;
            }
            tau++;
        }
        if (tau === halfLen) return null;

        const s0 = yinBuffer[tau - 1];
        const s1 = yinBuffer[tau];
        const s2 = tau + 1 < halfLen ? yinBuffer[tau + 1] : yinBuffer[tau];
        const betterTau = tau + (s0 - s2) / (2 * (s0 - 2 * s1 + s2));

        const freq = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tau];
        return { freq, confidence };
    }

    function freqToMidi(f) {
        return 69 + 12 * Math.log2(f / 440);
    }

    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    function midiToNote(m) {
        const rounded = Math.round(m);
        return noteNames[rounded % 12];
    }

    function renderStringNotes() {
        if (!stringNoteContainer) return;
        stringNoteContainer.innerHTML = '';
        selectedTuning.forEach(f => {
            const btn = document.createElement('button');
            btn.dataset.freq = f;
            btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
            btn.textContent = midiToNote(freqToMidi(f));
            btn.onclick = () => {
                if (manualTargetFreq === f) {
                    manualTargetFreq = null; // Toggle off if clicked again
                } else {
                    manualTargetFreq = f;
                }
                // Visual feedback immediately
                Array.from(stringNoteContainer.children).forEach(b => {
                    const bFreq = parseFloat(b.dataset.freq);
                    if (Math.abs(bFreq - manualTargetFreq) < 0.1) {
                        b.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors';
                    } else {
                        b.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
                    }
                });
            };
            stringNoteContainer.appendChild(btn);
        });
    }

    function updateUI(result) {
        if (!result || result.confidence < 0.8 || result.freq < _TUNER_MIN_DETECTABLE_HZ) {
            // No strong signal
            return;
        }

        const freq = result.freq;
        freqDisplay.textContent = freq.toFixed(1) + ' Hz';

        let targetFreq;
        let isManual = false;
        if (manualTargetFreq) {
            targetFreq = manualTargetFreq;
            isManual = true;
        } else {
            // Find closest string in selected tuning
            targetFreq = selectedTuning[0];
            let minDiff = Math.abs(freq - targetFreq);
            for (let i = 1; i < selectedTuning.length; i++) {
                const diff = Math.abs(freq - selectedTuning[i]);
                if (diff < minDiff) {
                    minDiff = diff;
                    targetFreq = selectedTuning[i];
                }
            }
        }

        const targetMidi = freqToMidi(targetFreq);
        const actualMidi = freqToMidi(freq);
        const cents = (actualMidi - targetMidi) * 100;

        noteDisplay.textContent = midiToNote(targetMidi);
        centsDisplay.textContent = (cents > 0 ? '+' : '') + cents.toFixed(0) + ' cents';
        
        // Update string note highlighting
        Array.from(stringNoteContainer.children).forEach(btn => {
            const btnFreq = parseFloat(btn.dataset.freq);
            if (Math.abs(btnFreq - targetFreq) < 0.1) {
                if (isManual) {
                    // Full highlight for manual selection
                    btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors';
                } else {
                    // Border only for estimated
                    btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-accent border border-accent transition-colors';
                }
            } else {
                btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
            }
        });

        // Update gauge
        const gaugeRange = 50; // cents
        const percent = 50 + (cents / gaugeRange) * 50;
        const constrained = Math.max(0, Math.min(100, percent));
        gaugeNeedle.style.left = constrained + '%';

        if (Math.abs(cents) < 5) {
            noteDisplay.className = 'text-5xl font-black my-2 h-16 flex items-center justify-center text-green-400';
            gaugeNeedle.className = 'absolute left-1/2 top-0 bottom-0 w-1 bg-green-400 transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(74,222,128,0.5)]';
        } else {
            noteDisplay.className = 'text-5xl font-black my-2 h-16 flex items-center justify-center text-white';
            gaugeNeedle.className = 'absolute left-1/2 top-0 bottom-0 w-1 bg-white transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)]';
        }
    }

    // Add to slopsmith menu or shortcut
    // For now, we'll just expose it to window so it can be called
    window.tuner = {
        enable,
        disable,
        toggle: () => enabled ? disable() : enable()
    };

    console.log('Tuner plugin loaded. Use window.tuner.toggle() to open.');
    
    // Add a floating button to the UI
    function addButton() {
        if (document.getElementById('tuner-toggle-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'tuner-toggle-btn';
        btn.textContent = 'Tuner';
        btn.title = 'Open Tuner';
        btn.className = 'fixed bottom-5 right-5 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-gray-800 text-gray-300 hover:text-white rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-2xl z-[1001]';
        btn.onclick = window.tuner.toggle;
        document.body.appendChild(btn);
    }
    addButton();

})();
