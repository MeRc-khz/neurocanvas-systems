/**
 * NeuroCanvas v2 — Visual HTML Editor
 * 2D infinite board + WYSIWYG page editor + 3D project galaxy
 * Pure Canvas 2D + Three.js, no framework dependency
 */

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const API = '/nc-api';

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
const state = {
  projects: [],
  activeProject: null,
  activePage: null,
  view: 'board',       // 'board' | 'edit' | 'galaxy'
  board: { x: 0, y: 0, zoom: 1, dragging: false, dragStart: { x: 0, y: 0 } },
  editor: { tool: 'select', selectedElement: null, clipboard: null },
  galaxy: { rotation: 0, targetRotation: 0 },
  syncConfig: { type: 'api', host: '', path: '', username: '', password: '', apiKey: '' }
};

// ═══════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok && res.status !== 201) throw new Error(`API ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════
// DOM SETUP
// ═══════════════════════════════════════════════════════════
const app = document.getElementById('app');
app.innerHTML = `
<div id="nc-root">
  <header id="nc-header">
    <div id="nc-logo">
      <span class="nc-logo-icon">◈</span>
      <span class="nc-logo-text">NeuroCanvas</span>
    </div>
    <nav id="nc-nav">
      <button class="nc-nav-btn active" data-view="board" title="2D Board">⊞ Board</button>
      <button class="nc-nav-btn" data-view="galaxy" title="3D Galaxy">✦ Galaxy</button>
      <button class="nc-nav-btn" data-view="sync" title="Sync Wiki">↕ Sync</button>
    </nav>
    <div id="nc-header-actions">
      <button id="nc-new-project" class="nc-btn nc-btn-primary">+ New Project</button>
    </div>
  </header>

  <main id="nc-main">
    <!-- Board View: 2D infinite canvas with page thumbnails -->
    <div id="nc-board-view" class="nc-view active">
      <div id="nc-board-canvas-wrap">
        <canvas id="nc-board-canvas"></canvas>
      </div>
      <div id="nc-board-hud">
        <div id="nc-zoom-controls">
          <button id="nc-zoom-out">−</button>
          <span id="nc-zoom-level">100%</span>
          <button id="nc-zoom-in">+</button>
          <button id="nc-zoom-fit">⊡ Fit</button>
        </div>
        <div id="nc-page-count">0 pages</div>
      </div>
      <div id="nc-add-page-fab" title="Add Page">+</div>
    </div>

    <!-- Editor View: WYSIWYG HTML page editor -->
    <div id="nc-editor-view" class="nc-view">
      <div id="nc-editor-toolbar">
        <div class="nc-toolbar-group">
          <button class="nc-tool-btn active" data-tool="select" title="Select (V)">↖</button>
          <button class="nc-tool-btn" data-tool="text" title="Text (T)">T</button>
          <button class="nc-tool-btn" data-tool="image" title="Image (I)">🖼</button>
          <button class="nc-tool-btn" data-tool="audio" title="Audio (A)">🔊</button>
          <button class="nc-tool-btn" data-tool="video" title="Video (M)">▶</button>
          <button class="nc-tool-btn" data-tool="table" title="Table (B)">⊞</button>
          <button class="nc-tool-btn" data-tool="shape" title="Shape (S)">□</button>
        </div>
        <div class="nc-toolbar-group">
          <button id="nc-undo" title="Undo">↩</button>
          <button id="nc-redo" title="Redo">↪</button>
          <button id="nc-delete-el" title="Delete">🗑</button>
        </div>
        <div class="nc-toolbar-group">
          <button id="nc-save-page" class="nc-btn nc-btn-primary">Save</button>
          <button id="nc-back-board" class="nc-btn">← Back</button>
        </div>
      </div>
      <div id="nc-editor-canvas-wrap">
        <canvas id="nc-editor-canvas"></canvas>
      </div>
      <div id="nc-editor-properties">
        <h3>Properties</h3>
        <div id="nc-props-content">
          <p class="nc-hint">Select an element to edit properties</p>
        </div>
      </div>
    </div>

    <!-- Galaxy View: 3D project visualization -->
    <div id="nc-galaxy-view" class="nc-view">
      <div id="nc-galaxy-canvas-wrap">
        <canvas id="nc-galaxy-canvas"></canvas>
      </div>
      <div id="nc-galaxy-hud">
        <div id="nc-project-list"></div>
      </div>
    </div>

    <!-- Sync View: Remote wiki connection -->
    <div id="nc-sync-view" class="nc-view">
      <div id="nc-sync-panel">
        <h2>↕ Sync Remote Wiki</h2>
        <p class="nc-hint">Connect to a remote knowledge base via FTP, SCP, or API endpoint.</p>

        <div class="nc-form-group">
          <label>Connection Type</label>
          <select id="nc-sync-type">
            <option value="api">API Endpoint</option>
            <option value="scp">SCP (SSH)</option>
            <option value="ftp">FTP</option>
          </select>
        </div>

        <div class="nc-form-group">
          <label>Host / URL</label>
          <input id="nc-sync-host" type="text" placeholder="https://example.com or 192.168.1.100" />
        </div>

        <div class="nc-form-group" id="nc-sync-api-group">
          <label>API Path</label>
          <input id="nc-sync-path" type="text" placeholder="/api/wiki/pages" />
        </div>

        <div class="nc-form-group" id="nc-sync-apikey-group">
          <label>API Key (optional)</label>
          <input id="nc-sync-apikey" type="text" placeholder="Bearer token..." />
        </div>

        <div class="nc-form-group nc-sync-cred" style="display:none">
          <label>Username</label>
          <input id="nc-sync-user" type="text" placeholder="Username" />
        </div>

        <div class="nc-form-group nc-sync-cred" style="display:none">
          <label>Password</label>
          <input id="nc-sync-pass" type="password" placeholder="Password" />
        </div>

        <div class="nc-form-group nc-sync-cred" style="display:none">
          <label>Remote Path</label>
          <input id="nc-sync-remote-path" type="text" placeholder="/var/wiki/pages" />
        </div>

        <div class="nc-form-group">
          <label>Target Project</label>
          <select id="nc-sync-target-project">
            <option value="new">Create New Project</option>
          </select>
        </div>

        <button id="nc-sync-start" class="nc-btn nc-btn-primary nc-btn-large">Start Sync</button>

        <div id="nc-sync-status"></div>
        <div id="nc-sync-results"></div>
      </div>
    </div>
  </main>

  <!-- Project sidebar -->
  <aside id="nc-sidebar">
    <div id="nc-sidebar-header">
      <h3>Projects</h3>
      <button id="nc-sidebar-toggle" title="Toggle sidebar">◀</button>
    </div>
    <div id="nc-project-list"></div>
  </aside>

  <!-- Modals -->
  <div id="nc-modal-overlay" class="nc-hidden">
    <div id="nc-modal"></div>
  </div>
</div>
`;

