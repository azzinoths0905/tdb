const byId = (id) => document.getElementById(id);
const drawButton = byId("draw");
const resetButton = byId("reset");
const cardView = byId("card");
const status = byId("status");
const timerButton = byId("start-timer");
const installButton = byId("install");

const types = { truth: "真心话", dare: "大冒险", bonus: "加分牌" };
const requirements = {
  props: "道具", food: "食物", shower: "淋浴", foot: "足部互动",
  rimming: "舔肛", anal: "肛交",
};
const pickMethods = { bottle: "转瓶子选人", pick: "抽牌选人" };

let players = [];
let turn = 0;
let activeCard = null;
const names = byId("names");
const main = document.querySelector("main");
const applyButton = byId("apply");
const defaultNames = { pair: "玩家一\n玩家二", group: "玩家一\n玩家二\n玩家三" };
const drafts = { ...defaultNames };
let draftMode = "pair";
let gameSettings = null;
names.value = drafts.pair;

function clearError() {
  byId("roster-error").textContent = "";
  names.removeAttribute("aria-invalid");
}
names.addEventListener("input", clearError);

function displayScreen(screen) {
  main.dataset.screen = screen;
  byId("enter-label").textContent = players.length ? "继续牌局" : "进入牌桌";
  if (screen === "setup") {
    if (gameSettings) {
      draftMode = gameSettings.pair ? "pair" : "group";
      document.querySelector(`input[name="mode"][value="${draftMode}"]`).checked = true;
      document.querySelector(`input[name="level"][value="${gameSettings.level}"]`).checked = true;
      names.value = players.join("\n");
    }
    byId("back").textContent = players.length ? "取消" : "返回";
    if (decks) applyButton.textContent = players.length ? "保存设置" : "开始游戏";
    clearError();
  }
  window.scrollTo(0, 0);
  byId({home:"enter", setup:"setup-title", game:"round"}[screen]).focus({preventScroll:true});
}

function navigate(screen, replace = false) {
  if (replace) history.replaceState({screen}, "");
  else history.pushState({screen}, "");
  displayScreen(screen);
}
history.replaceState({screen:"home"}, "");
window.addEventListener("popstate", event => {
  const target = event.state?.screen;
  displayScreen(target === "setup" || (target === "game" && players.length) ? target : "home");
});
byId("enter").addEventListener("click", () => navigate(players.length ? "game" : "setup"));
byId("edit").addEventListener("click", () => navigate("setup"));
byId("back").addEventListener("click", () => history.back());
byId("guide").addEventListener("click", () => byId("guide-help").showModal());

applyButton.addEventListener("click", () => {
  if (!decks) { loadDeck(); return; }
  const entered = names.value.split(/\n/).map(name => name.trim()).filter(Boolean);
  const selection = settings();
  const validCount = selection.pair ? entered.length === 2 : entered.length >= 3;
  if (!validCount || new Set(entered).size !== entered.length) {
    byId("roster-error").textContent = selection.pair
      ? "请填写两个不同的昵称，每行一人。"
      : "请填写至少三个不同的昵称，每行一人。";
    names.setAttribute("aria-invalid", "true");
    names.focus();
    return;
  }
  const editing = !!gameSettings;
  const changed = !editing || selection.level !== gameSettings.level ||
    selection.pair !== gameSettings.pair || entered.some((name,i) => name !== players[i]) ||
    entered.length !== players.length;
  gameSettings = selection;
  players = entered;
  drafts[draftMode] = entered.join("\n");
  if (changed) showDeck();
  if (editing) history.back();
  else navigate("game", true);
});

function passTurn() {
  return players[turn % players.length];
}

byId("partner").addEventListener("click", () => {
  const others = players.filter(name => name !== passTurn());
  const chosen = [];
  const count = (activeCard?.np ?? 2) - 1;
  while (chosen.length < count && others.length) {
    chosen.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
  }
  byId("partner").textContent = "搭档 · " + chosen.join("、");
  byId("partner").disabled = true;
});

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
    const pile = decks[level].filter((card) => !(pair && (card.exclude2 || card.np > 2)));
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
  const { pile, total } = pileFor(gameSettings);
  drawButton.disabled = false;
  resetButton.hidden = pile.length === total || cardView.dataset.state === "empty";
  status.textContent = pile.length
    ? `剩余 ${pile.length} / ${total} 张`
    : "剩余 0 张";
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
  byId("remaining").hidden = true;
  byId("timer-status").hidden = true;
  timerButton.hidden = false;
  timerButton.textContent = "开始计时";
  if (duration) showTime(duration);
}

function updateTimer() {
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  showTime(seconds);
  if (seconds === 0) {
    stopTimer();
    timerButton.hidden = false;
    timerButton.textContent = "再计一次";
    byId("timer-status").textContent = "时间到";
  }
}

