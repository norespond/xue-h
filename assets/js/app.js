const appRoot = document.querySelector("#app-root");
const appBack = document.querySelector("#app-back");
const brandLink = document.querySelector(".brand");
const themeToggle = document.querySelector("#theme-toggle");
const gameSearch = document.querySelector("#game-search");
const clearSearch = document.querySelector("#clear-search");

const playerBar = document.querySelector("#player-bar");
const playerCover = document.querySelector("#player-cover");
const playerTitle = document.querySelector("#player-title");
const playerToggle = document.querySelector("#player-toggle");
const playerPrev = document.querySelector("#player-prev");
const playerNext = document.querySelector("#player-next");
const playerClose = document.querySelector("#player-close");
const playerProgress = document.querySelector("#player-progress");
const playerTime = document.querySelector("#player-time");
const audio = document.querySelector("#audio-player");

const cgViewer = document.querySelector("#cg-viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerCaption = document.querySelector("#viewer-caption");
const viewerClose = document.querySelector("#viewer-close");
const viewerPrev = document.querySelector("#viewer-prev");
const viewerNext = document.querySelector("#viewer-next");

const defaultFallbackCover = "https://norespond.github.io/picx-images-hosting/cover/EV074.4n82bulpg6.jpg";
const storageKey = "xue-hua-theme";
const libraryStateKey = "xue-hua-library-state";

let fallbackCover = defaultFallbackCover;
let allGames = [];
let currentView = "home";
let currentPlaylist = [];
let currentTrackIndex = -1;
let currentTrackSrc = "";
let activeTrackButton = null;
let currentCgs = [];
let currentCgIndex = -1;
let playerErrorMessage = "";

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "day" ? "日间" : "夜间";
  localStorage.setItem(storageKey, theme);
}

