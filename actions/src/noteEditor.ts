import http from 'http'
import { spawn } from 'child_process'
import { URL } from 'url'
import { OWNER, REPO } from './config'
import { composeNoteComment, parseNoteComment } from './noteComment'

const HOST = '127.0.0.1'
const PORT = Number(process.env.NOTE_EDITOR_PORT || 4329)

type GhLabel = string | { name?: string | null }

type GhIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: GhLabel[];
  pull_request?: unknown;
}

type GhComment = {
  id: number;
  body?: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user?: {
    login?: string;
  };
}

type GhUser = {
  login: string;
}

type RequestBody = {
  title?: string;
  description?: string;
  tags?: string[] | string;
  body?: string;
}

async function main() {
  await assertGhAuth()

  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res)
    }
    catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  server.listen(PORT, HOST, () => {
    console.log(`Note editor running at http://${HOST}:${PORT}`)
  })
}

async function route(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
  const method = req.method || 'GET'

  if (method === 'GET' && url.pathname === '/') {
    sendHtml(res, getPageHtml())
    return
  }

  if (method === 'GET' && url.pathname === '/api/auth') {
    const user = await ghJson<GhUser>(['api', 'user'])
    sendJson(res, 200, { owner: OWNER, repo: REPO, login: user.login })
    return
  }

  if (method === 'GET' && url.pathname === '/api/issues') {
    const issues = await ghJson<GhIssue[]>([
      'api',
      `repos/${OWNER}/${REPO}/issues`,
      '--method',
      'GET',
      '--paginate',
      '-f',
      'state=open',
      '-f',
      'labels=Note',
    ])

    sendJson(res, 200, issues
      .filter(issue => !issue.pull_request)
      .filter(issue => issue.labels.some(label => (typeof label === 'string' ? label : label.name) === 'Note'))
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        htmlUrl: issue.html_url,
        state: issue.state,
        labels: issue.labels.map(label => typeof label === 'string' ? label : label.name).filter(Boolean),
      })))
    return
  }

  const commentsMatch = url.pathname.match(/^\/api\/issues\/(\d+)\/comments$/)
  if (method === 'GET' && commentsMatch) {
    const comments = await ghJson<GhComment[]>([
      'api',
      `repos/${OWNER}/${REPO}/issues/${commentsMatch[1]}/comments`,
      '--paginate',
    ])

    sendJson(res, 200, comments
      .filter(comment => comment.user?.login === OWNER)
      .map(comment => ({
        id: comment.id,
        htmlUrl: comment.html_url,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        rawBody: comment.body || '',
        ...parseNoteComment(comment.body),
      })))
    return
  }

  if (method === 'POST' && url.pathname === '/api/preview') {
    const fields = await readNoteFields(req)
    sendJson(res, 200, { body: composeNoteComment(fields) })
    return
  }

  if (method === 'POST' && commentsMatch) {
    const fields = await readNoteFields(req)
    const comment = await ghJson<GhComment>([
      'api',
      `repos/${OWNER}/${REPO}/issues/${commentsMatch[1]}/comments`,
      '--method',
      'POST',
      '--input',
      '-',
    ], JSON.stringify({ body: composeNoteComment(fields) }))

    sendJson(res, 201, { id: comment.id, htmlUrl: comment.html_url })
    return
  }

  const commentMatch = url.pathname.match(/^\/api\/comments\/(\d+)$/)
  if (method === 'PATCH' && commentMatch) {
    const fields = await readNoteFields(req)
    const comment = await ghJson<GhComment>([
      'api',
      `repos/${OWNER}/${REPO}/issues/comments/${commentMatch[1]}`,
      '--method',
      'PATCH',
      '--input',
      '-',
    ], JSON.stringify({ body: composeNoteComment(fields) }))

    sendJson(res, 200, { id: comment.id, htmlUrl: comment.html_url })
    return
  }

  sendJson(res, 404, { error: 'Not found' })
}

async function assertGhAuth() {
  await gh(['auth', 'status'])
  const user = await ghJson<GhUser>(['api', 'user'])
  if (user.login !== OWNER) {
    throw new Error(`gh is authenticated as ${user.login}, expected ${OWNER}`)
  }
}

