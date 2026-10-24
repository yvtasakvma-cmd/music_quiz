import { frequency } from './music.js';

let context;
let stopPrevious;

export async function playChord(notes) {
  if (!notes.length) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('このブラウザは音声再生に対応していません。');
  context ??= new AudioContext();
  await context.resume();
  if (context.state !== 'running') throw new Error('音声を開始できませんでした。もう一度「鳴らす」を押してください。');
  stopPrevious?.();
  const now = context.currentTime;
  const voices = [];
  const master = context.createGain();
  master.gain.value = 0.32 / Math.sqrt(notes.length);
  master.connect(context.destination);

  for (const note of notes) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.7, now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.2, now + 0.4);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    envelope.connect(master);
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency(note);
    oscillator.connect(envelope);
    oscillator.start(now);
    oscillator.stop(now + 1.85);
    voices.push(oscillator);
  }
  let remaining = voices.length;
  for (const voice of voices) {
    voice.onended = () => {
      voice.disconnect();
      if (--remaining === 0) master.disconnect();
    };
  }
  stopPrevious = () => {
    // Release quickly to avoid clicks when playing the next voicing.
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, 0.015);
  };
}
