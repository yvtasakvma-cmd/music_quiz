import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, cadence, majorScale, canConfirm, isCorrect, noteName, frequency, drawKey } from '../src/music.js';

test('all 12 keys produce ii m7, V7 and I maj7 with the correct intervals', () => {
  for (const key of KEYS) {
    const chords = cadence(key);
    const roots = [2, 7, 0];
    const intervals = [[0, 3, 7, 10], [0, 4, 7, 10], [0, 4, 7, 11]];
    chords.forEach((chord, index) => {
      const root = (key.tonic + roots[index]) % 12;
      assert.deepEqual(chord.pitches, intervals[index].map((interval) => (root + interval) % 12), `${key.name} / ${index}`);
    });
  }
});

test('D-flat cadence matches the requested four-note chords', () => {
  assert.deepEqual(cadence(KEYS[1]), [
    { symbol: 'E♭m7', notes: ['E♭', 'G♭', 'B♭', 'D♭'], pitches: [3, 6, 10, 1] },
    { symbol: 'A♭7', notes: ['A♭', 'C', 'E♭', 'G♭'], pitches: [8, 0, 3, 6] },
    { symbol: 'D♭maj7', notes: ['D♭', 'F', 'A♭', 'C'], pitches: [1, 5, 8, 0] },
  ]);
});

test('scale spelling preserves diatonic names, including C-flat', () => {
  assert.deepEqual(majorScale(KEYS[11]).map((note) => note.name), ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯']);
  assert.deepEqual(majorScale(KEYS[6]).map((note) => note.name), ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']);
  // F-sharp's enharmonic spelling is G-flat in this exercise.
  assert.equal(cadence(KEYS[6])[1].symbol, 'D♭7');
});

test('grading accepts every inversion and octave voicing for every chord', () => {
  for (const key of KEYS) {
    for (const chord of cadence(key)) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const voicing = [...chord.pitches.slice(rotation), ...chord.pitches.slice(0, rotation)]
          .map((pitch, index) => pitch + (index % 2 ? 60 : 48));
        assert.equal(isCorrect(voicing, chord), true);
      }
      const wrong = chord.pitches.map((pitch) => 48 + (pitch + 1) % 12);
      assert.equal(isCorrect(wrong, chord), false);
    }
  }
});

test('four distinct pitch classes are required, even across octaves', () => {
  assert.equal(canConfirm([]), false);
  assert.equal(canConfirm([48, 52, 55]), false);
  assert.equal(canConfirm([48, 52, 55, 60]), false);
  assert.equal(canConfirm([48, 52, 55, 59]), true);
  assert.equal(canConfirm([48, 52, 55, 59, 62]), false);
});

test('note names and audio tuning', () => {
  assert.equal(noteName(48, true, true), 'C3');
  assert.equal(noteName(61, true, true), 'D♭4');
  assert.equal(noteName(61, false, true), 'C♯4');
  assert.equal(frequency(69), 440);
  assert.equal(frequency(57), 220);
});

test('random first question can be any key, with no repeats for all 12 questions', () => {
  for (let first = 0; first < 12; first++) {
    let remaining;
    let previous;
    const seen = new Set();
    for (let index = 0; index < 12; index++) {
      const draw = drawKey(remaining, previous, () => index === 0 ? (first + 0.1) / 12 : 0.5);
      if (index === 0) assert.equal(draw.key.tonic, first);
      assert.equal(seen.has(draw.key.tonic), false);
      seen.add(draw.key.tonic);
      remaining = draw.remaining;
      previous = draw.key.tonic;
      assert.equal(remaining.length, 11 - index);
    }
    assert.equal(seen.size, 12);
    const next = drawKey(remaining, previous, () => 0);
    assert.notEqual(next.key.tonic, previous);
    assert.equal(next.remaining.length, 11);
  }
});
