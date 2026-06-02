(function() {
    const _TUNER_MIN_YIN_SAMPLES = 4096;
    const _TUNER_FRAME_SIZE = 2048;
    const _TUNER_MIN_DETECTABLE_HZ = 20;
    const _FREQ_HISTORY_LEN = 3;
    const _WARMUP_FRAMES = 2;

    let _audioCtx = null;
    let _sourceNode = null;
    let _stream = null;
    let _processor = null;
    let _gainNode = null;
    let _accumBuffer = new Float32Array(0);
    let _pendingBuffer = null;
    let _detectInterval = null;
    let _processingFrame = false;
    let _yinWorker = null;
    let _freqHistory = [];
    let _validFrameCount = 0;
    let _lastFreq = 0;
    let _onResult = null;
    let _usingDesktopBridge = false;
    let _bridgeInterval = null;

    function _octaveFold(freq, ref) {
        if (!ref || freq <= 0) return freq;
        while (freq > ref * 1.414) freq /= 2;
        while (freq < ref / 1.414) freq *= 2;
        return freq;
    }

    function _median(arr) {
        if (!arr.length) return 0;
        var s = arr.slice().sort(function(a, b) { return a - b; });
        var mid = Math.floor(s.length / 2);
        return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    function _handleYinResult(result) {
        const rms = result ? result.rms : 0;
        const hasSignal = rms > 0.01;

        if (!result || (!hasSignal && result.confidence < 0.5) || (result.freq < _TUNER_MIN_DETECTABLE_HZ && result.freq !== 0)) {
            _validFrameCount = 0; _freqHistory = []; _lastFreq = 0;
            if (_onResult) _onResult({ smoothedFreq: null, rms, hasSignal: false });
            return;
        }

        if (result.confidence < 0.5 && hasSignal) {
            _validFrameCount = 0; _freqHistory = []; _lastFreq = 0;
            if (_onResult) _onResult({ smoothedFreq: null, rms, hasSignal: false });
            return;
        }

        _freqHistory.push(_octaveFold(result.freq, _lastFreq));
        if (_freqHistory.length > _FREQ_HISTORY_LEN) _freqHistory.shift();
        _validFrameCount++;

        if (_validFrameCount <= _WARMUP_FRAMES) {
            if (_onResult) _onResult({ smoothedFreq: null, rms, hasSignal });
            return;
        }

        const smoothedFreq = _median(_freqHistory);
        _lastFreq = smoothedFreq;
        if (_onResult) _onResult({ smoothedFreq, rms, hasSignal });
    }

    async function _tryBridgeStart(audioInputMode) {
        if (audioInputMode === 'browser') return false;
        var desktop = (typeof window !== 'undefined') ? window.slopsmithDesktop : null;
        if (!desktop || !desktop.isDesktop || !desktop.audio
            || typeof desktop.audio.getPitchDetection !== 'function'
            || typeof desktop.audio.isAvailable !== 'function') return false;

        var available = false;
        try { available = await desktop.audio.isAvailable(); } catch (_) {}
        if (!available) return false;

        var mlActive = false;
        try {
            if (typeof desktop.audio.isMlNoteDetection === 'function') {
                mlActive = (await desktop.audio.isMlNoteDetection()) === true;
            }
        } catch (_) {}
        if (mlActive) {
            console.log('[tuner] bridge skipped — ML detector active, using browser pipeline');
            return false;
        }

        try {
            var running = typeof desktop.audio.isAudioRunning === 'function'
                ? await desktop.audio.isAudioRunning() : false;
            if (!running && typeof desktop.audio.startAudio === 'function') {
                await desktop.audio.startAudio();
            }
        } catch (_) {}

        _usingDesktopBridge = true;
        console.log('[tuner] using desktop JUCE bridge for audio input');

        _bridgeInterval = setInterval(async function() {
            try {
                var p = await desktop.audio.getPitchDetection();
                if (p && p.midiNote >= 0 && p.frequency > 0 && p.confidence >= 0.15) {
                    if (_onResult) _onResult({ smoothedFreq: p.frequency, rms: 1.0, hasSignal: true });
                } else {
                    if (_onResult) _onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
                }
            } catch (e) {
                console.warn('[tuner] bridge poll failed:', e && e.message ? e.message : e);
                if (_onResult) _onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
            }
        }, 30);

        return true;
    }

    async function _doStart(deviceId, channel, audioInputMode) {
        var bridgeStarted = await _tryBridgeStart(audioInputMode || 'auto');
        if (bridgeStarted) return;
        const constraints = {
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }
        };
        if (deviceId) constraints.audio.deviceId = { exact: deviceId };

        try {
            _stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            if (e.name === 'OverconstrainedError' && deviceId) {
                delete constraints.audio.deviceId;
                delete constraints.audio.channelCount;
            } else if (e.name === 'NotFoundError' && deviceId) {
                delete constraints.audio.deviceId;
            } else if (e.name === 'OverconstrainedError') {
                delete constraints.audio.channelCount;
            } else {
                throw e;
            }
            _stream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        _sourceNode = _audioCtx.createMediaStreamSource(_stream);
        _gainNode = _audioCtx.createGain();
        _gainNode.gain.value = 1.0;

        if (_sourceNode.channelCount >= 2 && channel !== 'mono') {
            const splitter = _audioCtx.createChannelSplitter(2);
            const merger = _audioCtx.createChannelMerger(1);
            _sourceNode.connect(splitter);
            splitter.connect(merger, channel === 'left' ? 0 : 1, 0);
            merger.connect(_gainNode);
        } else {
            _sourceNode.connect(_gainNode);
        }

        _processor = _audioCtx.createScriptProcessor(_TUNER_FRAME_SIZE, 1, 1);
        _processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const combined = new Float32Array(_accumBuffer.length + input.length);
            combined.set(_accumBuffer);
            combined.set(input, _accumBuffer.length);
            if (combined.length >= _TUNER_MIN_YIN_SAMPLES) {
                _pendingBuffer = combined.slice(combined.length - _TUNER_MIN_YIN_SAMPLES);
                _accumBuffer = combined.slice(input.length);
            } else {
                _accumBuffer = combined;
            }
        };

        _gainNode.connect(_processor);
        _processor.connect(_audioCtx.destination);

        _yinWorker = new Worker('/api/plugins/tuner/workers/yin.js');
        _yinWorker.onmessage = (e) => { _handleYinResult(e.data); _processingFrame = false; };
        _yinWorker.onerror = (e) => { console.error('Tuner: YIN worker error', e); _processingFrame = false; };

        _detectInterval = setInterval(() => {
            if (_processingFrame || !_pendingBuffer || !_yinWorker) return;
            const buf = _pendingBuffer;
            _pendingBuffer = null;
            _processingFrame = true;
            _yinWorker.postMessage({ samples: buf, sampleRate: _audioCtx.sampleRate }, [buf.buffer]);
        }, 30);
    }

    function _doStop() {
        if (_bridgeInterval) { clearInterval(_bridgeInterval); _bridgeInterval = null; }
        _usingDesktopBridge = false;
        if (_detectInterval) { clearInterval(_detectInterval); _detectInterval = null; }
        if (_yinWorker) { _yinWorker.terminate(); _yinWorker = null; }
        _processingFrame = false;
        _pendingBuffer = null;
        _accumBuffer = new Float32Array(0);
        _freqHistory = [];
        _validFrameCount = 0;
        _lastFreq = 0;
        if (_processor) { _processor.disconnect(); _processor = null; }
        if (_gainNode) { _gainNode.disconnect(); _gainNode = null; }
        if (_sourceNode) { _sourceNode.disconnect(); _sourceNode = null; }
        if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
        if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
    }

    window._tunerAudio = {
        start: async function(options, onResult) {
            _onResult = onResult;
            await _doStart(options.deviceId, options.channel, options.audioInputMode || 'auto');
        },
        stop: function() {
            _onResult = null;
            _doStop();
        },
        restart: async function(options) {
            _doStop();
            await _doStart(options.deviceId, options.channel, options.audioInputMode || 'auto');
        },
        get usingBridge() { return _usingDesktopBridge; },
    };
})();