async function readNoteFields(req: http.IncomingMessage) {
  const raw = await readRequestBody(req)
  const body = JSON.parse(raw || '{}') as RequestBody
  return {
    title: body.title || '',
    description: body.description || '',
    tags: Array.isArray(body.tags)
      ? body.tags
      : (body.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    body: body.body || '',
  }
}

async function ghJson<T>(args: string[], input?: string): Promise<T> {
  const output = await gh(args, input)
  return JSON.parse(output) as T
}

function gh(args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString()
      if (code === 0) {
        resolve(out)
        return
      }
      reject(new Error(Buffer.concat(stderr).toString() || out || `gh exited with ${code}`))
    })

    if (input) {
      child.stdin.end(input)
    }
    else {
      child.stdin.end()
    }
  })
}

function readRequestBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1024 * 1024) {
        reject(new Error('Request body is too large'))
        req.destroy()
        return
      }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendHtml(res: http.ServerResponse, body: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(body)
}

function getPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Note Editor</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef3f8;
      --bg-deep: #dfe7f0;
      --panel: rgba(255,255,255,.72);
      --panel-strong: rgba(255,255,255,.88);
      --panel-soft: rgba(248,250,252,.68);
      --border: rgba(15,23,42,.12);
      --border-strong: rgba(15,23,42,.2);
      --muted: #536176;
      --text: #0b1020;
      --text-soft: #283244;
      --accent: #ec4899;
      --accent-strong: #be185d;
      --accent-soft: rgba(236,72,153,.13);
      --cyan: #0891b2;
      --cyan-soft: rgba(8,145,178,.13);
      --green: #0f766e;
      --danger: #b42318;
      --shadow: 0 24px 70px rgba(15,23,42,.14);
      --shadow-soft: 0 12px 34px rgba(15,23,42,.09);
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; }
    body {
      margin: 0;
      min-height: 100%;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        linear-gradient(135deg, rgba(236,72,153,.12), transparent 30%),
        linear-gradient(225deg, rgba(8,145,178,.12), transparent 32%),
        linear-gradient(180deg, #f8fbff 0%, var(--bg) 46%, var(--bg-deep) 100%);
      color: var(--text);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(15,23,42,.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(15,23,42,.045) 1px, transparent 1px);
      background-size: 40px 40px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,.88), transparent 78%);
    }
    a { color: inherit; text-decoration: none; }
    .topbar {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin: 12px 12px 0;
      padding: 12px 16px;
      border: 1px solid rgba(255,255,255,.62);
      border-radius: var(--radius);
      background: rgba(255,255,255,.7);
      box-shadow: var(--shadow-soft);
      backdrop-filter: blur(22px) saturate(160%);
      position: sticky;
      top: 12px;
      z-index: 5;
      animation: enter .36s ease-out both;
    }
    .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .mark {
      width: 38px;
      height: 38px;
      border-radius: var(--radius);
      display: grid;
      place-items: center;
      background:
        linear-gradient(135deg, rgba(255,255,255,.22), transparent 36%),
        linear-gradient(145deg, #0f172a, #be185d 58%, #0891b2);
      color: #fff;
      font-weight: 800;
      box-shadow: 0 12px 30px rgba(190,24,93,.28);
      position: relative;
      overflow: hidden;
    }
    .mark::after {
      content: "";
      position: absolute;
      inset: 8px;
      border: 1px solid rgba(255,255,255,.38);
      border-radius: 4px;
    }
    .brand-title { display: grid; line-height: 1.15; }
    .brand-title strong { font-size: 15px; letter-spacing: .02em; }
    .brand-title span { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 52vw; }
    .top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .link-button, button {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 9px 12px;
      background: rgba(255,255,255,.74);
      color: var(--text);
      font: inherit;
      font-weight: 650;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 36px;
      box-shadow: 0 1px 0 rgba(255,255,255,.8) inset;
      transition: border-color .18s ease-out, background .18s ease-out, color .18s ease-out, box-shadow .18s ease-out, transform .18s ease-out;
    }
    .link-button:hover, button:hover { border-color: rgba(236,72,153,.42); background: rgba(255,255,255,.94); box-shadow: 0 10px 24px rgba(15,23,42,.1); transform: translateY(-1px); }
    .link-button:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid rgba(236,72,153,.22); outline-offset: 2px; }
    button.primary {
      background: linear-gradient(135deg, var(--accent), var(--cyan));
      border-color: rgba(255,255,255,.24);
      color: #fff;
      box-shadow: 0 14px 30px rgba(236,72,153,.24);
    }
    button.primary:hover { background: linear-gradient(135deg, var(--accent-strong), #0e7490); border-color: rgba(255,255,255,.28); }
    button:disabled { opacity: .48; cursor: not-allowed; transform: none; box-shadow: none; }
    main { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 16px; padding: 16px 12px 12px; min-height: calc(100vh - 92px); animation: enter .42s .05s ease-out both; }
    aside, section {
      background: var(--panel);
      border: 1px solid rgba(255,255,255,.62);
      border-radius: var(--radius);
      min-width: 0;
      box-shadow: var(--shadow);
      backdrop-filter: blur(24px) saturate(150%);
    }
    aside { padding: 14px; display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 112px); position: sticky; top: 92px; }
    section { padding: 16px; display: grid; grid-auto-rows: max-content; gap: 13px; align-content: start; align-items: start; position: relative; overflow: hidden; }
    section::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(236,72,153,.58), rgba(8,145,178,.58), transparent);
    }
    .workspace { display: grid; grid-template-columns: minmax(520px, 1fr) minmax(260px, 320px); gap: 16px; align-items: start; min-width: 0; }
    .editor-panel { min-height: calc(100vh - 112px); }
    .meta-panel { padding: 14px; gap: 12px; position: sticky; top: 92px; }
    .field { display: grid; grid-template-rows: 15px max-content; gap: 6px; align-content: start; align-items: start; min-width: 0; width: 100%; }
    .markdown-field { grid-template-rows: auto max-content; }
    .field-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
    label { display: block; height: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 15px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: .08em; }
    select, input, textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font: inherit;
      background: rgba(255,255,255,.78);
      color: var(--text);
      outline: none;
      box-shadow: 0 1px 0 rgba(255,255,255,.8) inset;
      transition: border-color .18s ease-out, box-shadow .18s ease-out, background .18s ease-out;
    }
    select, input { height: 42px; min-height: 42px; padding: 0 12px; }
    select:focus, input:focus, textarea:focus { border-color: rgba(236,72,153,.6); background: rgba(255,255,255,.94); box-shadow: 0 0 0 4px rgba(236,72,153,.13), 0 14px 30px rgba(15,23,42,.08); }
    textarea { height: 430px; min-height: 240px; padding: 11px 12px; resize: vertical; align-self: start; line-height: 1.62; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 13px; }
    .comments { display: grid; gap: 8px; overflow: auto; padding-right: 2px; }
    .comment { text-align: left; display: grid; gap: 5px; justify-content: stretch; }
    .comment.active { border-color: rgba(236,72,153,.44); background: linear-gradient(135deg, rgba(236,72,153,.13), rgba(8,145,178,.1)); box-shadow: 0 12px 28px rgba(236,72,153,.12); }
    .comment.has-draft { border-color: rgba(8,145,178,.38); }
    .comment strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .comment span, .muted { color: var(--muted); font-size: 12px; }
    .comment .draft-mark { color: var(--cyan); font-weight: 800; }
    .comments-loading { color: var(--muted); font-size: 12px; padding: 10px 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; width: 100%; }
    .meta-panel .grid { grid-template-columns: 1fr; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .panel-actions { display: grid; grid-template-columns: 1fr; width: 100%; }
    .panel-actions button { width: 100%; }
    .panel-actions .status { margin-left: 0; width: 100%; }
    .status {
      margin-left: auto;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 5px 10px;
      background: rgba(255,255,255,.62);
    }
    .status::before {
      content: "";
      width: 7px;
      height: 7px;
      margin-right: 7px;
      border-radius: 999px;
      background: var(--green);
      box-shadow: 0 0 0 4px rgba(15,118,110,.12);
    }
    .status.busy::before {
      background: var(--accent);
      animation: pulse 1.1s ease-out infinite;
    }
    .draft-banner {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(8,145,178,.28);
      border-radius: var(--radius);
      background: rgba(8,145,178,.1);
      color: var(--text-soft);
    }
    .draft-banner.visible { display: flex; }
    .draft-banner strong { color: var(--cyan); }
    .draft-banner .actions { flex: 0 0 auto; }
    .draft-banner button { min-height: 32px; padding: 6px 9px; }
    .output { display: grid; grid-template-rows: minmax(0, 1fr); width: 100%; overflow: hidden; border-top: 1px solid var(--border); padding-top: 12px; }
    .tabs { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
    .tab { min-height: 32px; padding: 6px 10px; border-radius: 6px; }
    .tab.active { background: #0f172a; border-color: #0f172a; color: #fff; box-shadow: 0 10px 24px rgba(15,23,42,.16); }
    .pane { display: none; min-height: 0; overflow: auto; }
    .pane.active { display: block; animation: fade .18s ease-out both; }
    .preview-card { padding: 18px; }
    .preview-card h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.18; letter-spacing: 0; }
    .preview-card p { line-height: 1.68; color: var(--text-soft); }
    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px; }
    .tag { border: 1px solid rgba(236,72,153,.28); color: var(--accent-strong); background: var(--accent-soft); border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
    .rendered { border-top: 1px solid var(--border); padding-top: 14px; overflow-wrap: anywhere; }
    .rendered pre, .raw { margin: 0; padding: 14px; background: #0b1020; color: #eef2f6; white-space: pre-wrap; overflow: auto; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 13px; line-height: 1.58; }
    .rendered code { background: rgba(15,23,42,.08); border: 1px solid rgba(15,23,42,.08); border-radius: 5px; padding: 2px 5px; }
    .empty { color: var(--muted); padding: 18px; }
    @keyframes enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(236,72,153,.28); } 100% { box-shadow: 0 0 0 9px rgba(236,72,153,0); } }
    @media (max-width: 1180px) { .workspace { grid-template-columns: 1fr; } .editor-panel { min-height: auto; } .meta-panel { position: static; } .output { min-height: 360px; } }
    @media (max-width: 820px) { .topbar { align-items: flex-start; margin: 8px 8px 0; top: 8px; } main { grid-template-columns: 1fr; padding: 12px 8px 8px; } aside { position: static; max-height: none; } .grid { grid-template-columns: 1fr; } .field-head { align-items: flex-start; flex-direction: column; } .tabs { width: 100%; justify-content: stretch; } .tab { flex: 1; } .status { margin-left: 0; width: 100%; } }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
      .link-button:hover, button:hover { transform: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <div class="mark">N</div>
      <div class="brand-title">
        <strong>Note Editor</strong>
        <span id="auth">Loading GitHub auth...</span>
      </div>
    </div>
    <nav class="top-actions">
      <a class="link-button" href="https://github.com/byodian/all-in-github" target="_blank" rel="noopener">Repository</a>
      <a class="link-button" href="https://byodian.github.io/all-in-github" target="_blank" rel="noopener">Website</a>
    </nav>
  </header>
  <main>
    <aside>
      <div class="field">
        <label for="issue">Issue</label>
        <select id="issue"></select>
      </div>
      <div class="actions">
        <button id="refresh">Refresh</button>
        <button id="new">New</button>
      </div>
      <div id="comments" class="comments"></div>
    </aside>
    <div class="workspace">
      <section class="editor-panel">
        <div id="draftBanner" class="draft-banner">
          <span id="draftText"></span>
          <div class="actions">
            <button id="restoreDraft">Restore Draft</button>
            <button id="discardDraft">Discard Draft</button>
          </div>
        </div>
        <div class="field markdown-field">
          <div class="field-head">
            <label for="body">Markdown</label>
            <div class="tabs">
              <button class="tab active" data-tab="previewPane">Preview</button>
              <button class="tab" data-tab="rawPane">Raw</button>
            </div>
          </div>
          <textarea id="body" spellcheck="false"></textarea>
        </div>
        <div class="output">
          <div id="previewPane" class="pane active">
            <div id="previewBox" class="preview-card empty">Preview will appear here.</div>
          </div>
          <div id="rawPane" class="pane">
            <pre id="rawBox" class="raw"></pre>
          </div>
        </div>
      </section>
      <section class="meta-panel">
        <div class="grid">
          <div class="field">
            <label for="title">Title</label>
            <input id="title" autocomplete="off">
          </div>
          <div class="field">
            <label for="tags">Tags</label>
            <input id="tags" autocomplete="off" placeholder="tag1,tag2">
          </div>
        </div>
        <div class="field">
          <label for="description">Description</label>
          <input id="description" autocomplete="off">
        </div>
        <div class="actions panel-actions">
          <button id="preview">Refresh Output</button>
          <button id="create" class="primary">Create</button>
          <button id="update" disabled>Update</button>
          <button id="open" disabled>Open GitHub Comment</button>
          <span id="status" class="muted status"></span>
        </div>
      </section>
    </div>
  </main>
  <script>
    const state = { issue: null, comment: null, comments: [], output: '', pendingRequest: '', owner: '', repo: '' }
    const el = id => document.getElementById(id)

    async function api(path, options, pendingText) {
      if (typeof options === 'string') {
        pendingText = options
        options = undefined
      }
      if (pendingText) {
        state.pendingRequest = pendingText
        setStatus(pendingText)
        renderControls()
      }
      try {
        const res = await fetch(path, options)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Request failed')
        return data
      }
      finally {
        if (pendingText && state.pendingRequest === pendingText) {
          state.pendingRequest = ''
          renderControls()
        }
      }
    }

    function fields() {
      return {
        title: el('title').value,
        description: el('description').value,
        tags: el('tags').value,
        body: el('body').value
      }
    }

    function baseFields(comment) {
      return {
        title: comment.title || '',
        description: comment.description || '',
        tags: (comment.tags || []).join(','),
        body: comment.body || ''
      }
    }

    function sameFields(left, right) {
      return left.title === right.title &&
        left.description === right.description &&
        left.tags === right.tags &&
        left.body === right.body
    }

    function hasContent(value) {
      return Object.values(value).some(field => field.trim())
    }

    function setStatus(text) {
      el('status').textContent = text
      el('status').classList.toggle('busy', Boolean(state.pendingRequest) || /\\.\\.\\.$/.test(text))
    }

    function renderControls() {
      const busy = Boolean(state.pendingRequest)
      el('issue').disabled = busy
      el('refresh').disabled = busy
      el('new').disabled = busy
      el('preview').disabled = busy
      el('create').disabled = busy
      el('update').disabled = busy || !state.comment
      el('open').disabled = busy || !state.comment
      el('restoreDraft').disabled = busy
      el('discardDraft').disabled = busy
      document.querySelectorAll('.comment').forEach(button => {
        button.disabled = busy
      })
      el('status').classList.toggle('busy', busy)
    }

    function draftPrefix() {
      if (!state.owner || !state.repo) return ''
      return 'note-editor:' + state.owner + '/' + state.repo + ':'
    }

    function newDraftKey(issueNumber) {
      const prefix = draftPrefix()
      return prefix && issueNumber ? prefix + 'issue:' + issueNumber + ':new' : ''
    }

    function commentDraftKey(commentId) {
      const prefix = draftPrefix()
      return prefix && commentId ? prefix + 'comment:' + commentId : ''
    }

    function activeDraftKey() {
      if (state.comment) return commentDraftKey(state.comment.id)
      return newDraftKey(el('issue').value)
    }

    function readDraft(key) {
      if (!key) return null
      try {
        return JSON.parse(localStorage.getItem(key) || 'null')
      }
      catch {
        return null
      }
    }

    function writeDraft(key, draft) {
      if (!key) return
      try {
        localStorage.setItem(key, JSON.stringify(draft))
      }
      catch {
        setStatus('Unable to save local draft')
      }
    }

    function removeDraft(key) {
      if (!key) return
      try {
        localStorage.removeItem(key)
      }
      catch {
        setStatus('Unable to remove local draft')
      }
    }

    function saveActiveDraft() {
      const current = fields()
      if (state.comment) {
        const key = commentDraftKey(state.comment.id)
        if (sameFields(current, baseFields(state.comment))) {
          removeDraft(key)
        }
        else {
          writeDraft(key, {
            version: 1,
            issueNumber: Number(el('issue').value),
            commentId: state.comment.id,
            fields: current,
            baseUpdatedAt: state.comment.updatedAt,
            savedAt: new Date().toISOString()
          })
        }
      }
      else {
        const key = newDraftKey(el('issue').value)
        if (hasContent(current)) {
          writeDraft(key, {
            version: 1,
            issueNumber: Number(el('issue').value),
            commentId: null,
            fields: current,
            baseUpdatedAt: null,
            savedAt: new Date().toISOString()
          })
        }
        else {
          removeDraft(key)
        }
      }
      renderDraftNotice()
      renderCommentDraftMarks()
    }

    function formatSavedAt(value) {
      if (!value) return 'unknown time'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return 'unknown time'
      return date.toLocaleString()
    }

    function renderDraftNotice() {
      const draft = readDraft(activeDraftKey())
      el('draftBanner').classList.toggle('visible', Boolean(draft))
      if (!draft) {
        el('draftText').textContent = ''
        return
      }
      el('draftText').innerHTML = '<strong>Local draft</strong> saved ' + escapeHtml(formatSavedAt(draft.savedAt)) + '.'
    }

    function restoreDraft() {
      const draft = readDraft(activeDraftKey())
      if (!draft || !draft.fields) return
      el('title').value = draft.fields.title || ''
      el('description').value = draft.fields.description || ''
      el('tags').value = draft.fields.tags || ''
      el('body').value = draft.fields.body || ''
      setStatus('Draft restored')
      preview().catch(error => setStatus(error.message))
    }

    function discardDraft() {
      removeDraft(activeDraftKey())
      if (state.comment) {
        const current = baseFields(state.comment)
        el('title').value = current.title
        el('description').value = current.description
        el('tags').value = current.tags
        el('body').value = current.body
        preview().catch(error => setStatus(error.message))
      }
      else {
        el('title').value = ''
        el('description').value = ''
        el('tags').value = ''
        el('body').value = ''
        state.output = ''
        el('previewBox').className = 'preview-card empty'
        el('previewBox').textContent = 'Preview will appear here.'
        el('rawBox').textContent = ''
      }
      renderDraftNotice()
      renderCommentDraftMarks()
      setStatus('Draft discarded')
    }

    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]))
    }

    function renderMarkdown(markdown) {
      if (!markdown.trim()) return '<p class="muted">No Markdown body.</p>'
      const blocks = markdown.split(/\\n{2,}/).map(block => {
        if (block.startsWith('\`\`\`')) {
          return '<pre>' + escapeHtml(block.replace(/^\`\`\`\\w*\\n?/, '').replace(/\`\`\`$/, '')) + '</pre>'
        }
        if (/^#{1,3}\\s/.test(block)) {
          const level = block.match(/^#+/)[0].length
          return '<h' + level + '>' + escapeHtml(block.replace(/^#{1,3}\\s/, '')) + '</h' + level + '>'
        }
        return '<p>' + escapeHtml(block).replace(/\\n/g, '<br>') + '</p>'
      })
      return blocks.join('')
    }

    function setActiveTab(id) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === id))
      document.querySelectorAll('.pane').forEach(pane => pane.classList.toggle('active', pane.id === id))
    }

    function clearForm() {
      state.comment = null
      document.querySelectorAll('.comment').forEach(button => button.classList.remove('active'))
      el('title').value = ''
      el('description').value = ''
      el('tags').value = ''
      el('body').value = ''
      state.output = ''
      el('previewBox').className = 'preview-card empty'
      el('previewBox').textContent = 'Preview will appear here.'
      el('rawBox').textContent = ''
      renderControls()
      renderDraftNotice()
    }

    function fillForm(comment) {
      state.comment = comment
      document.querySelectorAll('.comment').forEach(button => button.classList.toggle('active', button.dataset.commentId === String(comment.id)))
      const current = baseFields(comment)
      el('title').value = current.title
      el('description').value = current.description
      el('tags').value = current.tags
      el('body').value = current.body
      renderControls()
      renderDraftNotice()
      setStatus('Selected #' + comment.id)
      preview().catch(error => setStatus(error.message))
    }

    async function loadIssues() {
      const auth = await api('/api/auth', 'Loading auth...')
      state.owner = auth.owner
      state.repo = auth.repo
      el('auth').textContent = auth.login + ' -> ' + auth.owner + '/' + auth.repo
      const issues = await api('/api/issues', 'Loading issues...')
      el('issue').innerHTML = issues.map(issue => '<option value="' + issue.number + '">' + issue.title + ' #' + issue.number + '</option>').join('')
      const snippets = issues.find(issue => issue.title === 'Snippets')
      state.issue = snippets || issues[0]
      if (state.issue) el('issue').value = state.issue.number
      await loadComments()
    }

    async function loadComments() {
      const number = el('issue').value
      if (!number) return
      const previousIssue = state.issue
      const previousComments = state.comments
      el('comments').innerHTML = '<div class="comments-loading">Loading comments...</div>'
      try {
        const comments = await api('/api/issues/' + number + '/comments', 'Loading comments...')
        state.issue = { number }
        state.comments = comments
        clearForm()
        renderComments()
        setStatus(state.comments.length + ' comments')
      }
      catch (error) {
        state.issue = previousIssue
        state.comments = previousComments
        renderComments()
        renderCommentDraftMarks()
        renderControls()
        setStatus(error.message)
      }
    }

    function renderComments() {
      el('comments').innerHTML = ''
      for (const comment of state.comments) {
        const button = document.createElement('button')
        button.className = 'comment'
        button.dataset.commentId = comment.id
        button.innerHTML = '<strong></strong><span></span>'
        button.querySelector('strong').textContent = comment.title || comment.body.slice(0, 60) || '#' + comment.id
        button.querySelector('span').textContent = '#' + comment.id + ' updated ' + comment.updatedAt
        button.addEventListener('click', () => fillForm(comment))
        el('comments').appendChild(button)
      }
      renderCommentDraftMarks()
      renderControls()
    }

    function renderCommentDraftMarks() {
      document.querySelectorAll('.comment').forEach(button => {
        const draft = readDraft(commentDraftKey(button.dataset.commentId))
        button.classList.toggle('has-draft', Boolean(draft))
        const span = button.querySelector('span')
        if (!span) return
        const base = span.dataset.baseText || span.textContent
        span.dataset.baseText = base
        span.innerHTML = escapeHtml(base) + (draft ? ' <span class="draft-mark">draft</span>' : '')
      })
    }

    async function preview() {
      const data = await api('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields())
      })
      state.output = data.body
      el('rawBox').textContent = data.body
      const current = fields()
      const tags = current.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      el('previewBox').className = 'preview-card'
      el('previewBox').innerHTML =
        '<h1>' + escapeHtml(current.title || 'Untitled') + '</h1>' +
        (current.description ? '<p class="muted">' + escapeHtml(current.description) + '</p>' : '') +
        '<div class="tag-row">' + tags.map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join('') + '</div>' +
        '<div class="rendered">' + renderMarkdown(current.body) + '</div>'
      return data.body
    }

    el('issue').addEventListener('change', loadComments)
    el('refresh').addEventListener('click', loadComments)
    el('new').addEventListener('click', () => { clearForm(); setStatus(readDraft(activeDraftKey()) ? 'New comment has a local draft' : 'New comment') })
    el('restoreDraft').addEventListener('click', restoreDraft)
    el('discardDraft').addEventListener('click', discardDraft)
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)))
    el('preview').addEventListener('click', () => preview().catch(error => setStatus(error.message)))
    ;['title', 'description', 'tags', 'body'].forEach(id => {
      el(id).addEventListener('input', () => {
        saveActiveDraft()
        clearTimeout(state.previewTimer)
        state.previewTimer = setTimeout(() => preview().catch(error => setStatus(error.message)), 350)
      })
    })
    el('create').addEventListener('click', async () => {
      try {
        const comment = await api('/api/issues/' + el('issue').value + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields())
        }, 'Creating...')
        removeDraft(newDraftKey(el('issue').value))
        setStatus('Created #' + comment.id)
        await loadComments()
      } catch (error) {
        setStatus(error.message)
      }
    })
    el('update').addEventListener('click', async () => {
      if (!state.comment) return
      try {
        const key = commentDraftKey(state.comment.id)
        const comment = await api('/api/comments/' + state.comment.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields())
        }, 'Updating...')
        removeDraft(key)
        setStatus('Updated #' + comment.id)
        await loadComments()
      } catch (error) {
        setStatus(error.message)
      }
    })
    el('open').addEventListener('click', () => {
      if (state.comment) window.open(state.comment.htmlUrl, '_blank', 'noopener')
    })

    loadIssues().catch(error => setStatus(error.message))
  </script>
</body>
</html>`
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
