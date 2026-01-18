/**
 * Sound utility using Web Audio API
 */

class SoundService {
    constructor() {
        this.context = null;
    }

    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async playBeep(frequency = 880, duration = 0.1, type = 'sine') {
        this.init();
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);

        gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.start();
        oscillator.stop(this.context.currentTime + duration);
    }

    // Presets
    async playSuccess() {
        await this.playBeep(880, 0.1); // A5
        setTimeout(() => this.playBeep(1108.73, 0.2), 100); // C#6
    }

    async playError() {
        await this.playBeep(220, 0.3, 'sawtooth'); // A3
    }

    async playScan() {
        await this.playBeep(1320, 0.05); // E6
    }
}

export const sounds = new SoundService();
