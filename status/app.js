/* Atelier YO — Custom Status UI (static)
   Reads Upptime data from repository folders:
   - ./history/<slug>.yml
   - ./api/<slug>/*.json
   - ./graphs/<slug>/response-time-week.png
*/

const SERVICES = [
  { name: "Atelier YO", url: "https://atelier-yo.fr", slug: "atelier-yo" },
  { name: "Atelier YO (www)", url: "https://www.atelier-yo.fr", slug: "atelier-yo-www" },
];

function $(id){ return document.getElementById(id); }

async function fetchText(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return await res.text();
}
async function fetchJson(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return await res.json();
}

// Very small YAML parser for Upptime history files (simple key: value lines)
function parseUpptimeHistoryYml(text){
  const out = {};
  for (const rawLine of text.split(/\r?\n/)){
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))){
      val = val.slice(1, -1);
    }
    // numbers
    if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
    out[key] = val;
  }
  return out;
}

function badgeForStatus(status){
  const s = (status || "").toLowerCase();
  if (s === "up") return { text: "Operational", cls: "badge badge--ok" };
  if (s === "down") return { text: "Outage", cls: "badge badge--bad" };
  return { text: (status || "Unknown").toUpperCase(), cls: "badge badge--warn" };
}

function dotForOverall(anyDown){
  if (anyDown) return { title: "Partial outage", sub: "Some services are currently impacted.", dotCls: "dot dot--bad" };
  return { title: "All systems operational", sub: "We’re not aware of any issues affecting our systems.", dotCls: "dot dot--ok" };
}

function prettyDate(iso){
  if (!iso) return "—";
  try{
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
  }catch{
    return iso;
  }
}

function parsePercentMsg(msg){
  if (!msg) return null;
  const m = String(msg).match(/(\d+(?:\.\d+)?)%/);
  return m ? Number(m[1]) : null;
}

async function loadService(service){
  const historyText = await fetchText(`./history/${service.slug}.yml`);
  const hist = parseUpptimeHistoryYml(historyText);

  // Uptime and response time summaries (these are Shields-style JSON payloads)
  const uptime24h = await fetchJson(`./api/${service.slug}/uptime-day.json`).catch(() => null);
  const uptime7d  = await fetchJson(`./api/${service.slug}/uptime-week.json`).catch(() => null);
  const uptime30d = await fetchJson(`./api/${service.slug}/uptime-month.json`).catch(() => null);
  const rt24h = await fetchJson(`./api/${service.slug}/response-time-day.json`).catch(() => null);

  const status = (hist.status || "unknown").toLowerCase();
  return {
    ...service,
    status,
    code: hist.code,
    responseTime: hist.responseTime,
    lastUpdated: hist.lastUpdated,
    uptime24h: parsePercentMsg(uptime24h?.message) ?? null,
    uptime7d:  parsePercentMsg(uptime7d?.message) ?? null,
    uptime30d: parsePercentMsg(uptime30d?.message) ?? null,
    rt24h: (rt24h?.message || null),
  };
}

function makeCard(data){
  const badge = badgeForStatus(data.status);

  const el = document.createElement("article");
  el.className = "card";
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `Open details for ${data.name}`);

  const rt = (typeof data.responseTime === "number") ? `${data.responseTime}ms` : "—";
  const code = data.code ? String(data.code) : "—";

  el.innerHTML = `
    <div class="card__top">
      <div>
        <h3 class="card__title">${escapeHtml(data.name)}</h3>
        <a class="card__url" href="${escapeAttr(data.url)}" rel="noopener">${escapeHtml(data.url.replace(/^https?:\/\//, ""))}</a>
      </div>
      <div class="${badge.cls}">${badge.text}</div>
    </div>

    <div class="card__stats">
      <div class="stat">
        <div class="stat__k">Response time</div>
        <div class="stat__v">${escapeHtml(rt)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">HTTP code</div>
        <div class="stat__v">${escapeHtml(code)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">Last updated</div>
        <div class="stat__v">${escapeHtml(prettyDate(data.lastUpdated))}</div>
      </div>
    </div>

    <div class="spark" aria-hidden="true">
      <img src="./graphs/${encodeURIComponent(data.slug)}/response-time-week.png" alt="">
    </div>
  `;

  const open = () => openDetails(data);
  el.addEventListener("click", open);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(); });

  return el;
}

