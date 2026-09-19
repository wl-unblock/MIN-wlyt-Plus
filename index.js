const express = require("express");
const http = require("http");
const path = require("path");
const yts = require("youtube-search-api");
const fetch = require("node-fetch");
const cookieParser = require("cookie-parser");
const https = require("https");
const fs = require('fs');

let wispServer = null;
try {
  wispServer = require('@mercuryworkshop/wisp-js/server');
} catch (e) {
  console.warn('[@mercuryworkshop/wisp-js] not loaded:', e.message);
}

const app = express();
const server = http.createServer();
const port = process.env.PORT || 3000;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const API_HEALTH_CHECKER = "https://raw.githubusercontent.com/Minotaur-ZAOU/test/refs/heads/main/min-tube-api.json";
const TEMP_API_LIST = "https://raw.githubusercontent.com/Minotaur-ZAOU/test/refs/heads/main/min-tube-api.json";
const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';
const videoCache = new Map();
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0"
];

const keys = [
  process.env.RAPIDAPI_KEY_1 || '69e2995a79mshcb657184ba6731cp16f684jsn32054a070ba5',
  process.env.RAPIDAPI_KEY_2 || 'ece95806fdmshe322f47bce30060p1c3411jsn41a3d4820039',
  process.env.RAPIDAPI_KEY_3 || '41c9265bc6msha0fa7dfc1a63eabp18bf7cjsne6ef10b79b38'
];

const PROXY_DIR = path.join(__dirname, 'proxy');


app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

let apiListCache = [];

async function updateApiListCache() {
  try {
    const response = await fetch(API_HEALTH_CHECKER);
    if (response.ok) {
      const mainApiList = await response.json();
      if (Array.isArray(mainApiList) && mainApiList.length > 0) {
        apiListCache = mainApiList;
        console.log("API List updated.");
      }
    }
  } catch (err) {
    console.error("API update failed.");
  }
}

updateApiListCache();
setInterval(updateApiListCache, 1000 * 60 * 10);

function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

setInterval(() => {
    const now = Date.now();
    for (const [videoId, cachedItem] of videoCache.entries()) {
        if (cachedItem.expiry < now) {
            videoCache.delete(videoId);
        }
    }
}, 300000);

// ミドルウェア: 人間確認,
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/video") || req.path === "/") {
    if (!req.cookies || req.cookies.humanVerified !== "true") {
      const pages = [
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/memo/min-tube-pro-main-loading.txt',
        'https://github.com/woolisbest-honke/min-wlyt-plus/blob/main/assist/memo/min-tube-pro-sub-roading-like-command-loader-local.txt',
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/memo/google.txt',
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/memo/history.html.txt',
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/memo/gisou/chapcha.html',
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/memo/gisou/easy.html',
        'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/gizo/Login.html',
        'https://github.com/woolisbest-honke/min-wlyt-plus/raw/refs/heads/main/gizo/TU.html',
        'https://github.com/woolisbest-honke/min-wlyt-plus/raw/refs/heads/main/gizo/classroom.html',
        'https://github.com/woolisbest-honke/min-wlyt-plus/raw/refs/heads/main/gizo/kensaku.html',
        'https://github.com/woolisbest-honke/min-wlyt-plus/raw/refs/heads/main/gizo/wikipedia.html'
      ];
      const randomPage = pages[Math.floor(Math.random() * pages.length)];
      try {
        const response = await fetch(randomPage);
        const htmlContent = await response.text();
        return res.render("robots", { content: htmlContent });
      } catch (err) {
        return res.render("robots", { content: "<p>Verification Required</p>" });
      }
    }
  }
  next();
});

// --- API ENDPOINTS ---

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/api/trending", async (req, res) => {
  const page = parseInt(req.query.page) || 0;
  try {
    const trendingSeeds = [
      "人気急上昇", "最新 ニュース", "Music Video Official", 
      "ゲーム実況 人気", "話題の動画", "トレンド", 
      "Breaking News Japan", "Top Hits", "いま話題"
    ];

    const seed1 = trendingSeeds[(page * 2) % trendingSeeds.length];
    const seed2 = trendingSeeds[(page * 2 + 1) % trendingSeeds.length];

    const [res1, res2] = await Promise.all([
      yts.GetListByKeyword(seed1, false, 25),
      yts.GetListByKeyword(seed2, false, 25)
    ]);

    let combined = [...(res1.items || []), ...(res2.items || [])];
    const finalItems = [];
    const seenIdsServer = new Set();

    for (const item of combined) {
      if (item.type === 'video' && !seenIdsServer.has(item.id)) {
        if (item.viewCountText) {
          seenIdsServer.add(item.id);
          finalItems.push(item);
        }
      }
    }

    const result = finalItems.sort(() => 0.5 - Math.random());
    res.json({ items: result });
    
  } catch (err) {
    console.error("Trending API Error:", err);
    res.json({ items: [] });
  }
});


app.get("/api/search", async (req, res, next) => {
  const query = req.query.q;
  const page = req.query.page || 0;
  if (!query) return res.status(400).json({ error: "Query required" });
  try {
    const results = await yts.GetListByKeyword(query, false, 20, page);
    res.json(results);
  } catch (err) { next(err); }
});