// ═══════════════════════════════════════════════════════════
// STYLES (injected)
// ═══════════════════════════════════════════════════════════
const style = document.createElement('style');
style.textContent = `
#nc-root {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 240px 1fr;
  height: 100vh;
  background: #0a0a0a;
  color: #e0e0e0;
  font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* Header */
#nc-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #111;
  border-bottom: 1px solid #222;
  gap: 24px;
  z-index: 100;
}
#nc-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; }
.nc-logo-icon { color: #2bee8c; font-size: 20px; }
.nc-logo-text { letter-spacing: 0.5px; }
#nc-nav { display: flex; gap: 4px; }
.nc-nav-btn {
  background: transparent; border: none; color: #888;
  padding: 6px 14px; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 500; transition: all 0.15s;
}
.nc-nav-btn:hover { background: #1a1a1a; color: #ccc; }
.nc-nav-btn.active { background: #1c2721; color: #2bee8c; }
#nc-header-actions { margin-left: auto; }

/* Buttons */
.nc-btn {
  background: #1a1a1a; border: 1px solid #333; color: #ccc;
  padding: 6px 14px; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 500; transition: all 0.15s;
}
.nc-btn:hover { background: #252525; color: #fff; }
.nc-btn-primary { background: #2bee8c; color: #0a0a0a; border-color: #2bee8c; }
.nc-btn-primary:hover { background: #3dff9e; }
.nc-btn-large { padding: 10px 24px; font-size: 14px; width: 100%; }

/* Sidebar */
#nc-sidebar {
  background: #0f0f0f;
  border-right: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s;
}
#nc-sidebar.collapsed { width: 40px; }
#nc-sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid #1a1a1a;
}
#nc-sidebar-header h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
#nc-sidebar-toggle { background: none; border: none; color: #666; cursor: pointer; font-size: 12px; }
#nc-project-list { flex: 1; overflow-y: auto; padding: 8px; }
.nc-project-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  margin-bottom: 4px; transition: background 0.15s;
  border: 1px solid transparent;
}
.nc-project-item:hover { background: #1a1a1a; }
.nc-project-item.active { background: #1c2721; border-color: #2bee8c33; }
.nc-project-item-name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
.nc-project-item-meta { font-size: 11px; color: #555; }

/* Main area */
#nc-main { position: relative; overflow: hidden; }
.nc-view { display: none; position: absolute; inset: 0; }
.nc-view.active { display: block; }

/* Board view */
#nc-board-canvas-wrap { position: absolute; inset: 0; }
#nc-board-canvas { width: 100%; height: 100%; cursor: grab; }
#nc-board-canvas:active { cursor: grabbing; }
#nc-board-hud {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  background: #111111ee; border: 1px solid #333; border-radius: 12px;
  padding: 8px 16px; backdrop-filter: blur(10px);
}
#nc-zoom-controls { display: flex; align-items: center; gap: 8px; }
#nc-zoom-controls button {
  background: #222; border: 1px solid #333; color: #ccc;
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
#nc-zoom-controls button:hover { background: #333; }
#nc-zoom-level { font-size: 12px; color: #888; min-width: 40px; text-align: center; }
#nc-page-count { font-size: 12px; color: #666; }
#nc-add-page-fab {
  position: absolute; bottom: 16px; right: 16px;
  width: 56px; height: 56px; border-radius: 50%;
  background: #2bee8c; color: #0a0a0a;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; cursor: pointer; box-shadow: 0 4px 20px #2bee8c33;
  transition: transform 0.15s;
}
#nc-add-page-fab:hover { transform: scale(1.1); }

/* Page thumbnail on board */
.nc-page-thumb {
  position: absolute;
  background: #161616;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.nc-page-thumb:hover {
  border-color: #2bee8c;
  box-shadow: 0 0 20px #2bee8c22;
}
.nc-page-thumb-preview {
  width: 100%; height: 140px;
  background: #0a0a0a;
  border-bottom: 1px solid #222;
  overflow: hidden;
  position: relative;
}
.nc-page-thumb-preview iframe {
  width: 400%; height: 400%;
  transform: scale(0.25);
  transform-origin: top left;
  border: none;
  pointer-events: none;
}
.nc-page-thumb-label {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Editor view */
#nc-editor-view { display: flex; flex-direction: column; }
#nc-editor-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: #111;
  border-bottom: 1px solid #222;
}
.nc-toolbar-group { display: flex; align-items: center; gap: 4px; padding-right: 12px; border-right: 1px solid #222; }
.nc-toolbar-group:last-child { border-right: none; }
.nc-tool-btn, #nc-editor-toolbar button {
  background: transparent; border: 1px solid transparent; color: #888;
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
  font-size: 13px; min-width: 32px;
}
.nc-tool-btn:hover, #nc-editor-toolbar button:hover { background: #1a1a1a; color: #ccc; }
.nc-tool-btn.active { background: #1c2721; color: #2bee8c; border-color: #2bee8c33; }
#nc-editor-canvas-wrap { flex: 1; position: relative; }
#nc-editor-canvas { width: 100%; height: 100%; }
#nc-editor-properties {
  width: 260px; background: #0f0f0f;
  border-left: 1px solid #1a1a1a;
  padding: 16px; overflow-y: auto;
  position: absolute; right: 0; top: 0; bottom: 0;
}
#nc-editor-properties h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 12px; }
.nc-prop-group { margin-bottom: 12px; }
.nc-prop-group label { display: block; font-size: 11px; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.nc-prop-group input, .nc-prop-group select, .nc-prop-group textarea {
  width: 100%; background: #1a1a1a; border: 1px solid #333; color: #ccc;
  padding: 6px 8px; border-radius: 4px; font-size: 13px;
  box-sizing: border-box;
}
.nc-prop-group input:focus, .nc-prop-group select:focus { border-color: #2bee8c; outline: none; }

/* Galaxy view */
#nc-galaxy-canvas-wrap { position: absolute; inset: 0; }
#nc-galaxy-canvas { width: 100%; height: 100%; }
#nc-galaxy-hud {
  position: absolute; top: 16px; left: 16px;
  background: #111111dd; border: 1px solid #333; border-radius: 12px;
  padding: 16px; max-width: 280px; max-height: 60vh; overflow-y: auto;
}
#nc-galaxy-hud h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 8px; }

/* Sync view */
#nc-sync-view { overflow-y: auto; padding: 32px; }
#nc-sync-panel {
  max-width: 520px; margin: 0 auto;
  background: #111; border: 1px solid #222; border-radius: 16px;
  padding: 32px;
}
#nc-sync-panel h2 { font-size: 20px; margin-bottom: 8px; }
.nc-form-group { margin-bottom: 16px; }
.nc-form-group label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.nc-form-group input, .nc-form-group select {
  width: 100%; background: #1a1a1a; border: 1px solid #333; color: #ccc;
  padding: 10px 12px; border-radius: 8px; font-size: 14px;
  box-sizing: border-box;
}
.nc-form-group input:focus, .nc-form-group select:focus { border-color: #2bee8c; outline: none; }
#nc-sync-status { margin-top: 16px; padding: 12px; background: #1a1a1a; border-radius: 8px; font-size: 13px; display: none; }
#nc-sync-results { margin-top: 12px; }
.nc-sync-result-item { padding: 8px 12px; background: #1a1a1a; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }

/* Modal */
#nc-modal-overlay {
  position: fixed; inset: 0; background: #000000aa;
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
#nc-modal {
  background: #111; border: 1px solid #333; border-radius: 16px;
  padding: 24px; min-width: 400px; max-width: 600px;
}
.nc-hidden { display: none !important; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #444; }

.nc-hint { font-size: 13px; color: #555; }
`;
document.head.appendChild(style);

