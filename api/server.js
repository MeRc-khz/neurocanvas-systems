/**
 * NeuroCanvas API v2
 * Remote wiki sync (FTP/SCP/API), HTML project CRUD, page management
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.NC_PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = process.env.NC_DATA || '/root/neurocanvas-v2/data';
const THUMB_DIR = process.env.NC_THUMBS || '/root/neurocanvas-v2/thumbnails';
const WIKI_SYNC_DIR = process.env.NC_WIKI_DIR || '/root/neurocanvas-v2/wiki-sync';

[DATA_DIR, THUMB_DIR, WIKI_SYNC_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── Helpers ─────────────────────────────────────────────
function id() { return crypto.randomBytes(8).toString('hex'); }
function projectFile(p) { return path.join(DATA_DIR, `${p}.json`); }
function readProject(p) {
  try { return JSON.parse(fs.readFileSync(projectFile(p), 'utf8')); }
  catch { return null; }
}
function writeProject(p, data) {
  fs.writeFileSync(projectFile(p), JSON.stringify(data, null, 2));
  return data;
}

// ─── Projects CRUD ───────────────────────────────────────

// List all projects
app.get('/api/projects', (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const projects = files.map(f => {
    const p = readProject(f.replace('.json', ''));
    return p ? { id: p.id, name: p.name, description: p.description, updatedAt: p.updatedAt, pageCount: Object.keys(p.pages || {}).length } : null;
  }).filter(Boolean);
  res.json(projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});

// Get project
app.get('/api/projects/:id', (req, res) => {
  const p = readProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

// Create project
app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  const project = {
    id: id(),
    name: name || 'Untitled Project',
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: {},
    settings: { gridSize: 50, snapToGrid: false }
  };
  writeProject(project.id, project);
  res.status(201).json(project);
});

// Update project
app.put('/api/projects/:id', (req, res) => {
  const p = readProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  Object.assign(p, req.body, { updatedAt: new Date().toISOString() });
  writeProject(p.id, p);
  res.json(p);
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  try { fs.unlinkSync(projectFile(req.params.id)); } catch {}
  res.json({ ok: true });
});

// ─── Pages CRUD (HTML content) ───────────────────────────

// Create page
app.post('/api/projects/:pid/pages', (req, res) => {
  const p = readProject(req.params.pid);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const page = {
    id: id(),
    title: req.body.title || 'Untitled Page',
    html: req.body.html || '<div class="nc-page"><h1>New Page</h1><p>Start editing...</p></div>',
    width: req.body.width || 800,
    height: req.body.height || 600,
    x: req.body.x || 0,
    y: req.body.y || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  p.pages[page.id] = page;
  p.updatedAt = new Date().toISOString();
  writeProject(p.id, p);
  res.status(201).json(page);
});

// Update page
app.put('/api/projects/:pid/pages/:pageId', (req, res) => {
  const p = readProject(req.params.pid);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const page = p.pages[req.params.pageId];
  if (!page) return res.status(404).json({ error: 'Page not found' });
  Object.assign(page, req.body, { updatedAt: new Date().toISOString() });
  p.updatedAt = new Date().toISOString();
  writeProject(p.id, p);
  res.json(page);
});

// Delete page
app.delete('/api/projects/:pid/pages/:pageId', (req, res) => {
  const p = readProject(req.params.pid);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  delete p.pages[req.params.pageId];
  p.updatedAt = new Date().toISOString();
  writeProject(p.id, p);
  res.json({ ok: true });
});

// ─── Remote Wiki Sync ────────────────────────────────────

// Sync from remote source (FTP/SCP/API endpoint)
app.post('/api/sync', async (req, res) => {
  const { type, host, port, username, password, path: remotePath, apiKey } = req.body;
  const syncId = id();
  const syncDir = path.join(WIKI_SYNC_DIR, syncId);
  fs.mkdirSync(syncDir, { recursive: true });

  try {
    if (type === 'scp') {
      const cmd = `scp -P ${port || 22} -r ${username}@${host}:${remotePath}/* ${syncDir}/`;
      exec(cmd, { timeout: 30000 }, (err) => {
        if (err) console.error('SCP sync error:', err.message);
      });
    } else if (type === 'ftp') {
      const cmd = `lftp -u ${username},${password} -p ${port || 21} ${host} -e "mirror ${remotePath} ${syncDir}; quit"`;
      exec(cmd, { timeout: 30000 }, (err) => {
        if (err) console.error('FTP sync error:', err.message);
      });
    } else if (type === 'api') {
      const fetch = (await import('node-fetch')).default;
      const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
      const response = await fetch(`${host}${remotePath}`, { headers });
      const data = await response.json();
      // Save API response as project data
      fs.writeFileSync(path.join(syncDir, 'api-response.json'), JSON.stringify(data, null, 2));
    }

    // Process synced files into projects
    const files = fs.readdirSync(syncDir);
    const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.html'));
    const importedPages = [];

    for (const file of mdFiles) {
      const content = fs.readFileSync(path.join(syncDir, file), 'utf8');
      const isHtml = file.endsWith('.html');
      importedPages.push({
        sourceFile: file,
        title: file.replace(/\.(md|html)$/, '').replace(/[-_]/g, ' '),
        html: isHtml ? content : markdownToHtml(content),
        syncedAt: new Date().toISOString()
      });
    }

    res.json({ syncId, filesFound: files.length, mdFiles: mdFiles.length, importedPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple markdown to HTML converter
function markdownToHtml(md) {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*-\s+(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (m) => {
      if (m.startsWith('<')) return m;
      return `<p>${m}</p>`;
    });
}

// Get sync status
app.get('/api/sync/:id', (req, res) => {
  const syncDir = path.join(WIKI_SYNC_DIR, req.params.id);
  if (!fs.existsSync(syncDir)) return res.status(404).json({ error: 'Sync not found' });
  const files = fs.readdirSync(syncDir);
  res.json({ id: req.params.id, files, completed: true });
});

// ─── Thumbnails ──────────────────────────────────────────

app.get('/api/thumbnails/:projectId/:pageId', (req, res) => {
  const thumbPath = path.join(THUMB_DIR, req.params.projectId, `${req.params.pageId}.png`);
  if (fs.existsSync(thumbPath)) {
    res.sendFile(thumbPath);
  } else {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

app.post('/api/thumbnails/:projectId/:pageId', (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'No image data' });
  const dir = path.join(THUMB_DIR, req.params.projectId);
  fs.mkdirSync(dir, { recursive: true });
  const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(dir, `${req.params.pageId}.png`), buffer);
  res.json({ ok: true });
});

// ─── Health ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', dataDir: DATA_DIR });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NeuroCanvas API v2 on port ${PORT}`);
});