timerButton.addEventListener("click", () => {
  if (!duration || interval !== null) return;
  deadline = Date.now() + duration * 1000;
  timerButton.hidden = true;
  byId("remaining").hidden = false;
  byId("timer-status").hidden = false;
  byId("timer-status").textContent = "计时中";
  interval = setInterval(updateTimer, 200);
  updateTimer();
});

function render(card, { pair }, state = card ? "drawn" : "ready") {
  const messages = {
    ready: ["准备开牌", "选好等级，抽一张试试。", "抽一张"],
    loading: ["正在加载牌库", "", "抽一张"],
    empty: ["这叠牌抽完了", "", "重新洗牌"],
    error: ["牌库暂时无法加载", "连接网络后重试。", "重试"],
    drawn: ["", "", "抽一张"],
  };
  const [title, description, action] = messages[state];
  const text = card ? (pair ? card.text2 ?? card.text : card.text) : description;
  cardView.dataset.state = state;
  cardView.classList.toggle("has-card", Boolean(card));
  cardView.toggleAttribute("data-long", text.length > 90);
  byId("card-header").hidden = !card;
  byId("card-title").hidden = !title;
  byId("card-title").textContent = title;
  byId("kind").textContent = types[card?.type] ?? "";
  byId("points").textContent = card ? `${card.pts} 分` : "";
  byId("card-text").textContent = text;
  drawButton.textContent = action;
  byId("flip").hidden = state !== "ready" || !players.length;
  activeCard = card;
  cardView.dataset.kind = card?.type ?? "";
  byId("round").textContent = `第 ${turn + 1} 轮 · 尺度 ${gameSettings?.level ?? settings().level}`;
  const picker = byId("partner");
  picker.hidden = !card?.pick || pair || card.allin;
  picker.disabled = false;
  picker.textContent = pickMethods[card?.pick] ?? "选搭档";
  if (players.length && card) {
    byId("kind").textContent = passTurn() + " · " + types[card.type];
    drawButton.textContent = "结束本轮";
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cardView.animate([{opacity: 0.35, transform: "perspective(700px) rotateY(-16deg)"}, {opacity: 1, transform: "none"}], {duration: 280});
    }
  }
  if (state === "ready") {
    drawButton.textContent = players.length ? "翻开卡牌" : "开始游戏";
    byId("card-title").textContent = players.length ? passTurn() : "准备开牌";
    byId("card-text").textContent = players.length ? "轮到你了，准备好就翻牌。" : "选好等级和玩家，开始这一局。";
  }

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
    if (pair && card.pick && players.length) labels.push("搭档 · " + players[(turn + 1) % players.length]);
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
  if (!decks) return;
  const selection = gameSettings ?? settings();
  render(null, selection, pileFor(selection).pile.length ? "ready" : "empty");
  if (gameSettings) updateControls();
}

function reshuffle() {
  const { level, pair } = gameSettings;
  piles.delete(`${level}:${pair}`);
  showDeck();
}

let lastAction = -Infinity;
function advanceTurn() {
  if (main.dataset.screen !== "game" || performance.now() - lastAction < 400) return;
  lastAction = performance.now();
  drawButton.focus({preventScroll:true});
  if (activeCard) {
    turn += 1;
    showDeck();
    return;
  }
  if (cardView.dataset.state === "empty") {
    reshuffle();
    return;
  }
  const card = pileFor(gameSettings).pile.pop();
  render(card, gameSettings, card ? "drawn" : "empty");
  updateControls();
}
drawButton.addEventListener("click", advanceTurn);
byId("flip").addEventListener("click", advanceTurn);
resetButton.addEventListener("click", () => byId("shuffle-help").showModal());
byId("confirm-shuffle").addEventListener("click", reshuffle);

byId("modes").addEventListener("change", () => {
  drafts[draftMode] = names.value;
  draftMode = settings().pair ? "pair" : "group";
  names.value = drafts[draftMode];
  clearError();
});
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
}

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

async function loadDeck() {
  applyButton.disabled = true;
  applyButton.textContent = "正在加载牌库…";
  drawButton.disabled = true;
  resetButton.hidden = true;
  status.textContent = "正在加载牌库…";
  render(null, settings(), "loading");
  try {
    const response = await fetch("./cards-cn.json?v=2");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    for (const level of ["1", "2", "3", "4"]) {
      if (!Array.isArray(data[level]) || !data[level].length) {
        throw new Error(`Missing level ${level}`);
      }
    }
    decks = data;
    applyButton.disabled = false;
    applyButton.textContent = "开始游戏";
    showDeck();
  } catch (error) {
    console.error("Unable to load the deck", error);
    status.textContent = "牌库加载失败，请检查网络后重试。";
    render(null, settings(), "error");
    applyButton.disabled = false;
    applyButton.textContent = "牌库加载失败，点此重试";
  }
}

loadDeck();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Offline setup failed", error);
  });
}
