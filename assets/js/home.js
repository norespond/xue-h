const grid = document.querySelector("#game-grid");
const gameCount = document.querySelector("#game-count");
const cgCount = document.querySelector("#cg-count");
const bgmCount = document.querySelector("#bgm-count");
const themeToggle = document.querySelector("#theme-toggle");
const gameSearch = document.querySelector("#game-search");
const clearSearch = document.querySelector("#clear-search");
const resultCount = document.querySelector("#result-count");

const defaultFallbackCover = "https://norespond.github.io/picx-images-hosting/cover/EV074.4n82bulpg6.jpg";
const storageKey = "xue-hua-theme";
const libraryStateKey = "xue-hua-library-state";
let fallbackCover = defaultFallbackCover;
let allGames = [];

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "day" ? "日间" : "夜间";
  localStorage.setItem(storageKey, theme);
}

const savedTheme = localStorage.getItem(storageKey) || "night";
setTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "night";
  setTheme(currentTheme === "night" ? "day" : "night");
});

function normalizePath(path) {
  if (!path) return fallbackCover;
  return path.startsWith("/") ? path.slice(1) : path;
}

function handleImageError(image) {
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = fallbackCover;
  image.classList.add("is-fallback-image");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function makeCard(game, index = 0) {
  const cover = normalizePath(game.cover);
  const loading = index < 6 ? "eager" : "lazy";
  const fetchPriority = index < 2 ? ' fetchpriority="high"' : "";
  const isUnclassified = Boolean(game.isUnclassified || game.id === "000" || game.folder === "000");

  const card = document.createElement("a");
  card.className = `game-card${isUnclassified ? " is-unclassified" : ""}`;
  card.href = `game.html?id=${encodeURIComponent(game.id)}`;
  card.addEventListener("click", saveLibraryState);
  card.innerHTML = `
    <img class="game-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(game.title)} 封面" loading="${loading}" decoding="async"${fetchPriority} />
    <div class="game-body">
      ${isUnclassified ? `<span class="game-badge">未归档</span>` : ""}
      <h3 class="game-title">${escapeHtml(game.title)}</h3>
    </div>
  `;
  card.querySelector(".game-cover").addEventListener("error", (event) => {
    handleImageError(event.currentTarget);
  });
  return card;
}

function normalizeText(value) {
  return String(value).toLowerCase().replace(/\s+/g, "");
}

function getInitialQuery() {
  return new URLSearchParams(window.location.search).get("q") || "";
}

function updateQueryParams(keyword) {
  const url = new URL(window.location.href);
  if (keyword) {
    url.searchParams.set("q", keyword);
  } else {
    url.searchParams.delete("q");
  }
  window.history.replaceState({}, "", url);
}

function saveLibraryState() {
  sessionStorage.setItem(
    libraryStateKey,
    JSON.stringify({
      q: gameSearch.value,
      scrollY: window.scrollY,
    }),
  );
}

function restoreLibraryState() {
  const rawState = sessionStorage.getItem(libraryStateKey);
  if (!rawState) return null;

  try {
    const state = JSON.parse(rawState);
    if (typeof state.q === "string") gameSearch.value = state.q;
    return Number(state.scrollY) || 0;
  } catch (error) {
    console.warn("Failed to restore library state:", error);
    return null;
  }
}

function sortGames(games) {
  const sorted = [...games];
  const byFolder = (a, b) => String(a.folder || a.id).localeCompare(String(b.folder || b.id), undefined, { numeric: true });
  const placeUnclassifiedLast = (a, b) => {
    const aLast = a.id === "000" || a.folder === "000";
    const bLast = b.id === "000" || b.folder === "000";
    return Number(aLast) - Number(bLast);
  };

  return sorted.sort((a, b) => placeUnclassifiedLast(a, b) || byFolder(a, b));
}

function renderGames(games) {
  const regularGames = allGames.filter((game) => !(game.isUnclassified || game.id === "000" || game.folder === "000"));
  gameCount.textContent = String(regularGames.length);
  cgCount.textContent = String(regularGames.reduce((total, game) => total + (game.cgCount || 0), 0));
  bgmCount.textContent = String(regularGames.reduce((total, game) => total + (game.bgmCount || 0), 0));
  const keyword = gameSearch.value.trim();
  clearSearch.hidden = !keyword;
  resultCount.textContent =
    games.length === allGames.length
      ? `${regularGames.length} 个作品`
      : `找到 ${games.length} / ${allGames.length} 个条目${keyword ? ` · ${keyword}` : ""}`;

  if (!games.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>没有匹配的作品</strong>
        <span>换一个关键词试试。</span>
      </div>
    `;
    return;
  }

  grid.replaceChildren(...games.map(makeCard));
}

function applyLibraryView({ syncUrl = false } = {}) {
  const keyword = normalizeText(gameSearch.value);
  const filteredGames = keyword
    ? allGames.filter((game) => {
        const haystack = normalizeText(`${game.title} ${game.summary || ""} ${game.folder || ""}`);
        return haystack.includes(keyword);
      })
    : allGames;

  if (syncUrl) {
    updateQueryParams(gameSearch.value.trim());
  }

  renderGames(sortGames(filteredGames));
}

async function loadGames() {
  try {
    const gamesResponse = await fetch("assets/json/games.json");
    if (!gamesResponse.ok) throw new Error(`games.json HTTP ${gamesResponse.status}`);
    allGames = await gamesResponse.json();

    gameSearch.value = getInitialQuery();
    const urlParams = new URLSearchParams(window.location.search);
    const shouldUseSavedState = !urlParams.has("q");
    const restoredScrollY = shouldUseSavedState ? restoreLibraryState() : null;
    applyLibraryView({ syncUrl: restoredScrollY !== null });
    if (restoredScrollY !== null) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: restoredScrollY, behavior: "auto" });
      });
    }
  } catch (error) {
    gameCount.textContent = "0";
    resultCount.textContent = "";
    grid.innerHTML = `
      <div class="empty-state">
        <strong>作品数据暂时无法读取</strong>
        <span>请通过本地服务器打开页面，例如 python -m http.server 5173 --bind 127.0.0.1。</span>
      </div>
    `;
    console.error("Failed to load games:", error);
  }
}

async function loadFallbackCover() {
  try {
    const response = await fetch("assets/game/000/cover.json");
    if (!response.ok) return;
    const data = await response.json();
    fallbackCover = data.src || data.cover || defaultFallbackCover;
  } catch (error) {
    console.warn("Failed to load fallback cover:", error);
  }
}

gameSearch.addEventListener("input", () => {
  applyLibraryView({ syncUrl: true });
});
clearSearch.addEventListener("click", () => {
  gameSearch.value = "";
  gameSearch.focus();
  applyLibraryView({ syncUrl: true });
});
loadFallbackCover().finally(loadGames);
