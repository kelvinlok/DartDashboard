(function attachDartAudio(root) {
  const AUDIO_MANIFEST = Object.freeze({
    single: "assets/audio/hit-single.wav",
    double: "assets/audio/hit-double.wav",
    triple: "assets/audio/hit-triple.wav",
    outerBull: "assets/audio/outer-bull.wav",
    bullseye: "assets/audio/bullseye.wav",
    bust: "assets/audio/bust.wav",
    checkout: "assets/audio/checkout.wav",
    turnChange: "assets/audio/turn-change.wav",
  });

  const MAJOR_EVENTS = new Set(["bullseye", "bust", "checkout"]);
  const DEFAULT_AUDIO_SETTINGS = Object.freeze({ muted: false, volume: 0.8 });
  const STORAGE_KEY = "dart-dashboard-audio";

  function normalizeAudioSettings(value) {
    const settings = value && typeof value === "object" ? value : {};
    return {
      muted: typeof settings.muted === "boolean"
        ? settings.muted
        : DEFAULT_AUDIO_SETTINGS.muted,
      volume: Number.isFinite(settings.volume)
        && settings.volume >= 0
        && settings.volume <= 1
        ? settings.volume
        : DEFAULT_AUDIO_SETTINGS.volume,
    };
  }

  class SoundManager {
    constructor(options = {}) {
      this.context = null;
      this.masterGain = null;
      this.effectsGain = null;
      this.majorGain = null;
      this.outputLimiter = null;
      this.buffers = new Map();
      this._majorSource = null;
      this._storage = options.storage || null;
      this._fetch = options.fetchImpl || null;
      this._setTimeout = options.setTimeoutImpl || null;
      this.settings = { ...DEFAULT_AUDIO_SETTINGS };

      try {
        if (!this._storage) this._storage = root.localStorage || null;
      } catch (error) {
        this._storage = null;
      }

      try {
        if (!this._fetch && typeof root.fetch === "function") {
          this._fetch = root.fetch.bind(root);
        }
      } catch (error) {
        this._fetch = null;
      }

      if (!this._setTimeout && typeof root.setTimeout === "function") {
        this._setTimeout = root.setTimeout.bind(root);
      }

      this.settings = this._readSettings();

      try {
        const AudioContextClass = options.AudioContextClass
          || root.AudioContext
          || root.webkitAudioContext;
        if (!AudioContextClass) return;

        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.effectsGain = this.context.createGain();
        this.majorGain = this.context.createGain();
        this.outputLimiter = this.context.createDynamicsCompressor();
        this.effectsGain.connect(this.masterGain);
        this.majorGain.connect(this.masterGain);
        this.masterGain.connect(this.outputLimiter);
        this.outputLimiter.connect(this.context.destination);
        this.outputLimiter.threshold.value = -3;
        this.outputLimiter.knee.value = 0;
        this.outputLimiter.ratio.value = 20;
        this.outputLimiter.attack.value = 0.003;
        this.outputLimiter.release.value = 0.1;
        this.effectsGain.gain.value = 1;
        this.majorGain.gain.value = 1;
        this._applyMasterVolume();
      } catch (error) {
        this.context = null;
        this.masterGain = null;
        this.effectsGain = null;
        this.majorGain = null;
        this.outputLimiter = null;
      }
    }

    _readSettings() {
      try {
        const saved = this._storage?.getItem(STORAGE_KEY);
        return normalizeAudioSettings(saved ? JSON.parse(saved) : null);
      } catch (error) {
        return { ...DEFAULT_AUDIO_SETTINGS };
      }
    }

    _persistSettings() {
      try {
        this._storage?.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        return true;
      } catch (error) {
        return false;
      }
    }

    _applyMasterVolume() {
      try {
        if (!this.masterGain) return false;
        this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.volume;
        return true;
      } catch (error) {
        return false;
      }
    }

    getSettings() {
      try {
        return { ...this.settings };
      } catch (error) {
        return { ...DEFAULT_AUDIO_SETTINGS };
      }
    }

    setMuted(muted) {
      try {
        this.settings = { ...this.settings, muted: Boolean(muted) };
        this._applyMasterVolume();
        this._persistSettings();
        return this.getSettings();
      } catch (error) {
        return this.getSettings();
      }
    }

    setVolume(volume) {
      try {
        const nextVolume = Number(volume);
        if (!Number.isFinite(nextVolume)) return this.getSettings();
        this.settings = {
          ...this.settings,
          volume: Math.min(1, Math.max(0, nextVolume)),
        };
        this._applyMasterVolume();
        this._persistSettings();
        return this.getSettings();
      } catch (error) {
        return this.getSettings();
      }
    }

    async unlock() {
      try {
        if (!this.context) return false;
        if (this.context.state === "suspended") await this.context.resume();
        return this.context.state !== "suspended";
      } catch (error) {
        return false;
      }
    }

    async load() {
      if (!this.context || !this._fetch) return 0;

      try {
        await Promise.all(Object.entries(AUDIO_MANIFEST).map(async ([name, path]) => {
          try {
            const response = await this._fetch(path);
            if (!response || response.ok === false) throw new Error(`Unable to load ${path}`);
            const encoded = await response.arrayBuffer();
            const buffer = await this.context.decodeAudioData(encoded);
            this.buffers.set(name, buffer);
          } catch (error) {
            this.buffers.delete(name);
          }
        }));
        return this.buffers.size;
      } catch (error) {
        return this.buffers.size;
      }
    }

    _duckEffects() {
      const gain = this.effectsGain?.gain;
      if (!gain || !this.context) return;
      const now = this.context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0.35, now + 0.03);
    }

    _restoreEffects() {
      const gain = this.effectsGain?.gain;
      if (!gain || !this.context) return;
      const now = this.context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(1, now + 0.08);
    }

    play(name) {
      let restoreMajor = null;
      try {
        const buffer = this.buffers.get(name);
        if (!this.context || this.settings.muted || !buffer) return false;

        const isMajor = MAJOR_EVENTS.has(name);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(isMajor ? this.majorGain : this.effectsGain);

        if (isMajor) {
          const previousMajor = this._majorSource;
          this._majorSource = source;
          if (previousMajor) {
            try {
              previousMajor.stop();
            } catch (error) {
              // A source that already ended is harmless.
            }
          }

          restoreMajor = () => {
            if (this._majorSource !== source) return;
            this._majorSource = null;
            this._restoreEffects();
          };
          source.onended = restoreMajor;
          this._duckEffects();
        }

        source.start(0);
        if (restoreMajor && this._setTimeout) {
          this._setTimeout(restoreMajor, Math.round(buffer.duration * 1000));
        }
        return true;
      } catch (error) {
        try {
          restoreMajor?.();
        } catch (restoreError) {
          // Playback and recovery failures are both harmless to gameplay.
        }
        return false;
      }
    }
  }

  const api = {
    AUDIO_MANIFEST,
    DEFAULT_AUDIO_SETTINGS,
    SoundManager,
    normalizeAudioSettings,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.DartAudio = api;
})(typeof window !== "undefined" ? window : globalThis);