function normalizePath(path) {
  if (!path) return fallbackCover;
  return path.startsWith("/") ? path.slice(1) : path;
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

function normalizeText(value) {
  return String(value).toLowerCase().replace(/\s+/g, "");
}

function isUnclassified(game) {
  return Boolean(game?.isUnclassified || game?.id === "000" || game?.folder === "000");
}

function handleImageError(image) {
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = fallbackCover;
  image.classList.add("is-fallback-image");
}

function getRouteGameId() {
  return new URLSearchParams(window.location.search).get("id");
}

function getSearchQuery() {
  return new URLSearchParams(window.location.search).get("q") || "";
}

function setUrl(params, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.search = "";
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", url);
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
  const byFolder = (a, b) => String(a.folder || a.id).localeCompare(String(b.folder || b.id), undefined, { numeric: true });
  const placeUnclassifiedLast = (a, b) => Number(isUnclassified(a)) - Number(isUnclassified(b));
  return [...games].sort((a, b) => placeUnclassifiedLast(a, b) || byFolder(a, b));
}

function renderHomeShell() {
  appRoot.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">Galgame CG / BGM Archive</p>
        <h1 id="hero-title">把喜欢的作品，整理成安静的视听档案。</h1>
        <p class="hero-text">
          以游戏为单位收纳介绍、CG 与 BGM。这里先从测试资源开始，慢慢打磨成一个适合回看和试听的收藏馆。
        </p>
        <div class="hero-stats" aria-label="当前档案状态">
          <span><strong id="game-count">0</strong> game</span>
          <span><strong id="cg-count">0</strong> cg</span>
          <span><strong id="bgm-count">0</strong> bgm</span>
        </div>
      </div>
    </section>

    <section class="section-block" id="library" aria-labelledby="library-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Library</p>
          <h2 id="library-title">作品列表</h2>
        </div>
      </div>
      <p class="result-count" id="result-count"></p>
      <div class="game-grid" id="game-grid" aria-live="polite"></div>
    </section>

    <section class="info-band" id="updates" aria-labelledby="updates-title">
      <div>
        <p class="eyebrow">Archive</p>
        <h2 id="updates-title">整理完成</h2>
      </div>
      <p>
        现有作品的简介、封面、CG 与 BGM 已整理完成。后续只需维护 JSON 数据、补充未归档资源，并在更新后重新生成与校验数据。
      </p>
    </section>
  `;
}

function makeCard(game, index = 0) {
  const cover = normalizePath(game.cover);
  const loading = index < 6 ? "eager" : "lazy";
  const fetchPriority = index < 2 ? ' fetchpriority="high"' : "";
  const card = document.createElement("a");
  card.className = `game-card${isUnclassified(game) ? " is-unclassified" : ""}`;
  card.href = `./index.html?id=${encodeURIComponent(game.id)}`;
  card.innerHTML = `
    <img class="game-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(game.title)} 封面" loading="${loading}" decoding="async"${fetchPriority} />
    <div class="game-body">
      ${isUnclassified(game) ? `<span class="game-badge">未归档</span>` : ""}
      <h3 class="game-title">${escapeHtml(game.title)}</h3>
    </div>
  `;
  card.addEventListener("click", (event) => {
    event.preventDefault();
    saveLibraryState();
    navigateToGame(game.id);
  });
  card.querySelector(".game-cover").addEventListener("error", (event) => {
    handleImageError(event.currentTarget);
  });
  return card;
}

function renderHome({ restoreScroll = false } = {}) {
  currentView = "home";
  document.body.dataset.view = "home";
  document.title = "雪蕐档案馆";
  appBack.hidden = true;
  renderHomeShell();

  const regularGames = allGames.filter((game) => !isUnclassified(game));
  appRoot.querySelector("#game-count").textContent = String(regularGames.length);
  appRoot.querySelector("#cg-count").textContent = String(regularGames.reduce((total, game) => total + (game.cgCount || 0), 0));
  appRoot.querySelector("#bgm-count").textContent = String(regularGames.reduce((total, game) => total + (game.bgmCount || 0), 0));

  const grid = appRoot.querySelector("#game-grid");
  const resultCount = appRoot.querySelector("#result-count");
  const keyword = gameSearch.value.trim();
  const normalizedKeyword = normalizeText(keyword);
  const filteredGames = normalizedKeyword
    ? allGames.filter((game) => {
        const haystack = normalizeText(`${game.title} ${game.summary || ""} ${game.folder || ""}`);
        return haystack.includes(normalizedKeyword);
      })
    : allGames;

  clearSearch.hidden = !keyword;
  resultCount.textContent =
    filteredGames.length === allGames.length
      ? `${regularGames.length} 个作品`
      : `找到 ${filteredGames.length} / ${allGames.length} 个条目${keyword ? ` · ${keyword}` : ""}`;

  if (!filteredGames.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>没有匹配的作品</strong>
        <span>换一个关键词试试。</span>
      </div>
    `;
  } else {
    grid.replaceChildren(...sortGames(filteredGames).map(makeCard));
  }

  if (restoreScroll) {
    const restoredScrollY = restoreLibraryState();
    if (restoredScrollY !== null) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: restoredScrollY, behavior: "auto" });
      });
    }
  }
}

