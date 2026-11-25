const byId = (id) => document.getElementById(id);
const drawButton = byId("draw");
const resetButton = byId("reset");
const cardView = byId("card");
const status = byId("status");
const timerButton = byId("start-timer");
const installButton = byId("install");

const types = { truth: "真心话", dare: "大冒险", bonus: "特别牌" };
const requirements = {
  props: "道具", food: "食物", shower: "淋浴", foot: "足部互动",
  rimming: "舔肛", anal: "肛交",
};
const main = document.querySelector("main");
const applyButton = byId("apply");
let gameSettings = null;
let catalog = [];
let selected = new Set();
let available = [];

// Each facet returns the labels that apply to a card. Missing metadata stays explicit.
function timerSeconds(card) {
  return card?.timer && card.duration > 0 ? card.duration : 0;
}
function timingValues(card) {
  const seconds = timerSeconds(card);
  return [seconds ? `${seconds} 秒` : "无需计时"];
}
const facets = [
  ["牌型", c => [types[c.type]]],
  ["参与人数", c => [c.allin ? "全员参与" : c.np ? `${c.np} 人参与` : "未标注人数"]],
  ["双人适用性", c => [c.exclude2 || c.np > 2 ? "不适用双人" : "适用双人"]],
  ["计时", timingValues],
  ["是否需要选人", c => [c.pick ? "需要选人" : "无需选人"]],
  ["特殊要求", c => c.requires?.length ? c.requires.map(key => requirements[key] ?? key) : ["无特殊要求"]],
];

const filters = new Map();
let matches = [];

function buildFilters(cards) {
  filters.clear();
  const controls = byId("deck-filters");
  controls.replaceChildren();
  for (const [name, valuesFor] of facets) {
    const values = new Set(cards.flatMap(valuesFor));
    if (values.size < 2) continue;
    const group = document.createElement("fieldset");
    group.className = "multi-filter";
    const legend = document.createElement("legend");
    legend.textContent = name + "（可多选）";
    group.append(legend);
    function tag(text, container = group) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = text;
      input.checked = true;
      const span = document.createElement("span");
      span.textContent = text;
      label.append(input, span);
      container.append(label);
      return input;
    }
    const all = tag("全选");
    let timed;
    let durations = [];
    let options;
    if (valuesFor === timingValues) {
      const untimed = tag("无需计时");
      timed = tag("需要计时");
      const seconds = [...new Set(cards.map(timerSeconds))].filter(Boolean).sort((a,b) => a-b);
      const row = document.createElement("div");
      row.className = "duration-options";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "计时时长");
      group.append(row);
      durations = seconds.map(value => tag(`${value} 秒`, row));
      options = [untimed, ...durations];
    } else {
      options = Array.from(values, value => tag(value));
    }
    function syncParent(parent, children) {
      const count = children.filter(option => option.checked).length;
      parent.checked = count === children.length;
      parent.indeterminate = count > 0 && !parent.checked;
    }
    group.addEventListener("change", event => {
      if (event.target === all) {
        for (const option of options) option.checked = all.checked;
      } else if (event.target === timed) {
        for (const option of durations) option.checked = timed.checked;
      }
      if (timed) syncParent(timed, durations);
      syncParent(all, options);
      if (all.checked) filters.delete(valuesFor);
      else filters.set(valuesFor, new Set(options.filter(option => option.checked).map(option => option.value)));
      showOptions();
    });
    controls.append(group);
  }
}

byId("clear-filters").addEventListener("click", () => {
  filters.clear();
  for (const input of byId("deck-filters").querySelectorAll("input")) {
    input.checked = true;
    input.indeterminate = false;
  }
  showOptions();
});
byId("use-matches").addEventListener("click", () => {
  for (const {index} of available) selected.delete(index);
  for (const {index} of matches) selected.add(index);
  showOptions();
});

function updateDeckCount() {
  const count = available.filter(({index}) => selected.has(index)).length;
  byId("deck-count").textContent = count ? `已选 ${count} / ${available.length} 张` : available.length ? "请至少选一张牌" : "请至少选择一个尺度";
  applyButton.disabled = !count;
}

