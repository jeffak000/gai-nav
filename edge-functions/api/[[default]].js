import { getStore } from "@edgeone/pages-blob";

// ---------------------------------------------------------------------------
// EdgeOne Makers 书签中心后端
// 单文件 catch-all：/edge-functions/api/[[default]].js  ->  所有 /api/*
// 存储：Blob 命名空间 "bookmarks"
//   data/categories.json  -> [{id,name,sort,group,created_at}]  group: 分区 id
//   data/bookmarks.json   -> [{id,category_id,title,url,icon,note,sort,group,visits,last_visit_at,created_at}]
//   data/groups.json      -> [{id,name}]  分区列表（默认 个人区/工作区）
//   data/icons.json       -> { "<host>": "data:image/png;base64,...." }
//   data/password.json    -> { password: "..." }  可选覆盖 env.APP_PASSWORD
// 鉴权：Bearer Token（HMAC，Web Crypto）+ 可选 HttpOnly Cookie
// ---------------------------------------------------------------------------

const STORE = "bookmarks";
const PUBLIC = new Set([
  "categories",
  "bookmarks",
  "icon",
  "health",
]);

function store() {
  return getStore(STORE);
}

// --------------------------- 基础工具 ---------------------------
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      ...extra,
    },
  });
}

function b64u(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function abToB64(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function ctOfDataUrl(du) {
  const m = du.match(/^data:([^;]+);/);
  return m ? m[1] : "image/png";
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// --------------------------- 鉴权 ---------------------------
async function getStoredPwd(s) {
  try {
    const p = await s.get("data/password.json", { type: "json", consistency: "strong" });
    if (p && p.password) return p.password;
  } catch {}
  return null;
}
async function setStoredPwd(s, pwd) {
  await s.setJSON("data/password.json", { password: pwd, updated_at: Date.now() });
}
function getPwd(env, stored) {
  return stored || env.APP_PASSWORD || "admin";
}

async function importKey(key) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function hmac(msg, key) {
  const k = await importKey(key);
  const buf = await crypto.subtle.sign(
    "HMAC",
    k,
    new TextEncoder().encode(msg)
  );
  return [...new Uint8Array(buf)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(obj) {
  return b64u(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}

async function makeToken(pwd) {
  const exp = Date.now() + 7 * 86400000;
  const p = b64url({ exp });
  const sig = await hmac(p, pwd);
  return p + "." + sig;
}

async function verifyToken(tok, pwd) {
  try {
    const [p, sig] = tok.split(".");
    if (!p || !sig) return false;
    const expect = await hmac(p, pwd);
    if (sig !== expect) return false;
    const { exp } = JSON.parse(b64urlDecode(p));
    return exp > Date.now();
  } catch {
    return false;
  }
}

async function requireAuth(req, env, s) {
  const stored = s ? await getStoredPwd(s) : null;
  const pwd = getPwd(env, stored);
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && (await verifyToken(m[1], pwd))) return true;
  // 兼容 HttpOnly Cookie
  const cookie = req.headers.get("cookie") || "";
  const cm = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (cm && (await verifyToken(cm[1], pwd))) return true;
  return false;
}

// --------------------------- 数据访问 ---------------------------
async function getCats(s) {
  const arr = (await s.get("data/categories.json", { type: "json", consistency: "strong" })) || [];
  for (const c of arr) if (!c.group) c.group = "personal";
  return arr;
}
async function setCats(s, arr) {
  await s.setJSON("data/categories.json", arr);
}
async function getBms(s) {
  const arr = (await s.get("data/bookmarks.json", { type: "json", consistency: "strong" })) || [];
  for (const b of arr) {
    if (!b.group) b.group = "personal";
    if (!b.icon && b.url) b.icon = null;
  }
  return arr;
}
async function setBms(s, arr) {
  await s.setJSON("data/bookmarks.json", arr);
}
async function getIcons(s) {
  return (await s.get("data/icons.json", { type: "json", consistency: "strong" })) || {};
}
async function setIcons(s, map) {
  await s.setJSON("data/icons.json", map);
}
async function getGroups(s) {
  let arr = (await s.get("data/groups.json", { type: "json", consistency: "strong" })) || [];
  if (!arr.length) {
    arr = [{ id: "personal", name: "个人区" }, { id: "work", name: "工作区" }];
    await s.setJSON("data/groups.json", arr);
  }
  return arr;
}
async function setGroups(s, arr) {
  await s.setJSON("data/groups.json", arr);
}
async function getSite(s) {
  let o = (await s.get("data/site.json", { type: "json", consistency: "strong" })) || {};
  if (!o.name) o.name = "gai溜子导航站";
  if (!o.author) o.author = "gai溜子到处跑";
  if (!o.url) o.url = "www.090803.xyz";
  return o;
}
async function setSite(s, o) {
  await s.setJSON("data/site.json", o);
}
function groupOf(q) {
  if (q && q !== "all") return q;
  return null;
}

// --------------------------- 图标生成 ---------------------------
async function fetchIcon(host) {
  const sources = [
    "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64",
    "https://icons.duckduckgo.com/ip3/" + encodeURIComponent(host) + ".ico",
  ];
  for (const url of sources) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf && buf.byteLength > 32) {
          return "data:" + (r.headers.get("content-type") || "image/png") + ";base64," + abToB64(buf);
        }
      }
    } catch {
      // 继续下一个源
    }
  }
  return null;
}

function letterIcon(host) {
  const ch = (host || "?").charAt(0).toUpperCase();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
    '<rect width="64" height="64" rx="12" fill="#4b5563"/>' +
    '<text x="32" y="43" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">' +
    ch +
    "</text></svg>";
  return "data:image/svg+xml;base64," + b64u(svg);
}

async function serveIcon(s, host, fallback = true) {
  const map = await getIcons(s);
  let du = map[host];
  if (!du && fallback) du = letterIcon(host);
  const ct = ctOfDataUrl(du);
  const b64 = du.split(",")[1] || "";
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(buf, {
    headers: {
      "content-type": ct,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}

async function getAllIcons(s) {
  return await getIcons(s);
}

// 仅由显式刷新或保存书签时后台触发；不阻塞请求、不自动写回失败占位图
async function maybeFetchIcon(s, host) {
  if (!host) return;
  const map = await getIcons(s);
  if (map[host]) return;
  const du = await fetchIcon(host);
  if (du) {
    map[host] = du;
    await setIcons(s, map);
  }
}

async function refreshAllIcons(s) {
  const bms = await getBms(s);
  const hosts = [...new Set(bms.map((b) => {
    try { return new URL(b.url).host; } catch { return null; }
  }).filter(Boolean))];
  const map = await getIcons(s);
  let n = 0;
  for (const h of hosts) {
    if (map[h]) { n++; continue; }
    const du = (await fetchIcon(h)) || letterIcon(h);
    map[h] = du;
    n++;
  }
  await setIcons(s, map);
  return { hosts: hosts.length, cached: n };
}

// 仅刷新单个域名的图标（显式点「刷新图标」时触发）
async function refreshOneIcon(s, host) {
  if (!host) return null;
  const map = await getIcons(s);
  const du = (await fetchIcon(host)) || letterIcon(host);
  map[host] = du;
  await setIcons(s, map);
  return du;
}

// --------------------------- 主路由 ---------------------------
export default async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);

  // CORS 预检
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }

  const s = store();
  const head = parts[0] || "";

  // 公开端点
  if (head === "health") return json({ ok: true });

  if (method === "POST" && head === "login") {
    const body = await readBody(request);
    const stored = await getStoredPwd(s);
    const pwd = getPwd(env, stored);
    if (!body.password || body.password !== pwd) return json({ error: "密码错误" }, 401);
    const token = await makeToken(pwd);
    const cookie = "token=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + 7 * 86400;
    return json({ ok: true, token }, 200, { "set-cookie": cookie });
  }

  if (head === "icon" && method === "GET") {
    const host = url.searchParams.get("host");
    if (!host) return json({ error: "missing host" }, 400);
    return serveIcon(s, host);
  }

  // 以下端点：GET 分类/书签/图标公开；写操作及 backup/restore/data/icons 需鉴权
  const isReadPublic = method === "GET" && (head === "categories" || head === "bookmarks" || head === "icons" || head === "icon");
  const needsAuth = ["POST", "PUT", "PATCH", "DELETE"].includes(method) || ["backup", "restore", "data", "icons"].includes(head) || (head === "password" && method === "POST");
  if (needsAuth && !isReadPublic) {
    if (!(await requireAuth(request, env, s))) return json({ error: "unauthorized" }, 401);
  }

  // ---- 分类 ----
  if (head === "categories") {
    if (method === "GET") {
      const cats = await getCats(s);
      const g = groupOf(url.searchParams.get("group"));
      return json(g ? cats.filter((c) => c.group === g) : cats);
    }
    if (method === "POST") {
      const body = await readBody(request);
      const cats = await getCats(s);
      const maxSort = cats.reduce((m, c) => Math.max(m, c.sort || 0), 0);
      const cat = {
        id: crypto.randomUUID(),
        name: String(body.name || "未命名"),
        sort: body.sort != null ? Number(body.sort) : maxSort + 1,
        group: (typeof body.group === "string" && body.group) ? body.group : "personal",
        created_at: Date.now(),
      };
      cats.push(cat);
      await setCats(s, cats);
      return json(cat, 201);
    }
    const id = parts[1];
    if (method === "PUT" || method === "PATCH") {
      const body = await readBody(request);
      const cats = await getCats(s);
      const c = cats.find((x) => x.id === id);
      if (!c) return json({ error: "not found" }, 404);
      if (body.name != null) c.name = String(body.name);
      if (body.sort != null) c.sort = Number(body.sort);
      if (typeof body.group === "string" && body.group && body.group !== c.group) {
        const newGroup = body.group;
        c.group = newGroup;
        // 级联：把该分类下的书签一并移动到新分区，保持 b.group 与所属分类一致
        // （否则分类外壳过去了、书签还留在旧分区，切换到新分区就显示 0 条）
        const bms = await getBms(s);
        for (const b of bms) if (b.category_id === id) b.group = newGroup;
        await setBms(s, bms);
      }
      await setCats(s, cats);
      return json(c);
    }
    if (method === "DELETE") {
      const cats = await getCats(s);
      const bms = await getBms(s);
      const remaining = cats.filter((x) => x.id !== id);
      if (remaining.length === cats.length) return json({ error: "not found" }, 404);
      const newBms = bms.filter((x) => x.category_id !== id); // 级联删除书签
      await setCats(s, remaining);
      await setBms(s, newBms);
      return json({ ok: true, deleted: cats.length - remaining.length, bookmarksDeleted: bms.length - newBms.length });
    }
  }

  // ---- 书签 ----
  if (head === "bookmarks") {
    if (method === "GET") {
      const bms = await getBms(s);
      const g = groupOf(url.searchParams.get("group"));
      return json(g ? bms.filter((b) => b.group === g) : bms);
    }
    if (method === "POST") {
      const body = await readBody(request);
      if (!body.url) return json({ error: "url required" }, 400);
      const bms = await getBms(s);
      const maxSort = bms.reduce((m, b) => Math.max(m, b.sort || 0), 0);
      const host = (() => { try { return new URL(body.url).host; } catch { return null; } })();
      const bm = {
        id: crypto.randomUUID(),
        category_id: body.category_id || null,
        title: String(body.title || body.url),
        url: String(body.url),
        icon: body.icon || null,
        note: body.note || null,
        sort: body.sort != null ? Number(body.sort) : maxSort + 1,
        group: (typeof body.group === "string" && body.group) ? body.group : "personal",
        visits: 0,
        last_visit_at: null,
        created_at: Date.now(),
      };
      bms.push(bm);
      await setBms(s, bms);
      if (host && context.waitUntil) context.waitUntil(maybeFetchIcon(s, host));
      return json(bm, 201);
    }
    const id = parts[1];
    if (!id) return json({ error: "id required" }, 400);
    if (method === "PUT" || method === "PATCH") {
      const body = await readBody(request);
      const bms = await getBms(s);
      const b = bms.find((x) => x.id === id);
      if (!b) return json({ error: "not found" }, 404);
      for (const f of ["title", "url", "icon", "note", "sort"]) {
        if (body[f] != null) b[f] = f === "sort" ? Number(body[f]) : body[f];
      }
      if (body.category_id !== undefined) b.category_id = body.category_id; // 允许显式置 null（移动/取消分类）
      if (typeof body.group === "string" && body.group) b.group = body.group;
      await setBms(s, bms);
      const host = body.url ? (() => { try { return new URL(body.url).host; } catch { return null; } })() : null;
      if (host && context.waitUntil) context.waitUntil(maybeFetchIcon(s, host));
      return json(b);
    }
    if (method === "DELETE") {
      const bms = await getBms(s);
      const remaining = bms.filter((x) => x.id !== id);
      if (remaining.length === bms.length) return json({ error: "not found" }, 404);
      await setBms(s, remaining);
      return json({ ok: true });
    }
  }

  // ---- 备份 / 恢复 / 清空 ----
  if (head === "backup" && method === "GET") {
    const [cats, bms, icons] = await Promise.all([getCats(s), getBms(s), getIcons(s)]);
    return json({
      version: 2,
      generator: "bookmark-hub-eo",
      exportedAt: new Date().toISOString(),
      categories: cats,
      bookmarks: bms,
      icons,
    });
  }

  if (head === "restore" && method === "POST") {
    const body = await readBody(request);
    if (!body || !Array.isArray(body.categories) || !Array.isArray(body.bookmarks))
      return json({ error: "invalid backup" }, 400);
    // 图标兼容两种格式：dataURL 字符串 或 {ct, b64} 对象
    let icons = {};
    if (body.icons && typeof body.icons === "object") {
      for (const [h, v] of Object.entries(body.icons)) {
        if (typeof v === "string") icons[h] = v;
        else if (v && v.b64) icons[h] = "data:" + (v.ct || "image/png") + ";base64," + v.b64;
      }
    }
    await setCats(s, body.categories);
    await setBms(s, body.bookmarks);
    await setIcons(s, icons);
    return json({ ok: true, categories: body.categories.length, bookmarks: body.bookmarks.length, icons: Object.keys(icons).length });
  }

  if (head === "data" && method === "DELETE") {
    await s.delete("data/categories.json");
    await s.delete("data/bookmarks.json");
    await s.delete("data/icons.json");
    return json({ ok: true });
  }

  if (head === "icons") {
    if (method === "GET") {
      const icons = await getAllIcons(s);
      return json(icons);
    }
    if (parts[1] === "refresh" && method === "POST") {
      const body = await readBody(request);
      if (body && body.host) {
        const du = await refreshOneIcon(s, String(body.host));
        return json({ ok: true, host: body.host, refreshed: true, hasIcon: !!du && !String(du).startsWith("data:image/svg") });
      }
      const r = await refreshAllIcons(s);
      return json({ ok: true, ...r });
    }
  }

  if (head === "password" && method === "POST") {
    const body = await readBody(request);
    if (!body.password || typeof body.password !== "string" || body.password.length < 1)
      return json({ error: "password required" }, 400);
    await setStoredPwd(s, body.password);
    const token = await makeToken(body.password);
    return json({ ok: true, token });
  }

  // ---- 分区（个人区 / 工作区 等） ----
  if (head === "groups") {
    if (method === "GET") {
      const g = await getGroups(s);
      return json(g);
    }
    if (method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      if (!name) return json({ error: "名称必填" }, 400);
      const g = await getGroups(s);
      const id = (body.id && /^[A-Za-z0-9_-]{1,32}$/.test(String(body.id)))
        ? String(body.id)
        : crypto.randomUUID().slice(0, 8);
      if (g.find((x) => x.id === id)) return json({ error: "该分区已存在" }, 409);
      const ng = { id, name };
      g.push(ng);
      await setGroups(s, g);
      return json(ng, 201);
    }
    const id = parts[1];
    if (method === "PUT" || method === "PATCH") {
      if (!id) return json({ error: "id required" }, 400);
      const body = await readBody(request);
      const g = await getGroups(s);
      const target = g.find((x) => x.id === id);
      if (!target) return json({ error: "not found" }, 404);
      if (body.name != null) {
        const name = String(body.name).trim();
        if (!name) return json({ error: "名称必填" }, 400);
        target.name = name;
      }
      await setGroups(s, g);
      return json(target);
    }
    if (method === "DELETE") {
      if (!id) return json({ error: "id required" }, 400);
      const g = await getGroups(s);
      if (g.length <= 1) return json({ error: "至少保留一个分区" }, 400);
      const target = g.find((x) => x.id === id);
      if (!target) return json({ error: "not found" }, 404);
      const fallback = g.find((x) => x.id !== id).id;
      const cats = await getCats(s);
      const bms = await getBms(s);
      for (const c of cats) if (c.group === id) c.group = fallback;
      for (const b of bms) if (b.group === id) b.group = fallback;
      await setCats(s, cats);
      await setBms(s, bms);
      await setGroups(s, g.filter((x) => x.id !== id));
      return json({ ok: true, fallback });
    }
  }

  // ---- 站点信息（首页展示，可编辑） ----
  if (head === "site") {
    if (method === "GET") {
      const o = await getSite(s);
      return json(o);
    }
    if (method === "PUT" || method === "PATCH") {
      const body = await readBody(request);
      const o = await getSite(s);
      if (body.name != null) o.name = String(body.name).slice(0, 40);
      if (body.author != null) o.author = String(body.author).slice(0, 40);
      if (body.url != null) o.url = String(body.url).slice(0, 120);
      await setSite(s, o);
      return json(o);
    }
  }

  return json({ error: "not found", path }, 404);
}