function openDetails(data){
  const modal = $("detailsModal");
  const content = $("modalContent");

  const badge = badgeForStatus(data.status);

  const uptime24h = data.uptime24h != null ? `${data.uptime24h.toFixed(2)}%` : "—";
  const uptime7d  = data.uptime7d  != null ? `${data.uptime7d.toFixed(2)}%`  : "—";
  const uptime30d = data.uptime30d != null ? `${data.uptime30d.toFixed(2)}%` : "—";

  const rt = (typeof data.responseTime === "number") ? `${data.responseTime}ms` : "—";
  const code = data.code ? String(data.code) : "—";

  content.innerHTML = `
    <div class="details__head">
      <div>
        <h3 class="details__title">${escapeHtml(data.name)}</h3>
        <p class="details__sub">
          <a href="${escapeAttr(data.url)}" rel="noopener">${escapeHtml(data.url)}</a>
          &nbsp;•&nbsp; <span class="${badge.cls}">${badge.text}</span>
        </p>
      </div>
    </div>

    <div class="details__grid">
      <div class="stat">
        <div class="stat__k">Response time (last check)</div>
        <div class="stat__v">${escapeHtml(rt)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">HTTP code (last check)</div>
        <div class="stat__v">${escapeHtml(code)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">Last updated</div>
        <div class="stat__v">${escapeHtml(prettyDate(data.lastUpdated))}</div>
      </div>

      <div class="stat">
        <div class="stat__k">Uptime (24h)</div>
        <div class="stat__v">${escapeHtml(uptime24h)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">Uptime (7d)</div>
        <div class="stat__v">${escapeHtml(uptime7d)}</div>
      </div>
      <div class="stat">
        <div class="stat__k">Uptime (30d)</div>
        <div class="stat__v">${escapeHtml(uptime30d)}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="muted" style="margin-bottom:10px">Response time trend (weekly)</div>
    <div class="spark">
      <img src="./graphs/${encodeURIComponent(data.slug)}/response-time-week.png" alt="Response time graph">
    </div>

    <div class="hr"></div>

    <div class="muted">More details:</div>
    <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap">
      <a class="pill" href="https://github.com/N3uralCreativity/upptime/commits/HEAD/history/${encodeURIComponent(data.slug)}.yml" rel="noopener">History file</a>
      <a class="pill" href="https://github.com/N3uralCreativity/upptime/issues" rel="noopener">Incidents</a>
    </div>
  `;

  modal.showModal();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
}
function escapeAttr(s){
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function main(){
  const grid = $("servicesGrid");
  const overallTitle = $("overallTitle");
  const overallSubtitle = $("overallSubtitle");
  const overallDot = $("overallDot");
  const lastUpdatedPill = $("lastUpdatedPill");

  grid.innerHTML = "";

  const results = [];
  for (const svc of SERVICES){
    try{
      results.push(await loadService(svc));
    }catch(e){
      results.push({ ...svc, status: "unknown", lastUpdated: null, responseTime: null, code: null });
    }
  }

  const anyDown = results.some(r => (r.status || "").toLowerCase() === "down");
  const overall = dotForOverall(anyDown);
  overallTitle.textContent = overall.title;
  overallSubtitle.textContent = overall.sub;
  overallDot.className = overall.dotCls;

  // last updated = newest among services
  const newest = results
    .map(r => r.lastUpdated ? new Date(r.lastUpdated).getTime() : 0)
    .reduce((a,b) => Math.max(a,b), 0);
  lastUpdatedPill.textContent = `Last updated: ${newest ? prettyDate(new Date(newest).toISOString()) : "—"}`;

  // render cards
  for (const r of results){
    grid.appendChild(makeCard(r));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = $("detailsModal");
  $("closeModal").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  main();
  // Refresh every 60s (non-intrusive)
  setInterval(main, 60_000);
});
