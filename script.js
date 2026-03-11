// Load vocab from database API
let vocab = [];

async function loadVocabFromDb() {
  const response = await fetch("api.php");
  if (!response.ok) {
    throw new Error("Failed to load vocabulary from api.php");
  }

  const data = await response.json();

  vocab = data.map(item => ({
    id: Number(item.id),
    chapter: Number(item.chapter),
    ar: item.arabic,
    en: item.english,
    starred: Number(item.starred)
  }));
}

// --- State ---
let deck = [];
let i = 0;
let score = 0;
let answered = false;

// Auto-next state
let autoNextTimer = null;
const AUTO_NEXT_MS = 5000;

let inMistakeReview = false;
const wrongCountByKey = new Map();
const mistakeKeys = new Set();
const starredKeys = new Set();

// --- Elements ---
const titleEl = document.getElementById("title");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const qEl = document.getElementById("questionText");
const hintEl = document.getElementById("hintText");
const inputEl = document.getElementById("answerInput");
const msgEl = document.getElementById("msgBox");
const footerEl = document.getElementById("footerText");
const wrongCountTagEl = document.getElementById("wrongCountTag");

const modeEl = document.getElementById("mode");
const strictWrapEl = document.getElementById("strictWrap");
const strictEl = document.getElementById("strictHarakat");
const autoNextEl = document.getElementById("autoNext");

