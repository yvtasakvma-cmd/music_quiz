import { frequency } from './music.js';

let context;
let stopPrevious;

export async function playChord(notes) {
  return playNotes(notes, false);
}

export async function playScale(notes) {
  return playNotes(notes, true);
}

export function stopPlayback() {
  stopPrevious?.();
}

async function playNotes(notes, sequential) {
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
  master.gain.value = sequential ? 0.32 : 0.32 / Math.sqrt(notes.length);
  master.connect(context.destination);

  for (const [index, note] of notes.entries()) {
    const start = now + (sequential ? index * 0.3 : 0);
    const duration = sequential ? 0.55 : 1.8;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.7, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.2, start + (sequential ? 0.2 : 0.4));
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    envelope.connect(master);
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency(note);
    oscillator.connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
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
