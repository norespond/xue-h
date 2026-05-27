const root = document.querySelector("#game-root");
const themeToggle = document.querySelector("#theme-toggle");
const backButton = document.querySelector("#back-button");
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

const storageKey = "xue-hua-theme";
const defaultFallbackCover = "https://norespond.github.io/picx-images-hosting/cover/EV074.4n82bulpg6.jpg";
let fallbackCover = defaultFallbackCover;
let activeTrackButton = null;
let currentTrackIndex = -1;
let currentTracks = [];
let currentCgs = [];
let currentCgIndex = -1;
let playerErrorMessage = "";

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "day" ? "日间" : "夜间";
  localStorage.setItem(storageKey, theme);
}

setTheme(localStorage.getItem(storageKey) || "night");

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "night";
  setTheme(currentTheme === "night" ? "day" : "night");
});

backButton.addEventListener("click", () => {
  const referrer = document.referrer ? new URL(document.referrer) : null;
  if (window.history.length > 1 && referrer?.origin === window.location.origin) {
    window.history.back();
    return;
  }
  window.location.href = "./index.html#library";
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

function getGameId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "001";
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

function bindCgViewer(cgs) {
  currentCgs = cgs;
  currentCgIndex = -1;

  root.querySelectorAll(".cg-card").forEach((card) => {
    card.addEventListener("click", () => {
      showCg(Number(card.dataset.cgIndex));
    });
  });
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
            <button class="track-button" type="button" data-track-index="${index}">
              <span class="track-index">${String(index + 1).padStart(2, "0")}</span>
              <span class="track-title">${escapeHtml(track.title)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
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
  root.querySelectorAll(".track-button.has-error").forEach((button) => {
    button.classList.remove("has-error");
  });
}

function handlePlaybackError(error) {
  if (error?.name === "AbortError") return;
  playerToggle.textContent = "播放";
  playerToggle.setAttribute("aria-pressed", "false");
  setPlayerError("播放失败，请检查音频链接或切换下一首");
  console.error("Failed to play track:", error);
}

function setActiveTrackButton(index) {
  if (activeTrackButton) {
    activeTrackButton.classList.remove("is-active");
    activeTrackButton.removeAttribute("aria-current");
  }

  activeTrackButton = root.querySelector(`[data-track-index="${index}"]`);
  if (activeTrackButton) {
    activeTrackButton.classList.add("is-active");
    activeTrackButton.setAttribute("aria-current", "true");
    activeTrackButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function playTrack(index) {
  const track = currentTracks[index];
  if (!track) return;

  currentTrackIndex = index;
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
  if (!currentTracks.length) return;
  const nextIndex = currentTrackIndex >= currentTracks.length - 1 ? 0 : currentTrackIndex + 1;
  playTrack(nextIndex);
}

function playPrevTrack() {
  if (!currentTracks.length) return;
  const prevIndex = currentTrackIndex <= 0 ? currentTracks.length - 1 : currentTrackIndex - 1;
  playTrack(prevIndex);
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
  currentTrackIndex = -1;
  if (activeTrackButton) {
    activeTrackButton.classList.remove("is-active", "has-error");
    activeTrackButton.removeAttribute("aria-current");
    activeTrackButton = null;
  }
  clearPlayerError();
}

function bindPlayer(tracks) {
  currentTracks = tracks;
  currentTrackIndex = -1;
  activeTrackButton = null;

  root.querySelectorAll(".track-button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.trackIndex);
      playTrack(index);
    });
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

  audio.addEventListener("ended", () => {
    playNextTrack();
  });

  playerProgress.addEventListener("input", () => {
    if (!audio.duration) return;
    audio.currentTime = (Number(playerProgress.value) / 100) * audio.duration;
  });
}

function bindSummaryToggle() {
  const summary = root.querySelector("#summary");
  const button = root.querySelector("#summary-toggle");
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

function renderResourceSummary(hasSummary, cgs, tracks, isUnclassified) {
  const items = [
    { label: "简介", done: hasSummary, value: hasSummary ? "已整理" : "待补充" },
    { label: "BGM", done: tracks.length > 0, value: `${tracks.length} 首` },
  ];
  if (!isUnclassified) {
    items.splice(1, 0, { label: "CG", done: cgs.length > 0, value: `${cgs.length} 张` });
  } else {
    items.splice(1, 0, { label: "CG", done: true, value: "忽略" });
  }

  return `
    <div class="resource-summary" aria-label="资源状态">
      ${items
        .map(
          (item) => `
            <span class="resource-pill ${item.done ? "is-done" : "is-missing"}">
              <strong>${item.label}</strong>
              <span>${item.value}</span>
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderGame(game) {
  document.title = `${game.title} - 雪花档案馆`;
  const cover = normalizePath(game.cover);
  const hasSummary = Boolean(game.description || game.summary);
  const summary = game.description || game.summary || "简介待补充。";
  const cgs = Array.isArray(game.cg) ? game.cg : [];
  const tracks = Array.isArray(game.bgm) ? game.bgm : [];
  const isUnclassified = Boolean(game.isUnclassified || game.id === "000" || game.folder === "000");
  const eyebrow = isUnclassified ? "Unclassified Archive" : "Game Archive";
  const bgmTitle = isUnclassified ? "未归档 BGM" : "BGM";
  const actionLinks = [
    { href: "./index.html#library", label: "返回列表", show: true },
    { href: "#cg-section", label: "查看 CG", show: !isUnclassified && cgs.length > 0 },
    { href: "#bgm-section", label: "试听 BGM", show: tracks.length > 0 },
  ].filter((item) => item.show);
  const unclassifiedNotice = isUnclassified
    ? `
      <div class="unclassified-notice">
        <strong>未归档资源池</strong>
        <span>这里临时收纳尚未确定作品归属的资源。确认出处后，将资源移动到对应游戏目录并重新生成数据。</span>
      </div>
    `
    : "";
  const cgSection = isUnclassified
    ? ""
    : `
      <section class="section-panel showcase-panel" id="cg-section" aria-labelledby="cg-title">
        <div class="section-title-row">
          <h2 id="cg-title">CG</h2>
          <span>${cgs.length} 张</span>
        </div>
        ${renderCg(cgs)}
      </section>
    `;

  root.innerHTML = `
    <section class="detail-hero${isUnclassified ? " is-unclassified" : ""}">
      <img class="detail-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(game.title)} 封面" decoding="async" />
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${escapeHtml(game.title)}</h1>
        ${renderResourceSummary(hasSummary, cgs, tracks, isUnclassified)}
        <div class="detail-actions">
          ${actionLinks
            .map((item) => `<a class="detail-action" href="${item.href}">${item.label}</a>`)
            .join("")}
        </div>
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

  bindSummaryToggle();
  bindCgViewer(cgs);
  bindPlayer(tracks);
  root.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => handleImageError(image));
  });
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

async function loadGame() {
  const id = getGameId();

  try {
    const response = await fetch(`assets/json/games/${encodeURIComponent(id)}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const game = await response.json();
    renderGame(game);
  } catch (error) {
    root.innerHTML = `
      <section class="loading-block">
        <p>没有找到这个作品档案。</p>
      </section>
    `;
    console.error("Failed to load game:", error);
  }
}

loadFallbackCover().finally(loadGame);

viewerClose.addEventListener("click", closeCgViewer);
viewerPrev.addEventListener("click", showPrevCg);
viewerNext.addEventListener("click", showNextCg);
viewerImage.addEventListener("error", () => handleImageError(viewerImage));
viewerImage.addEventListener("load", () => {
  cgViewer.classList.remove("is-loading");
});
playerCover.addEventListener("error", () => handleImageError(playerCover));

cgViewer.addEventListener("click", (event) => {
  if (event.target === cgViewer) {
    closeCgViewer();
  }
});

document.addEventListener("keydown", (event) => {
  if (cgViewer.hidden) return;

  if (event.key === "Escape") {
    closeCgViewer();
  }
  if (event.key === "ArrowLeft") {
    showPrevCg();
  }
  if (event.key === "ArrowRight") {
    showNextCg();
  }
});