const checkBtn = document.getElementById("checkBtn");
const showBtn = document.getElementById("showBtn");
const starBtn = document.getElementById("starBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const restartBtn = document.getElementById("restartBtn");

const starCountEl = document.getElementById("starCount");
const toggleStarredBtn = document.getElementById("toggleStarredBtn");
const starredPanel = document.getElementById("starredPanel");
const starredSummary = document.getElementById("starredSummary");
const starredList = document.getElementById("starredList");

const chapBtn = document.getElementById("chapBtn");
const chapMenu = document.getElementById("chapMenu");
const chapList = document.getElementById("chapList");
const selAll = document.getElementById("selAll");
const selNone = document.getElementById("selNone");

const chapterState = new Map();

function clearAutoNext() {
  if (autoNextTimer) {
    clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
}

function scheduleAutoNext() {
  clearAutoNext();
  if (!autoNextEl.checked) return;
  autoNextTimer = setTimeout(() => {
    if (answered) nextQuestion();
  }, AUTO_NEXT_MS);
}

function getAllChaptersFromVocab() {
  return [...new Set(vocab.map(v => v.chapter))].sort((a, b) => a - b);
}

function setDefaultChapterSelectionIfEmpty() {
  const chapters = getAllChaptersFromVocab();
  if (chapters.length === 0) return;

  if (chapterState.size === 0) {
    chapters.forEach(ch => chapterState.set(ch, ch === chapters[0]));
    return;
  }

  for (const ch of chapters) {
    if (!chapterState.has(ch)) chapterState.set(ch, false);
  }
}

function selectedChapters() {
  return [...chapterState.entries()]
    .filter(([, c]) => c)
    .map(([ch]) => ch)
    .sort((a, b) => a - b);
}

function updateChapterButtonText() {
  const sel = selectedChapters();
  chapBtn.textContent = sel.length ? `Chapters: ${sel.join(", ")} ▾` : "Select chapters ▾";
}

function renderChapterCheckboxes() {
  setDefaultChapterSelectionIfEmpty();
  const chapters = getAllChaptersFromVocab();
  chapList.innerHTML = "";

  chapters.forEach(ch => {
    const row = document.createElement("div");
    row.className = "chapItem";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `ch_${ch}`;
    cb.checked = !!chapterState.get(ch);
    cb.addEventListener("change", () => {
      chapterState.set(ch, cb.checked);
      updateChapterButtonText();
      restart();
    });

    const label = document.createElement("label");
    label.htmlFor = cb.id;
    label.textContent = `Chapter ${ch}`;

    row.appendChild(cb);
    row.appendChild(label);
    chapList.appendChild(row);
  });

  updateChapterButtonText();
}

function buildDeckFromSelection() {
  const sel = selectedChapters();
  return vocab.filter(item => sel.includes(item.chapter));
}

function itemKey(item) {
  return `${item.chapter}||${item.ar}||${item.en}`;
}

function markMistake(item) {
  const k = itemKey(item);
  mistakeKeys.add(k);
  wrongCountByKey.set(k, (wrongCountByKey.get(k) || 0) + 1);
}

function getWrongCount(item) {
  return wrongCountByKey.get(itemKey(item)) || 0;
}

function normalizeEnglish(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripHarakat(s) {
  return s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

function normalizeArabic(s, strictHarakat) {
  let x = s.trim().replace(/\s+/g, " ");
  x = x.replace(/\u0640/g, "");
  return strictHarakat ? x : stripHarakat(x);
}

function setMessage(text, ok) {
  msgEl.style.display = "block";
  msgEl.className = "msg " + (ok ? "ok" : "bad");
  msgEl.textContent = text;
}

function clearMessage() {
  msgEl.style.display = "none";
  msgEl.textContent = "";
  msgEl.className = "msg";
}

function updateStrictVisibility() {
  const show = modeEl.value === "en2ar";
  strictWrapEl.classList.toggle("hidden", !show);
}

function isStarred(item) {
  return starredKeys.has(itemKey(item));
}

function updateStarCount() {
  starCountEl.textContent = `⭐ Starred: ${starredKeys.size}`;
}

function updateStarButton() {
  if (deck.length === 0) return;
  starBtn.textContent = isStarred(deck[i]) ? "⭐ Starred" : "⭐ Star";
}

async function toggleStarCurrent() {
  alert("toggleStarCurrent reached");
  if (deck.length === 0) return;
  clearAutoNext();

  const item = deck[i];
  const k = itemKey(item);
  const willBeStarred = starredKeys.has(k) ? 0 : 1;

  try {
    const response = await fetch("api.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: item.id,
        starred: willBeStarred
      })
    });

    const result = await response.json();
    console.log("STAR response:", result);

    if (!response.ok || result.changes !== 1) {
      throw new Error("Database update failed");
    }

    if (willBeStarred === 1) {
      starredKeys.add(k);
      item.starred = 1;
    } else {
      starredKeys.delete(k);
      item.starred = 0;
    }

    updateStarCount();
    updateStarButton();
    renderStarredPanel();
    setMessage(willBeStarred === 1 ? "⭐ Added to Study Later" : "⭐ Removed from Study Later", true);
  } catch (error) {
    console.error(error);
    setMessage("Could not update starred word in database.", false);
  }
}

function renderStarredPanel() {
  const items = [];
  for (const item of vocab) {
    if (starredKeys.has(itemKey(item))) items.push(item);
  }

  updateStarCount();

  if (items.length === 0) {
    starredSummary.textContent = "No starred words yet. Use ⭐ Star during the quiz.";
    starredList.innerHTML = "";
    return;
  }

  starredSummary.textContent = `Starred words: ${items.length}`;

  starredList.innerHTML = `<div class="starGrid">${
    items.map(it => `
      <div class="starItem">
        <div>
          <div class="starAr">${it.ar}</div>
          <div class="starEn">${it.en}</div>
        </div>
        <div class="starRight">
          <span class="pill">Ch ${it.chapter}</span>
          <button class="smallBtn" data-unstar="${itemKey(it)}">Unstar</button>
        </div>
      </div>
    `).join("")
  }</div>`;

  starredList.querySelectorAll("[data-unstar]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const k = btn.getAttribute("data-unstar");
      const item = vocab.find(v => itemKey(v) === k);
      if (!item) return;

      try {
        const response = await fetch("api.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id: item.id,
            starred: 0
          })
        });

        if (!response.ok) {
          throw new Error("Failed to unstar");
        }

        starredKeys.delete(k);
        item.starred = 0;
        updateStarCount();
        renderStarredPanel();
        updateStarButton();
      } catch (error) {
        console.error(error);
        setMessage("Could not remove starred word from database.", false);
      }
    });
  });
}

function currentQA() {
  const item = deck[i];
  const mode = modeEl.value;

  if (mode === "ar2en") {
    return { question: item.ar, answer: item.en, hint: "Answer in English." };
  } else {
    const strict = strictEl.checked;
    return {
      question: item.en,
      answer: item.ar,
      hint: strict
        ? "Answer in Arabic (must match ḥarakāt exactly)."
        : "Answer in Arabic (ḥarakāt ignored; base letters only)."
    };
  }
}