app.get("/api/recommendations", async (req, res) => {
  const { title, channel, id } = req.query;
  try {
    const cleanKwd = title
      .replace(/[【】「」()!！?？\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleanKwd.split(' ').filter(w => w.length >= 2);
    const mainTopic = words.length > 0 ? words.slice(0, 2).join(' ') : cleanKwd;

    const [topicRes, channelRes, relatedRes] = await Promise.all([
      yts.GetListByKeyword(`${mainTopic}`, false, 12),
      yts.GetListByKeyword(`${channel}`, false, 8),
      yts.GetListByKeyword(`${mainTopic} 関連`, false, 8)
    ]);

    let rawList = [
      ...(topicRes.items || []),
      ...(channelRes.items || []),
      ...(relatedRes.items || [])
    ];

    const seenIds = new Set([id]); 
    const seenNormalizedTitles = new Set();
    const finalItems = [];

    for (const item of rawList) {
      if (!item.id || item.type !== 'video') continue;
      if (seenIds.has(item.id)) continue;

      // タイトルの正規化による「重複内容」の排除
      const normalized = item.title.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/official|lyrics|mv|musicvideo|video|公式|実況|解説/g, '');

      const titleSig = normalized.substring(0, 12);
      if (seenNormalizedTitles.has(titleSig)) continue;

      seenIds.add(item.id);
      seenNormalizedTitles.add(titleSig);
      finalItems.push(item);

      if (finalItems.length >= 24) break; 
    }

    const result = finalItems.sort(() => 0.5 - Math.random());
    res.json({ items: result });
  } catch (err) {
    console.error("Rec Engine Error:", err);
    res.json({ items: [] });
  }
});

app.get("/video/:id", async (req, res, next) => {
const videoId = req.params.id;
try {
let videoData = null;
let commentsData = { commentCount: 0, comments: [] };
let successfulApi = null;

const protocol = req.headers['x-forwarded-proto'] || 'http';
const host = req.headers.host;

for (const apiBase of apiListCache) {
  try {
    videoData = await Promise.any([
      fetchWithTimeout(`${apiBase}/api/video/${videoId}`, {}, 5000)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => data.stream_url ? data : Promise.reject()),
      fetchWithTimeout(`${protocol}://${host}/sia-dl/${videoId}`, {}, 5000)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => data.stream_url ? data : Promise.reject()),

      new Promise((resolve, reject) => {
        setTimeout(() => {
          fetchWithTimeout(`${protocol}://${host}/ai-fetch/${videoId}`, {}, 5000)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => data.stream_url ? resolve(data) : reject())
            .catch(reject);
        }, 2000);
      })
    ]);


    try {
      const cRes = await fetchWithTimeout(`${apiBase}/api/comments/${videoId}`, {}, 3000);
      if (cRes.ok) commentsData = await cRes.json();
    } catch (e) {}

    successfulApi = apiBase;
    break;

  } catch (e) {
    try {
      const rapidRes = await fetchWithTimeout(`${protocol}://${host}/rapid/${videoId}`, {}, 5000);
      if (rapidRes.ok) {
        const rapidData = await rapidRes.json();
        if (rapidData.stream_url) {
          videoData = rapidData;
          
          try {
            const cRes = await fetchWithTimeout(`${apiBase}/api/comments/${videoId}`, {}, 3000);
            if (cRes.ok) commentsData = await cRes.json();
          } catch (e) {}

          successfulApi = apiBase; 
          break; 
        }
      }
    } catch (rapidErr) {}
    continue;
  }
}

if (!videoData) {
  videoData = { videoTitle: "再生できない動画", stream_url: "youtube-nocookie" };
}

console.log(commentsData)
let isShortForm = videoData.videoTitle.includes('#');

if (isShortForm) {
    try {
        const shortCheckRes = await fetchWithTimeout(
            `${protocol}://${host}/short-check/${videoId}`,
            {},
            5000
        );

        if (shortCheckRes.ok) {
            const shortCheckData = await shortCheckRes.json();

            isShortForm = shortCheckData.isShort === true;
        } else {
            isShortForm = false;
        }

    } catch (e) {
        console.warn('ショート判定失敗:', e);
        isShortForm = false;
    }
}

    if (isShortForm) {
const shortsHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${videoData.videoTitle}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; color: #fff; font-family: "Roboto", sans-serif; overflow: hidden; }
        .shorts-wrapper { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #000; }
        .video-container { position: relative; height: 94vh; aspect-ratio: 9/16; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10; }
        @media (max-width: 600px) { .video-container { height: 100%; width: 100%; border-radius: 0; } }
        /* 動画を常に最前面へ */
        video, iframe { width: 100%; height: 100%; object-fit: cover; border: none; position: relative; z-index: 11; visibility: hidden; }
        .progress-container { position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background: rgba(255,255,255,0.2); z-index: 25; }
        .progress-bar { height: 100%; background: #ff0000; width: 0%; transition: width 0.1s linear; }
        .bottom-overlay { position: absolute; bottom: 0; left: 0; width: 100%; padding: 100px 16px 24px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); z-index: 20; pointer-events: none; }
        .bottom-overlay * { pointer-events: auto; }
        .channel-info { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .channel-info img { width: 32px; height: 32px; border-radius: 50%; }
        .channel-name { font-weight: 500; font-size: 15px; }
        .subscribe-btn { background: #fff; color: #000; border: none; padding: 6px 12px; border-radius: 18px; font-size: 12px; font-weight: bold; cursor: pointer; margin-left: 8px; }
        .video-title { font-size: 14px; line-height: 1.4; margin-bottom: 8px; font-weight: 400; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .side-bar { position: absolute; right: 8px; bottom: 80px; display: flex; flex-direction: column; gap: 16px; align-items: center; z-index: 30; }
        .action-btn { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
        .btn-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: 0.2s; margin-bottom: 4px; }
        .btn-icon:active { transform: scale(0.9); background: rgba(255,255,255,0.25); }
        .action-btn span { font-size: 11px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); font-weight: 400; }
        .swipe-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); padding: 12px 20px; border-radius: 30px; display: flex; align-items: center; gap: 10px; z-index: 50; opacity: 0; pointer-events: none; transition: opacity 0.5s; border: 1px solid rgba(255,255,255,0.2); }
        .swipe-hint.show { opacity: 1; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, -60%); } }
        .comments-panel { position: absolute; bottom: 0; left: 0; width: 100%; height: 70%; background: #181818; border-radius: 16px 16px 0 0; z-index: 40; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
        .comments-panel.open { transform: translateY(0); }
        .comments-header { padding: 16px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
        .comments-body { flex: 1; overflow-y: auto; padding: 16px; }
        .comment-item { display: flex; gap: 12px; margin-bottom: 18px; }
        .comment-avatar { width: 32px; height: 32px; border-radius: 50%; }
        .top-nav { position: absolute; top: 16px; left: 16px; z-index: 35; display: flex; align-items: center; color: white; text-decoration: none; }
        .top-nav i { font-size: 20px; filter: drop-shadow(0 0 4px rgba(0,0,0,0.5)); }
        .loading-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 100; display: flex; align-items: center; justify-content: center; opacity: 1; transition: 0.3s; }
        .loading-screen.fade { opacity: 0; pointer-events: none; }
    </style>
</head>
<body>
    <div id="loader" class="loading-screen"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>
    <div class="shorts-wrapper">
        <div class="video-container">
            <a href="/" class="top-nav"><i class="fas fa-arrow-left"></i></a>
            <div id="swipeHint" class="swipe-hint"><i class="fas fa-hand-pointer"></i><span>下にスワイプして次の動画へ移動</span></div>
            
            ${videoData.stream_url !== "youtube-nocookie" 
                ? `<video id="videoPlayer" data-src="${videoData.stream_url}" loop playsinline></video>` 
                : `<iframe id="videoIframe" data-src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0" allow="autoplay"></iframe>`}
            
            <div class="progress-container"><div id="progressBar" class="progress-bar"></div></div>
            <div class="side-bar">
                <div class="action-btn"><div class="btn-icon"><i class="fas fa-thumbs-up"></i></div><span>${videoData.likeCount || '評価'}</span></div>
                <div class="action-btn"><div class="btn-icon"><i class="fas fa-thumbs-down"></i></div><span>低評価</span></div>
                <div class="action-btn" onclick="toggleComments()"><div class="btn-icon"><i class="fas fa-comment-dots"></i></div><span>${commentsData.commentCount || 0}</span></div>
                <div class="action-btn"><div class="btn-icon"><i class="fas fa-share"></i></div><span>共有</span></div>
                <div class="action-btn"><div class="btn-icon" style="background:none;"><img src="${videoData.channelImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=random&color=fff&size=64&bold=true`}" style="width:30px; height:30px; border-radius:4px; border:2px solid #fff;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=555&color=fff&size=64&bold=true'"></div></div>
            </div>
            <div class="bottom-overlay">
                <div class="channel-info"><img src="${videoData.channelImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=random&color=fff&size=64&bold=true`}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=555&color=fff&size=64&bold=true'"><a href="/channel/${encodeURIComponent(videoData.channelName)}" style="text-decoration:none;color:inherit;"><span class="channel-name">@${videoData.channelName}</span></a><button id="shortSubBtn" class="subscribe-btn" onclick="toggleShortSub()">登録</button></div>
                <div class="video-title">${videoData.videoTitle}</div>
            </div>
            <div id="commentsPanel" class="comments-panel">
                <div class="comments-header"><h3 style="margin:0; font-size:16px;">コメント</h3><i class="fas fa-times" style="cursor:pointer;" onclick="toggleComments()"></i></div>
                <div class="comments-body">
                    ${commentsData.comments.length > 0 ? commentsData.comments.map(c => `<div class="comment-item"><img class="comment-avatar" src="${c.authorThumbnails?.[0]?.url || 'https://via.placeholder.com/32'}"><div><div style="font-size:12px; color:#aaa; font-weight:bold;">${c.author}</div><div style="font-size:14px; margin-top:2px;">${c.content}</div></div></div>`).join('') : '<p style="text-align:center; color:#888;">コメントはありません</p>'}
                </div>
            </div>
        </div>
    </div>
    <script>
        let startY = 0;
        const loader = document.getElementById('loader');
        const commentsPanel = document.getElementById('commentsPanel');
        const swipeHint = document.getElementById('swipeHint');
        const progressBar = document.getElementById('progressBar');

        window.onload = async () => {
            // 設定から保存された再生方法を取得
            const savedMode = localStorage.getItem('playbackMode') || 'googlevideo';

            async function initShortsPlayer() {
                const videoEl = document.getElementById('videoPlayer');
                const iframeEl = document.getElementById('videoIframe');

                if (savedMode === 'youtube-nocookie') {
                    // youtube-nocookie: video要素があればiframeに差し替え
                    const targetIframe = iframeEl || document.createElement('iframe');
                    if (!iframeEl) {
                        targetIframe.id = 'videoIframe';
                        targetIframe.setAttribute('allow', 'autoplay');
                        targetIframe.setAttribute('allowfullscreen', '');
                        targetIframe.style.cssText = 'width:100%; height:100%; object-fit:cover; border:none; position:relative; z-index:11;';
                        if (videoEl) videoEl.replaceWith(targetIframe);
                        else document.querySelector('.video-container').insertBefore(targetIframe, document.querySelector('.progress-container'));
                    }
                    targetIframe.src = \`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0\`;
                    targetIframe.style.visibility = 'visible';

                } else if (savedMode !== 'googlevideo' && videoEl) {
                    // DL-Pro などその他のモード: エンドポイントからURLを取得して再生
                    const endpointMap = { 'DL-Pro': '/360/${videoId}' };
                    const endpoint = endpointMap[savedMode];
                    if (endpoint) {
                        try {
                            const res = await fetch(endpoint);
                            if (res.ok) {
                                const url = await res.text();
                                videoEl.src = url;
                                videoEl.style.visibility = 'visible';
                                videoEl.play().catch(() => {});
                                videoEl.ontimeupdate = () => { const p = (videoEl.currentTime / videoEl.duration) * 100; progressBar.style.width = p + '%'; };
                                return;
                            }
                        } catch (e) {
                            console.warn('ショート: エンドポイント取得失敗、googlevideoにフォールバック', e);
                        }
                    }
                    // フォールバック: googlevideo
                    if (videoEl.dataset.src) {
                        videoEl.src = videoEl.dataset.src;
                        videoEl.style.visibility = 'visible';
                        videoEl.play().catch(() => {});
                        videoEl.ontimeupdate = () => { const p = (videoEl.currentTime / videoEl.duration) * 100; progressBar.style.width = p + '%'; };
                    }

                } else {
                    // デフォルト: googlevideo (またはサーバーがnocookieを返した場合はiframe)
                    if (videoEl && videoEl.dataset.src) {
                        videoEl.src = videoEl.dataset.src;
                        videoEl.style.visibility = 'visible';
                        videoEl.play().catch(() => {});
                        videoEl.ontimeupdate = () => { const p = (videoEl.currentTime / videoEl.duration) * 100; progressBar.style.width = p + '%'; };
                    }
                    if (iframeEl && iframeEl.dataset.src) {
                        iframeEl.src = iframeEl.dataset.src;
                        iframeEl.style.visibility = 'visible';
                    }
                }
            }

            await initShortsPlayer();
            loader.classList.add('fade');
            swipeHint.classList.add('show');
            setTimeout(() => { swipeHint.classList.remove('show'); }, 300);
        };

        function toggleComments() { commentsPanel.classList.toggle('open'); }
        // チャンネル登録機能（ショート）
        const SHORT_CHANNEL = "${videoData.channelName || ''}";
        const SHORT_SUB_KEY = 'subscribed_' + SHORT_CHANNEL;
        const shortSubBtn = document.getElementById('shortSubBtn');
        function updateShortSubBtn() {
          const isSub = localStorage.getItem(SHORT_SUB_KEY) === 'true';
          shortSubBtn.textContent = isSub ? '登録済み' : '登録';
          shortSubBtn.style.background = isSub ? 'rgba(255,255,255,0.3)' : '#fff';
          shortSubBtn.style.color = isSub ? '#fff' : '#000';
        }
        function toggleShortSub() {
          const isSub = localStorage.getItem(SHORT_SUB_KEY) === 'true';
          if (isSub) localStorage.removeItem(SHORT_SUB_KEY);
          else localStorage.setItem(SHORT_SUB_KEY, 'true');
          updateShortSubBtn();
        }
        updateShortSubBtn();
        async function loadNextShort() {
            if (commentsPanel.classList.contains('open')) return;
            loader.classList.remove('fade');
            try {
                const params = new URLSearchParams({ title: "${videoData.videoTitle}", channel: "${videoData.channelName}", id: "${videoId}" });
                const res = await fetch(\`/api/recommendations?\${params.toString()}\`);
                const data = await res.json();
                const nextShort = data.items.find(item => item.title.includes('#')) || data.items[0];
                if (nextShort) { window.location.href = '/video/' + nextShort.id; } else { window.location.href = '/'; }
            } catch (e) { window.location.href = '/'; }
        }
        window.addEventListener('touchstart', e => startY = e.touches[0].pageY);
        window.addEventListener('touchend', e => { const endY = e.changedTouches[0].pageY; if (startY - endY > 100) loadNextShort(); });
        window.addEventListener('wheel', e => { if (e.deltaY > 50) loadNextShort(); }, { passive: true });
        document.addEventListener('click', (e) => { if (commentsPanel.classList.contains('open') && !commentsPanel.contains(e.target) && !e.target.closest('.action-btn')) { toggleComments(); } });
    </script>
</body>
</html>`;
      return res.send(shortsHtml);
    }

    // --- STANDARD VIDEO MODE HTML ---
    // playerWrapper は空にして、クライアント側JSが localStorage.playbackMode に基づいて初期化する
const streamEmbedPlaceholder = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;"><div class="spinner"></div></div>`;

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${videoData.videoTitle} - YouTube Pro</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root { --bg-main: #0f0f0f; --bg-secondary: #272727; --bg-hover: #3f3f3f; --text-main: #f1f1f1; --text-sub: #aaaaaa; --yt-red: #ff0000; }
        body { margin: 0; padding: 0; background: var(--bg-main); color: var(--text-main); font-family: "Roboto", "Arial", sans-serif; overflow-x: hidden; }
        .navbar { position: fixed; top: 0; width: 100%; height: 56px; background: var(--bg-main); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box; z-index: 1000; border-bottom: 1px solid #222; }
        .nav-left { display: flex; align-items: center; gap: 16px; }
        .logo { display: flex; align-items: center; color: white; text-decoration: none; font-weight: bold; font-size: 18px; }
        .logo i { color: var(--yt-red); font-size: 24px; margin-right: 4px; }
        .nav-center { flex: 0 1 600px; display: flex; position: relative; }
        .search-bar { display: flex; width: 100%; background: #121212; border: 1px solid #303030; border-radius: 40px 0 0 40px; padding: 0 16px; }
        .search-bar input { width: 100%; background: transparent; border: none; color: white; height: 38px; font-size: 16px; outline: none; }
        .search-btn { background: #222; border: 1px solid #303030; border-left: none; border-radius: 0 40px 40px 0; width: 64px; height: 40px; color: white; cursor: pointer; }
        .autocomplete-dropdown { position: absolute; top: calc(100% + 4px); left: 0; width: calc(100% - 64px); background: #212121; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 2000; overflow: hidden; display: none; padding: 12px 0; border: 1px solid #303030; }
        .autocomplete-item { padding: 8px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; color: white; font-size: 16px; }
        .autocomplete-item:hover { background: #3f3f3f; }
        .autocomplete-item i { color: #aaa; font-size: 14px; }
        .container { margin-top: 56px; display: flex; justify-content: center; padding: 24px; gap: 24px; max-width: 1700px; margin-left: auto; margin-right: auto; }
        .main-content { flex: 1; min-width: 0; position: relative; }
        .sidebar { width: 400px; flex-shrink: 0; }
        .player-container { width: 100%; aspect-ratio: 16 / 9; background: black; border-radius: 12px; overflow: hidden; position: relative; z-index: 100; box-shadow: 0 4px 30px rgba(0,0,0,0.7); }
        .video-title { font-size: 20px; font-weight: bold; margin: 12px 0; line-height: 28px; }
        .owner-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .owner-info { display: flex; align-items: center; gap: 12px; }
        .owner-info img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .channel-name { font-weight: bold; font-size: 16px; }
        .btn-sub { background: white; color: black; border: none; padding: 0 16px; height: 36px; border-radius: 18px; font-weight: bold; cursor: pointer; }
        .action-btn { background: var(--bg-secondary); border: none; color: white; padding: 0 16px; height: 36px; border-radius: 18px; cursor: pointer; font-size: 14px; }
        .description-box { background: var(--bg-secondary); border-radius: 12px; padding: 12px; font-size: 14px; margin-bottom: 24px; cursor: pointer; transition: background 0.2s; }
        .description-box:hover { background: var(--bg-hover); }
        .description-content { max-height: 60px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; margin-top: 8px; line-height: 1.5; }
        .description-box.expanded .description-content { max-height: none; -webkit-line-clamp: unset; display: block; }
        .description-show-more { font-weight: bold; margin-top: 8px; font-size: 14px; }
        .comment-item { display: flex; gap: 16px; margin-bottom: 20px; }
        .comment-avatar { width: 40px; height: 40px; border-radius: 50%; }
        .comment-author { font-weight: bold; font-size: 13px; margin-bottom: 4px; display: block; }
        .rec-item { display: flex; gap: 8px; margin-bottom: 12px; cursor: pointer; text-decoration: none; color: inherit; }
        .rec-thumb { width: 160px; height: 90px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: #222; }
        .rec-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .rec-info { display: flex; flex-direction: column; justify-content: flex-start; }
        .rec-title { font-size: 14px; font-weight: bold; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; }
        .rec-meta { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
        .shorts-shelf-container { margin-top: 24px; border-top: 4px solid var(--bg-secondary); padding-top: 20px; margin-bottom: 24px; }
        .shorts-shelf-title { display: flex; align-items: center; font-size: 18px; font-weight: bold; margin-bottom: 16px; color: white; }
        .shorts-shelf-title svg { margin-right: 8px; width: 24px; height: 24px; }
        .shorts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .short-card { text-decoration: none; color: inherit; display: block; }
        .short-thumb { aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; background: #222; }
        .short-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .short-info { margin-top: 8px; }
        .short-title { font-size: 14px; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .short-views { font-size: 12px; color: var(--text-sub); margin-top: 4px; }
        .server-dropdown-container { position: relative; display: inline-block; margin-left: 12px; }
        .btn-server { background: var(--bg-secondary); color: var(--text-main); border: none; padding: 0 16px; height: 36px; border-radius: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; transition: background 0.2s; }
        .btn-server:hover { background: var(--bg-hover); }
        .server-menu { display: none; position: absolute; top: 100%; left: 0; margin-top: 8px; background: var(--bg-secondary); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 200; min-width: 220px; border: 1px solid #333; }
        .server-menu.show { display: block; }
        .server-option { padding: 12px 16px; cursor: pointer; font-size: 14px; transition: background 0.2s; display: flex; align-items: center; }
        .server-option:hover { background: var(--bg-hover); }
        .server-option.active { background: #333; border-left: 4px solid var(--yt-red); padding-left: 12px; }
        .video-loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 150; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; backdrop-filter: blur(2px); }
        .video-loading-overlay.active { opacity: 1; pointer-events: auto; }
        .spinner { border: 4px solid rgba(255, 255, 255, 0.1); width: 50px; height: 50px; border-radius: 50%; border-top-color: var(--yt-red); animation: spin 1s ease-in-out infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @media (max-width: 1000px) { .container { flex-direction: column; padding: 0; } .sidebar { width: 100%; padding: 16px; box-sizing: border-box; } .player-container { border-radius: 0; } .main-content { padding: 16px; } }
    </style>
</head>
<body>
<nav class="navbar">
    <div class="nav-left"><a href="/" class="logo"><i class="fab fa-youtube"></i>YouTube Pro</a></div>
    <div class="nav-center">
        <form class="search-bar" action="/nothing/search">
            <input type="text" name="q" id="searchInput" placeholder="検索" autocomplete="off">
            <button type="submit" class="search-btn"><i class="fas fa-search"></i></button>
        </form>
        <div id="autocompleteDropdown" class="autocomplete-dropdown"></div>
    </div>
    <div style="width:100px;"></div>
</nav>

<div class="container">
    <div class="main-content">
        <div class="player-container">
            <div id="playerWrapper" style="width:100%; height:100%;">
                ${streamEmbedPlaceholder}
            </div>
            <div id="videoLoadingOverlay" class="video-loading-overlay">
                <div class="spinner"></div>
                <div style="font-weight: bold; font-size: 16px;">動画サーバーに接続中...</div>
            </div>
        </div>
        <h1 class="video-title">${videoData.videoTitle}</h1>
        <div class="owner-row">
            <div class="owner-info">
                <a href="/channel/${encodeURIComponent(videoData.channelName)}" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;">
                  <img id="ownerAvatar" src="${videoData.channelImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=random&color=fff&size=80&bold=true`}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.channelName||'C')}&background=555&color=fff&size=80&bold=true'">
                  <div class="channel-name">${videoData.channelName}</div>
                </a>
                <button id="subBtn" class="btn-sub" onclick="toggleSubscribeVideo()">チャンネル登録</button>
                <div class="server-dropdown-container">
                    <button class="btn-server" onclick="toggleServerMenu()">
                        <i class="fas fa-server"></i> 動画サーバー <i class="fas fa-chevron-down" style="font-size: 12px; margin-left: 2px;"></i>
                    </button>
                    <div id="serverMenu" class="server-menu">
                        <div class="server-option active" onclick="changeServer('googlevideo', '', event)">Googlevideo</div>
                        <div class="server-option" onclick="changeServer('youtube-nocookie', '/nocookie/${videoId}', event)">Youtube-nocookie</div>
                        <div class="server-option" onclick="changeServer('DL-Pro', '/360/${videoId}', event)">DL-Pro</div>
                        <div class="server-option" onclick="changeServer('YoutubeEdu-Kahoot', '/kahoot-edu/${videoId}', event)">YoutubeEdu-Kahoot</div>
                        <div class="server-option" onclick="changeServer('YoutubeEdu-Scratch', '/scratch-edu/${videoId}', event)">YoutubeEdu-Scratch</div>
                        <div class="server-option" onclick="changeServer('Youtube-Pro', '/pro-stream/${videoId}', event)">Youtube-Pro</div>
                        <div class="server-option" onclick="changeServer('Elixir-Network', '/stream-network/${videoId}', event)">Elixir-Network</div>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:8px;"><button class="action-btn">👍 ${videoData.likeCount || 0}</button><button class="action-btn">共有</button></div>
        </div>
        <div class="description-box" id="descriptionBox" onclick="toggleDescription(event)">
            <b>${videoData.videoViews || '0'} 回視聴</b>
            <div class="description-content" id="descriptionContent">
                ${(videoData.videoDes || '').replace(/\r\n|\n|\r/g, '<br>')}
            </div>
            <div class="description-show-more" id="descriptionToggleBtn">全文を表示</div>
        </div>
        <div class="comments-section">
            <h3>コメント ${commentsData.commentCount} 件</h3>
            ${commentsData.comments.map(c => `<div class="comment-item"><img class="comment-avatar" src="${c.authorThumbnails?.[0]?.url || ''}"><div><span class="comment-author">${c.author}</span><div style="font-size:14px;">${c.content}</div></div></div>`).join('')}
        </div>
    </div>
    <div class="sidebar">
        <div id="recommendations"></div>
        <div id="shortsShelf" class="shorts-shelf-container" style="display:none;">
            <div class="shorts-shelf-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red">
                    <path d="M17.77,10.32l-1.2-.5L18,9.06a3.74,3.74,0,0,0-3.5-6.62L6,6.94a3.74,3.74,0,0,0,.23,6.74l1.2.49L6,14.93a3.75,3.75,0,0,0,3.5,6.63l8.5-4.5a3.74,3.74,0,0,0-.23-6.74Z"/>
                    <polygon points="10 14.65 15 12 10 9.35 10 14.65" fill="#fff"/>
                </svg>
                Shorts
            </div>
            <div id="shortsGrid" class="shorts-grid"></div>
        </div>
    </div>
</div>

<script>
    function toggleServerMenu() { document.getElementById('serverMenu').classList.toggle('show'); }
    window.addEventListener('click', function(e) { if (!e.target.closest('.server-dropdown-container')) { const menu = document.getElementById('serverMenu'); if (menu && menu.classList.contains('show')) menu.classList.remove('show'); } });

    const VIDEO_CHANNEL = ${JSON.stringify(videoData.channelName || '')};
    const SUB_KEY_VIDEO = 'subscribed_' + VIDEO_CHANNEL;
    const subBtn = document.getElementById('subBtn');
    function updateSubBtnUI() {
      const isSub = localStorage.getItem(SUB_KEY_VIDEO) === 'true';
      if (isSub) {
        subBtn.textContent = '登録済み';
        subBtn.style.background = '#272727';
        subBtn.style.color = '#aaa';
      } else {
        subBtn.textContent = 'チャンネル登録';
        subBtn.style.background = 'white';
        subBtn.style.color = 'black';
      }
    }
    function toggleSubscribeVideo() {
      const isSub = localStorage.getItem(SUB_KEY_VIDEO) === 'true';
      if (isSub) {
        localStorage.removeItem(SUB_KEY_VIDEO);
      } else {
        localStorage.setItem(SUB_KEY_VIDEO, 'true');
      }
      updateSubBtnUI();
    }
    updateSubBtnUI();

    async function changeServer(serverName, endpointPath, event) {
        // --- 修正箇所：サーバー名を localStorage に保存 ---
        localStorage.setItem('playbackMode', serverName);

        document.getElementById('serverMenu').classList.remove('show');
        const options = document.querySelectorAll('.server-option');
        options.forEach(opt => opt.classList.remove('active'));
        
        // メニュー上の active 状態を同期
        if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        } else {
            // 自動起動時などは文字列検索で active を付与
            options.forEach(opt => {
               if (opt.getAttribute('onclick').includes("'" + serverName + "'")) opt.classList.add('active');
            });
        }

        const overlay = document.getElementById('videoLoadingOverlay');
        overlay.classList.add('active');

        try {
            let newUrl = '';
            if (serverName === 'googlevideo') {
                newUrl = "${videoData.stream_url}" === "youtube-nocookie" ? \`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1\` : "${videoData.stream_url}";
            } else if (serverName === 'Youtube-Pro') {
                newUrl = endpointPath;
            } else {
                const res = await fetch(endpointPath);
                if (!res.ok) throw new Error("サーバーエラー");
                newUrl = await res.text();
            }

            const playerContainer = document.getElementById('playerWrapper');
            const forceIframe = ['YoutubeEdu-Kahoot', 'YoutubeEdu-Scratch', 'Youtube-Pro', 'youtube-nocookie', 'Elixir-Network'].includes(serverName);
            const isIframe = forceIframe || newUrl.includes('embed');

            let playerHtml = '';
            if (isIframe) {
                playerHtml = \`<iframe id="mainIframe" src="\${newUrl}" frameborder="0" allowfullscreen style="width:100%; height:100%; position:relative; z-index:10;"></iframe>\`;
            } else {
                playerHtml = \`<video id="mainPlayer" controls autoplay style="width:100%; height:100%; position:relative; z-index:10; background:#000;"><source src="\${newUrl}" type="video/mp4"></video>\`;
            }
            playerContainer.innerHTML = playerHtml;
            const newVideo = document.getElementById('mainPlayer');
            if (newVideo) { 
                newVideo.load(); 
                newVideo.play().catch(e => console.log("Auto")); 

                if (serverName === 'googlevideo' && !window.googlevideoReloaded) {
                    window.googlevideoReloaded = true;
                    setTimeout(() => {
                        const vid = document.getElementById('mainPlayer');
                        if (vid) {
                            const currentTime = vid.currentTime;
                            const isPlaying = !vid.paused;
                            vid.load();
                            vid.currentTime = currentTime;
                            if (isPlaying) vid.play().catch(e => {});
                        }
                    }, 2000);
                }
            }
        } catch (error) { console.error(error); } finally { overlay.classList.remove('active'); }
    }

    async function loadRecommendations() {
        const params = new URLSearchParams({ title: "${videoData.videoTitle}", channel: "${videoData.channelName}", id: "${videoId}" });
        const res = await fetch(\`/api/recommendations?\${params.toString()}\`);
        const data = await res.json();
        const shorts = data.items.filter(item => item.title.includes('#'));
        const regulars = data.items.filter(item => !item.title.includes('#'));
        document.getElementById('recommendations').innerHTML = regulars.map(item => \`
            <a href="/video/\${item.id}" class="rec-item">
                <div class="rec-thumb"><img src="https://i.ytimg.com/vi/\${item.id}/mqdefault.jpg"></div>
                <div class="rec-info">
                    <div class="rec-title">\${item.title}</div>
                    <div class="rec-meta">\${item.channelTitle}</div>
                    <div class="rec-meta">\${item.viewCountText || ''}</div>
                </div>
            </a>
        \`).join('');
        if (shorts.length > 0) {
            const shelf = document.getElementById('shortsShelf');
            const grid = document.getElementById('shortsGrid');
            shelf.style.display = 'block';
            grid.innerHTML = shorts.slice(0, 4).map(item => \`
                <a href="/video/\${item.id}" class="short-card">
                    <div class="short-thumb"><img src="https://i.ytimg.com/vi/\${item.id}/hq720.jpg"></div>
                    <div class="short-info">
                        <div class="short-title">\${item.title}</div>
                        <div class="short-views">\${item.viewCountText || ''}</div>
                    </div>
                </a>
            \`).join('');
        }
    }
    window.onload = () => {
        loadRecommendations();

        // --- 修正箇所：保存された再生方法を即座に反映 ---
        const savedMode = localStorage.getItem('playbackMode') || 'googlevideo';
        const serverEndpoints = {
            'googlevideo':        '',
            'youtube-nocookie':   '/nocookie/${videoId}',
            'DL-Pro':             '/360/${videoId}',
            'YoutubeEdu-Kahoot':  '/kahoot-edu/${videoId}',
            'YoutubeEdu-Scratch': '/scratch-edu/${videoId}',
            'Youtube-Pro':        '/pro-stream/${videoId}',
            'Elixir-Network': '/elixir-stream/${videoId}'
        };
        const serverName = serverEndpoints.hasOwnProperty(savedMode) ? savedMode : 'googlevideo';
        const endpointPath = serverEndpoints[serverName];

        // 初期サーバー選択で起動
        changeServer(serverName, endpointPath, null);
    };

    const searchInput = document.getElementById('searchInput');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    let searchTimeout = null;

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (!query) {
                autocompleteDropdown.style.display = 'none';
                return;
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const script = document.createElement('script');
                script.src = 'https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=' + encodeURIComponent(query) + '&jsonp=handleAutocomplete';
                document.body.appendChild(script);
            }, 200);
        });
    }

    window.handleAutocomplete = function(data) {
        const suggestions = data[1];
        if (!suggestions || suggestions.length === 0) {
            autocompleteDropdown.style.display = 'none';
            return;
        }
        autocompleteDropdown.innerHTML = suggestions.map(function(s) {
            return '<div class="autocomplete-item" data-query="' + encodeURIComponent(s[0]) + '" onclick="selectSuggestion(this)">' +
                   '<i class="fas fa-search"></i><span>' + s[0] + '</span>' +
                   '</div>';
        }).join('');
        autocompleteDropdown.style.display = 'block';
    };

    window.selectSuggestion = function(el) {
        searchInput.value = decodeURIComponent(el.getAttribute('data-query'));
        autocompleteDropdown.style.display = 'none';
        searchInput.closest('form').submit();
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-center')) {
            if(autocompleteDropdown) autocompleteDropdown.style.display = 'none';
        }
    });

    function toggleDescription(e) {
        if(e && e.target.tagName === 'A') return;
        const box = document.getElementById('descriptionBox');
        const btn = document.getElementById('descriptionToggleBtn');
        if (box.classList.contains('expanded')) {
            box.classList.remove('expanded');
            btn.textContent = '全文を表示';
        } else {
            box.classList.add('expanded');
            btn.textContent = '一部を表示';
        }
    }
</script>
</body>
</html>
    `;
    res.send(html);
  } catch (err) { next(err); }
});

app.get("/nothing/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.post("/api/save-history", express.json(), (req, res) => {
  res.json({ success: true });
});
app.get('/rapid/:id', async (req, res) => {
  const videoId = req.params.id;
  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  const url = `https://${RAPID_API_HOST}/dl?id=${videoId}`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': selectedKey,
      'x-rapidapi-host': RAPID_API_HOST,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(400).json({ error: "Failed to fetch video data" });
    }

    // --- 多分取得できないから消してもいい ---
    let channelImageUrl = data.channelThumbnail?.[0]?.url || data.author?.thumbnails?.[0]?.url;

    // 2. アバターURLを作成
    if (!channelImageUrl) {
      const name = encodeURIComponent(data.channelTitle || 'Youtube Channel');
      // UI Avatars を使用
      channelImageUrl = `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;
    }

    const highResStream = data.adaptiveFormats?.find(f => f.qualityLabel === '1080p') || data.adaptiveFormats?.[0];
    const audioStream = data.adaptiveFormats?.find(f => f.mimeType.includes('audio')) || data.adaptiveFormats?.[data.adaptiveFormats?.length - 1];

    const formattedResponse = {
      stream_url: data.formats?.[0]?.url || "",
      highstreamUrl: highResStream?.url || "",
      audioUrl: audioStream?.url || "",
      videoId: data.id,
      channelId: data.channelId,
      channelName: data.channelTitle,
      channelImage: channelImageUrl, 
      videoTitle: data.title,
      videoDes: data.description,
      videoViews: parseInt(data.viewCount) || 0,
      likeCount: data.likeCount || 0
    };

    res.json(formattedResponse);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- 追加: コメントの追加読み込み用API ---
app.get("/api/comments/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  const continuation = req.query.continuation || ""; // 続きのトークン

  for (const apiBase of apiListCache) {
    try {
      // 既存の取得ロジックに continuation を乗せる
      const url = `${apiBase}/api/comments/${videoId}${continuation ? '?continuation=' + continuation : ''}`;
      const cRes = await fetchWithTimeout(url, {}, 3000);
      if (cRes.ok) {
        const data = await cRes.json();
        return res.json(data); // 成功したら即座に返す
      }
    } catch (e) { continue; }
  }
  res.status(500).json({ error: "コメントの取得に失敗しました" });
});

// --- 修正: 既存の /api/channel (ページングをより確実に) ---
app.get("/api/channel", async (req, res) => {
  const channelName = req.query.name || req.query.id;
  const page = parseInt(req.query.page) || 0;
  if (!channelName) return res.status(400).json({ error: "name required" });
  try {
    // 既存の yts を使用
    const results = await yts.GetListByKeyword(channelName, false, 20); // ytsの仕様に合わせる
    const videos = (results.items || []).filter(item => item.type === 'video');
    res.json({ channelName, videos, nextPage: page + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/streams', (req, res) => {
    const cacheData = Object.fromEntries(videoCache);
    res.json(cacheData);
});
app.get('/360/:videoId',async(req,res)=>{const videoId=req.params.videoId;const now=Date.now();const cachedItem=videoCache.get(videoId);if(cachedItem&&cachedItem.expiry>now){return res.type('text/plain').send(cachedItem.url);}const _0x1a=[0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3e,0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,0x75,0x76,0x83,0x50,0x86,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55];const _0x2b=[0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e,0x43];const _0x11=['\x6d\x61\x70','\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65','\x6a\x6f\x69\x6e'];const _0x4d=_0x1a[_0x11[0]](_0x5e=>String[_0x11[1]](_0x5e-0x11))[_0x11[2]]('');const _0x5e=_0x2b[_0x11[0]](_0x6f=>String[_0x11[1]](_0x6f-0x11))[_0x11[2]]('');const targetUrl=_0x4d+videoId+_0x5e;try{const response=await fetch(targetUrl,{method:'GET',headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"},redirect:'follow'});const finalUrl=response.url;videoCache.set(videoId,{url:finalUrl,expiry:now+60000});res.type('text/plain').send(finalUrl);}catch(error){console.error('Error:',error);res.status(500).send('Internal Server Error');}});
app.get('/scratch-edu/:id', async (req, res) => {
  const id = req.params.id;

  const configUrl = 'https://raw.githubusercontent.com/wista-api-project/auto/refs/heads/main/edu/2.txt';
  const configRes = await fetch(configUrl);
  const configJson = await configRes.json();
  const params = configJson.params; 

  const url = `https://www.youtubeeducation.com/embed/${id}${params}`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(url);
});


app.get('/kahoot-edu/:id', async (req, res) => {
  const id = req.params.id;

  const paramUrl = 'https://raw.githubusercontent.com/wista-api-project/auto/refs/heads/main/edu/3.txt';
  const response = await fetch(paramUrl);
  const params = await response.text(); 

  const url = `https://www.youtubeeducation.com/embed/${id}${params}`;

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(url);
});


app.get('/nocookie/:id', (req, res) => {
  const id = req.params.id;
  const url = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(url);
});

app.get('/pro-stream/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pro Stream — ${videoId}</title>
<style>
  :root{--bg:#000814;--accent:#00e5ff;--muted:#9fb6c8}
  html,body{height:100%;margin:0;background:radial-gradient(ellipse at center, rgba(0,8,20,1) 0%, rgba(0,4,10,1) 70%);font-family:Inter,system-ui,Roboto,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#e6f7ff}
  .stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .frame{position:relative;width:100%;height:100%;background:#000;overflow:hidden}
  .layer{position:absolute;inset:0;transition:opacity .8s cubic-bezier(.2,.9,.2,1), transform .8s;display:flex;align-items:center;justify-content:center}
  .layer iframe{width:100%;height:100%;border:0;display:block}
  .layer.inactive{opacity:0;transform:scale(1.02);pointer-events:none}
  .layer.active{opacity:1;transform:scale(1);pointer-events:auto}
  .hud{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80;display:flex;flex-direction:column;align-items:center;gap:14px;backdrop-filter:blur(6px)}
  .card{min-width:360px;max-width:88vw;padding:18px 20px;border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35));box-shadow:0 10px 40px rgba(0,0,0,0.6);color:#dff9ff}
  .title{font-size:18px;font-weight:700;color:var(--accent);letter-spacing:0.6px}
  .status{margin-top:8px;font-size:14px;font-weight:600}
  .sub{margin-top:6px;font-size:13px;color:var(--muted);line-height:1.4}
  .streams{margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:160px;overflow:auto;padding-right:6px}
  .stream-item{display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:13px}
  .stream-item.ok{border-left:4px solid #2ee6a7}
  .stream-item.fail{opacity:0.6;border-left:4px solid #ff6b6b}
  .progress{height:6px;background:rgba(255,255,255,0.04);border-radius:6px;overflow:hidden;margin-top:10px}
  .bar{height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#2ee6a7)}
  .btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:#dff9ff;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:600}
  .btn.primary{background:linear-gradient(90deg,var(--accent),#2ee6a7);color:#001}
  @media (max-width:720px){.card{min-width:300px;padding:14px}.title{font-size:16px}}
</style>
</head>
<body>
<div class="stage">
  <div class="frame" id="frame"></div>

  <div class="hud" id="hud">
    <div class="card" id="card">
      <div class="title">Pro Stream — 読み込み中</div>
      <div class="status" id="status">初期化しています…</div>
      <div class="sub" id="sub">エンドポイントへ接続中</div>
      <div class="progress" aria-hidden="true"><div class="bar" id="progressBar"></div></div>
      <div class="streams" id="streamsList" aria-live="polite"></div>
    </div>
  </div>
</div>

<script>
const VIDEO_ID = ${JSON.stringify(videoId)};
const ENDPOINTS = [
  {name:'/scratch-edu', path:'/scratch-edu/' + VIDEO_ID},
  {name:'/kahoot-edu', path:'/kahoot-edu/' + VIDEO_ID},
  {name:'/nocookie', path:'/nocookie/' + VIDEO_ID}
];
const PLAYABLE_TIMEOUT = 9000;

const frame = document.getElementById('frame');
const hud = document.getElementById('hud');
const statusEl = document.getElementById('status');
const subEl = document.getElementById('sub');
const streamsList = document.getElementById('streamsList');
const progressBar = document.getElementById('progressBar');

let layers = [];
let activeIndex = 0;
let globalMuted = true;

function setStatus(main, sub){ statusEl.textContent = main; subEl.textContent = sub || ''; }
function setProgress(p){ progressBar.style.width = Math.max(0, Math.min(1,p)) * 100 + '%'; }
function upsertStreamRow(name, url, state, note){
  let el = document.querySelector('[data-stream="'+name+'"]');
  if(!el){
    el = document.createElement('div');
    el.className = 'stream-item';
    el.dataset.stream = name;
    el.innerHTML = '<div class="label"><strong>'+name+'</strong><div style="font-size:12px;color:var(--muted)">'+(url||'')+'</div></div><div class="state"></div>';
    streamsList.appendChild(el);
  }
  el.querySelector('.state').textContent = note || (state === 'ok' ? '取得済' : '失敗');
  el.classList.toggle('ok', state === 'ok');
  el.classList.toggle('fail', state !== 'ok');
}

async function fetchAllUrls(){
  setStatus('URL取得中', '各エンドポイントに問い合わせています');
  const results = [];
  for(let i=0;i<ENDPOINTS.length;i++){
    const ep = ENDPOINTS[i];
    upsertStreamRow(ep.name, '', 'pending', '問い合わせ中');
    try{
      const res = await fetch(ep.path, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const text = (await res.text()).trim();
      if(text){
        results.push({name:ep.name, url:text, ok:true});
        upsertStreamRow(ep.name, text, 'ok', 'URL取得');
      } else {
        results.push({name:ep.name, url:null, ok:false});
        upsertStreamRow(ep.name, '', 'fail', '空のレスポンス');
      }
    }catch(err){
      results.push({name:ep.name, url:null, ok:false});
      upsertStreamRow(ep.name, '', 'fail', err.message || '取得失敗');
    }
    setProgress((i+1)/ENDPOINTS.length * 0.4);
  }
  return results;
}

function createLayer(name, url, idx){
  const layer = document.createElement('div');
  layer.className = 'layer inactive';
  layer.style.zIndex = 10 + idx;
  layer.dataset.name = name;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow','autoplay; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen','');

  try {
    const u = new URL(url, location.href);
    if(!u.searchParams.has('autoplay')) u.searchParams.set('autoplay','1');
    if(!u.searchParams.has('mute')) u.searchParams.set('mute','1');
    iframe.src = u.toString();
  } catch(e) {
    iframe.src = url + (url.includes('?') ? '&' : '?') + 'autoplay=1&mute=1';
  }

  layer.appendChild(iframe);
  frame.appendChild(layer);
  return {name, url, el:layer, iframe, state:'init', ok:false};
}

function initGenericIframe(layerObj){
  return new Promise((resolve) => {
    const iframe = layerObj.iframe;
    let resolved = false;
    const onLoad = () => {
      if(resolved) return;
      resolved = true;
      layerObj.state = 'loaded';
      layerObj.ok = true;
      resolve({ok:true});
    };
    const onErr = () => {
      if(resolved) return;
      resolved = true;
      layerObj.state = 'error';
      layerObj.ok = false;
      resolve({ok:false});
    };
    iframe.addEventListener('load', onLoad, {once:true});
    setTimeout(()=>{ if(!resolved) onErr(); }, PLAYABLE_TIMEOUT);
  });
}

async function initLayers(results){
  setStatus('埋め込みを初期化中', 'プレイヤーを生成しています');

  const valid = results.filter(r => r.ok && r.url);

  if(valid.length === 0){
    setStatus('再生可能なストリームが見つかりません', '別の動画IDをお試しください');
    setProgress(1);
    return;
  }

  setStatus('埋め込み候補を検査中', '最初に再生可能なストリームを一つだけ選択します');
  setProgress(0.4);

  let chosen = null;
  for(let i=0;i<valid.length;i++){
    const r = valid[i];
    upsertStreamRow(r.name, r.url, 'pending', '埋め込み生成（試行）');
    const obj = createLayer(r.name, r.url, 0);
    const check = await initGenericIframe(obj);
    if(check && check.ok){
      chosen = obj;
      upsertStreamRow(r.name, r.url, 'ok', 'ロード完了（採用）');
      break;
    } else {
      try{ obj.el.remove(); }catch(e){}
      upsertStreamRow(r.name, r.url, 'fail', '埋め込み失敗');
    }
    setProgress(0.4 + (i+1)/valid.length * 0.2);
  }

  if(!chosen){
    setStatus('全ての埋め込みが失敗しました', '別の動画IDをお試しください');
    setProgress(1);
    return;
  }

  valid.forEach(v => {
    const el = document.querySelector('[data-stream="'+v.name+'"]');
    if(el && el.classList.contains('ok') === false){
      el.querySelector('.state').textContent = '未採用';
      el.classList.remove('ok');
      el.classList.add('fail');
    }
  });

  layers = [chosen];
  activeIndex = 0;
  updateLayerVisibility();
  setProgress(0.85);
  setStatus('自動再生を試行中', 'ミュートで再生を開始します');

  try{ chosen.iframe.focus(); }catch(e){}

  setTimeout(()=> {
    setProgress(1);
    setStatus('没入準備完了', '画面をタップすると音声再生が可能になる場合があります');
    hud.style.transition = 'opacity .8s ease';
    hud.style.opacity = '0';
    setTimeout(()=> { hud.style.display = 'none'; }, 900);
  }, 900);
}

function updateLayerVisibility(){
  layers.forEach((l,i) => {
    if(i === activeIndex){ l.el.classList.remove('inactive'); l.el.classList.add('active'); }
    else { l.el.classList.remove('active'); l.el.classList.add('inactive'); }
  });
}

function showNext(){
  if(layers.length <= 1) return;
  activeIndex = (activeIndex + 1) % layers.length;
  updateLayerVisibility();
}

function toggleMute(){
  globalMuted = !globalMuted;
  layers.forEach(l => {
    try{ l.iframe.contentWindow.postMessage(JSON.stringify({event:'command',func: globalMuted ? 'mute' : 'unMute', args:[]}), '*'); }catch(e){}
    try{ l.iframe.muted = globalMuted; }catch(e){}
  });
}

function enterImmersive(){
  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen();
  else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

(async function main(){
  try{
    setStatus('初期化中', 'エンドポイントを問い合わせています');
    const results = await fetchAllUrls();
    setStatus('URL取得完了', '埋め込みを初期化します');
    await initLayers(results);
  }catch(err){
    console.error(err);
    setStatus('エラーが発生しました', String(err));
  }
})();

frame.addEventListener('click', ()=> {
  if(hud.style.display !== 'none'){
    hud.style.display = 'none';
    layers.forEach(l => { try{ l.iframe.focus(); }catch(e){} });
  } else {
    showNext();
  }
});
</script>
</body>
</html>`);
});

app.get('/sia-dl/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const protocol = req.protocol;
    const host = req.get('host');

    try {
        const metadataUrl = `https://siawaseok.duckdns.org/api/video2/${videoId}?depth=1`;
        const metaResponse = await fetch(metadataUrl);
        if (!metaResponse.ok) throw new Error('Metadata API response was not ok');
        const data = await metaResponse.json();

        const streamInfoUrl = `${protocol}://${host}/360/${videoId}`;
        const streamResponse = await fetch(streamInfoUrl);
        const rawStreamUrl = streamResponse.ok ? await streamResponse.text() : "";

        const parseCount = (str) => {
            if (!str) return 0;
            return parseInt(str.replace(/[^0-9]/g, '')) || 0;
        };

        const formattedResponse = {
            stream_url: rawStreamUrl.trim(),
            highstreamUrl: rawStreamUrl.trim(), 
            audioUrl: "", 
            
            videoId: data.id,
            channelId: data.author?.id || "",
            channelName: data.author?.name || "",
            channelImage: data.author?.thumbnail || "",
            videoTitle: data.title,
            videoDes: data.description?.text || "",
            
            videoViews: parseCount(data.views || data.extended_stats?.views_original),
            
            likeCount: parseCount(data.likes)
        };

        res.json(formattedResponse);

    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

app.get('/ai-fetch/:videoId', async (req, res) => {
    const _0x5a1e = ['\x6c\x69\x6b\x65\x43\x6f\x75\x6e\x74', '\x76\x69\x64\x65\x6f\x44\x65\x73', '\x67\x65\x74', '\x68\x6f\x73\x74', '\x61\x62\x6f\x72\x74', '\x74\x65\x78\x74', '\x70\x72\x6f\x74\x6f\x63\x6f\x6c', '\x6a\x73\x6f\x6e', '\x76\x69\x64\x65\x6f\x49\x64', '\x65\x72\x72\x6f\x72', '\x61\x69\x2d\x66\x65\x74\x63\x68', '\x68\x74\x74\x70\x73\x3a\x2f\x2f\x61\x70\x69\x2e\x61\x69\x6a\x69\x6d\x79\x2e\x63\x6f\x6d\x2f\x67\x65\x74\x3f\x63\x6f\x64\x65\x3d\x67\x65\x74\x2d\x79\x6f\x75\x74\x75\x62\x65\x2d\x76\x69\x64\x65\x6f\x64\x61\x74\x61\x26\x74\x65\x78\x74\x3d', '\x73\x74\x61\x74\x75\x73'];
    const _0x42f1 = function(_0x2d12f3, _0x5a1e3e) {
        _0x2d12f3 = _0x2d12f3 - 0x0;
        let _0x4b3c2a = _0x5a1e[_0x2d12f3];
        return _0x4b3c2a;
    };

    const videoId = req.params[_0x42f1('0x8')];
    
    const _0x1f22a1 = (function(_0x33e1a) {
        return _0x33e1a.split('').reverse().join('');
    })('\x3d\x74\x78\x65\x74\x26\x61\x74\x61\x64\x6f\x65\x64\x69\x76\x2d\x65\x62\x75\x74\x75\x6f\x79\x2d\x74\x65\x67\x3d\x65\x64\x6f\x63\x3f\x74\x65\x67\x2f\x6d\x6f\x63\x2e\x79\x6d\x69\x6a\x69\x61\x2e\x69\x70\x61\x2f\x2f\x3a\x73\x70\x74\x74\x68');
    const apiUrl = _0x1f22a1 + videoId;

    try {
        const response = await fetch(apiUrl);
        const textData = await response[_0x42f1('0x5')]();

        const descriptionMatch = textData.match(/概要欄:\s*([\s\S]*?)\s*公開日:/);
        const viewsMatch = textData.match(/再生回数:\s*(\d+)/);
        const likesMatch = textData.match(/高評価数:\s*(\d+)/);

        const videoDes = descriptionMatch ? descriptionMatch[1].trim() : "";
        const videoViews = viewsMatch ? parseInt(viewsMatch[1]) : 0;
        const likeCount = likesMatch ? parseInt(likesMatch[1]) : 0;

        let videoTitle = videoId; 
        let channelName = videoId;
        let found = false;

        try {
            const noEmbedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            if (noEmbedRes.ok) {
                const noEmbedData = await noEmbedRes.json();
                if (noEmbedData && !noEmbedData.error) {
                    videoTitle = noEmbedData.title || videoId;
                    channelName = noEmbedData.author_name || videoId;
                    found = true;
                }
            }
        } catch (noEmbedErr) {

        }

        if (!found) {
            try {
                let page = 0;
                while (page < 10 && !found) {
                    const searchResults = await yts.GetListByKeyword(videoId, false, 20, page);
                    if (searchResults && searchResults.items && searchResults.items.length > 0) {
                        const matchedVideo = searchResults.items.find(item => item.id === videoId);
                        if (matchedVideo) {
                            videoTitle = matchedVideo.title || videoId;
                            channelName = (matchedVideo.author && matchedVideo.author.name) ? matchedVideo.author.name : videoId;
                            found = true;
                        }
                    } else {
                        break;
                    }
                    page++;
                }
            } catch (searchErr) {
                console.error("Search API Error:", searchErr);
            }
        }

        const protocol = req[_0x42f1('0x6')];
        const host = req[_0x42f1('0x2')](_0x42f1('0x3'));
        const internalUrl = `${protocol}://${host}/360/${videoId}`;
        let finalStreamUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller[_0x42f1('0x4')](), 3000); 

            const internalRes = await fetch(internalUrl, { signal: controller.signal });
            if (internalRes.ok) {
                const rawText = await internalRes[_0x42f1('0x5')]();
                if (rawText && rawText.trim() !== "") {
                    finalStreamUrl = rawText.trim(); 
                }
            }
            clearTimeout(timeoutId);
        } catch (err) {
        }

        const formattedResponse = {
            stream_url: finalStreamUrl,
            highstreamUrl: finalStreamUrl,
            audioUrl: finalStreamUrl,
            videoId: videoId,
            channelId: "", 
            channelName: channelName, 
            channelImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=random&color=fff&size=128`,
            videoTitle: videoTitle, 
            videoDes: videoDes,
            videoViews: videoViews,
            likeCount: likeCount
        };

        res[_0x42f1('0x7')](formattedResponse);

    } catch (error) {
        console.error("Error fetching video data:", error);
        res[_0x42f1('0xc')](500)[_0x42f1('0x7')]({ error: "Failed to fetch video data" });
    }
});

app.get("/youtube-pro", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "min-tube-pro.html"));
});

app.get("/min-img.png", (req, res) => {
  const filePath = path.join(__dirname, "img", "min-tube-pro.png");
  res.sendFile(filePath);
});

app.get("/helios", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/helios.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat/chat.html"));
});

app.get("/nautilus-os", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/NautilusOS.html"));
});

app.get("/unblockers", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/search.html"));
});

app.get("/labo5", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/html-tube.html"));
});

app.get("/ai", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/aibot.html"));
});

app.get("/dl-pro", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/study2525.html"));
});

app.get("/update", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/sorry.html"));
});

app.get("/blog", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/sorry.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/sorry.html"));
});
app.get("/minecraft", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "game/fun/Minecraft.html"));
});

app.get("/play", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "game/play.html"));
});
app.get("/anime", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/anime.html"));
});

app.get("/movie", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/sorry.html"));
});

app.get("/check", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/check.html"));
});

app.get("/use-api", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/sorry.html"));
});

app.get("/version", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "raw/version.json"));
});
app.get("/ai", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/ac.html"));
});
app.get("/vc", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/Vc.html"));
});
app.get("/code", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/Code.html"));
});
app.get("/croxy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/croxy.html"));
});
app.get("/games.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "game/game.json"));
});
app.get("/gust", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/GUST.html"));
});
app.get("/easy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/easy.html"));
});

app.get("/urls", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/public-url.html"));
});

app.get("/own", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "proxy/own.html"));
});

app.get("/wista", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "wista.html"));
});

app.get("/sia", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sia/index.html"));
});

app.get("/k-tube", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/iframe/k-tube.html"));
});

app.get("/science", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/iframe/science.html"));
});

app.get("/earth", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/iframe/earth.html"));
});

app.get("/home-v2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test/home-v2-test.html"));
});

app.get("/sys-update", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app/update.html"));
});

app.get("/classroom.192", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "img/classroom.192.png"));
});

app.get("/classroom.512", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "img/classroom.512.png"));
});


app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});

app.get("/wool", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "wista.html"));
});

app.get("/api/channel", async (req, res) => {
  const channelName = req.query.name || req.query.id;
  const page = parseInt(req.query.page) || 0;
  if (!channelName) return res.status(400).json({ error: "name required" });
  try {
    // 取得件数を20に設定
    const results = await yts.GetListByKeyword(channelName, false, 20, page);
    const videos = (results.items || []).filter(item => item.type === 'video');
    res.json({ channelName, videos, nextPage: page + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inv/channel/:name', async (req, res) => {
  const channelName = req.params.name;

  const url = `https://yt.chocolatemoo53.com/api/v1/search?q=${encodeURIComponent(
    channelName
  )}&type=channel`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Upstream error: ${response.statusText}` });
    }

    const data = await response.json();

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/channel/:channelName", (req, res) => {
  const channelName = decodeURIComponent(req.params.channelName);
  const initial = channelName.charAt(0).toUpperCase();
  // チャンネルごとにアバター背景色を決定（固定色・フォールバック用）
  const colors = ['#ff0000','#ff6d00','#ffd600','#00c853','#00b0ff','#651fff','#d500f9','#f50057'];
  const colorIndex = channelName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const avatarBg = colors[colorIndex];

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${channelName} - Min-WLYT-Plus</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:#0f0f0f; --surface:#212121; --card:#272727; --hover:#3f3f3f;
      --text:#f1f1f1; --text-sub:#aaaaaa; --text-sec:#717171;
      --red:#ff0000; --border:#3f3f3f;
      --avatar-bg: ${avatarBg};
      --nav-h: 56px;
    }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'Roboto',Arial,sans-serif; -webkit-font-smoothing:antialiased; }

    /* ===== NAVBAR ===== */
    .navbar {
      position:fixed; top:0; width:100%; height:var(--nav-h);
      background:var(--bg); display:flex; align-items:center;
      padding:0 16px; z-index:1000; gap:8px;
      border-bottom:1px solid transparent;
    }
    .nav-left { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .icon-btn {
      background:none; border:none; color:var(--text); cursor:pointer;
      width:40px; height:40px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s; flex-shrink:0;
    }
    .icon-btn:hover { background:rgba(255,255,255,0.1); }
    .icon-btn svg { width:24px; height:24px; fill:var(--text); }
    .nav-logo { display:flex; align-items:center; gap:2px; text-decoration:none; color:var(--text); }
    .nav-logo-icon { background:var(--red); border-radius:6px; width:34px; height:24px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .nav-logo-icon svg { width:16px; height:16px; fill:white; }
    .nav-logo-text { font-size:18px; font-weight:700; letter-spacing:-0.5px; margin-left:4px; }
    .nav-logo-sub { font-size:10px; color:var(--text-sub); font-weight:500; margin-left:1px; align-self:flex-end; margin-bottom:4px; }
    .nav-center {
      flex:1; display:flex; align-items:center; justify-content:center;
      max-width:640px; margin:0 auto;
    }
    .search-form {
      display:flex; width:100%; height:40px;
      border:1px solid var(--border); border-radius:0; overflow:hidden;
    }
    .search-form:focus-within { border-color:#1c62b9; }
    .search-form input {
      flex:1; background:var(--bg); border:none; color:var(--text);
      padding:0 16px; outline:none; font-size:16px;
      font-family:'Roboto',Arial,sans-serif;
    }
    .search-btn {
      background:var(--surface); border:none; border-left:1px solid var(--border);
      color:var(--text-sub); width:64px; height:100%;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; font-size:18px; transition:background .1s;
    }
    .search-btn:hover { background:var(--hover); }
    .search-btn svg { width:20px; height:20px; fill:currentColor; }
    .nav-right { display:flex; align-items:center; gap:4px; margin-left:auto; flex-shrink:0; }

    /* ===== BANNER ===== */
    .channel-banner {
      margin-top:var(--nav-h); width:100%;
      height:clamp(100px, 18vw, 200px);
      background:linear-gradient(135deg, #1c1c2e 0%, #2d1b4e 40%, #1a2a4a 100%);
      position:relative; overflow:hidden;
    }
    .channel-banner::before {
      content:''; position:absolute; inset:0;
      background:radial-gradient(ellipse at 20% 60%, ${avatarBg}44 0%, transparent 60%);
    }
    .channel-banner::after {
      content:''; position:absolute; inset:0;
      background:radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.05) 0%, transparent 50%);
    }

    /* ===== CHANNEL HEADER ===== */
    .channel-header-wrap {
      max-width:1284px; margin:0 auto; padding:0 24px 0;
    }
    .channel-header {
      display:flex; align-items:center; gap:24px;
      padding:20px 0 16px;
    }
    .channel-avatar {
      width:80px; height:80px; border-radius:50%;
      background:var(--avatar-bg);
      display:flex; align-items:center; justify-content:center;
      font-size:36px; font-weight:700; color:#fff;
      flex-shrink:0; overflow:hidden; position:relative;
      border:3px solid var(--bg);
    }
    @media (min-width:600px) {
      .channel-avatar { width:160px; height:160px; font-size:64px; }
    }
    .channel-avatar img {
      width:100%; height:100%; object-fit:cover;
      display:none; position:absolute; inset:0;
    }
    .channel-avatar img.loaded { display:block; }
    .avatar-initial { position:relative; z-index:1; }

    .channel-info { flex:1; min-width:0; }
    .channel-title-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .channel-title {
      font-size:clamp(18px, 4vw, 36px); font-weight:700; line-height:1.2;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .verified-badge { fill:var(--text-sub); width:16px; height:16px; display:none; flex-shrink:0; }
    .verified-badge.show { display:block; }
    .channel-meta {
      font-size:14px; color:var(--text-sub); line-height:1.6;
      margin-bottom:12px;
    }
    .channel-meta span + span::before { content:' • '; }
    .channel-description {
      font-size:14px; color:var(--text-sub); line-height:1.5;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      overflow:hidden; max-width:600px; margin-bottom:16px;
    }
    .channel-actions { display:flex; align-items:center; gap:8px; }
    .btn-subscribe {
      background:var(--text); color:#0f0f0f;
      border:none; border-radius:20px;
      padding:0 16px; height:36px; font-size:14px; font-weight:500;
      cursor:pointer; transition:opacity .15s;
      font-family:'Roboto',Arial,sans-serif; white-space:nowrap;
      display:flex; align-items:center;
    }
    .btn-subscribe:hover { opacity:0.9; }
    .btn-subscribe.subscribed { background:var(--card); color:var(--text); }
    .btn-subscribe.subscribed:hover { background:var(--hover); }
    .btn-notify {
      background:var(--card); border:none; color:var(--text);
      width:36px; height:36px; border-radius:50%;
      display:none; align-items:center; justify-content:center;
      cursor:pointer; transition:background .15s;
    }
    .btn-notify.show { display:flex; }
    .btn-notify:hover { background:var(--hover); }
    .btn-notify svg { width:20px; height:20px; fill:var(--text); }

    /* ===== TABS ===== */
    .channel-tabs-wrap {
      max-width:1284px; margin:0 auto; padding:0 24px;
      border-bottom:1px solid var(--border);
    }
    .channel-tabs { display:flex; overflow-x:auto; scrollbar-width:none; }
    .channel-tabs::-webkit-scrollbar { display:none; }
    .tab {
      padding:0 16px; height:48px; cursor:pointer;
      font-size:14px; font-weight:500; letter-spacing:0.3px;
      color:var(--text-sub); border-bottom:2px solid transparent;
      transition:color .15s, border-color .15s; white-space:nowrap;
      display:flex; align-items:center;
    }
    .tab:hover { color:var(--text); background:rgba(255,255,255,0.05); }
    .tab.active { color:var(--text); border-bottom-color:var(--text); }

    /* ===== CONTENT ===== */
    .content { max-width:1284px; margin:0 auto; padding:20px 24px 60px; }
    .video-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(240px,1fr));
      gap:16px; row-gap:40px;
    }
    .video-card { text-decoration:none; color:inherit; display:flex; flex-direction:column; }
    .thumb {
      width:100%; aspect-ratio:16/9; border-radius:12px;
      overflow:hidden; background:#1a1a1a; position:relative;
      margin-bottom:12px;
    }
    .thumb img { width:100%; height:100%; object-fit:cover; display:block; transition:border-radius .2s; }
    .video-card:hover .thumb img { border-radius:0; }
    .duration-badge {
      position:absolute; bottom:6px; right:6px;
      background:rgba(0,0,0,0.85); color:#fff;
      font-size:12px; font-weight:700; padding:2px 5px; border-radius:4px;
    }
    .card-meta { display:flex; gap:12px; align-items:flex-start; }
    .card-ch-avatar {
      width:36px; height:36px; border-radius:50%;
      background:var(--avatar-bg); flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:14px; font-weight:700; color:#fff; overflow:hidden;
    }
    .card-ch-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
    .card-info { flex:1; min-width:0; }
    .video-title {
      font-size:14px; font-weight:500; line-height:1.4;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      overflow:hidden; color:var(--text); margin-bottom:4px;
    }
    .video-ch-name { font-size:13px; color:var(--text-sub); margin-bottom:2px; }
    .video-sub { font-size:13px; color:var(--text-sub); }

    /* ===== LOADING / EMPTY ===== */
    .loading { display:flex; justify-content:center; padding:60px; }
    .spinner {
      border:3px solid #333; border-top-color:var(--red);
      border-radius:50%; width:40px; height:40px;
      animation:spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
    .load-more {
      display:block; margin:32px auto; padding:0 24px; height:36px;
      background:var(--card); border:none; color:var(--text);
      border-radius:18px; font-size:14px; font-weight:500;
      cursor:pointer; transition:background .15s;
      font-family:'Roboto',Arial,sans-serif;
    }
    .load-more:hover { background:var(--hover); }
    .empty { text-align:center; padding:60px; color:var(--text-sub); font-size:15px; }

    /* ===== RESPONSIVE ===== */
    @media (max-width:600px) {
      .channel-header-wrap { padding:0 16px; }
      .channel-header { gap:16px; padding:16px 0 12px; }
      .channel-description { display:none; }
      .content { padding:16px 16px 80px; }
      .video-grid { grid-template-columns:repeat(2,1fr); gap:8px; row-gap:24px; }
      .channel-tabs-wrap { padding:0 16px; }
      .nav-center { display:none; }
    }
  </style>
</head>
<body>

<nav class="navbar">
  <div class="nav-left">
    <button class="icon-btn" onclick="history.back()" aria-label="戻る">
      <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    </button>
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">
        <svg viewBox="0 0 68 48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#FF0000"/><path d="M45 24 27 14v20" fill="white"/></svg>
      </div>
      <span class="nav-logo-text">YouTube</span><span class="nav-logo-sub">Pro</span>
    </a>
  </div>
  <div class="nav-center">
    <form class="search-form" action="/nothing/search" onsubmit="event.preventDefault(); const q=this.querySelector('input').value.trim(); if(q) window.location.href='/?q='+encodeURIComponent(q);">
      <input type="text" placeholder="検索" name="q">
      <button type="submit" class="search-btn">
        <svg viewBox="0 0 24 24"><path d="M20.87 20.17l-5.59-5.59C16.35 13.35 17 11.75 17 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7c1.75 0 3.35-.65 4.58-1.71l5.59 5.59.7-.71zM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
      </button>
    </form>
  </div>
  <div class="nav-right">
    <a href="/" class="icon-btn" title="ホーム">
      <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    </a>
  </div>
</nav>

<div class="channel-banner"></div>

<div class="channel-header-wrap">
  <div class="channel-header">
    <div class="channel-avatar" id="channelAvatar">
      <img id="channelAvatarImg" src="" alt="">
      <span class="avatar-initial" id="avatarInitial">${initial}</span>
    </div>
    <div class="channel-info">
      <div class="channel-title-row">
        <div class="channel-title" id="channelTitle">${channelName}</div>
        <svg class="verified-badge" id="verifiedBadge" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM10 17l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z"/></svg>
      </div>
      <div class="channel-meta">
        <span id="channelHandle">@${channelName.toLowerCase().replace(/\s+/g, '')}</span>
        <span id="subCount"></span>
        <span id="videoCountDisplay"></span>
      </div>
      <div class="channel-description" id="channelDescription"></div>
      <div class="channel-actions">
        <button class="btn-subscribe" id="subscribeBtn" onclick="toggleSubscribe()">チャンネル登録</button>
        <button class="btn-notify" id="notifyBtn" aria-label="通知">
          <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<div class="channel-tabs-wrap">
  <div class="channel-tabs">
    <div class="tab active">動画</div>
    <div class="tab" onclick="alert('近日公開予定')">再生リスト</div>
    <div class="tab" onclick="alert('近日公開予定')">コミュニティ</div>
  </div>
</div>

<div class="content">
  <div id="videoGrid" class="video-grid"></div>
  <div id="loading" class="loading"><div class="spinner"></div></div>
  <button id="loadMoreBtn" class="load-more" style="display:none;" onclick="loadMore()">もっと見る</button>
</div>

<script>
  const CHANNEL_NAME = ${JSON.stringify(channelName)};
  const initial = ${JSON.stringify(initial)};
  let currentPage = 0;
  let isLoading = false;
  let isEnd = false;
  let totalLoaded = 0;
  let channelAvatarUrl = ''; // fetchChannelInfo後に設定される

  // 既存：チャンネル登録管理
  const SUB_KEY = 'subscribed_' + CHANNEL_NAME;
  function updateSubscribeUI() {
    const isSub = localStorage.getItem(SUB_KEY) === 'true';
    const btn = document.getElementById('subscribeBtn');
    const notifyBtn = document.getElementById('notifyBtn');
    if (isSub) {
      btn.textContent = '登録済み';
      btn.classList.add('subscribed');
      if(notifyBtn) notifyBtn.classList.add('show');
    } else {
      btn.textContent = 'チャンネル登録';
      btn.classList.remove('subscribed');
      if(notifyBtn) notifyBtn.classList.remove('show');
    }
  }
  function toggleSubscribe() {
    localStorage.setItem(SUB_KEY, localStorage.getItem(SUB_KEY) !== 'true');
    updateSubscribeUI();
  }

  // 既存：フォーマット関数
  function formatViews(v) {
    if (!v) return '';
    return v.replace('views', '回視聴').replace('ago', '前');
  }
  function formatSubscribers(n) {
    if (!n) return 'チャンネル';
    return n;
  }

  // 動画描画
  function renderVideos(videos) {
    const grid = document.getElementById('videoGrid');
    if (videos.length === 0 && totalLoaded === 0) {
      grid.innerHTML = '<div class="empty">動画が見つかりませんでした</div>';
      return;
    }
    const html = videos.map(v => \`
      <a href="/video/\${v.id}" class="video-card">
        <div class="thumb">
          <img src="https://i.ytimg.com/vi/\${v.id}/mqdefault.jpg" loading="lazy">
          \${v.lengthText ? \`<div class="duration-badge">\${v.lengthText}</div>\` : ''}
        </div>
        <div class="card-meta">
          <div class="card-ch-avatar" style="position:relative;overflow:hidden;">
            <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:inherit;">\${initial}</span>
            \${channelAvatarUrl ? \`<img src="\${channelAvatarUrl}" alt="\${CHANNEL_NAME}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.remove()">\` : ''}
          </div>
          <div class="card-info">
            <div class="video-title">\${v.title || ''}</div>
            <div class="video-ch-name">\${CHANNEL_NAME}</div>
            <div class="video-sub">\${formatViews(v.viewCountText) || ''}</div>
          </div>
        </div>
      </a>
    \`).join('');
    grid.insertAdjacentHTML('beforeend', html);
    totalLoaded += videos.length;
    const countDisp = document.getElementById('videoCountDisplay');
    if (countDisp) countDisp.textContent = '動画 ' + totalLoaded + ' 本';
  }

  // 動画取得コア関数
  async function loadVideos() {
    if (isLoading || isEnd) return;
    isLoading = true;
    document.getElementById('loading').style.display = 'flex';
    
    try {
      const res = await fetch(\`/api/channel?name=\${encodeURIComponent(CHANNEL_NAME)}&page=\${currentPage}\`);
      const data = await res.json();
      if (!data.videos || data.videos.length === 0) {
        isEnd = true;
        document.getElementById('loading').innerHTML = '<p style="color:var(--text-sub);padding:20px;">すべての動画を読み込みました</p>';
      } else {
        renderVideos(data.videos);
        currentPage = data.nextPage;
      }
    } catch (e) {
      isEnd = true;
    } finally {
      isLoading = false;
      if (!isEnd) document.getElementById('loading').style.display = 'none';
    }
  }

  // 追加：無限スクロール監視 (Intersection Observer)
  function initInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadVideos();
    }, { rootMargin: '400px' });
    observer.observe(document.getElementById('loading'));
  }

  // 既存：チャンネル情報取得
  async function fetchChannelInfo() {
    try {
      const res = await fetch(\`/api/inv/channel/\${encodeURIComponent(CHANNEL_NAME)}\`);
      const data = await res.json();
      const c = Array.isArray(data) ? data[0] : data;
      if (c) {
        if (c.authorThumbnails?.length) {
          const avatarSrc = c.authorThumbnails[c.authorThumbnails.length-1].url;
          channelAvatarUrl = avatarSrc; // renderVideos で使用
          const img = document.getElementById('channelAvatarImg');
          img.src = avatarSrc;
          img.onload = () => { img.classList.add('loaded'); document.getElementById('avatarInitial').style.display='none'; };
        }
        if (c.description) document.getElementById('channelDescription').textContent = c.description;
        if (c.subCount) document.getElementById('subCount').textContent = c.subCount + ' 人の登録者';
      }
    } catch(e) {}
  }

  // 初期化
  async function init() {
    updateSubscribeUI();
    await fetchChannelInfo();
    await loadVideos(); // 初回20件
    initInfiniteScroll(); // 以降自動
  }
  init();
</script>
</body>
</html>`;
  res.send(html);
});


app.get('/stream/inv/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const now = Date.now();

    if (videoCache.has(videoId)) {
        const cached = videoCache.get(videoId);
        if (now < cached.expiry) {
            return res.type('text/plain').send(cached.url);
        }
    }

    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    try {
        const configRes = await fetch("https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/assist/inv-check.txt");
        const extraParams = (await configRes.text()).trim(); 
        
        const targetUrl = `https://yt-comp5.chocolatemoo53.com/companion/latest_version?id=${videoId}${extraParams}`;

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                "User-Agent": randomUA,
                "Accept": "*/*"
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const finalUrl = response.url;


        videoCache.set(videoId, {
            url: finalUrl,
            expiry: now + 60000
        });

        res.type('text/plain').send(finalUrl);

    } catch (error) {
        console.error('Error fetching the URL:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/img/:videoId", (req, res) => {
    const { videoId } = req.params;

    const url = `https://i3.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    https.get(url, (ytRes) => {
        if (ytRes.statusCode !== 200) {
            res.status(ytRes.statusCode).send("Failed to fetch image");
            return;
        }

        res.setHeader("Content-Type", "image/jpeg");

        // サーバー負荷を軽減するためそのままデータを転送してます
        ytRes.pipe(res);

    }).on("error", (err) => {
        console.error("Image proxy error:", err);
        res.status(500).send("Proxy error");
    });
});

app.get('/stream-network/:videoId', (req, res) => {
    const videoId = req.params.videoId;
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;
    const responseText = `${baseUrl}/proxy/embed.html#https://www.youtube-nocookie.com/embed/${videoId}`;
    res.send(responseText);
});

app.get("/abyss.png", (req, res) => {
  const filePath = path.join(__dirname, "img", "abyss.png");
  res.sendFile(filePath);
});



app.get('/get-other/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    const apiOrder = shuffleArray(Object.keys(apiHandlers));
    
    let result = null;
    let errors = [];

    for (const apiName of apiOrder) {
        try {
            console.log(`Trying API: ${apiName}`);
            result = await apiHandlers[apiName](videoId);
            if (result) {
                result.provider = apiName;
                break; 
            }
        } catch (error) {
            console.error(`❌ ${apiName} failed: ${error.message}`);
            errors.push({ api: apiName, error: error.message });
        }
    }

    if (!result) {
        return res.status(500).json({
            success: false,
            message: "えらー",
            details: errors
        });
    }

    try {
        const seenUrls = new Set();
        if (result.stream_url) seenUrls.add(result.stream_url);

        result.streamUrls = (result.streamUrls || []).filter(s => {
            if (!s.url || seenUrls.has(s.url)) return false;
            seenUrls.add(s.url);
            
            if (s.resolution) {
                s.resolution = String(s.resolution).replace(/ \(.+\)/g, '').trim();
                if (s.fps && s.resolution.endsWith(String(s.fps))) {
                    s.resolution = s.resolution.slice(0, -String(s.fps).length).trim();
                }
            }
            
            if (s.url.includes('.m3u8') || s.url.includes('manifest')) {
                s.container = 'm3u8';
            }
            return true;
        });

        const isInvalid = (url) => !url || url.includes('manifest') || url.includes('.m3u8');
        if (isInvalid(result.audioUrl)) {
            result.audioUrl = '';
            result.audioUrls = [];
        } else {
            result.audioUrls = (result.audioUrls || []).filter(s => !isInvalid(s.url));
        }

        return res.json({
            success: true,
            data: result
        });

    } catch (cleanError) {
        return res.json({
            success: true,
            data: result,
            note: "Cleaning process partially failed"
        });
    }
});

const calculateScore = (v) => {
    const [major, minor, patch] = v.split('.').map(Number);
    return (major * 1000) + (minor * 100) + (patch * 10);
};

app.get('/check-version', async (req, res) => {
    const remoteUrl = 'https://raw.githubusercontent.com/woolisbest-honke/min-wlyt-plus/refs/heads/main/public/raw/version.json';
    const localPath = path.join(__dirname, 'public', 'raw', 'version.json');

    try {
        const [remoteRes, localRaw] = await Promise.all([
            fetch(remoteUrl),
            fs.promises.readFile(localPath, 'utf8')
        ]);

        if (!remoteRes.ok) throw new Error('Could not reach remote version server');
        
        const remoteData = await remoteRes.json();
        const localData = JSON.parse(localRaw);

        const latestVersion = remoteData.version;
        const currentVersion = localData.version;


        const latestScore = calculateScore(latestVersion);
        const currentScore = calculateScore(currentVersion);
        

        const updateDiff = Math.max(0, latestScore - currentScore);


        res.json({
            is_latest: currentScore >= latestScore,
            latest_version: latestVersion,
            current_version: currentVersion,
            updates_count: updateDiff,
            status: "success"
        });

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

const memoryCache = new Map();
const CACHE_TTL = 10 * 60 * 100; 
const MAX_CACHE_SIZE = 50;      


function setCache(key, value) {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data: value, timestamp: Date.now() });
}

const isValidId = (id) => /^[a-zA-Z0-9_-]{11}$/.test(id); 
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";


app.get("/short-check/:id", async (req, res) => {
  const videoId = req.params.id;

  if (!isValidId(videoId)) {
    return res.status(400).json({ error: "Invalid video ID format" });
  }

  const cacheKey = `short:${videoId}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return res.json(cached.data);
  }

  try {
    const response = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT }
    });

    if (response.status === 429) {
      return res.status(429).json({ error: "YouTube rate limit exceeded." });
    }

    let isShort = false;
    let exists = true;

    if (response.status === 200) {
      isShort = true;
    } else if (response.status === 302 || response.status === 303) {
      isShort = false; 
    } else if (response.status === 404) {
      exists = false;
    }

    const result = { videoId, exists, isShort };
    setCache(cacheKey, result);

    res.setHeader("Cache-Control", "public, max-age=180, s-maxage=300");
    return res.json(result);

  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/api/1-search", async (req, res, next) => {
  const query = req.query.q;
  const startPage = Number(req.query.page) || 0;

  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  try {
    const maxPages = 5;
    let foundVideo = null;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const results = await yts.GetListByKeyword(query, false, 20, page);

      const items = Array.isArray(results?.items) ? results.items : [];

      for (const item of items) {
        const id = String(item?.id || "");

        if (id.startsWith("UC")) continue;

        foundVideo = item;
        break;
      }

      if (foundVideo) break;
    }

    if (!foundVideo) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json(foundVideo);

  } catch (err) {
    next(err);
  }
});

/**
 * proxy/
 * ├── uv/ (sw.js, uv.bundle.js, etc.)
 * └── prxy/
 *     ├── baremux/ (index.js, worker.js, etc.)
 *     ├── epoxy/ (index.js, etc.)
 *     ├── libcurl/ (index.js, etc.)
 *     └── register-sw.mjs
 */
app.use('/proxy', express.static(PROXY_DIR));
app.use('/uv', express.static(path.join(PROXY_DIR, 'uv')));
app.use('/prxy', express.static(path.join(PROXY_DIR, 'prxy')));

app.use((req, res, next) => {
    if (res.headersSent) return next();

    const targetPath = path.join(PROXY_DIR, req.path);
    const normalizedPath = path.normalize(targetPath);

    if (!normalizedPath.startsWith(PROXY_DIR)) {
        return next();
    }

    if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isFile()) {
        return res.sendFile(targetPath);
    }

    next();
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "public", "error.html")));
app.use((err, req, res, next) => {
  res.status(500).sendFile(path.join(__dirname, "public", "error.html"));
});

// HTTP リクエストの紐付け
server.on('request', (req, res) => {
  app(req, res);
});

// Wisp WebSocket 処理（自前Wispサーバー）
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/') || req.url.startsWith('/wisp')) {
    if (wispServer && wispServer.server && typeof wispServer.server.routeRequest === 'function') {
      wispServer.server.routeRequest(req, socket, head);
    } else {
      socket.end();
    }
  } else {
    socket.end();
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Server is running on port ${port}`));
