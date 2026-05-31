import { loadBoard } from "./leaderboard.js";

const $ = (id) => document.getElementById(id);
export const dom = {
  hud: $("hud"),
  score: $("score"),
  danger: $("danger"),
  depthFill: $("depth-fill"),
  depthDiver: $("depth-diver"),
  depthText: $("depth-text"),
  menu: $("menu"),
  over: $("over"),
  overReason: $("over-reason"),
  win: $("win"),
  board: $("board"),
  boardList: $("board-list"),
  stars: $("stars"),
  scoreLine: $("score-line"),
  nameInput: $("name-input"),
  nameEntry: $("name-entry"),
  ink: $("ink"),
  flash: $("flash"),
};

const SCREENS = [dom.menu, dom.over, dom.win, dom.board];
export function showScreen(el) {
  for (const s of SCREENS) s.classList.add("hidden");
  if (el) el.classList.remove("hidden");
}
export function setHudVisible(v) { dom.hud.classList.toggle("hidden", !v); }

export function setScore(n) { dom.score.textContent = Math.round(n); }
export function setDanger(on) { dom.danger.classList.toggle("hidden", !on); }

export function setDepth(t, meters, maxMeters) {
  const pct = Math.max(0, Math.min(1, t)) * 100;
  dom.depthFill.style.height = pct + "%";
  dom.depthDiver.style.top = pct + "%";
  dom.depthText.textContent = Math.round(meters) + "m";
}

// brief octopus-ink screen splash
export function flashInk() {
  dom.ink.style.opacity = "1";
  setTimeout(() => (dom.ink.style.opacity = "0"), 900);
}
// brief shark-bite red flash
export function flashDamage() {
  dom.flash.style.opacity = "1";
  setTimeout(() => (dom.flash.style.opacity = "0"), 180);
}

export function showStars(count) {
  dom.stars.innerHTML = "★".repeat(count) + `<span class="dim">${"★".repeat(3 - count)}</span>`;
}
export function setScoreLine(text) { dom.scoreLine.textContent = text; }

export function renderBoard() {
  const board = loadBoard();
  const list = dom.boardList;
  list.innerHTML = "";
  if (!board.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No dives yet — be the first!";
    list.appendChild(li);
    return;
  }
  board.forEach((e, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="rank">${i + 1}</span>` +
      `<span class="nm">${escapeHtml(e.name)}</span>` +
      `<span class="st">${"★".repeat(e.stars || 0)}</span>` +
      `<span class="sc">${e.score}</span>`;
    list.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