function render() {
  clearAutoNext();
  updateStrictVisibility();
  updateChapterButtonText();
  updateStarCount();

  const sel = selectedChapters();

  if (sel.length === 0 || deck.length === 0) {
    titleEl.textContent = "Arabic Vocabulary Quiz";
    qEl.textContent = sel.length === 0 ? "No chapter selected." : "No words found for selected chapter(s).";
    hintEl.textContent = sel.length === 0 ? "Open Chapters and check at least one." : "Select another chapter.";
    wrongCountTagEl.style.display = "none";
    progressEl.textContent = "--";
    scoreEl.textContent = "Score: 0";
    inputEl.value = "";
    inputEl.disabled = true;
    checkBtn.disabled = true;
    showBtn.disabled = true;
    starBtn.disabled = true;
    nextBtn.disabled = true;
    clearMessage();
    footerEl.textContent = "";
    return;
  }

  titleEl.textContent = inMistakeReview
    ? "Mistakes Review (only the ones you missed)"
    : "Arabic Vocabulary Quiz (one question at a time)";

  const item = deck[i];
  const { question, hint } = currentQA();
  qEl.textContent = question;

  if (modeEl.value === "ar2en") {
    qEl.style.direction = "rtl";
  } else {
    qEl.style.direction = "ltr";
  }
  qEl.style.unicodeBidi = "isolate";

  hintEl.textContent = hint;

  progressEl.textContent = `Question ${i + 1}/${deck.length}`;
  scoreEl.textContent = `Score: ${score}`;

  const wrongBefore = getWrongCount(item);
  if (wrongBefore > 0) {
    wrongCountTagEl.style.display = "block";
    wrongCountTagEl.textContent = `❗ Wrong before: ${wrongBefore}`;
  } else {
    wrongCountTagEl.style.display = "none";
  }

  inputEl.value = "";
  inputEl.disabled = false;
  checkBtn.disabled = false;
  showBtn.disabled = false;
  starBtn.disabled = false;
  inputEl.focus();

  answered = false;
  nextBtn.disabled = true;

  clearMessage();
  footerEl.textContent = "Tip: press Enter to Check. Use Next after checking.";

  updateStarButton();
}

function checkAnswer() {
  if (answered || deck.length === 0) return;
  clearAutoNext();

  const item = deck[i];
  const { answer } = currentQA();
  const mode = modeEl.value;

  if (!inputEl.value.trim()) {
    setMessage("Type an answer first.", false);
    return;
  }

  answered = true;
  nextBtn.disabled = false;

  let correct = false;

  if (mode === "ar2en") {
    const user = normalizeEnglish(inputEl.value);
    const key = normalizeEnglish(answer);

    if (user === key) {
      correct = true;
      score += 1;
      if (autoNextEl.checked) {
        setMessage("✅ Correct! (Next in 5s…)", true);
      } else {
        setMessage("✅ Correct!", true);
      }
    } else {
      markMistake(item);
      setMessage(`❌ Not quite. Correct answer: ${answer}`, false);
    }
  } else {
    const strict = strictEl.checked;
    const user = normalizeArabic(inputEl.value, strict);
    const key = normalizeArabic(answer, strict);

    if (user === key) {
      correct = true;
      score += 1;
      if (autoNextEl.checked) {
        setMessage("✅ Correct! (Next in 5s…)", true);
      } else {
        setMessage("✅ Correct!", true);
      }
    } else {
      markMistake(item);
      const extra = strict ? " (strict ḥarakāt)" : " (ḥarakāt ignored)";
      setMessage(`❌ Not quite${extra}. Correct answer: ${answer}`, false);
    }
  }

  scoreEl.textContent = `Score: ${score}`;
  if (correct) scheduleAutoNext();
}

function showAnswer() {
  if (deck.length === 0) return;
  clearAutoNext();
  const item = deck[i];
  const { answer } = currentQA();
  answered = true;
  nextBtn.disabled = false;
  markMistake(item);
  setMessage(`Answer: ${answer}`, true);
}

