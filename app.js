const byId = (id) => document.getElementById(id);
const drawButton = byId("draw");
const resetButton = byId("reset");
const cardView = byId("card");
const status = byId("status");
const timerButton = byId("start-timer");
const installButton = byId("install");

const types = {
  truth: ["真心话", "♥"],
  dare: ["大冒险", "♠"],
  bonus: ["加分牌", "♦"],
};
const requirements = {
  props: "道具", food: "食物", shower: "淋浴", foot: "足部互动",
  rimming: "舔肛", anal: "肛交",
};
const pickMethods = { bottle: "转瓶子选人", pick: "抽牌选人" };

let decks;
const piles = new Map();
let duration = 0;
let interval = null;
let deadline = 0;
let installPrompt = null;

function settings() {
  return {
    level: document.querySelector('input[name="level"]:checked').value,
    pair: document.querySelector('input[name="mode"]:checked').value === "pair",
  };
}

function pileFor({ level, pair }) {
  const key = `${level}:${pair}`;
  if (!piles.has(key)) {
    const pile = decks[level].filter((card) => !(pair && card.exclude2));
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    piles.set(key, { pile, total: pile.length });
  }
  return piles.get(key);
}

function updateControls() {
  if (!decks) return;
  const { pile, total } = pileFor(settings());
  drawButton.disabled = pile.length === 0;
  resetButton.disabled = pile.length === total;
  status.textContent = pile.length
    ? `剩余 ${pile.length} / ${total} 张`
    : "这叠牌抽完了。可以重新洗牌，或换个等级。";
}

function stopTimer() {
  clearInterval(interval);
  interval = null;
}

function showTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  byId("remaining").textContent = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function prepareTimer(card) {
  stopTimer();
  duration = card?.timer ? card.duration : 0;
  byId("timer").hidden = !duration;
  timerButton.disabled = false;
  timerButton.textContent = "开始计时";
  if (duration) showTime(duration);
}

function updateTimer() {
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  showTime(seconds);
  if (seconds === 0) {
    stopTimer();
    timerButton.disabled = false;
    timerButton.textContent = "再计一次";
    status.textContent = "时间到！";
  }
}

timerButton.addEventListener("click", () => {
  if (!duration || interval !== null) return;
  deadline = Date.now() + duration * 1000;
  timerButton.disabled = true;
  timerButton.textContent = "计时中";
  interval = setInterval(updateTimer, 200);
  updateTimer();
});

function render(card, { level, pair }) {
  cardView.dataset.level = level;
  cardView.classList.toggle("has-card", Boolean(card));
  byId("card-title").hidden = Boolean(card);
  const [label, suit] = types[card?.type] ?? ["", "♠"];
  byId("kind").textContent = card ? `第 ${level} 级 · ${label}` : `第 ${level} 级`;
  byId("suit").textContent = suit;
  byId("points").textContent = card ? `${card.pts} 分` : "";
  byId("card-text").textContent = card
    ? (pair ? card.text2 ?? card.text : card.text)
    : "选好等级，抽一张试试。";

  const art = byId("art");
  art.replaceChildren();
  if (card?.img && /^[a-zA-Z0-9_-]+\.png$/.test(card.img)) {
    const image = new Image();
    image.alt = "";
    image.hidden = true;
    image.addEventListener("load", () => { image.hidden = false; }, { once: true });
    image.src = `./img/${card.img}`;
    art.append(image);
  }

  const details = byId("details");
  details.replaceChildren();
  const labels = [];
  if (card) {
    if (card.allin && !pair) labels.push("全员参与");
    if (!pair && card.np && !card.allin) labels.push(`${card.np} 人参与`);
    if (!pair && pickMethods[card.pick]) labels.push(pickMethods[card.pick]);
    if (card.bonus) labels.push("可加分");
    if (card.requires?.length) {
      labels.push(`需要：${card.requires.map((key) => requirements[key] ?? key).join("、")}`);
    }
  }
  for (const label of labels) {
    const chip = document.createElement("span");
    chip.textContent = label;
    details.append(chip);
  }
  details.hidden = !labels.length;
  prepareTimer(card);
}

function showDeck() {
  render(null, settings());
  updateControls();
}

drawButton.addEventListener("click", () => {
  const selection = settings();
  const card = pileFor(selection).pile.pop();
  if (!card) return;
  render(card, selection);
  updateControls();
});

resetButton.addEventListener("click", () => {
  const { level, pair } = settings();
  piles.delete(`${level}:${pair}`);
  showDeck();
});

byId("levels").addEventListener("change", showDeck);
byId("modes").addEventListener("change", showDeck);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
});
if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
  installButton.hidden = true;
}
installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    byId("install-help").showModal();
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
  } catch {
    byId("install-help").showModal();
  }
});

try {
  const response = await fetch("./cards-cn.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  for (const level of ["1", "2", "3", "4"]) {
    if (!Array.isArray(data[level]) || !data[level].length) {
      throw new Error(`Missing level ${level}`);
    }
  }
  decks = data;
  showDeck();
} catch (error) {
  console.error("Unable to load the deck", error);
  status.textContent = "牌库加载失败，请刷新页面重试。";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Offline setup failed", error);
  });
}
