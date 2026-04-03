/**
 * LOTRO Chat Logger - Cloudflare Worker
 *
 * API Endpoints:
 *   POST /api/chat          - Receive new chat lines (from watcher)
 *   GET  /api/days           - List all days with chat logs
 *   GET  /api/chat/:date     - Get all chat lines for a date (YYYY-MM-DD)
 *   GET  /api/chat/:date/since/:index - Get lines since index (for live polling)
 *
 * Pages:
 *   /                        - Day list (index)
 *   /day/:date               - Chat view for a specific day
 */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers for local development
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- API Routes ---

      if (path === "/api/chat" && req.method === "POST") {
        return handlePostChat(req, env, corsHeaders);
      }

      if (path === "/api/days") {
        return handleGetDays(env, corsHeaders);
      }

      const chatMatch = path.match(/^\/api\/chat\/(\d{4}-\d{2}-\d{2})$/);
      if (chatMatch) {
        return handleGetChat(chatMatch[1], env, corsHeaders);
      }

      const sinceMatch = path.match(
        /^\/api\/chat\/(\d{4}-\d{2}-\d{2})\/since\/(\d+)$/
      );
      if (sinceMatch) {
        return handleGetChatSince(sinceMatch[1], parseInt(sinceMatch[2]), env, corsHeaders);
      }

      // --- Page Routes ---

      if (path === "/" || path === "/index.html") {
        return new Response(renderIndexPage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const dayMatch = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
      if (dayMatch) {
        return new Response(renderDayPage(dayMatch[1]), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};

// --- API Handlers ---

async function handlePostChat(req, env, corsHeaders) {
  // Authenticate
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = await req.json();
  const { date, lines } = body;

  if (!date || !lines || !Array.isArray(lines) || lines.length === 0) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Get existing chat data for this date
  const key = `chat:${date}`;
  const existing = await env.CHAT_KV.get(key, "json");
  const chatData = existing || { date, lines: [] };

  // Append new lines with an index
  for (const line of lines) {
    chatData.lines.push({
      ...line,
      index: chatData.lines.length,
      receivedAt: new Date().toISOString(),
    });
  }

  // Store updated data
  await env.CHAT_KV.put(key, JSON.stringify(chatData));

  // Update the day index
  await updateDayIndex(env, date);

  return new Response(
    JSON.stringify({ ok: true, totalLines: chatData.lines.length }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

async function updateDayIndex(env, date) {
  const indexKey = "index:days";
  const existing = await env.CHAT_KV.get(indexKey, "json");
  const days = existing || [];

  if (!days.includes(date)) {
    days.push(date);
    days.sort().reverse(); // newest first
    await env.CHAT_KV.put(indexKey, JSON.stringify(days));
  }
}

async function handleGetDays(env, corsHeaders) {
  const days = (await env.CHAT_KV.get("index:days", "json")) || [];
  return new Response(JSON.stringify({ days }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleGetChat(date, env, corsHeaders) {
  const data = await env.CHAT_KV.get(`chat:${date}`, "json");
  if (!data) {
    return new Response(JSON.stringify({ date, lines: [] }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleGetChatSince(date, sinceIndex, env, corsHeaders) {
  const data = await env.CHAT_KV.get(`chat:${date}`, "json");
  if (!data) {
    return new Response(JSON.stringify({ date, lines: [], total: 0 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const newLines = data.lines.filter((l) => l.index >= sinceIndex);
  return new Response(
    JSON.stringify({ date, lines: newLines, total: data.lines.length }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

// --- HTML Templates ---

function renderIndexPage() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOTRO Chat Archiv</title>
  <style>${getSharedStyles()}
    .day-list {
      list-style: none;
      padding: 0;
    }
    .day-list li {
      margin: 0;
    }
    .day-list a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      color: #c8b06b;
      text-decoration: none;
      border-bottom: 1px solid #2a2520;
      transition: background-color 0.2s;
    }
    .day-list a:hover {
      background-color: #2a2520;
    }
    .day-date {
      font-family: 'Courier New', monospace;
      font-size: 1.1em;
      font-weight: bold;
    }
    .day-weekday {
      color: #8a7e6b;
      font-size: 0.9em;
    }
    .live-badge {
      background: #4a7c3f;
      color: #d4e8c8;
      font-size: 0.75em;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: auto;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #8a7e6b;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #8a7e6b;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>LOTRO Chat Archiv</h1>
      <p class="subtitle">Mittelerde-Chatprotokoll</p>
    </header>
    <main>
      <div id="day-list" class="loading">Lade Tage...</div>
    </main>
  </div>
  <script>
    const WEEKDAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

    async function loadDays() {
      try {
        const resp = await fetch('/api/days');
        const data = await resp.json();
        const container = document.getElementById('day-list');

        if (!data.days || data.days.length === 0) {
          container.innerHTML = '<div class="empty-state"><p>Noch keine Chat-Logs vorhanden.</p><p>Starte den Watcher, um Chats aufzuzeichnen.</p></div>';
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        let html = '<ul class="day-list">';
        for (const day of data.days) {
          const d = new Date(day + 'T12:00:00');
          const weekday = WEEKDAYS[d.getDay()];
          const isToday = day === today;
          html += '<li><a href="/day/' + day + '">';
          html += '<span class="day-date">' + day + '</span>';
          html += '<span class="day-weekday">' + weekday + '</span>';
          if (isToday) {
            html += '<span class="live-badge">LIVE</span>';
          }
          html += '</a></li>';
        }
        html += '</ul>';
        container.innerHTML = html;
      } catch (err) {
        document.getElementById('day-list').innerHTML =
          '<div class="empty-state"><p>Fehler beim Laden: ' + err.message + '</p></div>';
      }
    }

    loadDays();
    // Refresh day list every 30 seconds
    setInterval(loadDays, 30000);
  </script>
</body>
</html>`;
}

function renderDayPage(date) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOTRO Chat - ${date}</title>
  <style>${getSharedStyles()}
    .back-link {
      display: inline-block;
      color: #8a7e6b;
      text-decoration: none;
      padding: 10px 0;
      margin-bottom: 10px;
    }
    .back-link:hover {
      color: #c8b06b;
    }
    .chat-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .chat-header h2 {
      margin: 0;
      color: #c8b06b;
    }
    .live-indicator {
      background: #4a7c3f;
      color: #d4e8c8;
      font-size: 0.8em;
      padding: 3px 10px;
      border-radius: 10px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .chat-container {
      background: #1a1612;
      border: 1px solid #2a2520;
      border-radius: 8px;
      padding: 0;
      max-height: 75vh;
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .chat-line {
      padding: 4px 16px;
      border-bottom: 1px solid #1f1b17;
      font-size: 0.95em;
      line-height: 1.5;
      transition: background-color 0.3s;
    }
    .chat-line:last-child {
      border-bottom: none;
    }
    .chat-line:hover {
      background-color: #221e1a;
    }
    .chat-line.new-line {
      background-color: #2a2a1a;
    }
    .chat-time {
      color: #5a5448;
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      margin-right: 8px;
    }
    .chat-channel {
      font-size: 0.8em;
      padding: 1px 6px;
      border-radius: 3px;
      margin-right: 6px;
      font-weight: bold;
    }
    .ch-Kinship, .ch-Sippe { background: #2d4a2d; color: #7cb87c; }
    .ch-Fellowship, .ch-Gemeinschaft { background: #4a4a2d; color: #b8b87c; }
    .ch-Say, .ch-Sagen { background: #4a3d2d; color: #b8a87c; }
    .ch-World, .ch-Welt { background: #2d3d4a; color: #7ca8b8; }
    .ch-Trade, .ch-Handel { background: #4a2d4a; color: #b87cb8; }
    .ch-LFF, .ch-GSG { background: #4a2d2d; color: #b87c7c; }
    .ch-Regional { background: #2d4a4a; color: #7cb8b8; }
    .ch-Tell, .ch-Sagen { background: #4a3d2d; color: #e8c87c; }
    .ch-OOC { background: #3d3d3d; color: #a8a8a8; }
    .ch-System { background: #3d2d2d; color: #a87c7c; }
    .ch-Unknown { background: #2d2d2d; color: #8a8a8a; }
    .chat-sender {
      color: #d4a857;
      font-weight: bold;
      margin-right: 4px;
    }
    .chat-sender.system {
      color: #a87c7c;
      font-style: italic;
    }
    .chat-message {
      color: #d4cfc4;
    }
    .line-count {
      color: #5a5448;
      font-size: 0.85em;
      margin-top: 8px;
    }
    .empty-chat {
      text-align: center;
      padding: 40px;
      color: #8a7e6b;
    }
    .auto-scroll-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #8a7e6b;
      font-size: 0.85em;
      margin-top: 8px;
    }
    .auto-scroll-toggle input {
      accent-color: #c8b06b;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">&larr; Alle Tage</a>
    <div class="chat-header">
      <h2>${date}</h2>
      <span id="live-badge" class="live-indicator" style="display:none">LIVE</span>
    </div>
    <div class="chat-container" id="chat-container"></div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span class="line-count" id="line-count"></span>
      <label class="auto-scroll-toggle" id="scroll-toggle" style="display:none">
        <input type="checkbox" id="auto-scroll" checked>
        Auto-Scroll
      </label>
    </div>
  </div>
  <script>
    const DATE = '${date}';
    const TODAY = new Date().toISOString().slice(0, 10);
    const isLive = DATE === TODAY;
    let currentIndex = 0;
    let pollTimer = null;

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function renderLine(line, isNew) {
      const channelClass = 'ch-' + (line.channel || 'Unknown').replace(/[^a-zA-Z]/g, '');
      const senderClass = line.sender === 'System' ? ' system' : '';
      const newClass = isNew ? ' new-line' : '';
      return '<div class="chat-line' + newClass + '">'
        + '<span class="chat-time">[' + escapeHtml(line.time) + ']</span>'
        + '<span class="chat-channel ' + channelClass + '">' + escapeHtml(line.channel) + '</span>'
        + '<span class="chat-sender' + senderClass + '">' + escapeHtml(line.sender) + ':</span> '
        + '<span class="chat-message">' + escapeHtml(line.message) + '</span>'
        + '</div>';
    }

    async function loadChat() {
      try {
        const resp = await fetch('/api/chat/' + DATE);
        const data = await resp.json();
        const container = document.getElementById('chat-container');

        if (!data.lines || data.lines.length === 0) {
          container.innerHTML = '<div class="empty-chat">Noch keine Nachrichten fuer diesen Tag.</div>';
          document.getElementById('line-count').textContent = '0 Nachrichten';
          return;
        }

        let html = '';
        for (const line of data.lines) {
          html += renderLine(line, false);
        }
        container.innerHTML = html;
        currentIndex = data.lines.length;
        document.getElementById('line-count').textContent = currentIndex + ' Nachrichten';

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Start live polling if today
        if (isLive) {
          document.getElementById('live-badge').style.display = '';
          document.getElementById('scroll-toggle').style.display = '';
          startPolling();
        }
      } catch (err) {
        document.getElementById('chat-container').innerHTML =
          '<div class="empty-chat">Fehler beim Laden: ' + err.message + '</div>';
      }
    }

    async function pollForUpdates() {
      try {
        const resp = await fetch('/api/chat/' + DATE + '/since/' + currentIndex);
        const data = await resp.json();

        if (data.lines && data.lines.length > 0) {
          const container = document.getElementById('chat-container');
          const wasEmpty = container.querySelector('.empty-chat');
          if (wasEmpty) container.innerHTML = '';

          for (const line of data.lines) {
            container.insertAdjacentHTML('beforeend', renderLine(line, true));
            // Remove highlight after animation
            setTimeout(() => {
              const lines = container.querySelectorAll('.new-line');
              lines.forEach(el => el.classList.remove('new-line'));
            }, 3000);
          }

          currentIndex = data.total;
          document.getElementById('line-count').textContent = currentIndex + ' Nachrichten';

          // Auto-scroll if enabled
          if (document.getElementById('auto-scroll').checked) {
            container.scrollTop = container.scrollHeight;
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pollForUpdates, 3000);
    }

    loadChat();
  </script>
</body>
</html>`;
}

function getSharedStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #0f0d0a;
      color: #c8c0b0;
      min-height: 100vh;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 30px 0 20px;
      border-bottom: 2px solid #2a2520;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #c8b06b;
      font-size: 1.8em;
      letter-spacing: 2px;
    }
    .subtitle {
      color: #8a7e6b;
      font-size: 0.9em;
      margin-top: 6px;
    }
    ::-webkit-scrollbar {
      width: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #1a1612;
    }
    ::-webkit-scrollbar-thumb {
      background: #3a3530;
      border-radius: 4px;
    }
    ::selection {
      background: #4a3d20;
      color: #e8d8a0;
    }
  `;
}
