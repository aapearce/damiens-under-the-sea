// Local top-10 leaderboard stored in the browser via localStorage.
const KEY = "uts_leaderboard_v1";

export function loadBoard() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveScore(entry) {
  const board = loadBoard();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {}
  return top.indexOf(entry) + 1 || -1;
}