function startMistakeReview() {
  const sel = selectedChapters();
  const mistakeDeck = [];
  const added = new Set();

  for (const item of vocab) {
    if (!sel.includes(item.chapter)) continue;
    const k = itemKey(item);
    if (mistakeKeys.has(k) && !added.has(k)) {
      mistakeDeck.push(item);
      added.add(k);
    }
  }

  if (mistakeDeck.length === 0) return false;

  inMistakeReview = true;
  deck = mistakeDeck;
  i = 0;
  score = 0;
  render();
  return true;
}

function finishQuiz() {
  clearAutoNext();

  if (!inMistakeReview && mistakeKeys.size > 0) {
    const ok = confirm(`You had ${mistakeKeys.size} mistake(s). Do you want to review them now?`);
    if (ok) {
      const started = startMistakeReview();
      if (started) return;
    }
  }

  qEl.textContent = "🎉 Finished!";
  hintEl.textContent = "";
  wrongCountTagEl.style.display = "none";
  inputEl.value = "";
  inputEl.disabled = true;
  checkBtn.disabled = true;
  showBtn.disabled = true;
  starBtn.disabled = true;
  nextBtn.disabled = true;

  setMessage(`Final score: ${score}/${deck.length}`, true);

  footerEl.textContent = inMistakeReview
    ? "Mistakes review completed. Press Restart to start again."
    : "Press Restart to play again.";
}

function nextQuestion() {
  clearAutoNext();
  if (!answered || deck.length === 0) return;

  if (i < deck.length - 1) {
    i += 1;
    render();
  } else {
    finishQuiz();
  }
}

function shuffleDeck() {
  clearAutoNext();
  for (let k = deck.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [deck[k], deck[r]] = [deck[r], deck[k]];
  }
  i = 0;
  score = 0;
  render();
}

function restart() {
  clearAutoNext();
  deck = buildDeckFromSelection();
  i = 0;
  score = 0;
  answered = false;

  inMistakeReview = false;
  wrongCountByKey.clear();
  mistakeKeys.clear();

  inputEl.disabled = false;
  checkBtn.disabled = false;
  showBtn.disabled = false;
  starBtn.disabled = false;

  render();
}

// Chapter dropdown behavior
function toggleChapMenu(open) {
  const shouldOpen = (open !== undefined) ? open : !chapMenu.classList.contains("open");
  chapMenu.classList.toggle("open", shouldOpen);
}

chapBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleChapMenu();
});

document.addEventListener("click", () => toggleChapMenu(false));
chapMenu.addEventListener("click", (e) => { e.stopPropagation(); });

selAll.addEventListener("click", () => {
  for (const ch of getAllChaptersFromVocab()) chapterState.set(ch, true);
  renderChapterCheckboxes();
  restart();
});

selNone.addEventListener("click", () => {
  for (const ch of getAllChaptersFromVocab()) chapterState.set(ch, false);
  renderChapterCheckboxes();
  restart();
});

// Starred panel toggle
toggleStarredBtn.addEventListener("click", () => {
  const isOpen = !starredPanel.classList.contains("hidden");
  starredPanel.classList.toggle("hidden", isOpen);
  toggleStarredBtn.textContent = isOpen ? "Show Starred Words" : "Hide Starred Words";
  if (!isOpen) renderStarredPanel();
});

// Events
checkBtn.addEventListener("click", checkAnswer);
showBtn.addEventListener("click", showAnswer);
starBtn.addEventListener("click", () => alert("pressed the starred button"));
nextBtn.addEventListener("click", nextQuestion);
shuffleBtn.addEventListener("click", shuffleDeck);
restartBtn.addEventListener("click", restart);

modeEl.addEventListener("change", () => { restart(); });
strictEl.addEventListener("change", () => { render(); });
autoNextEl.addEventListener("change", () => { clearAutoNext(); });

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkAnswer();
});

// Start
(async function start() {
  try {
    await loadVocabFromDb();

    starredKeys.clear();
    for (const item of vocab) {
      if (item.starred === 1) {
        starredKeys.add(itemKey(item));
      }
    }

    renderChapterCheckboxes();
    updateStarCount();
    renderStarredPanel();
    restart();
  } catch (error) {
    console.error(error);
    alert("Could not load vocabulary from database.");
  }
})();