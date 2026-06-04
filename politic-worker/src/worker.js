const MAX_SUBJECT_LEN = 500;
const JOB_PREFIX = "job:";
const INDEX_KEY = "jobs:index";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      ...headers,
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nowIso() {
  return new Date().toISOString();
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  if (origin === "https://politic.vivaforever.ro") {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-politic-password",
      "access-control-max-age": "86400",
    };
  }
  return {};
}

async function requirePassword(request, env) {
  const supplied = request.headers.get("x-politic-password") || "";
  if (!env.APP_PASSWORD) return false;
  return supplied === env.APP_PASSWORD;
}

async function requireAgent(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!env.HERMES_SHARED_SECRET) return false;
  return auth === `Bearer ${env.HERMES_SHARED_SECRET}`;
}

async function loadIndex(env) {
  const raw = await env.POLITIC_KV.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function saveIndex(env, ids) {
  const unique = [...new Set(ids)].slice(0, 100);
  await env.POLITIC_KV.put(INDEX_KEY, JSON.stringify(unique));
}

async function loadJob(env, id) {
  const raw = await env.POLITIC_KV.get(`${JOB_PREFIX}${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveJob(env, job) {
  await env.POLITIC_KV.put(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
}

const PAGE = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Politic - Viva Forever</title>
  <style>
    :root { color-scheme: dark; --bg:#101114; --card:#17191f; --text:#eee; --muted:#aab; --line:#2a2d36; --accent:#d6b35a; --bad:#e06c75; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; }
    main { max-width:960px; margin:0 auto; padding:32px 18px 60px; }
    h1 { margin:0 0 6px; font-size:28px; }
    .muted { color:var(--muted); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; margin:18px 0; }
    input, textarea, button { width:100%; border-radius:10px; border:1px solid var(--line); background:#0d0e12; color:var(--text); padding:12px; font:inherit; }
    textarea { min-height:110px; resize:vertical; }
    button { background:var(--accent); color:#111; font-weight:700; cursor:pointer; border:none; margin-top:10px; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .row { display:grid; grid-template-columns: 1fr 160px; gap:10px; }
    .job { padding:12px; border-bottom:1px solid var(--line); cursor:pointer; }
    .job:hover { background:#1d2028; }
    .status { display:inline-block; padding:2px 8px; border-radius:999px; background:#2a2d36; font-size:13px; }
    .error { color:var(--bad); white-space:pre-wrap; }
    article { white-space:pre-wrap; font-size:18px; line-height:1.65; }
    img.hero { max-width:100%; border-radius:12px; border:1px solid var(--line); margin:12px 0; }
    a { color:var(--accent); }
    @media (max-width:700px) { .row { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Politic - generator manual</h1>
  <div class="muted">Pagină privată, noindex. Articole generate de profilul Hermes <code>political_analyst</code>.</div>

  <section id="login" class="card">
    <h2>Acces</h2>
    <input id="password" type="password" placeholder="Parolă">
    <button id="loginBtn">Intră</button>
    <div id="loginErr" class="error"></div>
  </section>

  <section id="app" style="display:none">
    <div class="card">
      <h2>Subiect nou</h2>
      <textarea id="subject" maxlength="500" placeholder="Scrie subiectul articolului..."></textarea>
      <button id="goBtn">Go</button>
      <div id="createMsg" class="muted"></div>
    </div>

    <div class="card">
      <h2>History</h2>
      <div id="jobs" class="muted">Se încarcă...</div>
    </div>

    <div class="card" id="viewer" style="display:none">
      <div class="row"><h2 id="articleTitle">Articol</h2><div><span id="articleStatus" class="status"></span></div></div>
      <div id="articleMeta" class="muted"></div>
      <img id="articleImage" class="hero" style="display:none" alt="Imagine articol">
      <div id="articleError" class="error"></div>
      <article id="articleBody"></article>
    </div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let password = localStorage.getItem('politic_password') || '';
let selectedId = null;
let timer = null;

function headers() { return {'content-type':'application/json', 'x-politic-password': password}; }
async function api(path, opts={}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function login() {
  password = $('password').value || password;
  try {
    await api('/api/jobs');
    localStorage.setItem('politic_password', password);
    $('login').style.display = 'none';
    $('app').style.display = '';
    await refreshJobs();
    timer = setInterval(tick, 5000);
  } catch (e) { $('loginErr').textContent = 'Parolă greșită sau API indisponibil.'; }
}

async function createJob() {
  const subject = $('subject').value.trim();
  if (!subject) return;
  $('goBtn').disabled = true;
  $('createMsg').textContent = 'Trimis. Agentul îl va prelua la următorul poll.';
  try {
    const job = await api('/api/jobs', {method:'POST', body:JSON.stringify({subject})});
    $('subject').value = '';
    selectedId = job.id;
    await refreshJobs();
    await loadJob(job.id);
  } catch (e) { $('createMsg').textContent = e.message; }
  finally { $('goBtn').disabled = false; }
}

async function refreshJobs() {
  const data = await api('/api/jobs');
  const jobs = data.jobs || [];
  $('jobs').innerHTML = jobs.length ? jobs.map(j => '<div class="job" data-id="' + escapeHtml(j.id) + '"><b>' + escapeHtml(j.title || j.subject) + '</b><br><span class="status">' + escapeHtml(j.status) + '</span> <span class="muted">' + escapeHtml(j.created_at || '') + '</span></div>').join('') : 'Niciun articol încă.';
  document.querySelectorAll('.job').forEach(el => el.onclick = () => { selectedId = el.dataset.id; loadJob(selectedId); });
}

async function loadJob(id) {
  const job = await api('/api/jobs/' + encodeURIComponent(id));
  $('viewer').style.display = '';
  $('articleTitle').textContent = job.title || job.subject || 'Articol';
  $('articleStatus').textContent = job.status;
  $('articleMeta').textContent = [job.created_at, job.completed_at ? 'gata: ' + job.completed_at : '', job.markdown_path || ''].filter(Boolean).join(' | ');
  $('articleError').textContent = job.error || '';
  $('articleBody').textContent = job.article_text || (job.status === 'done' ? '' : 'Încă se generează... pagina se actualizează automat.');
  if (job.image_data_url) { $('articleImage').src = job.image_data_url; $('articleImage').style.display = ''; }
  else { $('articleImage').style.display = 'none'; }
}

async function tick() {
  try {
    await refreshJobs();
    if (selectedId) await loadJob(selectedId);
  } catch (_) {}
}

$('loginBtn').onclick = login;
$('goBtn').onclick = createJob;
$('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
if (password) { $('password').value = password; login(); }
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.endsWith(".workers.dev")) {
      url.hostname = "politic.vivaforever.ro";
      return Response.redirect(url.toString(), 301);
    }
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });

    if (url.pathname === "/" || url.pathname === "/index.html") return html(PAGE);
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow, noarchive" } });

    if (url.pathname.startsWith("/api/agent/")) {
      if (!(await requireAgent(request, env))) return json({ error: "unauthorized" }, 401);

      if (url.pathname === "/api/agent/claim" && request.method === "GET") {
        const ids = await loadIndex(env);
        for (const id of ids) {
          const job = await loadJob(env, id);
          if (job && job.status === "queued") {
            job.status = "claimed";
            job.claimed_at = nowIso();
            await saveJob(env, job);
            return json({ job });
          }
        }
        return json({ job: null });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+\/status$/) && request.method === "POST") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404);
        const body = await request.json();
        job.status = String(body.status || job.status).slice(0, 50);
        job.updated_at = nowIso();
        await saveJob(env, job);
        return json({ ok: true });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+\/complete$/) && request.method === "POST") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404);
        const body = await request.json();
        Object.assign(job, {
          status: "done",
          completed_at: nowIso(),
          title: body.title || job.title,
          topic: body.topic || job.subject,
          article_text: body.article_text || "",
          markdown_path: body.markdown_path || "",
          image_path: body.image_path || "",
          image_data_url: body.image_data_url || "",
          sources: body.sources || [],
          updated_at: nowIso(),
        });
        await saveJob(env, job);
        return json({ ok: true });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+\/fail$/) && request.method === "POST") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404);
        const body = await request.json().catch(() => ({}));
        job.status = "failed";
        job.error = String(body.error || "failed").slice(0, 5000);
        job.completed_at = nowIso();
        job.updated_at = nowIso();
        await saveJob(env, job);
        return json({ ok: true });
      }

      return json({ error: "not found" }, 404);
    }

    if (url.pathname.startsWith("/api/")) {
      if (!(await requirePassword(request, env))) return json({ error: "unauthorized" }, 401, corsHeaders(request));

      if (url.pathname === "/api/jobs" && request.method === "GET") {
        const ids = await loadIndex(env);
        const jobs = [];
        for (const id of ids) {
          const job = await loadJob(env, id);
          if (job) jobs.push({ id: job.id, subject: job.subject, title: job.title, status: job.status, created_at: job.created_at, completed_at: job.completed_at });
        }
        return json({ jobs }, 200, corsHeaders(request));
      }

      if (url.pathname === "/api/jobs" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const subject = String(body.subject || "").trim().slice(0, MAX_SUBJECT_LEN);
        if (!subject) return json({ error: "subject required" }, 400, corsHeaders(request));
        const id = `${Date.now().toString(36)}-${(await sha256(subject + nowIso())).slice(0, 10)}`;
        const job = { id, subject, status: "queued", created_at: nowIso(), updated_at: nowIso() };
        await saveJob(env, job);
        const ids = await loadIndex(env);
        await saveIndex(env, [id, ...ids]);
        return json(job, 201, corsHeaders(request));
      }

      const match = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (match && request.method === "GET") {
        const job = await loadJob(env, decodeURIComponent(match[1]));
        if (!job) return json({ error: "not found" }, 404, corsHeaders(request));
        return json(job, 200, corsHeaders(request));
      }
    }

    return json({ error: "not found" }, 404);
  },
};