function renderCg(cgs) {
  if (!cgs.length) {
    return `
      <div class="empty-state">
        <strong>CG 暂未整理</strong>
        <span>后续补充 cg/cg.json 后会自动显示在这里。</span>
      </div>
    `;
  }

  const layoutClass = cgs.length === 1 ? "is-single" : cgs.length <= 3 ? "is-featured" : "is-grid";
  return `
    <div class="cg-gallery ${layoutClass}">
      ${cgs
        .map(
          (cg, index) => `
            <button class="cg-card${index === 0 ? " is-primary" : ""}" type="button" data-cg-index="${index}" aria-label="预览 ${escapeHtml(cg.title)}">
              <img class="cg-image" src="${escapeHtml(normalizePath(cg.image))}" alt="${escapeHtml(cg.title)}" loading="lazy" decoding="async" />
              <span class="cg-caption">${escapeHtml(cg.title)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTracks(tracks) {
  if (!tracks.length) {
    return `
      <div class="empty-state">
        <strong>BGM 暂未整理</strong>
        <span>添加 bgm/bgm.json 或本地音频后重新生成数据即可。</span>
      </div>
    `;
  }

  return `
    <div class="track-list">
      ${tracks
        .map(
          (track, index) => `
            <button class="track-button${track.audio === currentTrackSrc ? " is-active" : ""}" type="button" data-track-index="${index}"${track.audio === currentTrackSrc ? ' aria-current="true"' : ""}>
              <span class="track-index">${String(index + 1).padStart(2, "0")}</span>
              <span class="track-title">${escapeHtml(track.title)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

async function renderDetail(id) {
  currentView = "detail";
  document.body.dataset.view = "detail";
  appBack.hidden = false;
  appRoot.innerHTML = `
    <section class="loading-block">
      <p>正在读取作品档案...</p>
    </section>
  `;

  try {
    const response = await fetch(`assets/json/games/${encodeURIComponent(id)}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const game = await response.json();
    const cover = normalizePath(game.cover);
    const hasSummary = Boolean(game.description || game.summary);
    const summary = game.description || game.summary || "简介待补充。";
    const cgs = Array.isArray(game.cg) ? game.cg : [];
    const tracks = Array.isArray(game.bgm) ? game.bgm : [];
    const gameIsUnclassified = isUnclassified(game);
    const bgmTitle = gameIsUnclassified ? "未归档 BGM" : "BGM";
    const unclassifiedNotice = gameIsUnclassified
      ? `
        <div class="unclassified-notice">
          <strong>未分类资源与私货</strong>
          <span>这里放置暂未分类的资源，以及不适合归入单个作品档案的个人收藏内容。</span>
        </div>
      `
      : "";
    const cgSection = `
        <section class="section-panel showcase-panel" id="cg-section" aria-labelledby="cg-title">
          <div class="section-title-row">
            <h2 id="cg-title">CG</h2>
            <span>${cgs.length} 张</span>
          </div>
          ${renderCg(cgs)}
        </section>
      `;

    document.title = `${game.title} - 雪蕐档案馆`;
    appRoot.innerHTML = `
      <section class="detail-hero${gameIsUnclassified ? " is-unclassified" : ""}">
        <img class="detail-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(game.title)} 封面" decoding="async" />
        <div>
          <p class="eyebrow">${gameIsUnclassified ? "Unclassified Archive" : "Game Archive"}</p>
          <h1>${escapeHtml(game.title)}</h1>
          ${unclassifiedNotice}
          <p class="summary${hasSummary ? "" : " empty-summary"}" id="summary">${escapeHtml(summary)}</p>
          <button class="summary-toggle" type="button" id="summary-toggle">展开简介</button>
        </div>
      </section>

      <div class="showcase-stack">
        ${cgSection}

        <section class="section-panel showcase-panel" id="bgm-section" aria-labelledby="bgm-title">
          <div class="section-title-row">
            <h2 id="bgm-title">${bgmTitle}</h2>
            <span>${tracks.length} 首</span>
          </div>
          ${renderTracks(tracks)}
        </section>
      </div>
    `;

    bindDetailInteractions(cgs, tracks);
  } catch (error) {
    document.title = "未找到作品 - 雪蕐档案馆";
    appRoot.innerHTML = `
      <section class="loading-block">
        <p>没有找到这个作品档案。</p>
      </section>
    `;
    console.error("Failed to load game:", error);
  }
}

function bindDetailInteractions(cgs, tracks) {
  bindSummaryToggle();
  bindCgViewer(cgs);
  bindTrackButtons(tracks);

  appRoot.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => handleImageError(image));
  });
}

function bindSummaryToggle() {
  const summary = appRoot.querySelector("#summary");
  const button = appRoot.querySelector("#summary-toggle");
  if (!summary || !button) return;

  const shouldCollapse = summary.textContent.trim().length > 260 || summary.textContent.includes("\n");
  if (!shouldCollapse) {
    button.hidden = true;
    summary.classList.remove("is-collapsed");
    return;
  }

  summary.classList.add("is-collapsed");
  button.addEventListener("click", () => {
    const isCollapsed = summary.classList.toggle("is-collapsed");
    button.textContent = isCollapsed ? "展开简介" : "收起简介";
  });
}

function bindCgViewer(cgs) {
  currentCgs = cgs;
  currentCgIndex = -1;
  appRoot.querySelectorAll(".cg-card").forEach((card) => {
    card.addEventListener("click", () => {
      showCg(Number(card.dataset.cgIndex));
    });
  });
}

function bindTrackButtons(tracks) {
  activeTrackButton = appRoot.querySelector(".track-button.is-active");
  appRoot.querySelectorAll(".track-button").forEach((button) => {
    button.addEventListener("click", () => {
      playTrack(Number(button.dataset.trackIndex), tracks);
    });
  });
}

function navigateHome({ replace = false, restoreScroll = true } = {}) {
  setUrl({ q: gameSearch.value.trim() }, { replace });
  renderHome({ restoreScroll });
}

function navigateToGame(id, { replace = false } = {}) {
  setUrl({ id }, { replace });
  renderDetail(id);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderRoute({ restoreScroll = false } = {}) {
  const id = getRouteGameId();
  if (id) {
    renderDetail(id);
    return;
  }
  gameSearch.value = getSearchQuery();
  renderHome({ restoreScroll });
}

function showCg(index) {
  const cg = currentCgs[index];
  if (!cg) return;

  currentCgIndex = index;
  cgViewer.classList.add("is-loading");
  viewerImage.src = normalizePath(cg.image);
  viewerImage.dataset.fallbackApplied = "false";
  viewerImage.classList.remove("is-fallback-image");
  viewerImage.alt = cg.title;
  viewerCaption.textContent = `${cg.title} · ${index + 1} / ${currentCgs.length}`;
  cgViewer.hidden = false;
  document.body.classList.add("viewer-open");
}

function closeCgViewer() {
  cgViewer.hidden = true;
  cgViewer.classList.remove("is-loading");
  viewerImage.removeAttribute("src");
  document.body.classList.remove("viewer-open");
}

function showNextCg() {
  if (!currentCgs.length) return;
  showCg(currentCgIndex >= currentCgs.length - 1 ? 0 : currentCgIndex + 1);
}

function showPrevCg() {
  if (!currentCgs.length) return;
  showCg(currentCgIndex <= 0 ? currentCgs.length - 1 : currentCgIndex - 1);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updatePlayerTime() {
  playerTime.textContent = playerErrorMessage || `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}

function setPlayerError(message) {
  playerErrorMessage = message;
  playerTime.textContent = message;
  playerBar.classList.toggle("has-error", Boolean(message));
  if (activeTrackButton) {
    activeTrackButton.classList.toggle("has-error", Boolean(message));
  }
}

function clearPlayerError() {
  playerErrorMessage = "";
  playerBar.classList.remove("has-error");
  appRoot.querySelectorAll(".track-button.has-error").forEach((button) => {
    button.classList.remove("has-error");
  });
}

function setActiveTrackButton(index) {
  if (activeTrackButton) {
    activeTrackButton.classList.remove("is-active");
    activeTrackButton.removeAttribute("aria-current");
  }

  activeTrackButton = appRoot.querySelector(`[data-track-index="${index}"]`);
  if (activeTrackButton) {
    activeTrackButton.classList.add("is-active");
    activeTrackButton.setAttribute("aria-current", "true");
    activeTrackButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function handlePlaybackError(error) {
  if (error?.name === "AbortError") return;
  playerToggle.textContent = "播放";
  playerToggle.setAttribute("aria-pressed", "false");
  setPlayerError("播放失败，请检查音频链接或切换下一首");
  console.error("Failed to play track:", error);
}

function playTrack(index, playlist = currentPlaylist) {
  const track = playlist[index];
  if (!track) return;

  currentPlaylist = playlist;
  currentTrackIndex = index;
  currentTrackSrc = track.audio;
  clearPlayerError();
  setActiveTrackButton(index);
  audio.src = normalizePath(track.audio);
  playerCover.src = normalizePath(track.cover);
  playerCover.dataset.fallbackApplied = "false";
  playerCover.classList.remove("is-fallback-image");
  playerCover.alt = `${track.title} 封面`;
  playerTitle.textContent = track.title;
  playerToggle.textContent = "暂停";
  playerToggle.setAttribute("aria-pressed", "true");
  playerProgress.value = "0";
  updatePlayerTime();
  playerBar.hidden = false;
  audio.play().catch(handlePlaybackError);
}

function playNextTrack() {
  if (!currentPlaylist.length) return;
  playTrack(currentTrackIndex >= currentPlaylist.length - 1 ? 0 : currentTrackIndex + 1);
}

function playPrevTrack() {
  if (!currentPlaylist.length) return;
  playTrack(currentTrackIndex <= 0 ? currentPlaylist.length - 1 : currentTrackIndex - 1);
}

function closePlayer() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  playerBar.hidden = true;
  playerToggle.textContent = "播放";
  playerToggle.setAttribute("aria-pressed", "false");
  playerProgress.value = "0";
  playerTime.textContent = "00:00 / 00:00";
  currentPlaylist = [];
  currentTrackIndex = -1;
  currentTrackSrc = "";
  if (activeTrackButton) {
    activeTrackButton.classList.remove("is-active", "has-error");
    activeTrackButton.removeAttribute("aria-current");
    activeTrackButton = null;
  }
  clearPlayerError();
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

async function loadGames() {
  const response = await fetch("assets/json/games.json");
  if (!response.ok) throw new Error(`games.json HTTP ${response.status}`);
  allGames = await response.json();
}

function bindGlobalEvents() {
  setTheme(localStorage.getItem(storageKey) || "night");

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme || "night";
    setTheme(currentTheme === "night" ? "day" : "night");
  });
  brandLink.addEventListener("click", (event) => {
    event.preventDefault();
    gameSearch.value = "";
    navigateHome({ restoreScroll: false });
  });
  appBack.addEventListener("click", () => {
    navigateHome();
  });
  gameSearch.addEventListener("input", () => {
    clearSearch.hidden = !gameSearch.value.trim();
    if (currentView !== "home") {
      navigateHome({ restoreScroll: false });
      return;
    }
    setUrl({ q: gameSearch.value.trim() }, { replace: true });
    renderHome();
  });
  clearSearch.addEventListener("click", () => {
    gameSearch.value = "";
    gameSearch.focus();
    if (currentView !== "home") {
      navigateHome({ restoreScroll: false });
      return;
    }
    setUrl({}, { replace: true });
    renderHome();
  });
  window.addEventListener("popstate", () => {
    renderRoute({ restoreScroll: true });
  });

  playerToggle.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          playerToggle.textContent = "暂停";
          playerToggle.setAttribute("aria-pressed", "true");
        })
        .catch(handlePlaybackError);
    } else {
      audio.pause();
      playerToggle.textContent = "播放";
      playerToggle.setAttribute("aria-pressed", "false");
    }
  });
  playerPrev.addEventListener("click", playPrevTrack);
  playerNext.addEventListener("click", playNextTrack);
  playerClose.addEventListener("click", closePlayer);
  playerCover.addEventListener("error", () => handleImageError(playerCover));
  playerProgress.addEventListener("input", () => {
    if (!audio.duration) return;
    audio.currentTime = (Number(playerProgress.value) / 100) * audio.duration;
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || playerErrorMessage) return;
    playerProgress.value = String((audio.currentTime / audio.duration) * 100);
    updatePlayerTime();
  });
  audio.addEventListener("loadedmetadata", () => {
    clearPlayerError();
    updatePlayerTime();
  });
  audio.addEventListener("error", () => {
    playerToggle.textContent = "播放";
    playerToggle.setAttribute("aria-pressed", "false");
    setPlayerError("播放失败，请检查音频链接或切换下一首");
  });
  audio.addEventListener("ended", playNextTrack);

  viewerClose.addEventListener("click", closeCgViewer);
  viewerPrev.addEventListener("click", showPrevCg);
  viewerNext.addEventListener("click", showNextCg);
  viewerImage.addEventListener("error", () => handleImageError(viewerImage));
  viewerImage.addEventListener("load", () => {
    cgViewer.classList.remove("is-loading");
  });
  cgViewer.addEventListener("click", (event) => {
    if (event.target === cgViewer) closeCgViewer();
  });
  document.addEventListener("keydown", (event) => {
    if (cgViewer.hidden) return;
    if (event.key === "Escape") closeCgViewer();
    if (event.key === "ArrowLeft") showPrevCg();
    if (event.key === "ArrowRight") showNextCg();
  });
}

async function init() {
  bindGlobalEvents();
  try {
    await loadFallbackCover();
    await loadGames();
    const shouldRestore = !getRouteGameId() && !new URLSearchParams(window.location.search).has("q");
    if (shouldRestore) restoreLibraryState();
    renderRoute({ restoreScroll: shouldRestore });
  } catch (error) {
    appRoot.innerHTML = `
      <div class="empty-state">
        <strong>作品数据暂时无法读取</strong>
        <span>请通过本地服务器打开页面，例如 python -m http.server 5173 --bind 127.0.0.1。</span>
      </div>
    `;
    console.error("Failed to initialize app:", error);
  }
}

init();
