import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, MINOR_KEYS, cadence, diatonicChord, majorScale, naturalMinorScale, canConfirm, isCorrect, noteName, frequency, drawKey, drawDiatonic, drawRelative, relativeQuestion } from '../src/music.js';
import { QUIZ_MODES, questionFor, restoreOutcomes, recordOutcome, summarizeRound } from '../src/quiz.js';

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

test('major and natural minor scales have the right seven pitches in all 12 keys', () => {
  for (const [keys, scale, intervals] of [
    [KEYS, majorScale, [0, 2, 4, 5, 7, 9, 11]],
    [MINOR_KEYS, naturalMinorScale, [0, 2, 3, 5, 7, 8, 10]],
  ]) {
    for (const key of keys) {
      const notes = scale(key);
      const expected = intervals.map((interval) => (key.tonic + interval) % 12);
      assert.deepEqual(notes.map((note) => note.pitch), expected);
      assert.equal(new Set(notes.map((note) => note.name[0])).size, 7);
      assert.equal(notes.some((note) => /♭♭|♯♯/.test(note.name)), false);
      const target = { pitches: expected };
      const voicing = [...expected].reverse().map((pitch, i) => pitch + (i % 2 ? 48 : 60));
      assert.equal(isCorrect(voicing, target), true);
      assert.equal(isCorrect(voicing.slice(1), target), false);
      assert.equal(isCorrect([...voicing, voicing[0] + 12], target), false);
      assert.equal(isCorrect([...voicing.slice(1), voicing[1] + 12], target), false);
    }
  }
});