// ═══════════════════════════════════════════════════════════
// BOARD VIEW — 2D Infinite Canvas
// ═══════════════════════════════════════════════════════════
const boardCanvas = document.getElementById('nc-board-canvas');
const boardCtx = boardCanvas.getContext('2d');

function resizeBoard() {
  boardCanvas.width = boardCanvas.clientWidth * devicePixelRatio;
  boardCanvas.height = boardCanvas.clientHeight * devicePixelRatio;
  boardCtx.scale(devicePixelRatio, devicePixelRatio);
  renderBoard();
}

function renderBoard() {
  const w = boardCanvas.clientWidth;
  const h = boardCanvas.clientHeight;
  const { x, y, zoom } = state.board;

  boardCtx.clearRect(0, 0, w, h);

  // Grid
  boardCtx.save();
  boardCtx.translate(w / 2, h / 2);
  boardCtx.scale(zoom, zoom);
  boardCtx.translate(x, y);

  const gridSize = 50;
  const startX = Math.floor((-w / 2 / zoom - x) / gridSize) * gridSize;
  const startY = Math.floor((-h / 2 / zoom - y) / gridSize) * gridSize;
  const endX = Math.ceil((w / 2 / zoom - x) / gridSize) * gridSize;
  const endY = Math.ceil((h / 2 / zoom - y) / gridSize) * gridSize;

  boardCtx.strokeStyle = '#1a1a1a';
  boardCtx.lineWidth = 1;
  for (let gx = startX; gx <= endX; gx += gridSize) {
    boardCtx.beginPath();
    boardCtx.moveTo(gx, startY);
    boardCtx.lineTo(gx, endY);
    boardCtx.stroke();
  }
  for (let gy = startY; gy <= endY; gy += gridSize) {
    boardCtx.beginPath();
    boardCtx.moveTo(startX, gy);
    boardCtx.lineTo(endX, gy);
    boardCtx.stroke();
  }

  // Origin crosshair
  boardCtx.strokeStyle = '#2bee8c33';
  boardCtx.lineWidth = 1;
  boardCtx.beginPath();
  boardCtx.moveTo(-20, 0);
  boardCtx.lineTo(20, 0);
  boardCtx.moveTo(0, -20);
  boardCtx.lineTo(0, 20);
  boardCtx.stroke();

  // Page thumbnails
  if (state.activeProject) {
    const pages = Object.values(state.activeProject.pages || {});
    document.getElementById('nc-page-count').textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;

    pages.forEach((page, i) => {
      const px = page.x || (i % 5) * 220 - 440;
      const py = page.y || Math.floor(i / 5) * 200 - 300;
      const pw = 200;
      const ph = 160;

      // Card background
      boardCtx.fillStyle = '#161616';
      boardCtx.strokeStyle = state.activePage === page.id ? '#2bee8c' : '#2a2a2a';
      boardCtx.lineWidth = state.activePage === page.id ? 2 : 1;
      roundRect(boardCtx, px, py, pw, ph, 10);
      boardCtx.fill();
      boardCtx.stroke();

      // Preview area
      boardCtx.fillStyle = '#0a0a0a';
      boardCtx.fillRect(px + 1, py + 1, pw - 2, 120);

      // Render HTML preview into card
      renderPagePreview(boardCtx, page, px + 4, py + 4, pw - 8, 116);

      // Title
      boardCtx.fillStyle = '#ccc';
      boardCtx.font = '600 11px Space Grotesk, sans-serif';
      boardCtx.fillText(page.title || 'Untitled', px + 10, py + 140, pw - 20);
    });
  }

  boardCtx.restore();
}

function renderPagePreview(ctx, page, x, y, w, h) {
  // Simplified HTML rendering for thumbnail
  const html = page.html || '';

  // Extract text content
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);

  // Background gradient based on content
  const hue = (page.id.charCodeAt(0) * 37) % 360;
  ctx.fillStyle = `hsl(${hue}, 20%, 8%)`;
  ctx.fillRect(x, y, w, h);

  // Render text preview
  ctx.fillStyle = '#666';
  ctx.font = '10px Space Grotesk, sans-serif';
  const lines = wrapText(ctx, textContent, w - 16);
  lines.slice(0, 5).forEach((line, i) => {
    ctx.fillText(line, x + 8, y + 16 + i * 13);
  });

  // Media indicators
  let indicatorX = x + 8;
  const indicators = [];
  if (html.includes('<img') || html.includes('background-image')) indicators.push('🖼');
  if (html.includes('<audio') || html.includes('data-audio')) indicators.push('🔊');
  if (html.includes('<video') || html.includes('data-video')) indicators.push('▶');
  if (html.includes('<table')) indicators.push('⊞');

  if (indicators.length > 0) {
    ctx.font = '12px sans-serif';
    ctx.fillText(indicators.join(' '), indicatorX, y + h - 8);
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Board interactions
boardCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  state.board.zoom = Math.max(0.1, Math.min(5, state.board.zoom * delta));
  document.getElementById('nc-zoom-level').textContent = Math.round(state.board.zoom * 100) + '%';
  renderBoard();
});

boardCanvas.addEventListener('mousedown', (e) => {
  if (e.button === 0 || e.button === 1) {
    state.board.dragging = true;
    state.board.dragStart = { x: e.clientX - state.board.x * state.board.zoom, y: e.clientY - state.board.y * state.board.zoom };
    boardCanvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mousemove', (e) => {
  if (state.board.dragging) {
    state.board.x = (e.clientX - state.board.dragStart.x) / state.board.zoom;
    state.board.y = (e.clientY - state.board.dragStart.y) / state.board.zoom;
    renderBoard();
  }
});

window.addEventListener('mouseup', () => {
  state.board.dragging = false;
  boardCanvas.style.cursor = 'grab';
});

// Click on page thumbnails
boardCanvas.addEventListener('click', (e) => {
  if (!state.activeProject) return;
  const rect = boardCanvas.getBoundingClientRect();
  const mx = (rect.left + rect.width / 2);
  const my = (rect.top + rect.height / 2);

  const pages = Object.values(state.activeProject.pages || {});
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    const px = page.x || (i % 5) * 220 - 440;
    const py = page.y || Math.floor(i / 5) * 200 - 300;

    const screenX = mx + (px * state.board.zoom) + state.board.x * state.board.zoom;
    const screenY = my + (py * state.board.zoom) + state.board.y * state.board.zoom;
    const pw = 200 * state.board.zoom;
    const ph = 160 * state.board.zoom;

    if (e.clientX >= screenX && e.clientX <= screenX + pw && e.clientY >= screenY && e.clientY <= screenY + ph) {
      openPageEditor(page);
      return;
    }
  }
});