function showOptions() {
  const levels = selectedLevels();
  const levelCount = levels.length;
  byId("all-levels").checked = levelCount === document.querySelectorAll('[name="free-level"]').length;
  byId("all-levels").indeterminate = levelCount > 0 && !byId("all-levels").checked;
  if (!decks) return;
  available = catalog.filter(entry => levels.includes(entry.level));
  matches = available.filter(({card}) => {
    for (const [valuesFor, chosen] of filters) {
      if (!valuesFor(card).some(value => chosen.has(value))) return false;
    }
    return true;
  });
  byId("clear-filters").disabled = !filters.size;
  byId("match-count").hidden = !filters.size;
  byId("match-count").textContent = matches.length ? `匹配 ${matches.length} 张` : "没有匹配的牌，可调整或重置筛选。";
  byId("use-matches").hidden = !filters.size || !matches.length;
  updateDeckCount();
  const groups = byId("deck-groups");
  groups.replaceChildren();
  for (const [type, title] of Object.entries(types)) {
    const entries = matches.filter(({card}) => card.type === type);
    if (!entries.length) continue;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "quiet";
    function refresh() {
      const count = entries.filter(({index}) => selected.has(index)).length;
      summary.textContent = `${title} · ${count} / ${entries.length}`;
      toggle.textContent = "全选";
      toggle.setAttribute("aria-pressed", count === entries.length ? "true" : count ? "mixed" : "false");
      updateDeckCount();
    }
    details.open = filters.size > 0;
    details.append(summary, toggle);
    function setCard(index, checked) {
      if (checked) selected.add(index);
      else selected.delete(index);
    }
    for (const {card, index, level} of entries) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = index;
      input.checked = selected.has(index);
      input.addEventListener("change", () => { setCard(index, input.checked); refresh(); });
      const caption = document.createElement("span");
      caption.textContent = `尺度 ${level} · ${(card.textFree ?? card.text)}`;
      label.append(input, caption);
      details.append(label);
    }
    toggle.addEventListener("click", () => {
      const checked = entries.some(({index}) => !selected.has(index));
      for (const input of details.querySelectorAll("input")) {
        input.checked = checked;
        setCard(Number(input.value), checked);
      }
      refresh();
    });
    refresh();
    groups.append(details);
  }
}
function displayScreen(screen) {
  main.dataset.screen = screen;
  byId("enter-label").textContent = gameSettings ? "继续牌局" : "进入牌桌";
  if (screen === "setup") {
    if (gameSettings) {
      for (const input of byId("free-levels").querySelectorAll("input")) {
        input.checked = gameSettings.levels.includes(input.value);
      }
      for (const {level,index} of catalog) {
        if (gameSettings.levels.includes(level)) selected.delete(index);
      }
      for (const index of gameSettings.indices) selected.add(index);
    }
    showOptions();
    byId("back").textContent = history.state?.editing ? "取消" : "返回";
    if (decks) applyButton.textContent = history.state?.editing ? "保存设置" : "开始游戏";
  }
  window.scrollTo(0, 0);
  byId({home:"enter", quick:"quick-title", setup:"setup-title", game:"round"}[screen]).focus({preventScroll:true});
}

function navigate(screen, replace = false) {
  const state = { screen, editing: screen === "setup" && main.dataset.screen === "game" };
  if (replace) history.replaceState(state, "");
  else history.pushState(state, "");
  displayScreen(screen);
}
history.replaceState({screen:"home"}, "");
window.addEventListener("popstate", event => {
  const target = event.state?.screen;
  displayScreen(target === "quick" || target === "setup" || (target === "game" && gameSettings) ? target : "home");
});
byId("enter").addEventListener("click", () => navigate(gameSettings ? "game" : "quick"));
byId("quick-back").addEventListener("click", () => history.back());
byId("custom").addEventListener("click", () => navigate("setup"));
byId("quick-retry").addEventListener("click", loadDeck);
for (const button of document.querySelectorAll(".presets button")) {
  button.addEventListener("click", () => {
    const level = button.dataset.level;
    gameSettings = {levels: [level], indices: catalog.filter(entry => entry.level === level).map(entry => entry.index)};
    reshuffle();
    navigate("game");
  });
}
byId("edit").addEventListener("click", () => navigate("setup"));
byId("back").addEventListener("click", () => history.back());
byId("guide").addEventListener("click", () => byId("guide-help").showModal());

applyButton.addEventListener("click", () => {
  if (!decks) { loadDeck(); return; }
  const selection = {
    levels: selectedLevels(),
    indices: available.filter(({index}) => selected.has(index)).map(({index}) => index),
  };
  const editing = history.state?.editing;
  const changed = JSON.stringify(selection) !== JSON.stringify(gameSettings);
  gameSettings = selection;
  if (changed || !editing) reshuffle();
  if (editing) history.back();
  else navigate("game", true);
});

