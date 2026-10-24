export const KEYS = [
  { name: 'C', tonic: 0, flats: false },
  { name: 'D♭', tonic: 1, flats: true },
  { name: 'D', tonic: 2, flats: false },
  { name: 'E♭', tonic: 3, flats: true },
  { name: 'E', tonic: 4, flats: false },
  { name: 'F', tonic: 5, flats: true },
  { name: 'G♭', tonic: 6, flats: true },
  { name: 'G', tonic: 7, flats: false },
  { name: 'A♭', tonic: 8, flats: true },
  { name: 'A', tonic: 9, flats: false },
  { name: 'B♭', tonic: 10, flats: true },
  { name: 'B', tonic: 11, flats: false },
];

export const DEGREES = ['ii m7', 'V7', 'I maj7'];
export const MINOR_KEYS = KEYS.map((key) => ({
  ...key,
  name: ({ 1: 'C♯', 6: 'F♯', 8: 'G♯' })[key.tonic] || key.name,
  flats: [0, 2, 3, 5, 7, 10].includes(key.tonic),
}));
const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const CHORD_DEGREES = [[1, 3, 5, 0], [4, 6, 1, 3], [0, 2, 4, 6]];

export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

export function noteName(midi, flats = true, octave = false) {
  const name = (flats ? FLATS : SHARPS)[pitchClass(midi)];
  return octave ? `${name}${Math.floor(midi / 12) - 1}` : name;
}

// Spell scale tones diatonically, including C♭ in G♭ major.
export function majorScale(key) {
  return spellScale(key, SCALE);
}

export function naturalMinorScale(key) {
  return spellScale(key, MINOR_SCALE);
}

function spellScale(key, intervals) {
  const first = LETTERS.indexOf(key.name[0]);
  return intervals.map((offset, index) => {
    const letter = (first + index) % 7;
    const pitch = pitchClass(key.tonic + offset);
    let alteration = pitchClass(pitch - NATURALS[letter]);
    if (alteration > 6) alteration -= 12;
    return { pitch, name: LETTERS[letter] + (alteration > 0 ? '♯'.repeat(alteration) : '♭'.repeat(-alteration)) };
  });
}

export function cadence(key) {
  const scale = majorScale(key);
  return CHORD_DEGREES.map((degrees, index) => {
    const notes = degrees.map((degree) => scale[degree]);
    return {
      symbol: notes[0].name + ['m7', '7', 'maj7'][index],
      notes: notes.map((note) => note.name),
      pitches: notes.map((note) => note.pitch),
    };
  });
}

export function canConfirm(notes, count = 4) {
  return notes.length === count && new Set(notes.map(pitchClass)).size === count;
}

export function isCorrect(notes, chord) {
  return canConfirm(notes, chord.pitches.length) && chord.pitches.every((pitch) => notes.some((note) => pitchClass(note) === pitch));
}

export function drawKey(remaining = KEYS.map((key) => key.tonic), previous = null, random = Math.random) {
  const pool = remaining.length ? remaining : KEYS.map((key) => key.tonic);
  const choices = pool.filter((tonic) => tonic !== previous);
  const tonic = choices[Math.floor(random() * choices.length)];
  return { key: KEYS[tonic], remaining: pool.filter((item) => item !== tonic) };
}

export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