test('minor uses natural minor pitches and conventional spellings', () => {
  assert.deepEqual(naturalMinorScale(MINOR_KEYS[9]).map((note) => note.name), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(naturalMinorScale(MINOR_KEYS[0]).map((note) => note.name), ['C', 'D', 'E♭', 'F', 'G', 'A♭', 'B♭']);
  assert.deepEqual(naturalMinorScale(MINOR_KEYS[1]).map((note) => note.name), ['C♯', 'D♯', 'E', 'F♯', 'G♯', 'A', 'B']);
  const minor = { pitches: naturalMinorScale(MINOR_KEYS[9]).map((note) => note.pitch) };
  assert.equal(isCorrect([57, 59, 60, 62, 64, 65, 68], minor), false); // harmonic minor
  assert.equal(isCorrect([57, 59, 60, 62, 64, 66, 68], minor), false); // melodic minor
});

test('all 84 diatonic seventh chords have the right quality and accept inversions', () => {
  const roots = [0, 2, 4, 5, 7, 9, 11];
  const qualities = [[0, 4, 7, 11], [0, 3, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 10], [0, 3, 7, 10], [0, 3, 6, 10]];
  for (const key of KEYS) {
    for (let degree = 0; degree < 7; degree++) {
      const chord = diatonicChord(key, degree);
      const expected = qualities[degree].map((interval) => (key.tonic + roots[degree] + interval) % 12);
      assert.deepEqual(chord.pitches, expected, `${key.name}, degree ${degree + 1}`);
      assert.equal(new Set(chord.notes.map((note) => note[0])).size, 4);
      for (let inversion = 0; inversion < 4; inversion++) {
        const notes = [...expected.slice(inversion), ...expected.slice(0, inversion)].map((pitch, i) => pitch + (i % 2 ? 48 : 60));
        assert.equal(isCorrect(notes, chord), true);
      }
    }
  }
  assert.deepEqual(Array.from({ length: 7 }, (_, degree) => diatonicChord(KEYS[0], degree).symbol), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5（Bø7）']);
  assert.deepEqual(diatonicChord(KEYS[0], 1).notes, ['D', 'F', 'A', 'C']);
  assert.deepEqual(diatonicChord(KEYS[6], 3).notes, ['C♭', 'E♭', 'G♭', 'B♭']);
});

test('diatonic deck randomizes all 84 key-degree pairs without repetition and restarts safely', () => {
  for (let first = 0; first < 84; first++) {
    const initial = drawDiatonic(undefined, undefined, () => (first + 0.1) / 84);
    assert.equal(initial.questionId, first);
    let draw = initial;
    const seen = new Set([first]);
    for (let index = 1; index < 84; index++) {
      draw = drawDiatonic(draw.remaining, draw.questionId, () => 0.5);
      assert.equal(seen.has(draw.questionId), false);
      assert.equal(draw.key.tonic * 7 + draw.degree, draw.questionId);
      assert.equal(draw.remaining.length, 83 - index);
      seen.add(draw.questionId);
    }
    assert.equal(seen.size, 84);
    const next = drawDiatonic(draw.remaining, draw.questionId, () => 0);
    assert.notEqual(next.questionId, draw.questionId);
    assert.equal(next.remaining.length, 83);
  }
});

test('all relative major/minor questions share their scale tones and accept either octave', () => {
  for (let id = 0; id < 24; id++) {
    const { key, fromMajor, answerKey } = relativeQuestion(id);
    const source = (fromMajor ? majorScale : naturalMinorScale)(key).map((note) => note.pitch).sort((a, b) => a - b);
    const target = (fromMajor ? naturalMinorScale : majorScale)(answerKey).map((note) => note.pitch).sort((a, b) => a - b);
    assert.deepEqual(source, target);
    const answer = { pitches: [answerKey.tonic] };
    assert.equal(isCorrect([48 + answerKey.tonic], answer), true);
    assert.equal(isCorrect([60 + answerKey.tonic], answer), true);
    assert.equal(isCorrect([48 + (answerKey.tonic + 1) % 12], answer), false);
    assert.equal(isCorrect([48 + answerKey.tonic, 60 + answerKey.tonic], answer), false);
    assert.equal(relativeQuestion((fromMajor ? 12 : 0) + answerKey.tonic).answerKey.tonic, key.tonic);
  }
  assert.equal(relativeQuestion(0).answerKey.name, 'A'); // C major -> A minor
  assert.equal(relativeQuestion(21).answerKey.name, 'C'); // A minor -> C major
  assert.equal(relativeQuestion(1).answerKey.name, 'B♭'); // D-flat major -> B-flat minor
  assert.equal(relativeQuestion(20).answerKey.name, 'B'); // G-sharp minor -> B major
});

test('relative deck draws all 24 directions without repeats and starts a fresh round', () => {
  for (let first = 0; first < 24; first++) {
    let draw = drawRelative(undefined, undefined, () => (first + 0.1) / 24);
    assert.equal(draw.questionId, first);
    const seen = new Set([first]);
    for (let index = 1; index < 24; index++) {
      draw = drawRelative(draw.remaining, draw.questionId, () => 0.5);
      assert.equal(seen.has(draw.questionId), false);
      assert.equal(draw.remaining.length, 23 - index);
      seen.add(draw.questionId);
    }
    assert.equal(seen.size, 24);
    const next = drawRelative(draw.remaining, draw.questionId, () => 0);
    assert.notEqual(next.questionId, draw.questionId);
    assert.equal(next.remaining.length, 23);
  }
});

test('round summaries distinguish correct, wrong and unanswered questions in every mode', () => {
  for (const mode of Object.keys(QUIZ_MODES)) {
    const total = QUIZ_MODES[mode].total || 12;
    const outcomes = [];
    for (let id = 0; id < total; id++) {
      if (id === 1) continue;
      const items = questionFor(mode, id).items;
      const answers = items.map((item) => item.pitches.map((pitch) => pitch + 48));
      if (id === 0) answers[0][0] = 48 + Array.from({ length: 12 }, (_, pitch) => pitch).find((pitch) => !items[0].pitches.includes(pitch));
      outcomes.push({ id, answers });
    }
    const groups = summarizeRound(mode, outcomes);
    assert.equal(groups.correct.length, total - 2);
    assert.deepEqual(groups.incorrect.map((item) => item.id), [0]);
    assert.deepEqual(groups.unanswered.map((item) => item.id), [1]);
    assert.equal(groups.incorrect[0].results[0], false);
    if (mode === 'cadence') assert.deepEqual(groups.incorrect[0].results, [false, true, true]);
    assert.equal(groups.unanswered[0].answers, null);
  }
});

test('round records retain the first answer through edits, retry and storage restoration', () => {
  const answers = [[48]];
  let outcomes = recordOutcome([], 0, answers); // C major -> A minor, answered C
  answers[0][0] = 57;
  outcomes = recordOutcome(outcomes, 0, [[57]]);
  assert.equal(outcomes.length, 1);
  assert.deepEqual(outcomes[0].answers, [[48]]);
  const restored = restoreOutcomes('relative', JSON.parse(JSON.stringify(outcomes)));
  const groups = summarizeRound('relative', restored);
  assert.equal(groups.correct.length, 0);
  assert.equal(groups.incorrect.length, 1);
  assert.equal(groups.incorrect[0].title, 'Cメジャーの平行短調');
  assert.equal(groups.incorrect[0].items[0].symbol, 'Aマイナー');
});

test('corrupt or legacy history is never invented as a correct answer', () => {
  assert.deepEqual(restoreOutcomes('relative', undefined), []);
  const valid = { id: 0, answers: [[57]] };
  const records = restoreOutcomes('relative', [valid, { id: 0, answers: [[48]] }, { id: -1, answers: [[57]] }, { id: 24, answers: [[57]] }, { id: 1, answers: [["57"]] }, { id: 2, answers: [[57, 69]] }, { id: 3, answers: [[100]] }, null]);
  assert.deepEqual(records, [valid]);
  assert.equal(summarizeRound('major', []).unanswered.length, 12);
});