document.getElementById('nc-zoom-in').onclick = () => { state.board.zoom = Math.min(5, state.board.zoom * 1.2); document.getElementById('nc-zoom-level').textContent = Math.round(state.board.zoom * 100) + '%'; renderBoard(); };
document.getElementById('nc-zoom-out').onclick = () => { state.board.zoom = Math.max(0.1, state.board.zoom / 1.2); document.getElementById('nc-zoom-level').textContent = Math.round(state.board.zoom * 100) + '%'; renderBoard(); };
document.getElementById('nc-zoom-fit').onclick = () => { state.board.zoom = 1; state.board.x = 0; state.board.y = 0; document.getElementById('nc-zoom-level').textContent = '100%'; renderBoard(); };
document.getElementById('nc-add-page-fab').onclick = () => addPage();

// ═══════════════════════════════════════════════════════════
// EDITOR VIEW — WYSIWYG HTML Page Editor
// ═══════════════════════════════════════════════════════════
const editorCanvas = document.getElementById('nc-editor-canvas');
const editorCtx = editorCanvas.getContext('2d');
let editorElements = [];
let editorHistory = [];
let editorHistoryIndex = -1;

function openPageEditor(page) {
  state.activePage = page.id;
  state.view = 'edit';
  updateViewTabs();

  // Parse HTML into editable elements
  editorElements = parseHTMLToElements(page.html, page.width || 800, page.height || 600);
  saveEditorHistory();
  renderEditor();
}

function parseHTMLToElements(html, pageW, pageH) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = [];
  let y = 20;

  function processNode(node, depth = 0) {
    if (node.nodeType === 3 && node.textContent.trim()) {
      elements.push({
        type: 'text',
        x: 20, y: y, width: pageW - 40, height: 40,
        content: node.textContent.trim(),
        style: { fontSize: 16, color: '#e0e0e0', fontWeight: 'normal' }
      });
      y += 44;
    } else if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'h1') {
        elements.push({
          type: 'text', x: 20, y: y, width: pageW - 40, height: 60,
          content: node.textContent,
          style: { fontSize: 32, color: '#fff', fontWeight: 'bold' }
        });
        y += 68;
      } else if (tag === 'h2') {
        elements.push({
          type: 'text', x: 20, y: y, width: pageW - 40, height: 44,
          content: node.textContent,
          style: { fontSize: 24, color: '#ddd', fontWeight: 'bold' }
        });
        y += 50;
      } else if (tag === 'p') {
        elements.push({
          type: 'text', x: 20, y: y, width: pageW - 40, height: 36,
          content: node.textContent,
          style: { fontSize: 16, color: '#bbb', fontWeight: 'normal' }
        });
        y += 40;
      } else if (tag === 'img') {
        elements.push({
          type: 'image', x: 20, y: y, width: Math.min(400, pageW - 40), height: 200,
          src: node.getAttribute('src') || '',
          style: { borderRadius: 8 }
        });
        y += 210;
      } else if (tag === 'audio') {
        elements.push({
          type: 'audio', x: 20, y: y, width: pageW - 40, height: 48,
          src: node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '',
          style: {}
        });
        y += 56;
      } else if (tag === 'video') {
        elements.push({
          type: 'video', x: 20, y: y, width: Math.min(480, pageW - 40), height: 270,
          src: node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '',
          style: { borderRadius: 8 }
        });
        y += 280;
      } else if (tag === 'table') {
        const rows = node.querySelectorAll('tr');
        const rowCount = Math.min(rows.length, 8);
        const colCount = rows[0] ? rows[0].querySelectorAll('td, th').length : 1;
        elements.push({
          type: 'table', x: 20, y: y, width: pageW - 40, height: rowCount * 36 + 12,
          rows: Array.from(rows).slice(0, 8).map(r =>
            Array.from(r.querySelectorAll('td, th')).map(c => c.textContent.trim())
          ),
          style: { headerBg: '#1c2721', cellBg: '#111', borderColor: '#333' }
        });
        y += rowCount * 36 + 20;
      } else {
        // Recurse into containers
        node.childNodes.forEach(child => processNode(child, depth + 1));
      }
    }
  }

  doc.body.childNodes.forEach(n => processNode(n));

  // If nothing parsed, add a default text element
  if (elements.length === 0) {
    elements.push({
      type: 'text', x: 20, y: 20, width: pageW - 40, height: 40,
      content: 'Start typing...',
      style: { fontSize: 16, color: '#666', fontWeight: 'normal' }
    });
  }

  return elements;
}