let decks;
let pile = [];
let duration = 0;
let interval = null;
let deadline = 0;
let installPrompt = null;

function selectedLevels() {
  return Array.from(document.querySelectorAll('input[name="free-level"]:checked'), input => input.value);
}

function updateControls() {
  const total = gameSettings.indices.length;
  drawButton.disabled = false;
  resetButton.hidden = !pile.length || pile.length === total;
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
  duration = timerSeconds(card);
  byId("timer").hidden = !duration;
  byId("remaining").hidden = true;
  byId("timer-status").hidden = true;
  timerButton.hidden = false;
  timerButton.textContent = duration ? `开始计时 · ${duration} 秒` : "开始计时";
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

function render(card, state = card ? "drawn" : "ready") {
  const messages = {
    ready: ["准备开牌", "轻点牌背，翻开第一张。", "翻开卡牌"],
    loading: ["正在加载牌库", "", "抽一张"],
    empty: ["这叠牌抽完了", "", "重新洗牌"],
    error: ["牌库暂时无法加载", "连接网络后重试。", "重试"],
    drawn: ["", "", "抽一张"],
  };
  const [title, description, action] = messages[state];
  const text = card ? (card.textFree ?? card.text) : description;
  cardView.dataset.state = state;
  cardView.classList.toggle("has-card", Boolean(card));
  cardView.toggleAttribute("data-long", text.length > 90);
  byId("card-header").hidden = !card;
  byId("card-title").hidden = !title;
  byId("card-title").textContent = title;
  byId("kind").textContent = types[card?.type] ?? "";
  byId("card-text").textContent = text;
  drawButton.textContent = action;
  byId("flip").hidden = state !== "ready" || !gameSettings;
  cardView.dataset.kind = card?.type ?? "";
  byId("round").textContent = gameSettings ? `纯翻牌 · 尺度 ${gameSettings.levels.join("、")}` : "";
  if (card) drawButton.textContent = pile.length ? "翻下一张" : "重新洗牌";

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
    if (card.allin) labels.push("全员参与");
    if (card.np && !card.allin) labels.push(`${card.np} 人参与`);
    if (card.pick) labels.push("需要选人");
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

function reshuffle() {
  pile = gameSettings.indices.map(index => catalog[index].card);
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pile[i], pile[j]] = [pile[j], pile[i]];
  }
  render(null);
  updateControls();
}

let lastAction = -Infinity;
function drawCard() {
  if (main.dataset.screen !== "game" || performance.now() - lastAction < 400) return;
  lastAction = performance.now();
  drawButton.focus({preventScroll:true});
  if (!pile.length) {
    reshuffle();
    return;
  }
  render(pile.pop());
  updateControls();
}
drawButton.addEventListener("click", drawCard);
byId("flip").addEventListener("click", drawCard);
resetButton.addEventListener("click", () => byId("shuffle-help").showModal());
byId("confirm-shuffle").addEventListener("click", reshuffle);

byId("free-levels").addEventListener("change", event => {
  if (event.target === byId("all-levels")) {
    for (const input of document.querySelectorAll('[name="free-level"]')) input.checked = event.target.checked;
  }
  showOptions();
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
  byId("quick-status").textContent = "正在加载牌库…";
  byId("quick-retry").hidden = true;
  applyButton.disabled = true;
  applyButton.textContent = "正在加载牌库…";
  drawButton.disabled = true;
  resetButton.hidden = true;
  status.textContent = "正在加载牌库…";
  render(null, "loading");
  try {
    const response = await fetch("./cards-cn.json?v=3");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    for (const level of ["1", "2", "3", "4"]) {
      if (!Array.isArray(data[level]) || !data[level].length) {
        throw new Error(`Missing level ${level}`);
      }
    }
    decks = data;
    catalog = Object.entries(decks).flatMap(([level, cards]) =>
      cards.map(card => ({level, card}))
    ).map((entry, index) => ({...entry, index}));
    selected = new Set(catalog.map(entry => entry.index));
    for (const button of document.querySelectorAll(".presets button")) button.disabled = false;
    byId("quick-status").textContent = "";
    buildFilters(catalog.map(entry => entry.card));
    applyButton.disabled = false;
    applyButton.textContent = "开始游戏";
    showOptions();
  } catch (error) {
    console.error("Unable to load the deck", error);
    byId("quick-status").textContent = "牌库加载失败，请检查网络。";
    byId("quick-retry").hidden = false;
    status.textContent = "牌库加载失败，请检查网络后重试。";
    render(null, "error");
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
