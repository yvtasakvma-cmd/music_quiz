import './style.css';
import { KEYS, DEGREES, noteName, cadence, canConfirm, isCorrect, drawKey } from './music.js';
import { playChord } from './audio.js';

const icons = {
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke-linejoin="round"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const PROGRESS_KEY = 'cadence-key-progress-v1';
function readProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (progress && Number.isInteger(progress.previous) && KEYS[progress.previous] &&
      Array.isArray(progress.remaining) && new Set(progress.remaining).size === progress.remaining.length &&
      progress.remaining.every((tonic) => Number.isInteger(tonic) && KEYS[tonic] && tonic !== progress.previous)) return progress;
  } catch { /* Practice still works when browser storage is unavailable. */ }
  return {};
}
const progress = readProgress();
let { key, remaining } = drawKey(progress.remaining, progress.previous);
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ previous: key.tonic, remaining }));
  } catch { /* Keep the non-repeating deck in memory if storage is unavailable. */ }
}
saveProgress();
let current = 0;
let drafts = [[], [], []];
let answers = [null, null, null];
let result = null;
let feedback = '';
let audioBusy = false;
let feedbackTimer;

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Cadence ホーム"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>cadence<span class="brand-dot">.</span></a>
      <span class="practice-badge">音楽の練習帳</span>
    </header>

    <section class="question" aria-labelledby="question-title">
      <div class="eyebrow"><span class="tiny-dot"></span> CHORD PRACTICE <span class="lesson-number" aria-label="この周の出題数"></span></div>
      <div class="question-top"><h1 id="question-title" tabindex="-1"><span id="key-name"></span><span class="major-label">メジャーの</span></h1></div>
      <p class="progression" aria-label="ツー・ファイブ・ワン"><span>ii<small>m7</small></span><b>—</b><span>V<small>7</small></span><b>—</b><span>I<small>maj7</small></span></p>
      <p class="question-help">3つのコードを、鍵盤でつくってみよう。</p>
    </section>

    <nav class="steps" aria-label="回答するコード">
      ${DEGREES.map((degree, index) => `<button class="step" data-step="${index}" aria-label="${index + 1}つ目 ${degree}"><span class="step-circle"><span>${String(index + 1).padStart(2, '0')}</span></span><span class="step-degree">${degree}</span><span class="step-caption">入力する</span></button>`).join('')}
    </nav>

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
    <footer class="footer"><span>ii–V–I / MAJOR SEVENTH CHORDS</span><details><summary>使い方・iPhone に追加</summary><div><p>各コードの異なる4音を選び、OK で確定します。黄色の丸は回答済み。丸をタップすると戻って編集できます。</p><p>転回形・オクターブは自由です。すべてのコードを確定してから「回答する」を押してください。</p><p>iPhone は Safari の共有メニューから「ホーム画面に追加」。初回の読み込み後はオフラインでも練習できます。音が出ないときは本体の音量・消音設定も確認してください。</p><p id="offline-status">オフライン機能は本番版で有効になります。</p></div></details></footer>
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
  if (black) {
    button.style.left = `${((whiteIndex - 0.31) / 14) * 100}%`;
  } else {
    whiteIndex++;
  }
  $('#keyboard').append(button);
}

function notify(message) {
  clearTimeout(feedbackTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  feedbackTimer = setTimeout(() => { $('#toast').hidden = true; }, 2800);
}

function update() {
  $('#key-name').textContent = key.name;
  $('.lesson-number').textContent = `${KEYS.length - remaining.length} / ${KEYS.length}`;
  $('#current-degree').textContent = DEGREES[current];
  const selected = drafts[current];
  $('#note-count').textContent = `${selected.length} / 4 音`;
  $('#note-count').classList.toggle('complete', canConfirm(selected));
  const progress = answers.filter(Boolean).length;
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
    const pressed = selected.includes(midi);
    button.setAttribute('aria-pressed', String(pressed));
    button.classList.toggle('selected', pressed);
    button.setAttribute('aria-label', noteName(midi, key.flats, true));
    const name = noteName(midi, key.flats);
    button.innerHTML = `<span>${name}${midi % 12 === 0 ? `<small>${Math.floor(midi / 12) - 1}</small>` : ''}</span>`;
  });
  $('#selected-notes').innerHTML = selected.length ? [...selected].sort((a, b) => a - b).map((midi) => `<span class="note-chip">${noteName(midi, key.flats)}<small>${Math.floor(midi / 12) - 1}</small></span>`).join('') : '<span class="empty-notes">鍵盤から4音を選ぼう</span>';
  $('#input-help').textContent = feedback || (selected.length === 4 && !canConfirm(selected) ? '同じ音名が重複しています。異なる4音を選んでください。' : answers[current] ? '確定しました。丸をタップして他のコードも確認できます。' : '音の並び順・オクターブは自由です。');
  $('#play').disabled = selected.length === 0 || audioBusy;
  $('#clear').disabled = selected.length === 0;
  $('#confirm').disabled = !canConfirm(selected) || !!answers[current];
  $('#confirm span').textContent = answers[current] ? '確定済み' : 'OK';
  $('#grade').disabled = progress !== 3 || result !== null;
  $('#progress-help').textContent = result ? '音の組み合わせで採点しています' : progress === 3 ? '準備できました。3つのコードを採点しよう。' : `あと ${3 - progress} つのコードを OK で確定`;
  renderResults();
}

