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
    main { max-width:1240px; margin:0 auto; padding:28px 18px 60px; }
    h1 { margin:0 0 18px; font-size:28px; }
    h2 { margin:0 0 12px; }
    .muted { color:var(--muted); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; }
    input, textarea, button { width:100%; border-radius:10px; border:1px solid var(--line); background:#0d0e12; color:var(--text); padding:12px; font:inherit; }
    textarea { min-height:54px; max-height:260px; resize:none; overflow:hidden; padding-right:58px; }
    button { background:var(--accent); color:#111; font-weight:700; cursor:pointer; border:none; margin-top:10px; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .inputWrap { position:relative; }
    .sendBtn { position:absolute; right:10px; bottom:10px; width:36px; height:36px; padding:0; margin:0; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:22px; line-height:1; }
    .layout { display:grid; grid-template-columns:320px minmax(0,1fr); gap:18px; align-items:start; }
    .sidebar { position:sticky; top:18px; max-height:calc(100vh - 36px); overflow:auto; }
    .sidebarCard { padding:0; overflow:hidden; }
    .sidebarCard h2 { padding:14px 14px 10px; margin:0; }
    .compose { margin-bottom:18px; }
    .content.emptyMode { min-height:calc(100vh - 118px); display:flex; flex-direction:column; justify-content:center; }
    .content.emptyMode .compose { max-width:760px; width:100%; margin:0 auto; }
    .content.emptyMode #viewer { display:none; }
    .examples { display:none; margin-top:16px; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .content.emptyMode .examples { display:grid; }
    .example { text-align:left; color:var(--text); background:#111318; border:1px solid var(--line); border-radius:12px; padding:12px; cursor:pointer; font-size:14px; line-height:1.35; }
    .example:hover { border-color:var(--accent); background:#1d2028; }
    .example b { display:block; color:var(--accent); margin-bottom:4px; }
    .row { display:grid; grid-template-columns: 1fr auto; align-items:start; gap:10px; }
    .jobsList { display:flex; flex-direction:column; gap:0; }
    .job { padding:10px 12px; border:0; border-top:1px solid var(--line); border-radius:0; cursor:pointer; background:transparent; transition:background .15s,border-color .15s; }
    .job:hover { background:#1d2028; }
    .job.active { border-color:var(--line); background:#242116; box-shadow:inset 3px 0 0 var(--accent); }
    .jobTitle { display:block; font-weight:650; line-height:1.25; }
    .jobSubject { display:block; margin-top:4px; font-size:13px; color:var(--muted); line-height:1.3; }
    .status { display:inline-block; padding:2px 8px; border-radius:999px; background:#2a2d36; font-size:13px; white-space:nowrap; }
    .error { color:var(--bad); white-space:pre-wrap; }
    article { white-space:pre-wrap; font-size:18px; line-height:1.65; }
    img.hero { max-width:100%; border-radius:12px; border:1px solid var(--line); margin:12px 0; }
    a { color:var(--accent); }
    .emptyViewer { color:var(--muted); font-size:18px; padding:42px; text-align:center; }
    @media (max-width:850px) { main { padding-top:18px; } .layout { grid-template-columns:1fr; } .sidebar { position:static; max-height:none; } .row { grid-template-columns:1fr; } .content.emptyMode { min-height:auto; } .examples { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Generator de articole</h1>

  <section id="login" class="card">
    <h2>Acces</h2>
    <input id="password" type="password" placeholder="Parolă">
    <button id="loginBtn">Intră</button>
    <div id="loginErr" class="error"></div>
  </section>

  <section id="app" style="display:none">
    <div class="layout">
      <aside class="sidebar">
        <div class="card sidebarCard">
          <h2>Articole</h2>
          <div id="jobs" class="jobsList muted">Se încarcă...</div>
        </div>
      </aside>

      <section id="content" class="content emptyMode">
        <div class="card compose">
          <h2>Subiect nou</h2>
          <div class="inputWrap">
            <textarea id="subject" maxlength="500" placeholder="Scrie subiectul articolului..."></textarea>
            <button id="goBtn" class="sendBtn" title="Generează" aria-label="Generează">↑</button>
          </div>
          <div id="createMsg" class="muted"></div>
          <div class="examples" id="examples">
            <div class="example" data-example="Subiect: pensiile speciale ale magistraților\n\nUnghi: Nu e o discuție despre invidia față de profesii bine plătite, ci despre contractul rupt dintre stat și cetățean. Când statul cere austeritate de la oamenii obișnuiți, nu poate apăra privilegii greu de justificat.\n\nTon: ferm, civic-conservator, pe înțelesul oamenilor, fără limbaj tehnocratic.\n\nLimite: fără atacuri personale, fără exagerări, fără clișee populiste."><b>Pensii speciale</b>Contractul rupt dintre stat și cetățean.</div>
            <div class="example" data-example="Subiect: Elena Udrea și ieșirea din penitenciar\n\nUnghi: Nu centra articolul pe personajul monden. Folosește cazul ca simbol pentru problema mai mare: pedeapsa se termină, dar prejudiciul și neîncrederea rămân la cetățean.\n\nTon: critic față de statul care nu recuperează banii și față de spectacolul mediatic care înlocuiește răspunderea reală.\n\nLimite: ton ferm, dar nu vindicativ; fără atacuri personale."><b>Caz public</b>Persoana ca simbol pentru o problemă mai mare.</div>
            <div class="example" data-example="Subiect: creșterea taxelor locale\n\nUnghi: Scrie din perspectiva omului obișnuit care plătește taxe și vrea dreptate egală pentru toți. Statul cere mai mult înainte să dovedească faptul că respectă banii deja luați.\n\nTon: popular, concret, critic față de risipa administrativă, dar fără isterie."><b>Taxe locale</b>Perspectiva omului care muncește și plătește.</div>
            <div class="example" data-example="Subiect: reforma din educație\n\nUnghi: Privește tema prin familie, muncă și viitorul copiilor, nu prin limbaj de minister. Arată cum deciziile abstracte se simt în casa unei familii normale.\n\nTon: cald față de părinți și profesori, ferm cu statul care promite mult și livrează haotic."><b>Educație</b>Familie, școală și stat care promite haotic.</div>
          </div>
        </div>

        <div class="card" id="viewer">
          <div id="emptyViewer" class="emptyViewer">Selectează un articol din stânga sau creează unul nou.</div>
          <div id="articleContent" style="display:none">
            <div class="row"><h2 id="articleTitle">Articol</h2><div><span id="articleStatus" class="status"></span></div></div>
            <div id="articleMeta" class="muted"></div>
            <img id="articleImage" class="hero" style="display:none" alt="Imagine articol">
            <div id="articleError" class="error"></div>
            <article id="articleBody"></article>
          </div>
        </div>
      </section>
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
function autoResizeSubject() {
  const el = $('subject');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 260) + 'px';
  el.style.overflowY = el.scrollHeight > 260 ? 'auto' : 'hidden';
}

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
    autoResizeSubject();
    selectedId = job.id;
    await refreshJobs();
    await loadJob(job.id);
  } catch (e) { $('createMsg').textContent = e.message; }
  finally { $('goBtn').disabled = false; }
}

async function refreshJobs() {
  const data = await api('/api/jobs');
  const jobs = data.jobs || [];
  $('jobs').innerHTML = jobs.length ? jobs.map(j => {
    const active = selectedId === j.id ? ' active' : '';
    const title = escapeHtml(j.title || j.subject);
    const subject = j.title && j.subject && j.title !== j.subject ? '<span class="jobSubject">' + escapeHtml(j.subject) + '</span>' : '';
    return '<div class="job' + active + '" data-id="' + escapeHtml(j.id) + '"><span class="jobTitle">' + title + '</span>' + subject + '<span class="status">' + escapeHtml(j.status) + '</span></div>';
  }).join('') : 'Niciun articol încă.';
  document.querySelectorAll('.job').forEach(el => el.onclick = () => { selectedId = el.dataset.id; loadJob(selectedId); refreshJobs(); });
}

async function loadJob(id) {
  const job = await api('/api/jobs/' + encodeURIComponent(id));
  $('content').classList.remove('emptyMode');
  $('emptyViewer').style.display = 'none';
  $('articleContent').style.display = '';
  $('articleTitle').textContent = job.title || job.subject || 'Articol';
  $('articleStatus').textContent = job.status;
  $('articleMeta').textContent = '';
  $('articleError').textContent = job.status === 'failed' ? (job.error || '') : '';
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
$('subject').addEventListener('input', autoResizeSubject);
$('subject').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createJob(); });
document.querySelectorAll('.example').forEach(el => el.onclick = () => { $('subject').value = el.dataset.example || ''; autoResizeSubject(); $('subject').focus(); });
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
          error: "",
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
