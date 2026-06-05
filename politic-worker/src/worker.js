const MAX_SUBJECT_LEN = 500;
const TONE_OPTIONS = ["echilibrat", "ferm", "agresiv", "popular", "analitic", "ironie-rece"];
const VIEWPOINT_OPTIONS = ["suveranist", "aur", "psd", "pnl", "usr", "conservator", "conservator-independent", "neutru-critic"];
const JOB_PREFIX = "job:";
const INDEX_KEY = "jobs:index";
const DIRECT_ORIGIN = "https://gpt.vivaforever.ro";

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

function normalizeHeadingText(value) {
  return String(value || '')
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ro-RO')
    .replace(/^[\s.,:;!?—–\-"'()[\]{}]+|[\s.,:;!?—–\-"'()[\]{}]+$/g, '');
}

function stripDuplicateLeadingTitle(articleText, title) {
  const titleNorm = normalizeHeadingText(title);
  const text = String(articleText || '').trimStart();
  if (!text || !titleNorm) return text;
  const lines = text.split(/\r?\n/);
  const firstIndex = lines.findIndex((line) => line.trim());
  if (firstIndex < 0) return '';
  if (normalizeHeadingText(lines[firstIndex]) !== titleNorm) return text;
  lines.splice(firstIndex, 1);
  while (firstIndex < lines.length && !lines[firstIndex].trim()) lines.splice(firstIndex, 1);
  return lines.join('\n').trim();
}

function cleanArticleTextForTitle(articleText, title) {
  return stripDuplicateLeadingTitle(articleText, title);
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  if (origin === "https://politic.vivaforever.ro") {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
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
  const unique = [...new Set(ids)].slice(0, 500);
  await env.POLITIC_KV.put(INDEX_KEY, JSON.stringify(unique));
}

async function loadJob(env, id) {
  const raw = await env.POLITIC_KV.get(`${JOB_PREFIX}${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveJob(env, job) {
  await env.POLITIC_KV.put(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
}

async function startDirect(env, path, job) {
  if (!env.HERMES_SHARED_SECRET) throw new Error("direct secret missing");
  const res = await fetch(DIRECT_ORIGIN + path, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "authorization": `Bearer ${env.HERMES_SHARED_SECRET}`,
    },
    body: JSON.stringify({ job }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `direct server ${res.status}`);
  return data;
}

const PAGE = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Generator de articole</title>
  <script>try { if (localStorage.getItem('politic_password')) document.documentElement.classList.add('hasSavedPassword'); } catch (_) {}</script>
  <style>
    :root { color-scheme: dark; --bg:#101114; --card:#17191f; --text:#eee; --muted:#aab; --line:#2a2d36; --accent:#d6b35a; --bad:#e06c75; }
    * { box-sizing:border-box; }
    html { width:100%; -webkit-text-size-adjust:100%; text-size-adjust:100%; }
    body { width:100%; margin:0; overflow-x:hidden; background:var(--bg); color:var(--text); font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; }
    main { width:100%; margin:0; padding:0; }
    h1 { margin:0 0 18px; font-size:28px; }
    h2 { margin:0 0 12px; }
    .muted { color:var(--muted); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; }
    .hasSavedPassword #login { display:none; }
    .loginShell { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:radial-gradient(circle at 50% 35%, rgba(214,179,90,.12), transparent 32%), var(--bg); }
    .loginCard { width:min(360px, 100%); padding:26px; border-radius:20px; box-shadow:0 24px 80px rgba(0,0,0,.32); }
    .loginCard h2 { text-align:center; margin:0 0 18px; font-size:22px; color:rgba(238,238,238,.82); }
    .loginInputWrap { position:relative; }
    .loginCard input { text-align:center; padding-right:58px; }
    #loginBtn { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:36px; min-width:0; height:36px; border-radius:999px; padding:0; margin:0; display:flex; align-items:center; justify-content:center; font-size:22px; line-height:1; }
    #loginErr { margin-top:14px; text-align:center; font-size:14px; }
    input, textarea, button { width:100%; border-radius:10px; border:1px solid var(--line); background:#0d0e12; color:var(--text); padding:12px; font:inherit; }
    textarea { min-height:54px; resize:none; overflow:hidden; padding-right:58px; }
    select { border-radius:999px; border:1px solid var(--line); background:#111318; color:rgba(238,238,238,.82); padding:8px 32px 8px 11px; font:inherit; font-size:13px; outline:none; }
    button { background:var(--accent); color:#111; font-weight:700; cursor:pointer; border:none; margin-top:10px; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .inputWrap { position:relative; }
    .sendBtn { position:absolute; right:10px; bottom:15px; width:36px; height:36px; padding:0; margin:0; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:22px; line-height:1; }
    .composerOptions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; }
    .composerOptions select { width:auto; max-width:100%; }
    .layout { display:grid; grid-template-columns:300px minmax(0,1fr); min-height:100vh; }
    .desktopNewsBtn { position:fixed; top:14px; right:16px; z-index:12; width:auto; padding:8px 12px; border:1px solid rgba(214,179,90,.42); border-radius:999px; background:rgba(23,25,31,.88); color:var(--accent); text-decoration:none; font-size:14px; font-weight:650; backdrop-filter:blur(12px); box-shadow:0 10px 34px rgba(0,0,0,.24); }
    .desktopNewsBtn:hover { background:#242116; border-color:var(--accent); }
    .mobileTopbar, .sidebarBackdrop { display:none; }
    .sidebar { position:sticky; top:0; height:100vh; max-height:100vh; overflow:auto; border-right:1px solid var(--line); background:#0d0e12; }
    .sidebarCard { padding:0; overflow:hidden; border:0; border-radius:0; background:transparent; }
    .sidebarCard h2 { padding:18px 14px 10px; margin:0; }
    .articleSearchWrap { padding:0 12px 12px; }
    .articleSearch { width:100%; padding:9px 10px; border-radius:10px; background:#111318; color:var(--text); border:1px solid var(--line); font-size:14px; }
    .emptyList { display:block; padding:10px 12px; color:var(--muted); }
    .content { padding:28px 18px 60px; max-width:940px; width:100%; margin:0 auto; }
    .pageTitle { max-width:760px; width:100%; margin:0 auto 18px; text-align:center; color:rgba(238,238,238,.3); }
    .content:not(.emptyMode) .pageTitle { display:none; }
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
    .job { position:relative; display:grid; grid-template-columns:minmax(0,1fr) 28px; gap:8px; align-items:start; padding:10px 8px 10px 12px; border:0; border-top:1px solid var(--line); border-radius:0; cursor:pointer; background:transparent; transition:background .15s,border-color .15s; }
    .job:hover { background:#1d2028; }
    .job.active { border-color:var(--line); background:#242116; box-shadow:inset 3px 0 0 var(--accent); }
    .jobMain { min-width:0; }
    .jobTitle { display:block; font-weight:650; line-height:1.25; }
    .jobSubject { display:block; margin-top:4px; font-size:13px; color:rgba(238,238,238,.5); line-height:1.3; }
    .jobActions { position:relative; opacity:0; pointer-events:none; transition:opacity .12s ease; }
    .job:hover .jobActions, .job:focus-within .jobActions, .job.menuOpen .jobActions { opacity:1; pointer-events:auto; }
    .jobActionBtn { width:28px; height:28px; padding:0; margin:0; border-radius:8px; color:rgba(238,238,238,.55); background:transparent; display:flex; align-items:center; justify-content:center; font-size:20px; line-height:1; }
    .jobActionBtn:hover { background:#2a2d36; color:var(--text); }
    .jobMenu { position:absolute; top:30px; right:0; min-width:104px; padding:6px; border:1px solid var(--line); border-radius:10px; background:#17191f; box-shadow:0 12px 40px rgba(0,0,0,.34); z-index:5; }
    .jobMenu[hidden] { display:none; }
    .deleteJobBtn { width:100%; margin:0; padding:8px 10px; border-radius:8px; background:transparent; color:var(--bad); text-align:left; font-size:14px; font-weight:600; }
    .deleteJobBtn:hover { background:rgba(224,108,117,.12); }
    .articleTop { display:grid; grid-template-columns:minmax(0,1fr) 32px; align-items:start; gap:10px; }
    .articleActions { position:relative; }
    .articleActionBtn { width:32px; height:32px; padding:0; margin:0; border-radius:9px; color:rgba(238,238,238,.7); background:#111318; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:22px; line-height:1; }
    .articleActionBtn:hover { background:#242833; color:var(--text); }
    .articleMenu { position:absolute; top:36px; right:0; min-width:150px; padding:6px; border:1px solid var(--line); border-radius:10px; background:#17191f; box-shadow:0 12px 40px rgba(0,0,0,.34); z-index:10; }
    .articleMenu[hidden] { display:none; }
    .articleMenu button { width:100%; margin:0; padding:8px 10px; border-radius:8px; background:transparent; color:var(--text); text-align:left; font-size:14px; font-weight:600; }
    .articleMenu button:hover { background:#242833; }
    .articleMenu button.danger { color:var(--bad); }
    .articleMenu button.danger:hover { background:rgba(224,108,117,.12); }
    .status { display:inline-block; padding:2px 8px; border-radius:999px; background:#2a2d36; font-size:13px; white-space:nowrap; }
    .error { color:var(--bad); white-space:pre-wrap; }
    article { white-space:pre-wrap; font-size:18px; line-height:1.65; }
    img.hero { max-width:100%; border-radius:12px; border:1px solid var(--line); margin:12px 0; }
    .imageControls { margin:10px 0 14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .imageControls[hidden] { display:none; }
    .imageBtn { width:auto; margin:0; padding:9px 13px; border-radius:999px; background:var(--accent); color:#111; font-size:14px; font-weight:700; }
    .imageBtn[hidden] { display:none; }
    .imageLoading { display:flex; align-items:center; gap:8px; color:rgba(238,238,238,.55); font-size:14px; }
    .imageLoading[hidden] { display:none; }
    .spinner { width:15px; height:15px; border:2px solid rgba(238,238,238,.18); border-top-color:var(--accent); border-radius:999px; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    a { color:var(--accent); }
    .articleSources { margin-top:30px; padding-top:18px; border-top:1px solid var(--line); white-space:normal; }
    .articleSources[hidden] { display:none; }
    .articleSources h3 { margin:0 0 10px; font-size:16px; color:rgba(238,238,238,.62); }
    .articleSources ol { margin:0; padding-left:22px; }
    .articleSources li { margin:7px 0; padding-left:3px; color:rgba(238,238,238,.7); line-height:1.45; }
    .articleSources a { color:var(--accent); text-decoration:none; overflow-wrap:anywhere; }
    .articleSources a:hover { text-decoration:underline; }
    .waitingText { color:rgba(238,238,238,.5); font-size:16px; }
    @media (max-width:850px) {
      main { padding-top:0; }
      #app { padding-top:56px; }
      .desktopNewsBtn { display:none; }
      .mobileTopbar { position:fixed; top:0; left:0; right:0; width:100%; height:56px; z-index:20; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-bottom:1px solid var(--line); background:rgba(13,14,18,.96); backdrop-filter:blur(14px); }
      .mobileNavBtn { appearance:none; -webkit-appearance:none; width:auto; margin:0; padding:9px 12px; border-radius:999px; background:#17191f; color:var(--text); border:1px solid var(--line); font-size:14px; line-height:1; font-weight:650; white-space:nowrap; }
      .mobileNavBtn.primary { background:var(--accent); color:#111; border:0; }
      .mobileNavBtn[hidden] { display:none; }
      .sidebarBackdrop { display:block; position:fixed; inset:0; z-index:30; background:rgba(0,0,0,.5); opacity:0; pointer-events:none; transition:opacity .15s ease; }
      body.sidebarOpen .sidebarBackdrop { opacity:1; pointer-events:auto; }
      .layout { grid-template-columns:1fr; min-height:100vh; }
      .sidebar { position:fixed; top:0; left:0; z-index:40; width:min(86vw, 340px); height:100dvh; max-height:none; border-right:1px solid var(--line); border-bottom:0; transform:translateX(-105%); transition:transform .18s ease; box-shadow:20px 0 60px rgba(0,0,0,.38); }
      body.sidebarOpen .sidebar { transform:translateX(0); }
      .sidebarCard h2 { padding:14px 14px 10px; }
      .job { padding:9px 8px 9px 12px; }
      .jobActions { opacity:1; pointer-events:auto; }
      input, textarea, select { font-size:16px; line-height:1.35; touch-action:manipulation; }
      .composerOptions { flex-wrap:nowrap; gap:6px; margin-top:8px; overflow:hidden; }
      .composerOptions select { flex:1 1 0; min-width:0; height:34px; padding:6px 24px 6px 10px; border-radius:999px; background:#111318; border:1px solid rgba(238,238,238,.12); color:rgba(238,238,238,.74); font-size:16px; line-height:1.1; }
      .articleSearch { font-size:16px; }
      .content { padding:16px 14px 34px; max-width:none; }
      .content:not(.emptyMode) .compose { display:none; }
      .row { grid-template-columns:1fr; }
      .content.emptyMode { min-height:auto; justify-content:flex-start; }
      .pageTitle { display:none; }
      .content.emptyMode .compose { margin-top:0; }
      .examples { grid-template-columns:1fr; }
      .articleMenu { position:absolute; top:38px; right:0; left:auto; bottom:auto; min-width:190px; padding:8px; border-radius:14px; z-index:70; }
      .articleMenu button { min-height:46px; padding:12px 14px; border-radius:10px; text-align:left; font-size:16px; line-height:1.15; }
      article { font-size:17px; line-height:1.6; }
    }
  </style>
</head>
<body>
<main>

  <section id="login" class="loginShell">
    <div class="card loginCard">
      <h2>Acces privat</h2>
      <div class="loginInputWrap">
        <input id="password" type="password" placeholder="Parolă" autocomplete="current-password">
        <button id="loginBtn" title="Intră" aria-label="Intră">↑</button>
      </div>
      <div id="loginErr" class="error"></div>
    </div>
  </section>

  <section id="app" style="display:none">
    <a class="desktopNewsBtn" href="/casa-publica">Casa Publica</a>
    <div class="mobileTopbar">
      <button id="mobileSidebarBtn" class="mobileNavBtn primary">Articole</button>
      <button id="mobileBackBtn" class="mobileNavBtn" hidden>← Subiect nou</button>
    </div>
    <div id="sidebarBackdrop" class="sidebarBackdrop"></div>
    <div class="layout">
      <aside class="sidebar">
        <div class="card sidebarCard">
          <h2>Articole</h2>
          <div class="articleSearchWrap"><input id="articleSearch" class="articleSearch" type="search" placeholder="Caută în titluri și descrieri..."></div>
          <div id="jobs" class="jobsList"><span class="emptyList">Se încarcă...</span></div>
        </div>
      </aside>

      <section id="content" class="content emptyMode">
        <h1 class="pageTitle">Generator de articole</h1>
        <div class="card compose">
          <h2>Subiect nou</h2>
          <div class="inputWrap">
            <textarea id="subject" maxlength="500" placeholder="Scrie subiectul articolului..."></textarea>
            <button id="goBtn" class="sendBtn" title="Generează" aria-label="Generează">↑</button>
          </div>
          <div class="composerOptions" aria-label="Setări articol">
            <select id="toneSelect" title="Ton articol" aria-label="Ton articol">
              <option value="echilibrat">Echilibrat</option>
              <option value="ferm">Ferm</option>
              <option value="agresiv">Agresiv</option>
              <option value="popular">Popular</option>
              <option value="analitic">Analitic</option>
              <option value="ironie-rece">Ironie rece</option>
            </select>
            <select id="viewpointSelect" title="Punct de vedere" aria-label="Punct de vedere">
              <option value="suveranist">Suveranist</option>
              <option value="aur">AUR</option>
              <option value="psd">PSD</option>
              <option value="pnl">PNL</option>
              <option value="usr">USR</option>
              <option value="conservator">Conservator</option>
              <option value="neutru-critic">Neutru critic</option>
            </select>
          </div>
          <div id="createMsg" class="muted"></div>
          <div class="examples" id="examples">
            <div class="example" data-example="Subiect: pensiile speciale ale magistraților\n\nUnghi: Nu e o discuție despre invidia față de profesii bine plătite, ci despre contractul rupt dintre stat și cetățean. Când statul cere austeritate de la oamenii obișnuiți, nu poate apăra privilegii greu de justificat.\n\nTon: ferm, civic-conservator, pe înțelesul oamenilor, fără limbaj tehnocratic.\n\nLimite: fără atacuri personale, fără exagerări, fără clișee populiste."><b>Pensii speciale</b>Contractul rupt dintre stat și cetățean.</div>
            <div class="example" data-example="Subiect: Elena Udrea și ieșirea din penitenciar\n\nUnghi: Nu centra articolul pe personajul monden. Folosește cazul ca simbol pentru problema mai mare: pedeapsa se termină, dar prejudiciul și neîncrederea rămân la cetățean.\n\nTon: critic față de statul care nu recuperează banii și față de spectacolul mediatic care înlocuiește răspunderea reală.\n\nLimite: ton ferm, dar nu vindicativ; fără atacuri personale."><b>Caz public</b>Persoana ca simbol pentru o problemă mai mare.</div>
            <div class="example" data-example="Subiect: creșterea taxelor locale\n\nUnghi: Scrie din perspectiva omului obișnuit care plătește taxe și vrea dreptate egală pentru toți. Statul cere mai mult înainte să dovedească faptul că respectă banii deja luați.\n\nTon: popular, concret, critic față de risipa administrativă, dar fără isterie."><b>Taxe locale</b>Perspectiva omului care muncește și plătește.</div>
            <div class="example" data-example="Subiect: reforma din educație\n\nUnghi: Privește tema prin familie, muncă și viitorul copiilor, nu prin limbaj de minister. Arată cum deciziile abstracte se simt în casa unei familii normale.\n\nTon: cald față de părinți și profesori, ferm cu statul care promite mult și livrează haotic."><b>Educație</b>Familie, școală și stat care promite haotic.</div>
            <div class="example" data-example="Subiect: deficitul bugetar și noile măsuri de austeritate\n\nUnghi: Nu trata deficitul ca pe o abstracțiune contabilă. Arată cum nota de plată ajunge la salariat, antreprenor mic și familie, în timp ce statul amână tăierea privilegiilor și risipei.\n\nTon: ferm, concret, critic față de ipocrizia administrativă, fără jargon fiscal."><b>Austeritate</b>Cine plătește nota pentru risipa statului.</div>
            <div class="example" data-example="Subiect: relația României cu Bruxelles-ul\n\nUnghi: Scrie despre diferența dintre cooperare europeană și obediență birocratică. România trebuie să negocieze matur, cu interes național clar, nu să transforme orice directivă în pretext pentru taxe și interdicții.\n\nTon: suveranist lucid, critic, fără izolaționism caricatural."><b>Bruxelles</b>Cooperare europeană, nu obediență automată.</div>
            <div class="example" data-example="Subiect: spitalele regionale promise de ani de zile\n\nUnghi: Folosește tema ca simbol al statului care știe să facă strategii, comisii și poze, dar nu livrează infrastructură vitală. Accent pe pacient, familie și umilința drumurilor prin sistem.\n\nTon: empatic cu oamenii, dur cu administrația, fără melodramă."><b>Sănătate</b>Promisiuni mari, pacienți lăsați pe drumuri.</div>
            <div class="example" data-example="Subiect: pensiile mici și costul vieții\n\nUnghi: Nu transforma pensionarii în decor electoral. Scrie despre contractul moral dintre generații și despre statul care găsește bani pentru clientelă, dar cere răbdare celor care au muncit o viață.\n\nTon: cald, popular, acuzator față de cinismul politic."><b>Pensii mici</b>Contractul moral dintre stat și cei care au muncit.</div>
            <div class="example" data-example="Subiect: digitalizarea administrației publice\n\nUnghi: Arată contrastul dintre sloganul modernizării și realitatea ghișeelor, parolelor inutile și platformelor care cad. Digitalizarea trebuie să simplifice viața cetățeanului, nu să mute birocrația pe ecran.\n\nTon: ironic rece, pragmatic, cu exemple din viața de zi cu zi."><b>Digitalizare</b>Birocrația mutată de la ghișeu pe ecran.</div>
            <div class="example" data-example="Subiect: securitatea energetică a României\n\nUnghi: Leagă facturile, industria și independența națională. O țară cu resurse nu poate accepta politici care o fac dependentă, scumpă și vulnerabilă doar pentru a bifa agende scrise în altă parte.\n\nTon: strategic, suveranist, argumentat, fără panică."><b>Energie</b>Facturi, industrie și independență națională.</div>
          </div>
        </div>

        <div class="card" id="viewer">
          <div id="emptyViewer" class="emptyViewer">Selectează un articol din stânga sau creează unul nou.</div>
          <div id="articleContent" style="display:none">
            <div class="articleTop">
              <h2 id="articleTitle">Articol</h2>
              <div class="articleActions">
                <button id="articleActionBtn" class="articleActionBtn" title="Actions" aria-label="Actions">⋯</button>
                <div id="articleMenu" class="articleMenu" hidden>
                  <button id="copyArticleTextBtn">Copiază text</button>
                  <button id="copyArticleTitleBtn">Copiază titlu</button>
                  <button id="deleteArticleBtn" class="danger">Șterge</button>
                </div>
              </div>
            </div>
            <div id="articleMeta" class="muted"></div>
            <img id="articleImage" class="hero" style="display:none" alt="Imagine articol">
            <div id="imageControls" class="imageControls" hidden>
              <button id="generateImageBtn" class="imageBtn">Generează imagine</button>
              <div id="imageLoading" class="imageLoading" hidden><span class="spinner"></span><span>Se generează imaginea...</span></div>
            </div>
            <div id="articleError" class="error"></div>
            <article id="articleBody"></article>
            <div id="articleSources" class="articleSources" hidden></div>
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
let currentJob = null;
let timer = null;
let allJobs = [];
const initialArticleId = new URLSearchParams(location.search).get('article') || '';

function headers() { return {'content-type':'application/json', 'x-politic-password': password}; }
async function api(path, opts={}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
async function copyToClipboard(text) {
  const value = text || '';
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const el = document.createElement('textarea');
  el.value = value;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  el.remove();
}
function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function extractHttpUrl(value) {
  const match = String(value || '').match(new RegExp("https?://[^\\\\s)\\\\]}>,\\\"']+", "i"));
  return match ? match[0] : '';
}
function sourceUrl(source) {
  if (!source) return '';
  if (typeof source === 'string') return extractHttpUrl(source);
  return extractHttpUrl(source.url || source.link || source.href || source.source_url || source.source || '');
}
function sourceLabel(source, url) {
  if (!source) return url;
  if (typeof source === 'string') return source.replace(url, '').replace(/^[-–—:\s]+|[-–—:\s]+$/g, '') || url;
  return source.title || source.name || source.label || source.publisher || url;
}
function renderSources(sources) {
  const box = $('articleSources');
  const list = Array.isArray(sources) ? sources : [];
  const seen = new Set();
  const rows = list.map(source => {
    const url = sourceUrl(source);
    if (!url) return '';
    const key = url.toLowerCase();
    if (seen.has(key)) return '';
    seen.add(key);
    const label = String(sourceLabel(source, url) || url).trim();
    return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a></li>';
  }).filter(Boolean);
  box.hidden = !rows.length;
  box.innerHTML = rows.length ? '<h3>Surse</h3><ol>' + rows.join('') + '</ol>' : '';
}
function stripInlineSourceSection(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return value
    .replace(new RegExp("\\\\n{2,}(?:#{1,6}\\\\s*)?Surse\\\\s*\\\\n[\\\\s\\\\S]*$", "i"), '')
    .replace(new RegExp("\\\\n{2,}(?:#{1,6}\\\\s*)?Sources\\\\s*\\\\n[\\\\s\\\\S]*$", "i"), '')
    .trim();
}
function normalizeInlineHeading(value) {
  return String(value || '')
    .trim()
    .replace(new RegExp("^#{1,6}\\\\s+"), '')
    .replace(new RegExp('[*_~]', 'g'), '')
    .replace(new RegExp("\\\\s+", "g"), ' ')
    .trim()
    .toLocaleLowerCase('ro-RO')
    .replace(new RegExp('^[ .,:;!?]+|[ .,:;!?]+$', 'g'), '');
}
function stripDuplicateInlineTitle(text, title) {
  const titleNorm = normalizeInlineHeading(title);
  const value = String(text || '').trimStart();
  if (!value || !titleNorm) return value;
  const lines = value.split(new RegExp("\\\\r?\\\\n"));
  const firstIndex = lines.findIndex(line => line.trim());
  if (firstIndex < 0) return '';
  if (normalizeInlineHeading(lines[firstIndex]) !== titleNorm) return value;
  lines.splice(firstIndex, 1);
  while (firstIndex < lines.length && !lines[firstIndex].trim()) lines.splice(firstIndex, 1);
  return lines.join('\\n').trim();
}
function articleTextForDisplay(job) {
  return stripDuplicateInlineTitle(stripInlineSourceSection(job?.article_text || ''), job?.title || job?.subject || '');
}
function estimatedDoneText(job) {
  const base = job.created_at ? new Date(job.created_at) : new Date();
  const estimated = new Date(base.getTime() + 7 * 60 * 1000);
  const time = estimated.toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' });
  return 'Se estimează că va fi gata la ' + time + '. Pagina se actualizează automat.';
}
function autoResizeSubject() {
  const el = $('subject');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
  el.style.overflowY = 'hidden';
}

function randomizeExamples() {
  const items = Array.from(document.querySelectorAll('.example'));
  items
    .map(el => ({ el, rank: Math.random() }))
    .sort((a, b) => a.rank - b.rank)
    .forEach((item, index) => {
      item.el.hidden = index >= 2;
      item.el.parentNode?.appendChild(item.el);
    });
}

function scrollArticleIntoView() {
  if (window.matchMedia('(max-width:850px)').matches) {
    window.scrollTo({ top:0, behavior:'smooth' });
  }
}

function openSidebar() { document.body.classList.add('sidebarOpen'); }
function closeSidebar() { document.body.classList.remove('sidebarOpen'); }

function updateMobileBackButton() {
  const btn = $('mobileBackBtn');
  if (btn) btn.hidden = !selectedId;
}

function showComposer() {
  selectedId = null;
  clearViewer();
  closeSidebar();
  refreshJobs();
  window.scrollTo({ top:0, behavior:'smooth' });
}

async function login() {
  password = $('password').value || password;
  try {
    await api('/api/jobs');
    localStorage.setItem('politic_password', password);
    $('login').style.display = 'none';
    $('app').style.display = '';
    await refreshJobs();
    if (initialArticleId && !selectedId) {
      selectedId = initialArticleId;
      await loadJob(initialArticleId).catch(() => { selectedId = null; clearViewer(); });
      await refreshJobs();
    }
    timer = setInterval(tick, 5000);
  } catch (e) {
    document.documentElement.classList.remove('hasSavedPassword');
    $('app').style.display = 'none';
    $('login').style.display = '';
    $('loginErr').textContent = 'Parolă greșită sau API indisponibil.';
  }
}

async function createJob() {
  const subject = $('subject').value.trim();
  if (!subject) return;
  $('goBtn').disabled = true;
  $('createMsg').textContent = '';
  try {
    const tone = $('toneSelect')?.value || 'echilibrat';
    const viewpoint = $('viewpointSelect')?.value || 'suveranist';
    const job = await api('/api/jobs', {method:'POST', body:JSON.stringify({subject, tone, viewpoint})});
    $('subject').value = '';
    autoResizeSubject();
    selectedId = job.id;
    await refreshJobs();
    await loadJob(job.id);
    closeSidebar();
    scrollArticleIntoView();
  } catch (e) { $('createMsg').textContent = e.message; }
  finally { $('goBtn').disabled = false; }
}

function renderJobs(jobs) {
  const q = ($('articleSearch')?.value || '').trim().toLowerCase();
  const visibleJobs = q ? jobs.filter(j => ((j.title || '') + ' ' + (j.subject || '')).toLowerCase().includes(q)) : jobs;
  $('jobs').innerHTML = visibleJobs.length ? visibleJobs.map(j => {
    const active = selectedId === j.id ? ' active' : '';
    const id = escapeHtml(j.id);
    const title = escapeHtml(j.title || j.subject);
    const subject = j.title && j.subject && j.title !== j.subject ? '<span class="jobSubject">' + escapeHtml(j.subject) + '</span>' : '';
    const statusLabel = (j.status === 'queued' || j.status === 'running') ? 'se generează' : j.status;
    const status = j.status === 'done' ? '' : '<span class="status">' + escapeHtml(statusLabel) + '</span>';
    return '<div class="job' + active + '" data-id="' + id + '"><div class="jobMain"><span class="jobTitle">' + title + '</span>' + subject + status + '</div><div class="jobActions"><button class="jobActionBtn" data-action-id="' + id + '" title="Actions" aria-label="Actions">⋯</button><div class="jobMenu" data-menu-id="' + id + '" hidden><button class="deleteJobBtn" data-delete-id="' + id + '">Șterge</button></div></div></div>';
  }).join('') : (q ? '<span class="emptyList">Niciun rezultat.</span>' : '<span class="emptyList">Niciun articol încă.</span>');
  document.querySelectorAll('.job').forEach(el => el.onclick = async (e) => {
    if (e.target.closest('.jobActions')) return;
    selectedId = el.dataset.id;
    await loadJob(selectedId);
    await refreshJobs();
    closeSidebar();
    scrollArticleIntoView();
  });
  document.querySelectorAll('.jobActionBtn').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    const id = btn.dataset.actionId;
    document.querySelectorAll('.jobMenu').forEach(menu => { if (menu.dataset.menuId !== id) menu.hidden = true; });
    const menu = document.querySelector('.jobMenu[data-menu-id="' + CSS.escape(id) + '"]');
    if (menu) {
      menu.hidden = !menu.hidden;
      btn.closest('.job')?.classList.toggle('menuOpen', !menu.hidden);
    }
  });
  document.querySelectorAll('.deleteJobBtn').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    deleteJob(btn.dataset.deleteId);
  });
}

async function refreshJobs() {
  const data = await api('/api/jobs');
  allJobs = data.jobs || [];
  renderJobs(allJobs);
}

function clearViewer() {
  currentJob = null;
  $('content').classList.add('emptyMode');
  $('emptyViewer').style.display = '';
  $('articleContent').style.display = 'none';
  $('articleTitle').textContent = 'Articol';
  $('articleMeta').textContent = '';
  $('articleError').textContent = '';
  $('articleBody').textContent = '';
  renderSources([]);
  $('articleMenu').hidden = true;
  $('articleImage').removeAttribute('src');
  $('articleImage').style.display = 'none';
  renderImageControls(null);
  updateMobileBackButton();
}

async function deleteJob(id) {
  if (!id) return;
  if (!confirm('Ștergi acest articol?')) return;
  await api('/api/jobs/' + encodeURIComponent(id), { method:'DELETE' });
  if (selectedId === id) {
    selectedId = null;
    clearViewer();
  }
  await refreshJobs();
}

async function requestImage() {
  if (!currentJob?.id) return;
  const btn = $('generateImageBtn');
  if (btn) btn.disabled = true;
  try {
    const job = await api('/api/jobs/' + encodeURIComponent(currentJob.id) + '/image', { method:'POST' });
    currentJob = job;
    renderImageControls(job);
    await refreshJobs();
  } catch (e) {
    $('articleError').textContent = e.message || 'Nu am putut porni generarea imaginii.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderImageControls(job) {
  const controls = $('imageControls');
  const btn = $('generateImageBtn');
  const loading = $('imageLoading');
  if (!controls || !btn || !loading) return;
  const status = job?.image_status || '';
  const hasImage = Boolean(job?.image_data_url);
  const requestedAt = job?.image_requested_at ? Date.parse(job.image_requested_at) : 0;
  const requestIsFresh = requestedAt && (Date.now() - requestedAt < 30 * 60 * 1000);
  const isActiveImageRequest = (status === 'queued' || status === 'running') && requestIsFresh;
  const canGenerate = job?.status === 'done' && !hasImage && !isActiveImageRequest;
  const isGenerating = job?.status === 'done' && !hasImage && isActiveImageRequest;
  controls.hidden = !(canGenerate || isGenerating);
  btn.hidden = !canGenerate;
  loading.hidden = !isGenerating;
}

async function loadJob(id) {
  const job = await api('/api/jobs/' + encodeURIComponent(id));
  currentJob = job;
  $('content').classList.remove('emptyMode');
  $('emptyViewer').style.display = 'none';
  $('articleContent').style.display = '';
  $('articleTitle').textContent = job.title || job.subject || 'Articol';
  $('articleMeta').textContent = '';
  $('articleError').textContent = job.status === 'failed' ? (job.error || '') : '';
  const waitingText = job.status === 'done' ? '' : estimatedDoneText(job);
  const articleText = articleTextForDisplay(job);
  $('articleBody').className = articleText ? '' : (waitingText ? 'waitingText' : '');
  $('articleBody').textContent = articleText || waitingText;
  renderSources(job.status === 'done' ? job.sources : []);
  if (job.image_data_url) { $('articleImage').src = job.image_data_url; $('articleImage').style.display = ''; }
  else { $('articleImage').style.display = 'none'; }
  renderImageControls(job);
  updateMobileBackButton();
}

function toggleArticleMenu() {
  const menu = $('articleMenu');
  menu.hidden = !menu.hidden;
}

async function copyArticleText() {
  await copyToClipboard(currentJob?.article_text || $('articleBody').textContent || '');
  $('articleMenu').hidden = true;
}

async function copyArticleTitle() {
  await copyToClipboard(currentJob?.title || currentJob?.subject || $('articleTitle').textContent || '');
  $('articleMenu').hidden = true;
}

async function deleteCurrentArticle() {
  $('articleMenu').hidden = true;
  if (selectedId) await deleteJob(selectedId);
}

async function tick() {
  try {
    await refreshJobs();
    if (selectedId) await loadJob(selectedId);
  } catch (_) {}
}

$('loginBtn').onclick = login;
$('goBtn').onclick = createJob;
$('mobileSidebarBtn').onclick = openSidebar;
$('sidebarBackdrop').onclick = closeSidebar;
$('mobileBackBtn').onclick = showComposer;
$('articleActionBtn').onclick = toggleArticleMenu;
$('copyArticleTextBtn').onclick = copyArticleText;
$('copyArticleTitleBtn').onclick = copyArticleTitle;
$('deleteArticleBtn').onclick = deleteCurrentArticle;
$('generateImageBtn').onclick = requestImage;
$('subject').addEventListener('input', autoResizeSubject);
$('articleSearch').addEventListener('input', () => renderJobs(allJobs));
$('subject').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createJob(); });
randomizeExamples();
document.querySelectorAll('.example').forEach(el => el.onclick = () => { $('subject').value = el.dataset.example || ''; autoResizeSubject(); $('subject').focus(); });
$('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
if (password) { $('password').value = password; login(); }
</script>
</body>

</html>`;

const NEWSPAPER_PAGE = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Casa Publica</title>
  <style>
    :root { color-scheme:light; --paper:#f2ead8; --ink:#191511; --muted:#6f6658; --rule:#21170f; --accent:#9b1d1d; --gold:#b88a2e; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:#15110d; color:var(--ink); font:17px/1.52 Georgia, 'Times New Roman', serif; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'clig' 0, 'dlig' 0, 'hlig' 0; }
    a { color:inherit; }
    #login { display:none; }
    .loginShell { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#15110d; color:#f4ead7; font-family:system-ui,-apple-system,Segoe UI,sans-serif; }
    .loginCard { width:min(360px,100%); padding:26px; border:1px solid rgba(244,234,215,.18); border-radius:20px; background:#201a14; }
    .loginCard h2 { text-align:center; margin:0 0 18px; font-size:22px; font-family:system-ui,-apple-system,Segoe UI,sans-serif; color:rgba(244,234,215,.82); }
    .loginInputWrap { position:relative; }
    input, button { width:100%; border-radius:10px; border:1px solid rgba(244,234,215,.18); background:#120f0c; color:#f4ead7; padding:12px; font:16px system-ui,-apple-system,Segoe UI,sans-serif; }
    #password { text-align:center; padding-right:58px; }
    #loginBtn { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:36px; min-width:0; height:36px; border-radius:999px; padding:0; margin:0; background:var(--gold); color:#15110d; border:0; font-weight:800; cursor:pointer; }
    #loginErr { margin-top:14px; text-align:center; color:#e48a8a; font:14px system-ui,-apple-system,Segoe UI,sans-serif; }
    .hasSavedPassword #login { display:none; }
    #paper { display:block; width:min(1480px, calc(100% - 34px)); margin:18px auto 40px; padding:28px 34px 42px; background:var(--paper); box-shadow:0 30px 90px rgba(0,0,0,.42); }
    .topNav { display:flex; justify-content:space-between; align-items:center; gap:16px; padding-bottom:12px; border-bottom:3px double var(--rule); font:13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
    .back, .regenBtn { text-decoration:none; border:1px solid rgba(25,21,17,.28); border-radius:999px; padding:7px 11px; color:var(--ink); letter-spacing:0; text-transform:none; font-weight:700; background:transparent; cursor:pointer; width:auto; }
    .issueActions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
    .masthead { text-align:center; padding:18px 0 12px; border-bottom:1px solid var(--rule); }
    .masthead h1 { margin:0; font-size:clamp(52px, 7.2vw, 104px); line-height:.9; letter-spacing:-.055em; font-weight:900; text-transform:uppercase; }
    .deck { display:flex; justify-content:center; gap:18px; margin-top:12px; color:var(--muted); font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
    .leadGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; padding:22px 0; border-bottom:2px solid var(--rule); align-items:stretch; }
    .story { min-width:0; }
    .story a { height:100%; display:flex; flex-direction:column; text-decoration:none; }
    .storyImage { width:100%; aspect-ratio:16/10; object-fit:cover; border:1px solid rgba(25,21,17,.32); margin-bottom:10px; background:#d8c9aa; flex:0 0 auto; }
    .kicker { margin-bottom:6px; color:var(--accent); font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
    .story h2, .story h3 { margin:0; font-family:Georgia, 'Times New Roman', serif; font-weight:700; letter-spacing:0; line-height:1.1; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'clig' 0, 'dlig' 0, 'hlig' 0; }
    .lead h2 { font-size:clamp(24px, 2.25vw, 34px); }
    .sideLead h3 { font-size:clamp(24px, 2.25vw, 34px); }
    .snippet { margin:12px 0 0; color:#302820; font-size:16px; line-height:1.48; text-align:justify; text-justify:inter-word; hyphens:auto; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
    .meta { margin-top:10px; color:var(--muted); font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; text-transform:uppercase; letter-spacing:.08em; }
    .belowGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; padding-top:20px; border-bottom:1px solid rgba(25,21,17,.38); align-items:stretch; }
    .belowGrid .story { padding:0 16px 18px 0; border-right:1px solid rgba(25,21,17,.28); }
    .belowGrid .story:nth-child(3n) { border-right:0; padding-right:0; }
    .belowGrid h3 { font-size:22px; line-height:1.12; }
    .smallStories { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; margin-top:20px; align-items:stretch; }
    .smallStories h3 { font-size:20px; line-height:1.12; }
    .loading, .empty { padding:40px 0; text-align:center; color:var(--muted); font:15px system-ui,-apple-system,Segoe UI,sans-serif; }
    .modalBackdrop { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:22px; background:rgba(21,17,13,.72); backdrop-filter:blur(8px); }
    .modalBackdrop[hidden] { display:none; }
    .articleModal { position:relative; width:min(980px,100%); max-height:min(88vh,980px); overflow:auto; padding:28px 34px 36px; background:var(--paper); color:var(--ink); border:1px solid rgba(25,21,17,.45); box-shadow:0 34px 110px rgba(0,0,0,.55); }
    .modalClose { position:sticky; top:0; float:right; width:36px; height:36px; margin:0 0 10px 14px; padding:0; border-radius:999px; background:#21170f; color:var(--paper); border:0; font-size:24px; line-height:1; cursor:pointer; }
    .modalKicker { color:var(--accent); font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
    .modalTitle { margin:8px 0 8px; font-family:Georgia, 'Times New Roman', serif; font-size:clamp(28px,3.1vw,44px); line-height:1.12; letter-spacing:0; font-weight:700; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'clig' 0, 'dlig' 0, 'hlig' 0; }
    .modalMeta { color:var(--muted); font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif; text-transform:uppercase; letter-spacing:.08em; margin-bottom:16px; }
    .modalImage { width:100%; max-height:460px; object-fit:cover; border:1px solid rgba(25,21,17,.32); margin:8px 0 18px; background:#d8c9aa; }
    .modalBody { white-space:pre-wrap; max-width:760px; margin:0 auto; font-size:19px; line-height:1.68; text-align:justify; text-justify:inter-word; hyphens:auto; }
    .modalSources { margin-top:28px; padding-top:14px; border-top:1px solid rgba(25,21,17,.35); font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif; color:var(--muted); }
    .modalSources a { color:var(--accent); text-decoration:none; overflow-wrap:anywhere; }
    .modalSources a:hover { text-decoration:underline; }
    body.modalOpen { overflow:hidden; }
    @media (max-width:900px) {
      #paper { width:100%; margin:0; padding:18px 16px 34px; }
      .leadGrid, .belowGrid, .smallStories { grid-template-columns:1fr; }
      .belowGrid .story { border-right:0; border-bottom:1px solid rgba(25,21,17,.28); padding:0 0 16px; }
      .smallStories .story { border-bottom:1px solid rgba(25,21,17,.28); padding-bottom:16px; }
      .masthead h1 { font-size:46px; letter-spacing:-.04em; }
      .lead h2 { font-size:34px; }
      .sideLead h3 { font-size:28px; }
      .snippet { display:block; overflow:visible; }
      .modalBackdrop { padding:0; align-items:stretch; }
      .articleModal { max-height:100vh; width:100%; padding:18px 16px 30px; }
      .modalBody { max-width:none; font-size:18px; }
    }
  </style>
</head>
<body>
  <section id="login" class="loginShell">
    <div class="loginCard">
      <h2>Acces privat</h2>
      <div class="loginInputWrap">
        <input id="password" type="password" placeholder="Parolă" autocomplete="current-password">
        <button id="loginBtn" title="Intră" aria-label="Intră">↑</button>
      </div>
      <div id="loginErr"></div>
    </div>
  </section>
  <main id="paper">
    <div class="topNav"><a class="back" href="/">← Generator</a><span id="issueDate"></span><div class="issueActions"><button id="regenIssue" class="regenBtn" type="button">Regenerează</button><span>Ediție aleatorie</span></div></div>
    <header class="masthead"><h1>Casa Publica</h1><div class="deck"><span>Politică</span><span>Analiză</span></div></header>
    <div id="newsContent" class="loading">Se încarcă ediția...</div>
  </main>
  <div id="articleModalBackdrop" class="modalBackdrop" hidden>
    <div class="articleModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button id="modalClose" class="modalClose" aria-label="Închide">×</button>
      <div id="modalKicker" class="modalKicker"></div>
      <h2 id="modalTitle" class="modalTitle"></h2>
      <div id="modalMeta" class="modalMeta"></div>
      <img id="modalImage" class="modalImage" alt="" hidden>
      <div id="modalBody" class="modalBody"></div>
      <div id="modalSources" class="modalSources" hidden></div>
    </div>
  </div>
<script>
const $ = (id) => document.getElementById(id);
let password = localStorage.getItem('politic_password') || '';
let fullJobs = [];
let paperPool = [];
async function api(path, opts={}) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stripInlineSourceSection(text) {
  return String(text || '').replace(new RegExp("\\\\n{2,}(?:#{1,6}\\\\s*)?Surse\\\\s*\\\\n[\\\\s\\\\S]*$", "i"), '').trim();
}
function normalizeInlineHeading(value) {
  return String(value || '')
    .trim()
    .replace(new RegExp("^#{1,6}\\\\s+"), '')
    .replace(new RegExp('[*_~]', 'g'), '')
    .replace(new RegExp("\\\\s+", "g"), ' ')
    .trim()
    .toLocaleLowerCase('ro-RO')
    .replace(new RegExp('^[ .,:;!?]+|[ .,:;!?]+$', 'g'), '');
}
function stripDuplicateInlineTitle(text, title) {
  const titleNorm = normalizeInlineHeading(title);
  const value = String(text || '').trimStart();
  if (!value || !titleNorm) return value;
  const lines = value.split(new RegExp("\\\\r?\\\\n"));
  const firstIndex = lines.findIndex(line => line.trim());
  if (firstIndex < 0) return '';
  if (normalizeInlineHeading(lines[firstIndex]) !== titleNorm) return value;
  lines.splice(firstIndex, 1);
  while (firstIndex < lines.length && !lines[firstIndex].trim()) lines.splice(firstIndex, 1);
  return lines.join('\\n').trim();
}
function articleTextForDisplay(job) {
  return stripDuplicateInlineTitle(stripInlineSourceSection(job?.article_text || ''), job?.title || job?.subject || '');
}
function snippet(job, max) {
  const clean = articleTextForDisplay(job).replace(new RegExp('[#*_]', 'g'), '').replace(new RegExp("\\\\s+", "g"), ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(new RegExp("\\\\s+\\\\S*$"), '') + '...';
}
function dateLabel(job) {
  const raw = job.completed_at || job.created_at || '';
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ro-RO', { day:'2-digit', month:'long', year:'numeric' });
}
function storyTextBudget(job, cls, img, lines) {
  const titleLength = String(job?.title || job?.subject || '').length;
  const perLine = cls === 'small' ? 54 : (cls === 'column' ? 48 : 56);
  const titlePenalty = Math.max(0, Math.ceil((titleLength - 42) / 16)) * perLine;
  const base = Math.max(120, (lines || 6) * perLine - titlePenalty);
  return img ? Math.min(base, 360) : Math.min(base + 180, 760);
}
function story(job, cls, img, lines) {
  const title = escapeHtml(job.title || job.subject || 'Articol');
  const text = escapeHtml(snippet(job, storyTextBudget(job, cls, img, lines)));
  const image = img && job.image_data_url ? '<img class="storyImage" src="' + job.image_data_url + '" alt="">' : '';
  const clamp = Math.max(3, Math.min(lines || 6, 16));
  return '<article class="story ' + cls + '"><a class="storyLink" href="#" data-id="' + escapeHtml(job.id) + '">' + image + '<div class="kicker">' + escapeHtml(job.source === 'archive' ? 'Arhivă' : 'Actual') + '</div><h' + (cls === 'lead' ? '2' : '3') + '>' + title + '</h' + (cls === 'lead' ? '2' : '3') + '><p class="snippet" style="-webkit-line-clamp:' + clamp + '">' + text + '</p><div class="meta">' + escapeHtml(dateLabel(job)) + '</div></a></article>';
}
function sourceUrl(source) {
  if (!source) return '';
  const value = typeof source === 'string' ? source : (source.url || source.link || source.href || source.source_url || source.source || '');
  const match = String(value || '').match(new RegExp("https?://[^\\\\s)\\\\]}>,\\\"']+", "i"));
  return match ? match[0] : '';
}
function sourceLabel(source, url) {
  if (!source) return url;
  if (typeof source === 'string') return source.replace(url, '').replace(new RegExp("^[-–—:\\\\s]+|[-–—:\\\\s]+$", "g"), '') || url;
  return source.title || source.name || source.label || source.publisher || url;
}
function renderModalSources(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const seen = new Set();
  const rows = list.map(source => {
    const url = sourceUrl(source);
    if (!url) return '';
    const key = url.toLowerCase();
    if (seen.has(key)) return '';
    seen.add(key);
    return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(sourceLabel(source, url)) + '</a></li>';
  }).filter(Boolean);
  $('modalSources').hidden = !rows.length;
  $('modalSources').innerHTML = rows.length ? '<strong>Surse</strong><ol>' + rows.join('') + '</ol>' : '';
}
function openArticleModal(id) {
  const job = fullJobs.find(j => j.id === id);
  if (!job) return;
  $('modalKicker').textContent = job.source === 'archive' ? 'Arhivă' : 'Actual';
  $('modalTitle').textContent = job.title || job.subject || 'Articol';
  $('modalMeta').textContent = dateLabel(job);
  $('modalBody').textContent = articleTextForDisplay(job);
  if (job.image_data_url) { $('modalImage').src = job.image_data_url; $('modalImage').hidden = false; }
  else { $('modalImage').removeAttribute('src'); $('modalImage').hidden = true; }
  renderModalSources(job.sources);
  $('articleModalBackdrop').hidden = false;
  document.body.classList.add('modalOpen');
}
function closeArticleModal() {
  $('articleModalBackdrop').hidden = true;
  document.body.classList.remove('modalOpen');
}
function shuffledJobs(list) {
  return Array.from(list || [])
    .map(job => ({ job, rank: Math.random() }))
    .sort((a, b) => a.rank - b.rank)
    .map(item => item.job);
}
function renderPaperIssue(sourceJobs) {
  const eligible = shuffledJobs(sourceJobs).filter(j => j.status === 'done');
  const withImages = eligible.filter(j => j.image_data_url);
  const withoutImages = eligible.filter(j => !j.image_data_url);
  const imageSlots = new Set([0, 2, 4, 6]);
  const full = [];
  for (let i = 0; i < 12; i++) {
    const preferred = imageSlots.has(i) ? withImages : withoutImages;
    const fallback = imageSlots.has(i) ? withoutImages : withImages;
    full.push((preferred.length ? preferred : fallback).shift());
  }
  const compactFull = full.filter(Boolean);
  if (!compactFull.length) { $('newsContent').className = 'empty'; $('newsContent').textContent = 'Niciun articol publicat încă.'; return; }
  fullJobs = compactFull;
  const lead = compactFull[0];
  const side = compactFull.slice(1, 3);
  const below = compactFull.slice(3, 9);
  const small = compactFull.slice(9, 12);
  const topSlots = [
    { job: lead, cls: 'lead', img: true, lines: 6 },
    { job: side[0], cls: 'sideLead', img: false, lines: 14 },
    { job: side[1], cls: 'sideLead', img: true, lines: 6 },
  ].filter(slot => slot.job);
  const belowSlots = below.map((j, index) => {
    const img = Boolean(j.image_data_url) && (index === 1 || index === 4);
    return { job: j, cls: 'column', img, lines: img ? 6 : 12 };
  });
  const smallSlots = small.map(j => ({ job: j, cls: 'small', img: false, lines: 8 }));
  let html = '<section class="leadGrid">' + topSlots.map(slot => story(slot.job, slot.cls, slot.img, slot.lines)).join('') + '</section>';
  if (belowSlots.length) html += '<section class="belowGrid">' + belowSlots.map(slot => story(slot.job, slot.cls, slot.img, slot.lines)).join('') + '</section>';
  if (smallSlots.length) html += '<section class="smallStories">' + smallSlots.map(slot => story(slot.job, slot.cls, slot.img, slot.lines)).join('') + '</section>';
  $('newsContent').className = '';
  $('newsContent').innerHTML = html;
  document.querySelectorAll('.storyLink').forEach(el => el.onclick = (event) => {
    event.preventDefault();
    openArticleModal(el.dataset.id);
  });
}
async function loadPaper() {
  const list = await api('/api/public/casa-publica?limit=80');
  paperPool = (list.jobs || []).filter(j => j.status === 'done');
  renderPaperIssue(paperPool);
}
async function startPublicPaper() {
  $('issueDate').textContent = new Date().toLocaleDateString('ro-RO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  try {
    await loadPaper();
  } catch (e) {
    $('newsContent').className = 'empty';
    $('newsContent').textContent = 'Nu am putut încărca ediția.';
  }
}
$('modalClose').onclick = closeArticleModal;
$('regenIssue').onclick = () => renderPaperIssue(paperPool);
$('articleModalBackdrop').onclick = e => { if (e.target.id === 'articleModalBackdrop') closeArticleModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('articleModalBackdrop').hidden) closeArticleModal(); });
startPublicPaper();
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
    if (url.pathname === "/casa-publica" || url.pathname === "/casa-publica/") return html(NEWSPAPER_PAGE);
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow, noarchive" } });

    if (url.pathname === "/api/public/casa-publica" && request.method === "GET") {
      const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "60", 10);
      const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 60, 12), 80);
      const ids = await loadIndex(env);
      const jobs = [];
      for (const id of ids) {
        const job = await loadJob(env, id);
        if (!job || job.status !== "done") continue;
        const title = job.title || job.subject || "Articol";
        jobs.push({
          id: job.id,
          source: job.source || "manual",
          subject: job.subject || "",
          title,
          topic: job.topic || job.subject || title,
          status: job.status,
          created_at: job.created_at || "",
          completed_at: job.completed_at || job.created_at || "",
          article_text: cleanArticleTextForTitle(job.article_text || "", title),
          sources: Array.isArray(job.sources) ? job.sources.slice(0, 20) : [],
          image_data_url: job.image_data_url || "",
        });
        if (jobs.length >= limit) break;
      }
      jobs.sort((a, b) => String(b.completed_at || b.created_at || "").localeCompare(String(a.completed_at || a.created_at || "")));
      return json({ jobs });
    }

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

      if (url.pathname === "/api/agent/image-claim" && request.method === "GET") {
        const ids = await loadIndex(env);
        for (const id of ids) {
          const job = await loadJob(env, id);
          if (job && job.status === "done" && job.image_status === "queued" && !job.image_data_url) {
            job.image_status = "running";
            job.image_claimed_at = nowIso();
            job.updated_at = nowIso();
            await saveJob(env, job);
            return json({ job });
          }
        }
        return json({ job: null });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+\/image-complete$/) && request.method === "POST") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404);
        const body = await request.json();
        job.image_status = "done";
        job.image_completed_at = nowIso();
        job.image_path = body.image_path || job.image_path || "";
        job.image_data_url = body.image_data_url || job.image_data_url || "";
        job.image_prompt = body.image_prompt || job.image_prompt || "";
        job.image_error = "";
        job.updated_at = nowIso();
        await saveJob(env, job);
        return json({ ok: true });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+\/image-fail$/) && request.method === "POST") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404);
        const body = await request.json().catch(() => ({}));
        job.image_status = "failed";
        job.image_error = String(body.error || "image failed").slice(0, 5000);
        job.updated_at = nowIso();
        await saveJob(env, job);
        return json({ ok: true });
      }

      if (url.pathname.match(/^\/api\/agent\/jobs\/[^/]+$/) && request.method === "GET") {
        const id = decodeURIComponent(url.pathname.split("/")[4]);
        const job = await loadJob(env, id);
        if (!job) return json({ exists: false });
        return json({ exists: true, status: job.status });
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
        const completeTitle = body.title || job.title;
        Object.assign(job, {
          status: "done",
          completed_at: nowIso(),
          title: completeTitle,
          topic: body.topic || job.subject,
          article_text: cleanArticleTextForTitle(body.article_text || "", completeTitle),
          markdown_path: body.markdown_path || "",
          image_path: "",
          image_data_url: "",
          image_status: "idle",
          image_prompt: "",
          image_error: "",
          sources: body.sources || [],
          error: "",
          updated_at: nowIso(),
        });
        await saveJob(env, job);
        return json({ ok: true });
      }

      if (url.pathname === "/api/agent/archive" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const items = Array.isArray(body.items) ? body.items : [];
        const ids = await loadIndex(env);
        const imported = [];
        for (const raw of items.slice(0, 250)) {
          if (!raw || !raw.id) continue;
          const id = String(raw.id).slice(0, 160);
          const title = String(raw.title || raw.subject || "").trim().slice(0, 300);
          const topic = String(raw.topic || raw.subject || title).trim().slice(0, 500);
          const articleText = cleanArticleTextForTitle(String(raw.article_text || "").trim(), title);
          if (!title || !articleText) continue;
          const existing = await loadJob(env, id);
          const date = String(raw.date || raw.completed_at || raw.created_at || nowIso()).slice(0, 40);
          const createdAt = date.length === 10 ? `${date}T00:00:00.000Z` : date;
          const job = {
            ...(existing || {}),
            id,
            source: "archive",
            subject: topic,
            topic,
            title,
            status: "done",
            article_text: articleText,
            sources: Array.isArray(raw.sources) ? raw.sources.slice(0, 20) : [],
            markdown_path: raw.markdown_path || "",
            image_path: raw.image_path || existing?.image_path || "",
            image_data_url: existing?.image_data_url || "",
            image_status: existing?.image_data_url ? "done" : "idle",
            image_prompt: raw.image_prompt || existing?.image_prompt || "",
            created_at: createdAt,
            completed_at: raw.completed_at || createdAt,
            updated_at: nowIso(),
            error: "",
          };
          await saveJob(env, job);
          imported.push(id);
        }
        await saveIndex(env, [...imported, ...ids]);
        return json({ ok: true, imported: imported.length });
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
          if (job) jobs.push({ id: job.id, source: job.source || "manual", subject: job.subject, title: job.title, tone: job.tone, viewpoint: job.viewpoint, status: job.status, created_at: job.created_at, completed_at: job.completed_at });
        }
        jobs.sort((a, b) => String(b.completed_at || b.created_at || "").localeCompare(String(a.completed_at || a.created_at || "")));
        return json({ jobs }, 200, corsHeaders(request));
      }

      if (url.pathname === "/api/jobs" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const subject = String(body.subject || "").trim().slice(0, MAX_SUBJECT_LEN);
        const tone = TONE_OPTIONS.includes(String(body.tone || "")) ? String(body.tone) : "echilibrat";
        const viewpoint = VIEWPOINT_OPTIONS.includes(String(body.viewpoint || "")) ? String(body.viewpoint) : "suveranist";
        if (!subject) return json({ error: "subject required" }, 400, corsHeaders(request));
        const id = `${Date.now().toString(36)}-${(await sha256(subject + tone + viewpoint + nowIso())).slice(0, 10)}`;
        const job = { id, subject, tone, viewpoint, status: "queued", created_at: nowIso(), updated_at: nowIso() };
        await saveJob(env, job);
        const ids = await loadIndex(env);
        await saveIndex(env, [id, ...ids]);
        try {
          await startDirect(env, "/politic-agent/start-article", job);
        } catch (e) {
          job.status = "failed";
          job.error = "Serverul direct nu a pornit jobul: " + String(e.message || e).slice(0, 400);
          job.completed_at = nowIso();
          job.updated_at = nowIso();
          await saveJob(env, job);
        }
        return json(job, 201, corsHeaders(request));
      }

      const match = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (match && request.method === "GET") {
        const job = await loadJob(env, decodeURIComponent(match[1]));
        if (!job) return json({ error: "not found" }, 404, corsHeaders(request));
        return json(job, 200, corsHeaders(request));
      }

      const imageMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/image$/);
      if (imageMatch && request.method === "POST") {
        const id = decodeURIComponent(imageMatch[1]);
        const job = await loadJob(env, id);
        if (!job) return json({ error: "not found" }, 404, corsHeaders(request));
        if (job.status !== "done") return json({ error: "articolul încă nu este gata" }, 409, corsHeaders(request));
        if (job.image_data_url) return json(job, 200, corsHeaders(request));
        if (job.image_status === "queued" || job.image_status === "running") return json(job, 200, corsHeaders(request));
        job.image_status = "queued";
        job.image_requested_at = nowIso();
        job.image_error = "";
        job.updated_at = nowIso();
        await saveJob(env, job);
        try {
          await startDirect(env, "/politic-agent/start-image", job);
        } catch (e) {
          job.image_status = "failed";
          job.image_error = "Serverul direct nu a pornit imaginea: " + String(e.message || e).slice(0, 400);
          job.updated_at = nowIso();
          await saveJob(env, job);
        }
        return json(job, 202, corsHeaders(request));
      }

      if (match && request.method === "DELETE") {
        const id = decodeURIComponent(match[1]);
        const ids = await loadIndex(env);
        await saveIndex(env, ids.filter((existingId) => existingId !== id));
        await env.POLITIC_KV.delete(`${JOB_PREFIX}${id}`);
        return json({ ok: true }, 200, corsHeaders(request));
      }
    }

    return json({ error: "not found" }, 404);
  },
};
