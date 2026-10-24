import { KEYS, MINOR_KEYS, DEGREES, DIATONIC_DEGREES, cadence, diatonicChord, majorScale, naturalMinorScale, relativeQuestion, drawDiatonic, drawRelative, canConfirm, isCorrect } from './music.js';

export const QUIZ_MODES = {
  cadence: { label: 'ケーデンスクイズ', count: 4, slots: 3, storage: 'cadence-key-progress-v1' },
  diatonic: { label: 'メジャーダイアトニッククイズ', count: 4, slots: 1, storage: 'major-diatonic-progress-v1', total: 84, draw: drawDiatonic },
  relative: { label: '平行短調・長調クイズ', count: 1, slots: 1, storage: 'relative-key-progress-v1', total: 24, draw: drawRelative },
  major: { label: 'メジャースケール', count: 7, slots: 1, storage: 'scale-major-key-progress-v1' },
  minor: { label: 'マイナースケール', count: 7, slots: 1, storage: 'scale-minor-key-progress-v1' },
};

export function questionFor(mode, id) {
  let key = (mode === 'minor' ? MINOR_KEYS : KEYS)[id];
  if (mode === 'cadence') return { id, key, title: `${key.name}メジャーの ii–V–I`, items: cadence(key).map((item, i) => ({ ...item, degree: DEGREES[i] })) };
  if (mode === 'diatonic') {
    key = KEYS[Math.floor(id / 7)];
    const degree = id % 7;
    return { id, key, title: `${key.name}メジャーの${DIATONIC_DEGREES[degree]}`, items: [{ ...diatonicChord(key, degree), degree: DIATONIC_DEGREES[degree] }] };
  }
  if (mode === 'relative') {
    const { key, answerKey, fromMajor } = relativeQuestion(id);
    return { id, key, title: `${key.name}${fromMajor ? 'メジャーの平行短調' : 'マイナーの平行長調'}`, items: [{ symbol: `${answerKey.name}${fromMajor ? 'マイナー' : 'メジャー'}`, notes: [answerKey.name], pitches: [answerKey.tonic] }] };
  }
  const notes = (mode === 'minor' ? naturalMinorScale : majorScale)(key);
  const title = `${key.name} ${QUIZ_MODES[mode].label}`;
  return { id, key, title, items: [{ symbol: title, notes: notes.map((note) => note.name), pitches: notes.map((note) => note.pitch) }] };
}

export function restoreOutcomes(mode, value) {
  const config = QUIZ_MODES[mode];
  const total = config.total || KEYS.length;
  if (!Array.isArray(value) || value.length > total) return [];
  const seen = new Set();
  return value.filter((entry) => {
    if (!entry || !Number.isInteger(entry.id) || entry.id < 0 || entry.id >= total || seen.has(entry.id)) return false;
    if (!Array.isArray(entry.answers) || entry.answers.length !== config.slots || !entry.answers.every((notes) => Array.isArray(notes) && notes.every((note) => Number.isInteger(note) && note >= 48 && note < 72) && canConfirm(notes, config.count))) return false;
    seen.add(entry.id);
    return true;
  }).map((entry) => ({ id: entry.id, answers: entry.answers.map((notes) => [...notes]) }));
}

export function recordOutcome(outcomes, id, answers) {
  if (outcomes.some((entry) => entry.id === id)) return outcomes;
  return [...outcomes, { id, answers: answers.map((notes) => [...notes]) }];
}

export function summarizeRound(mode, outcomes) {
  const records = new Map(restoreOutcomes(mode, outcomes).map((entry) => [entry.id, entry]));
  const groups = { correct: [], incorrect: [], unanswered: [] };
  const total = QUIZ_MODES[mode].total || KEYS.length;
  for (let id = 0; id < total; id++) {
    const question = questionFor(mode, id);
    const record = records.get(id);
    const results = record ? question.items.map((item, i) => isCorrect(record.answers[i], item)) : null;
    const status = !results ? 'unanswered' : results.every(Boolean) ? 'correct' : 'incorrect';
    groups[status].push({ ...question, answers: record?.answers || null, results });
  }
  return groups;
}
