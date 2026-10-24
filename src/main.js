import './style.css';
import { KEYS, MINOR_KEYS, DEGREES, DIATONIC_DEGREES, noteName, cadence, diatonicChord, majorScale, naturalMinorScale, canConfirm, isCorrect, drawKey, drawDiatonic } from './music.js';
import { playChord, playScale, stopPlayback } from './audio.js';

const icons = {
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke-linejoin="round"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const MODES = {
  cadence: { label: 'ケーデンスクイズ', count: 4, slots: 3, storage: 'cadence-key-progress-v1' },
  diatonic: { label: 'メジャーダイアトニッククイズ', count: 4, slots: 1, storage: 'major-diatonic-progress-v1', total: 84 },
  major: { label: 'メジャースケール', count: 7, slots: 1, storage: 'scale-major-key-progress-v1' },
  minor: { label: 'マイナースケール', count: 7, slots: 1, storage: 'scale-minor-key-progress-v1' },
};
const sessions = new Map();
let mode = null;
let state;
let audioBusy = false;
let feedbackTimer;
const isCadence = () => mode === 'cadence';
const isDiatonic = () => mode === 'diatonic';
const isScale = () => mode === 'major' || mode === 'minor';
const config = () => MODES[mode];
const questionCount = () => config().total || KEYS.length;
const drawQuestion = (remaining, previous) => (isDiatonic() ? drawDiatonic : drawKey)(remaining, previous);
const selected = () => state.drafts[state.current];
const quizKey = (key) => mode === 'minor' ? MINOR_KEYS[key.tonic] : key;

function readProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(config().storage));
    const validId = (id) => Number.isInteger(id) && id >= 0 && id < questionCount();
    if (progress && validId(progress.previous) &&
      Array.isArray(progress.remaining) && new Set(progress.remaining).size === progress.remaining.length &&
      progress.remaining.every((id) => validId(id) && id !== progress.previous)) return progress;
  } catch { /* Practice still works when browser storage is unavailable. */ }
  return {};
}
function saveProgress() {
  try {
    localStorage.setItem(config().storage, JSON.stringify({ previous: isDiatonic() ? state.questionId : state.key.tonic, remaining: state.remaining }));
  } catch { /* Keep the non-repeating deck in memory if storage is unavailable. */ }
}
function createState() {
  const progress = readProgress();
  const draw = drawQuestion(progress.remaining, progress.previous);
  return { key: quizKey(draw.key), degree: draw.degree, questionId: draw.questionId, remaining: draw.remaining, current: 0,
    drafts: Array.from({ length: config().slots }, () => []),
    answers: Array(config().slots).fill(null), result: null, feedback: '' };
}
function items() {
  if (isCadence()) return cadence(state.key);
  if (isDiatonic()) return [diatonicChord(state.key, state.degree)];
  const notes = (mode === 'minor' ? naturalMinorScale : majorScale)(state.key);
  return [{ symbol: `${state.key.name} ${config().label}`, notes: notes.map((note) => note.name), pitches: notes.map((note) => note.pitch) }];
}

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Cadence ホーム"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>cadence<span class="brand-dot">.</span></a>
      <span class="practice-badge">音楽の練習帳</span>
    </header>

    <section id="menu" aria-labelledby="menu-title">
      <div class="eyebrow"><span class="tiny-dot"></span> YOUR DAILY MUSIC PRACTICE</div>
      <h1 id="menu-title" tabindex="-1">今日は、何を<br>練習する？</h1>
      <p class="menu-intro">鍵盤で考えて、音でたしかめる。<br>練習したいクイズを選ぼう。</p>
      <button class="menu-card cadence-card" data-mode="cadence"><span class="menu-card-top"><span class="eyebrow">CHORDS</span>${icons.arrow}</span><span class="menu-card-title">ケーデンスクイズ</span><span class="menu-progression">ii <small>m7</small> <i>—</i> V <small>7</small> <i>—</i> I <small>maj7</small></span><span class="menu-card-help">4音のコードを3つつくる</span></button>
      <button class="menu-card diatonic-card" data-mode="diatonic"><span class="menu-card-top"><span class="eyebrow">DIATONIC CHORDS</span>${icons.arrow}</span><span class="menu-card-title">メジャー<br>ダイアトニッククイズ</span><span class="menu-card-help">例：CメジャーのⅡは？<br>12キー × 7度数を、4和音で答える</span></button>
      <section class="scale-menu" aria-labelledby="scale-menu-title"><div class="scale-menu-heading"><h2 id="scale-menu-title">スケールクイズ</h2><span>7つの音を選ぼう</span></div><div class="scale-options">
        <button class="menu-card scale-card" data-mode="major"><span class="eyebrow">MAJOR</span><span class="scale-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="menu-card-title">メジャー</span><span class="menu-card-help">メジャースケール ${icons.arrow}</span></button>
        <button class="menu-card scale-card minor-card" data-mode="minor"><span class="eyebrow">MINOR</span><span class="scale-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="menu-card-title">マイナー</span><span class="menu-card-help">ナチュラルマイナー ${icons.arrow}</span></button>
      </div></section>
      <p class="menu-note">12キーをランダム出題。ひと巡りまで同じ問題は出ません。</p>
    </section>

    <div id="quiz" hidden>
      <button id="back-menu" class="back-menu" type="button"><span aria-hidden="true">←</span> メニューに戻る</button>
      <section class="question" aria-labelledby="question-title">
        <div class="eyebrow"><span class="tiny-dot"></span> <span id="quiz-label"></span><span class="lesson-number" aria-label="この周の出題数"></span></div>
        <div class="question-top"><h1 id="question-title" tabindex="-1"><span id="key-name"></span><span class="major-label">メジャーの</span></h1></div>
        <p class="progression" aria-label="ツー・ファイブ・ワン"><span>ii<small>m7</small></span><b>—</b><span>V<small>7</small></span><b>—</b><span>I<small>maj7</small></span></p>
        <p id="scale-title" class="scale-title" hidden></p>
        <p id="diatonic-title" class="diatonic-title" hidden><span id="degree-name"></span><span>は？</span></p>
        <p class="question-help"></p>
      </section>
      <nav class="steps" aria-label="回答するコード">${DEGREES.map((degree, index) => `<button class="step" data-step="${index}" aria-label="${index + 1}つ目 ${degree}"><span class="step-circle"><span>${String(index + 1).padStart(2, '0')}</span></span><span class="step-degree">${degree}</span><span class="step-caption">入力する</span></button>`).join('')}</nav>
      <section class="answer-card" aria-labelledby="answer-title">
        <div class="answer-heading"><h2 id="answer-title"><span id="current-degree"></span> <span class="answer-heading-sub">をつくる</span></h2><span id="note-count" class="note-count"></span></div>
        <p class="keyboard-help">タップで選択、もう一度タップで解除</p>
        <div id="keyboard" class="keyboard" role="group" aria-label="2オクターブの鍵盤 C3からB4"></div>
        <div class="selection-line"><span class="selection-label">選択中</span><div id="selected-notes" class="selected-notes"></div><button id="clear" class="text-button" type="button">クリア</button></div>
        <p id="input-help" class="input-help" aria-live="polite"></p>
        <div class="chord-actions"><button id="play" class="button play-button">${icons.sound}<span>鳴らす</span></button><button id="confirm" class="button confirm-button">${icons.check}<span>OK</span></button></div>
      </section>
      <div class="submit-area"><button id="grade" class="button grade-button"><span>回答する</span>${icons.arrow}</button><p id="progress-help" aria-live="polite"></p></div>
      <section id="results" class="results" aria-live="polite" aria-label="採点結果" hidden></section>
    </div>
    <footer class="footer"><span id="footer-label">CHORDS & SCALES / A LITTLE PRACTICE EVERY DAY</span><details><summary>使い方・iPhone に追加</summary><div><p id="mode-help">メニューからコードやスケールのクイズを選んで練習します。</p><p>鍵盤は再タップで解除。オクターブは自由ですが、同じ音名を重ねずに選びます。各クイズの出題履歴は別々に保存されます。</p><p>iPhone は Safari の共有メニューから「ホーム画面に追加」。初回の読み込み後はオフラインでも練習できます。音が出ないときは本体の音量・消音設定も確認してください。</p><p id="offline-status">オフライン機能は本番版で有効になります。</p></div></details></footer>
    <div id="toast" class="toast" role="status" hidden></div>
  </main>`;

const $ = (selector) => document.querySelector(selector);
let whiteIndex = 0;
for (let midi = 48; midi < 72; midi++) {
  const black = [1, 3, 6, 8, 10].includes(midi % 12);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `piano-key ${black ? 'black-key' : 'white-key'}`;
  button.dataset.midi = midi;
  button.setAttribute('aria-pressed', 'false');
  if (black) button.style.left = `${((whiteIndex - 0.31) / 14) * 100}%`;
  else whiteIndex++;
  $('#keyboard').append(button);
}

function clearToast() {
  clearTimeout(feedbackTimer);
  $('#toast').hidden = true;
}
function notify(message) {
  clearToast();
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  feedbackTimer = setTimeout(clearToast, 2800);
}
function startQuiz(nextMode) {
  mode = nextMode;
  if (!sessions.has(mode)) {
    state = createState();
    sessions.set(mode, state);
    saveProgress();
  } else state = sessions.get(mode);
  $('#menu').hidden = true;
  $('#quiz').hidden = false;
  clearToast();
  update();
  window.scrollTo(0, 0);
  $('#question-title').focus({ preventScroll: true });
}
function showMenu() {
  stopPlayback();
  clearToast();
  $('#quiz').hidden = true;
  $('#menu').hidden = false;
  $('#footer-label').textContent = 'CHORDS & SCALES / A LITTLE PRACTICE EVERY DAY';
  $('#mode-help').textContent = 'メニューからコードやスケールのクイズを選んで練習します。';
  window.scrollTo(0, 0);
  $('#menu-title').focus({ preventScroll: true });
}
$('#menu').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (button) startQuiz(button.dataset.mode);
});
$('#back-menu').addEventListener('click', showMenu);
$('.brand').addEventListener('click', (event) => { event.preventDefault(); showMenu(); });

function update() {
  const { key, remaining, current, answers, result } = state;
  const notes = selected();
  const count = config().count;
  const ready = canConfirm(notes, count);
  const progress = answers.filter(Boolean).length;
  $('#key-name').textContent = key.name;
  $('.major-label').textContent = isScale() ? 'の' : 'メジャーの';
  $('#quiz-label').textContent = isCadence() ? 'CADENCE QUIZ / ii–V–I' : isDiatonic() ? 'MAJOR DIATONIC QUIZ' : mode === 'major' ? 'SCALE QUIZ / MAJOR' : 'SCALE QUIZ / NATURAL MINOR';
  $('.lesson-number').textContent = `${questionCount() - remaining.length} / ${questionCount()}`;
  $('.progression').hidden = !isCadence();
  $('#scale-title').hidden = !isScale();
  $('#scale-title').textContent = config().label;
  $('#diatonic-title').hidden = !isDiatonic();
  $('#degree-name').textContent = DIATONIC_DEGREES[state.degree] || '';
  $('.question-help').textContent = isCadence() ? '3つのコードを、鍵盤でつくってみよう。' : isDiatonic() ? 'この度数のダイアトニックコードを4音で答えよう。' : mode === 'minor' ? 'ナチュラルマイナーをつくる7音を選ぼう。' : 'メジャースケールをつくる7音を選ぼう。';
  $('.steps').hidden = !isCadence();
  $('.answer-card').classList.toggle('scale-answer', !isCadence());
  $('.chord-actions').classList.toggle('single', !isCadence());
  $('#current-degree').textContent = isCadence() ? DEGREES[current] : `${count}つの音`;
  $('#note-count').textContent = `${notes.length} / ${count} 音`;
  $('#note-count').classList.toggle('complete', ready);
  document.querySelectorAll('.step').forEach((step, index) => {
    step.classList.toggle('active', index === current);
    step.classList.toggle('answered', !!answers[index]);
    step.classList.toggle('correct', result?.[index] === true);
    step.classList.toggle('incorrect', result?.[index] === false);
    step.setAttribute('aria-current', index === current ? 'step' : 'false');
    step.setAttribute('aria-label', `${index + 1}つ目 ${DEGREES[index]} ${answers[index] ? '回答済み' : '未回答'}`);
    step.querySelector('.step-caption').textContent = result ? (result[index] ? '正解' : 'もう一歩') : answers[index] ? '回答済み' : index === current ? '入力中' : '未回答';
  });
  document.querySelectorAll('.piano-key').forEach((button) => {
    const midi = Number(button.dataset.midi);
    const pressed = notes.includes(midi);
    button.setAttribute('aria-pressed', String(pressed));
    button.classList.toggle('selected', pressed);
    button.setAttribute('aria-label', noteName(midi, key.flats, true));
  });
  $('#selected-notes').innerHTML = notes.length ? [...notes].sort((a, b) => a - b).map((midi) => `<span class="note-chip">${noteName(midi, key.flats)}<small>${Math.floor(midi / 12) - 1}</small></span>`).join('') : `<span class="empty-notes">鍵盤から${count}音を選ぼう</span>`;
  $('#input-help').textContent = state.feedback || (notes.length === count && !ready ? `同じ音名が重複しています。異なる${count}音を選んでください。` : isCadence() && answers[current] ? '確定しました。丸をタップして他のコードも確認できます。' : '音の並び順・オクターブは自由です。');
  $('#play').disabled = notes.length === 0 || audioBusy;
  $('#clear').disabled = notes.length === 0;
  $('#confirm').hidden = !isCadence();
  $('#confirm').disabled = !ready || !!answers[current];
  $('#confirm span').textContent = answers[current] ? '確定済み' : 'OK';
  $('#grade').disabled = (isCadence() ? progress !== 3 : !ready) || result !== null;
  $('#progress-help').textContent = result ? '音の組み合わせで採点しています' : isCadence() ? progress === 3 ? '準備できました。3つのコードを採点しよう。' : `あと ${3 - progress} つのコードを OK で確定` : ready ? `${count}つの音がそろいました。回答してみよう。` : `異なる${count}音を選んで「回答する」を押そう`;
  $('#footer-label').textContent = isCadence() ? 'ii–V–I / MAJOR SEVENTH CHORDS' : isDiatonic() ? 'MAJOR DIATONIC / SEVENTH CHORDS' : mode === 'major' ? 'MAJOR SCALE / 7 NOTES' : 'NATURAL MINOR SCALE / 7 NOTES';
  $('#mode-help').textContent = isCadence() ? '各コードの異なる4音を選び、OK で確定します。黄色の丸は回答済み。丸をタップすると戻って編集できます。3つを確定してから「回答する」を押します。' : isDiatonic() ? 'キーとⅠ〜Ⅶの度数からダイアトニックコードを考え、異なる4音を選んで「回答する」を押します。「鳴らす」で和音を確認できます。12キー×7度数の84問を重複なく出題します。' : 'スケールを構成する異なる7音を選び、「回答する」で採点します。「鳴らす」では選択した音を低い順に再生します。マイナーはナチュラルマイナーです。';
  renderResults();
}
function renderResults() {
  const { result, answers, remaining, key } = state;
  $('#results').hidden = result === null;
  if (!result) return;
  const expected = items();
  const count = result.filter(Boolean).length;
  const heading = isCadence() ? count === 3 ? 'すべて正解！' : 'あと少し。音を見比べよう。' : result[0] ? '正解！' : 'あと少し。音を見比べよう。';
  $('#results').innerHTML = `<div class="result-heading"><span class="eyebrow">RESULT</span><h2>${heading}</h2><p>${isCadence() ? `${count} / 3 コード正解` : result[0] ? `${config().count}つの音を選べました。` : `正解の${config().count}音と比べてみよう。`}</p></div><div class="result-chords">${expected.map((item, index) => `<div class="result-chord ${result[index] ? 'is-correct' : 'is-incorrect'}"><span class="result-icon" aria-label="${result[index] ? '正解' : '不正解'}">${result[index] ? '✓' : '×'}</span><div><div class="result-chord-title">${isCadence() ? `<span>${DEGREES[index]}</span>` : isDiatonic() ? `<span>${DIATONIC_DEGREES[state.degree]}</span>` : ''}<strong>${item.symbol}</strong></div><p class="expected-notes">正解：${item.notes.join(' · ')}</p>${result[index] ? '' : `<p class="your-notes">回答：${[...answers[index]].sort((a, b) => a - b).map((midi) => noteName(midi, key.flats)).join(' · ')}</p>`}</div><button class="listen-answer" data-listen="${index}" aria-label="正解の ${item.symbol} を聴く">${icons.sound}</button></div>`).join('')}</div><div class="result-actions"><button id="retry" class="button retry-button">${isDiatonic() ? '同じ問題でもう一度' : '同じキーでもう一度'}</button><button id="next" class="button confirm-button">${remaining.length ? '次の問題' : `次の${questionCount()}問へ`} ${icons.arrow}</button></div>`;
}
function editCurrent() {
  state.answers[state.current] = null;
  state.result = null;
  state.feedback = '';
}
$('#keyboard').addEventListener('click', (event) => {
  const button = event.target.closest('[data-midi]');
  if (!button) return;
  const midi = Number(button.dataset.midi);
  const notes = selected();
  if (notes.includes(midi)) state.drafts[state.current] = notes.filter((note) => note !== midi);
  else if (notes.length < config().count) state.drafts[state.current] = [...notes, midi];
  else { notify(`${config().count}音まで選べます。選択した鍵盤をタップすると解除できます。`); return; }
  editCurrent();
  update();
});
document.querySelectorAll('.step').forEach((button) => button.addEventListener('click', () => {
  state.current = Number(button.dataset.step);
  state.feedback = '';
  update();
}));
$('#clear').addEventListener('click', () => { state.drafts[state.current] = []; editCurrent(); update(); });

async function play(notes) {
  if (audioBusy) return;
  const sequential = isScale();
  audioBusy = true;
  $('#play').disabled = true;
  try { await (sequential ? playScale(notes) : playChord(notes)); }
  catch (error) { notify(error.message || '音声を再生できませんでした。'); }
  finally { audioBusy = false; $('#play').disabled = !state || selected().length === 0; }
}
$('#play').addEventListener('click', () => play([...selected()].sort((a, b) => a - b)));
$('#confirm').addEventListener('click', () => {
  const { current, answers } = state;
  if (!isCadence() || !canConfirm(selected()) || answers[current]) return;
  answers[current] = [...selected()];
  const next = answers.findIndex((answer, index) => index > current && !answer);
  const first = answers.findIndex((answer) => !answer);
  if (next !== -1 || first !== -1) {
    state.current = next !== -1 ? next : first;
    state.feedback = '';
    notify(`${current + 1}つ目を確定しました。次のコードを入力しましょう。`);
  } else state.feedback = '3つのコードがそろいました。「回答する」で採点しよう。';
  update();
  document.querySelector(`[data-step="${state.current}"]`).focus({ preventScroll: true });
});
$('#grade').addEventListener('click', () => {
  if (!isCadence()) {
    if (!canConfirm(selected(), config().count)) return;
    state.answers[0] = [...selected()];
  }
  if (state.answers.some((answer) => !answer)) return;
  state.result = items().map((item, index) => isCorrect(state.answers[index], item));
  update();
  $('#results').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});
function reset(newKey = state.key) {
  stopPlayback();
  Object.assign(state, { key: quizKey(newKey), current: 0,
    drafts: Array.from({ length: config().slots }, () => []),
    answers: Array(config().slots).fill(null), result: null, feedback: '' });
  clearToast();
  update();
}
$('#results').addEventListener('click', (event) => {
  const listen = event.target.closest('[data-listen]');
  if (listen) {
    const item = items()[Number(listen.dataset.listen)];
    const root = item.pitches[0];
    const notes = item.pitches.map((pitch) => 48 + pitch + (pitch < root ? 12 : 0));
    if (isScale()) notes.push(60 + root);
    play(notes);
    return;
  }
  if (event.target.closest('#next') || event.target.closest('#retry')) {
    if (event.target.closest('#next')) {
      const next = drawQuestion(state.remaining, isDiatonic() ? state.questionId : state.key.tonic);
      state.remaining = next.remaining;
      state.degree = next.degree;
      state.questionId = next.questionId;
      reset(next.key);
      saveProgress();
    } else reset();
    $('.question').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#question-title').focus({ preventScroll: true });
  }
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(new URL('sw.js', document.baseURI));
      await navigator.serviceWorker.ready;
      $('#offline-status').textContent = 'オフラインの準備ができました。ネット接続なしでも使えます。';
    } catch {
      $('#offline-status').textContent = 'オフラインの準備ができませんでした。ネット接続を確認して再読み込みしてください。';
    }
  });
}