function elementsToHTML(elements, pageW, pageH) {
  let html = `<div class="nc-page" style="width:${pageW}px;min-height:${pageH}px;background:#0a0a0a;color:#e0e0e0;padding:20px;">`;
  for (const el of elements) {
    if (el.type === 'text') {
      const tag = el.style.fontSize >= 28 ? 'h2' : el.style.fontSize >= 36 ? 'h1' : 'p';
      html += `<${tag} style="font-size:${el.style.fontSize}px;color:${el.style.color};font-weight:${el.style.fontWeight};margin:8px 0;">${el.content}</${tag}>`;
    } else if (el.type === 'image') {
      html += `<img src="${el.src}" style="width:${el.width}px;height:${el.height}px;border-radius:${el.style.borderRadius || 0}px;object-fit:cover;" />`;
    } else if (el.type === 'audio') {
      html += `<audio controls src="${el.src}" style="width:${el.width}px;"></audio>`;
    } else if (el.type === 'video') {
      html += `<video controls src="${el.src}" style="width:${el.width}px;height:${el.height}px;border-radius:${el.style.borderRadius || 0}px;"></video>`;
    } else if (el.type === 'table') {
      html += '<table style="width:100%;border-collapse:collapse;">';
      el.rows.forEach((row, ri) => {
        html += '<tr>';
        row.forEach(cell => {
          const tag = ri === 0 ? 'th' : 'td';
          html += `<${tag} style="padding:8px 12px;border:1px solid ${el.style.borderColor};background:${ri === 0 ? el.style.headerBg : el.style.cellBg};">${cell}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table>';
    }
  }
  html += '</div>';
  return html;
}

function renderEditor() {
  const w = editorCanvas.clientWidth;
  const h = editorCanvas.clientHeight;
  editorCanvas.width = w * devicePixelRatio;
  editorCanvas.height = h * devicePixelRatio;
  editorCtx.scale(devicePixelRatio, devicePixelRatio);
  editorCtx.clearRect(0, 0, w, h);

  // Page background
  const pageW = state.activeProject?.pages[state.activePage]?.width || 800;
  const pageH = state.activeProject?.pages[state.activePage]?.height || 600;
  const scale = Math.min((w - 80) / pageW, (h - 40) / pageH, 1);
  const ox = (w - pageW * scale) / 2;
  const oy = 20;

  editorCtx.save();
  editorCtx.translate(ox, oy);
  editorCtx.scale(scale, scale);

  // Page canvas
  editorCtx.fillStyle = '#0a0a0a';
  editorCtx.fillRect(0, 0, pageW, pageH);
  editorCtx.strokeStyle = '#222';
  editorCtx.lineWidth = 1;
  editorCtx.strokeRect(0, 0, pageW, pageH);

  // Render elements
  for (const el of editorElements) {
    renderEditorElement(editorCtx, el, el === state.editor.selectedElement);
  }

  editorCtx.restore();
}

function renderEditorElement(ctx, el, selected) {
  ctx.save();

  if (el.type === 'text') {
    ctx.fillStyle = el.style.color;
    ctx.font = `${el.style.fontWeight} ${el.style.fontSize}px Space Grotesk, sans-serif`;
    const lines = wrapText(ctx, el.content, el.width);
    lines.forEach((line, i) => {
      ctx.fillText(line, el.x, el.y + i * (el.style.fontSize * 1.3) + el.style.fontSize);
    });
  } else if (el.type === 'image') {
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, el.x, el.y, el.width, el.height, el.style.borderRadius || 0);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '14px sans-serif';
    ctx.fillText(el.src ? '🖼 Image' : '🖼 Drop image here', el.x + 10, el.y + el.height / 2);
    if (el.src) {
      ctx.fillStyle = '#555';
      ctx.font = '11px sans-serif';
      ctx.fillText(el.src.substring(0, 40), el.x + 10, el.y + el.height / 2 + 18);
    }
  } else if (el.type === 'audio') {
    ctx.fillStyle = '#111';
    roundRect(ctx, el.x, el.y, el.width, el.height, 6);
    ctx.fill();
    ctx.fillStyle = '#2bee8c';
    ctx.font = '13px sans-serif';
    ctx.fillText('🔊 ' + (el.src || 'Drop audio file...'), el.x + 12, el.y + 30);
  } else if (el.type === 'video') {
    ctx.fillStyle = '#111';
    roundRect(ctx, el.x, el.y, el.width, el.height, el.style.borderRadius || 0);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '32px sans-serif';
    ctx.fillText('▶', el.x + el.width / 2 - 10, el.y + el.height / 2 + 10);
    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.fillText(el.src || 'Drop video file...', el.x + 10, el.y + el.height - 10);
  } else if (el.type === 'table') {
    const rowH = 36;
    el.rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const cellW = el.width / row.length;
        ctx.fillStyle = ri === 0 ? el.style.headerBg : el.style.cellBg;
        ctx.fillRect(el.x + ci * cellW, el.y + ri * rowH, cellW, rowH);
        ctx.strokeStyle = el.style.borderColor;
        ctx.strokeRect(el.x + ci * cellW, el.y + ri * rowH, cellW, rowH);
        ctx.fillStyle = ri === 0 ? '#2bee8c' : '#bbb';
        ctx.font = `${ri === 0 ? '600' : 'normal'} 12px Space Grotesk, sans-serif`;
        ctx.fillText(cell, el.x + ci * cellW + 8, el.y + ri * rowH + 22);
      });
    });
  }

  // Selection border
  if (selected) {
    ctx.strokeStyle = '#2bee8c';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
    ctx.setLineDash([]);

    // Resize handles
    ctx.fillStyle = '#2bee8c';
    [[el.x + el.width, el.y + el.height]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    });
  }

  ctx.restore();
}

// Editor tool interactions
document.querySelectorAll('.nc-tool-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.editor.tool = btn.dataset.tool;
  };
});

editorCanvas.addEventListener('click', (e) => {
  const rect = editorCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const pageW = state.activeProject?.pages[state.activePage]?.width || 800;
  const pageH = state.activeProject?.pages[state.activePage]?.height || 600;
  const scale = Math.min((editorCanvas.clientWidth - 80) / pageW, (editorCanvas.clientHeight - 40) / pageH, 1);
  const ox = (editorCanvas.clientWidth - pageW * scale) / 2;
  const oy = 20;

  const emx = (mx - ox) / scale;
  const emy = (my - oy) / scale;

  if (state.editor.tool === 'select') {
    // Find clicked element
    state.editor.selectedElement = null;
    for (let i = editorElements.length - 1; i >= 0; i--) {
      const el = editorElements[i];
      if (emx >= el.x && emx <= el.x + el.width && emy >= el.y && emy <= el.y + el.height) {
        state.editor.selectedElement = el;
        showElementProperties(el);
        break;
      }
    }
    if (!state.editor.selectedElement) {
      document.getElementById('nc-props-content').innerHTML = '<p class="nc-hint">Select an element to edit properties</p>';
    }
  } else {
    // Add new element based on tool
    const newEl = createElement(state.editor.tool, emx, emy);
    if (newEl) {
      editorElements.push(newEl);
      state.editor.selectedElement = newEl;
      saveEditorHistory();
    }
  }
  renderEditor();
});

function createElement(type, x, y) {
  const pageW = state.activeProject?.pages[state.activePage]?.width || 800;
  switch (type) {
    case 'text':
      return { type: 'text', x, y, width: pageW - 40, height: 40, content: 'New text', style: { fontSize: 16, color: '#e0e0e0', fontWeight: 'normal' } };
    case 'image':
      return { type: 'image', x, y, width: 300, height: 200, src: '', style: { borderRadius: 8 } };
    case 'audio':
      return { type: 'audio', x, y, width: pageW - 40, height: 48, src: '', style: {} };
    case 'video':
      return { type: 'video', x, y, width: 400, height: 225, src: '', style: { borderRadius: 8 } };
    case 'table':
      return { type: 'table', x, y, width: pageW - 40, height: 120, rows: [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']], style: { headerBg: '#1c2721', cellBg: '#111', borderColor: '#333' } };
    case 'shape':
      return { type: 'shape', x, y, width: 120, height: 120, style: { fill: '#1c2721', stroke: '#2bee8c', strokeWidth: 2, borderRadius: 8 } };
    default:
      return null;
  }
}

function showElementProperties(el) {
  const props = document.getElementById('nc-props-content');
  let html = '';

  if (el.type === 'text') {
    html = `
      <div class="nc-prop-group"><label>Content</label><textarea id="prop-content" rows="3">${el.content}</textarea></div>
      <div class="nc-prop-group"><label>Font Size</label><input id="prop-fontsize" type="number" value="${el.style.fontSize}" /></div>
      <div class="nc-prop-group"><label>Color</label><input id="prop-color" type="color" value="${el.style.color}" /></div>
      <div class="nc-prop-group"><label>Weight</label><select id="prop-weight"><option ${el.style.fontWeight === 'bold' ? 'selected' : ''}>bold</option><option ${el.style.fontWeight === 'normal' ? 'selected' : ''}>normal</option></select></div>
    `;
  } else if (el.type === 'image') {
    html = `
      <div class="nc-prop-group"><label>Image URL</label><input id="prop-src" type="text" value="${el.src}" placeholder="https://..." /></div>
      <div class="nc-prop-group"><label>Width</label><input id="prop-width" type="number" value="${el.width}" /></div>
      <div class="nc-prop-group"><label>Height</label><input id="prop-height" type="number" value="${el.height}" /></div>
      <div class="nc-prop-group"><label>Border Radius</label><input id="prop-radius" type="number" value="${el.style.borderRadius || 0}" /></div>
    `;
  } else if (el.type === 'audio' || el.type === 'video') {
    html = `
      <div class="nc-prop-group"><label>Media URL</label><input id="prop-src" type="text" value="${el.src}" placeholder="https://..." /></div>
      <div class="nc-prop-group"><label>Width</label><input id="prop-width" type="number" value="${el.width}" /></div>
    `;
  } else if (el.type === 'table') {
    html = `
      <div class="nc-prop-group"><label>Rows (comma-separated per row, newline between rows)</label><textarea id="prop-rows" rows="4">${el.rows.map(r => r.join(',')).join('\n')}</textarea></div>
    `;
  }

  html += `<div class="nc-prop-group"><label>Position X</label><input id="prop-x" type="number" value="${el.x}" /></div>`;
  html += `<div class="nc-prop-group"><label>Position Y</label><input id="prop-y" type="number" value="${el.y}" /></div>`;

  props.innerHTML = html;

  // Bind property changes
  props.querySelectorAll('input, select, textarea').forEach(input => {
    input.onchange = () => updateElementFromProps(el);
  });
}

function updateElementFromProps(el) {
  const get = (id) => document.getElementById(id);
  if (el.type === 'text') {
    if (get('prop-content')) el.content = get('prop-content').value;
    if (get('prop-fontsize')) el.style.fontSize = parseInt(get('prop-fontsize').value) || 16;
    if (get('prop-color')) el.style.color = get('prop-color').value;
    if (get('prop-weight')) el.style.fontWeight = get('prop-weight').value;
  }
  if (el.type === 'image') {
    if (get('prop-src')) el.src = get('prop-src').value;
    if (get('prop-width')) el.width = parseInt(get('prop-width').value) || 200;
    if (get('prop-height')) el.height = parseInt(get('prop-height').value) || 150;
    if (get('prop-radius')) el.style.borderRadius = parseInt(get('prop-radius').value) || 0;
  }
  if (el.type === 'audio' || el.type === 'video') {
    if (get('prop-src')) el.src = get('prop-src').value;
    if (get('prop-width')) el.width = parseInt(get('prop-width').value) || 400;
  }
  if (el.type === 'table') {
    if (get('prop-rows')) {
      el.rows = get('prop-rows').value.split('\n').map(r => r.split(',').map(c => c.trim()));
      el.height = el.rows.length * 36 + 12;
    }
  }
  if (get('prop-x')) el.x = parseInt(get('prop-x').value) || 0;
  if (get('prop-y')) el.y = parseInt(get('prop-y').value) || 0;

  saveEditorHistory();
  renderEditor();
}

function saveEditorHistory() {
  editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
  editorHistory.push(JSON.stringify(editorElements));
  editorHistoryIndex = editorHistory.length - 1;
}

document.getElementById('nc-undo').onclick = () => {
  if (editorHistoryIndex > 0) {
    editorHistoryIndex--;
    editorElements = JSON.parse(editorHistory[editorHistoryIndex]);
    renderEditor();
  }
};

document.getElementById('nc-redo').onclick = () => {
  if (editorHistoryIndex < editorHistory.length - 1) {
    editorHistoryIndex++;
    editorElements = JSON.parse(editorHistory[editorHistoryIndex]);
    renderEditor();
  }
};

document.getElementById('nc-delete-el').onclick = () => {
  if (state.editor.selectedElement) {
    editorElements = editorElements.filter(e => e !== state.editor.selectedElement);
    state.editor.selectedElement = null;
    saveEditorHistory();
    renderEditor();
  }
};

document.getElementById('nc-save-page').onclick = async () => {
  if (!state.activeProject || !state.activePage) return;
  const pageW = state.activeProject.pages[state.activePage].width || 800;
  const pageH = state.activeProject.pages[state.activePage].height || 600;
  const html = elementsToHTML(editorElements, pageW, pageH);
  try {
    await api(`/projects/${state.activeProject.id}/pages/${state.activePage}`, {
      method: 'PUT',
      body: JSON.stringify({ html })
    });
    // Update local state
    state.activeProject.pages[state.activePage].html = html;
    showNotification('Page saved!');
  } catch (e) {
    showNotification('Save failed: ' + e.message);
  }
};

document.getElementById('nc-back-board').onclick = () => {
  state.view = 'board';
  state.activePage = null;
  updateViewTabs();
  renderBoard();
};

// ═══════════════════════════════════════════════════════════
// GALAXY VIEW — 3D Project Visualization
// ═══════════════════════════════════════════════════════════
const galaxyCanvas = document.getElementById('nc-galaxy-canvas');
let galaxyScene, galaxyCamera, galaxyRenderer, galaxyNodes = [];
let galaxyInitialized = false;

function initGalaxy() {
  if (galaxyInitialized) return;
  galaxyInitialized = true;

  // Three.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  script.onload = setupGalaxyScene;
  document.head.appendChild(script);
}

function setupGalaxyScene() {
  const w = galaxyCanvas.clientWidth;
  const h = galaxyCanvas.clientHeight;

  galaxyScene = new THREE.Scene();
  galaxyScene.background = new THREE.Color(0x0a0a0a);

  galaxyCamera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  galaxyCamera.position.set(0, 50, 150);

  galaxyRenderer = new THREE.WebGLRenderer({ canvas: galaxyCanvas, antialias: true });
  galaxyRenderer.setSize(w, h);
  galaxyRenderer.setPixelRatio(devicePixelRatio);

  // Lights
  const ambient = new THREE.AmbientLight(0x333333);
  galaxyScene.add(ambient);
  const point = new THREE.PointLight(0x2bee8c, 1, 500);
  point.position.set(0, 80, 0);
  galaxyScene.add(point);

  // Stars background
  const starsGeo = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 2000; i++) {
    starPositions.push((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 800, (Math.random() - 0.5) * 800);
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0x444444, size: 0.5 });
  galaxyScene.add(new THREE.Points(starsGeo, starsMat));

  animateGalaxy();
}

function updateGalaxyNodes() {
  if (!galaxyScene) return;

  // Remove old nodes
  galaxyNodes.forEach(n => galaxyScene.remove(n));
  galaxyNodes = [];

  state.projects.forEach((project, i) => {
    const pages = Object.values(project.pages || {});
    const angle = (i / state.projects.length) * Math.PI * 2;
    const radius = 40 + pages.length * 5;

    // Project node
    const group = new THREE.Group();
    group.position.set(Math.cos(angle) * radius, pages.length * 2, Math.sin(angle) * radius);

    // Main sphere
    const geo = new THREE.SphereGeometry(3 + Math.min(pages.length, 10), 16, 16);
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL((i * 0.15) % 1, 0.6, 0.4),
      emissive: new THREE.Color().setHSL((i * 0.15) % 1, 0.8, 0.15)
    });
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);

    // Page thumbnails as small planes orbiting the project
    pages.slice(0, 12).forEach((page, pi) => {
      const pAngle = (pi / Math.min(pages.length, 12)) * Math.PI * 2;
      const pRadius = 8 + pages.length * 0.5;
      const planeGeo = new THREE.PlaneGeometry(4, 3);

      // Create texture from HTML
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 200, 150);
      ctx.fillStyle = '#333';
      ctx.font = '10px sans-serif';
      const text = (page.title || 'Page').substring(0, 30);
      ctx.fillText(text, 10, 20);

      const texture = new THREE.CanvasTexture(canvas);
      const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.set(Math.cos(pAngle) * pRadius, 0, Math.sin(pAngle) * pRadius);
      plane.lookAt(0, 0, 0);
      group.add(plane);
    });

    // Label
    // (Three.js text requires font loading — using sprite instead)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2bee8c';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(project.name, 10, 40);
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMat);
    label.position.y = 8;
    label.scale.set(20, 5, 1);
    group.add(label);

    galaxyScene.add(group);
    galaxyNodes.push(group);
  });
}

function animateGalaxy() {
  if (state.view !== 'galaxy') {
    requestAnimationFrame(animateGalaxy);
    return;
  }

  state.galaxy.rotation += 0.002;

  if (galaxyCamera) {
    galaxyCamera.position.x = Math.sin(state.galaxy.rotation) * 150;
    galaxyCamera.position.z = Math.cos(state.galaxy.rotation) * 150;
    galaxyCamera.lookAt(0, 0, 0);
  }

  galaxyNodes.forEach((node, i) => {
    node.rotation.y += 0.005;
    node.children.forEach(child => {
      if (child.position) {
        child.position.y += Math.sin(Date.now() * 0.001 + i) * 0.01;
      }
    });
  });

  if (galaxyRenderer && galaxyScene && galaxyCamera) {
    galaxyRenderer.render(galaxyScene, galaxyCamera);
  }

  requestAnimationFrame(animateGalaxy);
}

// ═══════════════════════════════════════════════════════════
// SYNC VIEW
// ═══════════════════════════════════════════════════════════
document.getElementById('nc-sync-type').onchange = (e) => {
  const isApi = e.target.value === 'api';
  document.getElementById('nc-sync-api-group').style.display = isApi ? '' : 'none';
  document.getElementById('nc-sync-apikey-group').style.display = isApi ? '' : 'none';
  document.querySelectorAll('.nc-sync-cred').forEach(el => {
    el.style.display = isApi ? 'none' : '';
  });
};

document.getElementById('nc-sync-start').onclick = async () => {
  const config = {
    type: document.getElementById('nc-sync-type').value,
    host: document.getElementById('nc-sync-host').value,
    path: document.getElementById('nc-sync-path').value,
    apiKey: document.getElementById('nc-sync-apikey').value,
    username: document.getElementById('nc-sync-user').value,
    password: document.getElementById('nc-sync-pass').value,
    remotePath: document.getElementById('nc-sync-remote-path').value
  };

  if (!config.host) return showNotification('Host is required');

  const status = document.getElementById('nc-sync-status');
  status.style.display = 'block';
  status.textContent = '⏳ Syncing...';

  try {
    const result = await api('/sync', { method: 'POST', body: JSON.stringify(config) });
    status.textContent = `✅ Sync complete! ${result.mdFiles} files found, ${result.importedPages.length} pages imported.`;

    const results = document.getElementById('nc-sync-results');
    results.innerHTML = result.importedPages.map(p =>
      `<div class="nc-sync-result-item"><strong>${p.title}</strong> — ${p.sourceFile}</div>`
    ).join('');

    // Offer to create project from synced pages
    if (result.importedPages.length > 0) {
      results.innerHTML += `<button class="nc-btn nc-btn-primary" style="margin-top:12px;width:100%" onclick="createProjectFromSync('${result.syncId}')">Create Project from Synced Pages</button>`;
    }
  } catch (e) {
    status.textContent = `❌ Sync failed: ${e.message}`;
  }
};

function createProjectFromSync(syncId) {
  showModal(`
    <h3>Create Project from Synced Pages</h3>
    <div class="nc-form-group"><label>Project Name</label><input id="sync-project-name" type="text" placeholder="My Wiki Project" /></div>
    <button class="nc-btn nc-btn-primary" onclick="confirmCreateFromSync('${syncId}')">Create</button>
    <button class="nc-btn" onclick="closeModal()">Cancel</button>
  `);
}

async function confirmCreateFromSync(syncId) {
  const name = document.getElementById('sync-project-name').value || 'Imported Wiki';
  try {
    const project = await api('/projects', { method: 'POST', body: JSON.stringify({ name, description: `Synced from remote wiki (${syncId})` }) });

    // Add synced pages to project
    const syncResult = await api(`/sync/${syncId}`);
    for (const page of (syncResult.importedPages || [])) {
      await api(`/projects/${project.id}/pages`, {
        method: 'POST',
        body: JSON.stringify({ title: page.title, html: page.html })
      });
    }

    closeModal();
    showNotification(`Project "${name}" created with ${syncResult.importedPages?.length || 0} pages!`);
    await loadProjects();
    openProject(project.id);
  } catch (e) {
    showNotification('Failed: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// PROJECT MANAGEMENT
// ═══════════════════════════════════════════════════════════
async function loadProjects() {
  try {
    state.projects = await api('/projects');
    renderProjectList();
    updateSyncTargetSelect();
    updateGalaxyNodes();
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

function renderProjectList() {
  const list = document.getElementById('nc-project-list');
  list.innerHTML = state.projects.map(p => `
    <div class="nc-project-item ${state.activeProject?.id === p.id ? 'active' : ''}" data-id="${p.id}">
      <div class="nc-project-item-name">${p.name}</div>
      <div class="nc-project-item-meta">${p.pageCount} pages · ${new Date(p.updatedAt).toLocaleDateString()}</div>
    </div>
  `).join('');

  list.querySelectorAll('.nc-project-item').forEach(item => {
    item.onclick = () => openProject(item.dataset.id);
  });
}

function updateSyncTargetSelect() {
  const select = document.getElementById('nc-sync-target-project');
  select.innerHTML = '<option value="new">Create New Project</option>' +
    state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

async function openProject(id) {
  try {
    state.activeProject = await api(`/projects/${id}`);
    state.view = 'board';
    state.activePage = null;
    updateViewTabs();
    renderBoard();
    renderProjectList();
  } catch (e) {
    showNotification('Failed to open project: ' + e.message);
  }
}

async function addPage() {
  if (!state.activeProject) return showNotification('Open a project first');
  try {
    const page = await api(`/projects/${state.activeProject.id}/pages`, {
      method: 'POST',
      body: JSON.stringify({ title: 'New Page', html: '<div class="nc-page"><h1>New Page</h1><p>Start editing...</p></div>' })
    });
    state.activeProject.pages[page.id] = page;
    renderBoard();
    openPageEditor(page);
  } catch (e) {
    showNotification('Failed to add page: ' + e.message);
  }
}

document.getElementById('nc-new-project').onclick = () => {
  showModal(`
    <h3>New Project</h3>
    <div class="nc-form-group"><label>Name</label><input id="new-project-name" type="text" placeholder="My Project" /></div>
    <div class="nc-form-group"><label>Description</label><textarea id="new-project-desc" rows="2" placeholder="Optional description"></textarea></div>
    <button class="nc-btn nc-btn-primary" onclick="confirmNewProject()">Create</button>
    <button class="nc-btn" onclick="closeModal()">Cancel</button>
  `);
  document.getElementById('new-project-name').focus();
};

async function confirmNewProject() {
  const name = document.getElementById('new-project-name').value || 'Untitled';
  const description = document.getElementById('new-project-desc').value;
  try {
    const project = await api('/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
    closeModal();
    await loadProjects();
    openProject(project.id);
  } catch (e) {
    showNotification('Failed: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════════════════════
function updateViewTabs() {
  document.querySelectorAll('.nc-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  document.querySelectorAll('.nc-view').forEach(v => {
    v.classList.toggle('active', v.id === `nc-${state.view}-view`);
  });
  if (state.view === 'galaxy') {
    initGalaxy();
    updateGalaxyNodes();
  }
  if (state.view === 'board') renderBoard();
  if (state.view === 'edit') renderEditor();
}

document.querySelectorAll('.nc-nav-btn').forEach(btn => {
  btn.onclick = () => {
    state.view = btn.dataset.view;
    updateViewTabs();
  };
});

document.getElementById('nc-sidebar-toggle').onclick = () => {
  document.getElementById('nc-sidebar').classList.toggle('collapsed');
};

function showModal(content) {
  document.getElementById('nc-modal').innerHTML = content;
  document.getElementById('nc-modal-overlay').classList.remove('nc-hidden');
}

function closeModal() {
  document.getElementById('nc-modal-overlay').classList.add('nc-hidden');
}

function showNotification(msg) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1c2721;border:1px solid #2bee8c;border-radius:8px;padding:12px 20px;color:#2bee8c;font-size:13px;z-index:9999;animation:nc-fadein 0.2s;';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

// Close modal on overlay click
document.getElementById('nc-modal-overlay').onclick = (e) => {
  if (e.target === e.currentTarget) closeModal();
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'v') { state.editor.tool = 'select'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'select')); }
  if (e.key === 't') { state.editor.tool = 'text'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'text')); }
  if (e.key === 'i') { state.editor.tool = 'image'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'image')); }
  if (e.key === 'a') { state.editor.tool = 'audio'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'audio')); }
  if (e.key === 'm') { state.editor.tool = 'video'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'video')); }
  if (e.key === 'b') { state.editor.tool = 'table'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'table')); }
  if (e.key === 's' && !e.ctrlKey) { state.editor.tool = 'shape'; document.querySelectorAll('.nc-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'shape')); }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('nc-undo').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('nc-redo').click(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (state.editor.selectedElement) document.getElementById('nc-delete-el').click(); }
  if (e.key === 'Escape') { closeModal(); }
});

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
  resizeBoard();
  renderEditor();
  if (galaxyRenderer) {
    galaxyRenderer.setSize(galaxyCanvas.clientWidth, galaxyCanvas.clientHeight);
    galaxyCamera.aspect = galaxyCanvas.clientWidth / galaxyCanvas.clientHeight;
    galaxyCamera.updateProjectionMatrix();
  }
});

// Seed demo data if no projects
async function seedDemo() {
  if (state.projects.length === 0) {
    const demo = await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'The Conglomerate Group', description: 'Main knowledge base' })
    });

    const pages = [
      { title: 'Welcome', html: '<div class="nc-page"><h1>Welcome to NeuroCanvas</h1><p>This is your visual HTML editor. Drag and drop primitives to build pages.</p><p>Connect to a remote wiki via <strong>Sync</strong> to import your knowledge base.</p></div>' },
      { title: 'Web Works Studio', html: '<div class="nc-page"><h1>Web Works Studio</h1><p>Tactical web component library.</p><table><tr><th>Component</th><th>Status</th></tr><tr><td>bzr-dial-menu</td><td>v1.0.0-mvp</td></tr><tr><td>NeuroCanvas</td><td>v2.0.0</td></tr><tr><td>AgentHTTP</td><td>v1.0.0</td></tr></table></div>' },
      { title: 'Ballademix Media', html: '<div class="nc-page"><h1>Ballademix Media</h1><p>Music, NFTs, and Web3 social platform.</p><ul><li>Intro NFT — 0.25 SOL mint</li><li>9,000 supply (9 covers x 1,000)</li><li>Pull-based dividend contract</li></ul></div>' },
      { title: 'Painted Dogs Interactive', html: '<div class="nc-page"><h1>Painted Dogs Interactive Infotainment</h1><p>Creative studio behind all Conglomerate Group development.</p><p>Writers, designers, musicians, voice actors.</p></div>' }
    ];

    for (const p of pages) {
      await api(`/projects/${demo.id}/pages`, { method: 'POST', body: JSON.stringify(p) });
    }

    state.projects = await api('/projects');
  }
}

// Start
loadProjects().then(seedDemo).then(() => {
  resizeBoard();
  updateViewTabs();
});

console.log('NeuroCanvas v2 initialized');