function renderResults() {
  $('#results').hidden = result === null;
  if (!result) return;
  const chords = cadence(key);
  const count = result.filter(Boolean).length;
  $('#results').innerHTML = `<div class="result-heading"><span class="eyebrow">RESULT</span><h2>${count === 3 ? 'すべて正解！' : 'あと少し。音を見比べよう。'}</h2><p>${count} / 3 コード正解${count === 3 ? ' · 次のキーにも挑戦しよう。' : ''}</p></div><div class="result-chords">${chords.map((chord, index) => `<div class="result-chord ${result[index] ? 'is-correct' : 'is-incorrect'}"><span class="result-icon" aria-label="${result[index] ? '正解' : '不正解'}">${result[index] ? '✓' : '×'}</span><div><div class="result-chord-title"><span>${DEGREES[index]}</span><strong>${chord.symbol}</strong></div><p class="expected-notes">正解：${chord.notes.join(' · ')}</p>${result[index] ? '' : `<p class="your-notes">回答：${[...answers[index]].sort((a, b) => a - b).map((midi) => noteName(midi, key.flats)).join(' · ')}</p>`}</div><button class="listen-answer" data-listen="${index}" aria-label="正解の ${chord.symbol} を聴く">${icons.sound}</button></div>`).join('')}</div><div class="result-actions"><button id="retry" class="button retry-button">同じキーでもう一度</button><button id="next" class="button confirm-button">${remaining.length ? '次の問題' : '次の12問へ'} ${icons.arrow}</button></div>`;
}

function editCurrent() {
  answers[current] = null;
  result = null;
  feedback = '';
}

$('#keyboard').addEventListener('click', (event) => {
  const button = event.target.closest('[data-midi]');
  if (!button) return;
  const midi = Number(button.dataset.midi);
  const selected = drafts[current];
  if (selected.includes(midi)) {
    drafts[current] = selected.filter((note) => note !== midi);
  } else if (selected.length < 4) {
    drafts[current] = [...selected, midi];
  } else {
    notify('4音まで選べます。選択した鍵盤をタップすると解除できます。');
    return;
  }
  editCurrent();
  update();
});

document.querySelectorAll('.step').forEach((button) => button.addEventListener('click', () => {
  current = Number(button.dataset.step);
  feedback = '';
  update();
}));

$('#clear').addEventListener('click', () => {
  drafts[current] = [];
  editCurrent();
  update();
});

async function play(notes) {
  if (audioBusy) return;
  audioBusy = true;
  $('#play').disabled = true;
  try {
    await playChord(notes);
  } catch (error) {
    notify(error.message || '音声を再生できませんでした。');
  } finally {
    audioBusy = false;
    $('#play').disabled = drafts[current].length === 0;
  }
}

$('#play').addEventListener('click', () => play([...drafts[current]]));
$('#confirm').addEventListener('click', () => {
  if (!canConfirm(drafts[current]) || answers[current]) return;
  answers[current] = [...drafts[current]];
  const next = answers.findIndex((answer, index) => index > current && !answer);
  const first = answers.findIndex((answer) => !answer);
  if (next !== -1 || first !== -1) {
    const confirmed = current + 1;
    current = next !== -1 ? next : first;
    feedback = '';
    notify(`${confirmed}つ目を確定しました。次のコードを入力しましょう。`);
  } else {
    feedback = '3つのコードがそろいました。「回答する」で採点しよう。';
  }
  update();
  // Move keyboard focus with the automatically advancing step.
  document.querySelector(`[data-step="${current}"]`).focus({ preventScroll: true });
});

$('#grade').addEventListener('click', () => {
  if (answers.some((answer) => !answer)) return;
  result = cadence(key).map((chord, index) => isCorrect(answers[index], chord));
  update();
  $('#results').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});

function reset(newKey = key) {
  key = newKey;
  current = 0;
  drafts = [[], [], []];
  answers = [null, null, null];
  result = null;
  feedback = '';
  clearTimeout(feedbackTimer);
  $('#toast').hidden = true;
  update();
}

$('#results').addEventListener('click', (event) => {
  const listen = event.target.closest('[data-listen]');
  if (listen) {
    const chord = cadence(key)[Number(listen.dataset.listen)];
    const root = chord.pitches[0];
    play(chord.pitches.map((pitch) => 48 + pitch + (pitch < root ? 12 : 0)));
    return;
  }
  if (event.target.closest('#next') || event.target.closest('#retry')) {
    if (event.target.closest('#next')) {
      const next = drawKey(remaining, key.tonic);
      remaining = next.remaining;
      reset(next.key);
      saveProgress();
    } else {
      reset();
    }
    $('.question').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#question-title').focus({ preventScroll: true });
  }
});

update();

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
