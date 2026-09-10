// gai溜子导航站 —— 纯前端静态版（数据存浏览器 localStorage，无后端）
const VERSION = "20260910-static";
const LS = { groups: "bm_groups", cats: "bm_cats", bms: "bm_bms", icons: "bm_icons", site: "bm_site" };

let CATS = [];
let BMS = [];
let ICONS = {};
let GROUPS = [{ id: "personal", name: "个人区" }, { id: "work", name: "工作区" }];
let SITE = { name: "gai溜子导航站", author: "gai溜子到处跑", url: "www.090803.xyz" };
let GROUP = localStorage.getItem("bm_group") || "personal";
let ACTIVE_CAT = "all";
let DRAG_BM = null;
let DRAG_CAT = null;

function clearDropHints() {
  document.querySelectorAll(".drop-ok, .drop-before, .drop-after").forEach((n) => n.classList.remove("drop-ok", "drop-before", "drop-after"));
}
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }
function hostOf(url) { try { return new URL(url).host; } catch { return ""; } }
function uid() { return (crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now() + Math.random().toString(36).slice(2)); }
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function letterIconSvg(host) {
  const ch = (host || "?").charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="4" fill="#4b5563"/><text x="9" y="13" font-size="12" text-anchor="middle" fill="#fff" font-family="sans-serif">${ch}</text></svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}
function iconSrc(host) { return ICONS[host] || letterIconSvg(host); }

// ---------------- 本地存储层 ----------------
function parse(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function load() {
  const g = parse(LS.groups);
  GROUPS = Array.isArray(g) && g.length ? g : [{ id: "personal", name: "个人区" }, { id: "work", name: "工作区" }];
  CATS = parse(LS.cats) || [];
  BMS = parse(LS.bms) || [];
  ICONS = parse(LS.icons) || {};
  const s = parse(LS.site);
  SITE = s && s.name ? s : { name: "gai溜子导航站", author: "gai溜子到处跑", url: "www.090803.xyz" };
}
function persist() {
  localStorage.setItem(LS.groups, JSON.stringify(GROUPS));
  localStorage.setItem(LS.cats, JSON.stringify(CATS));
  localStorage.setItem(LS.bms, JSON.stringify(BMS));
  localStorage.setItem(LS.icons, JSON.stringify(ICONS));
  localStorage.setItem(LS.site, JSON.stringify(SITE));
}
function nextSort(arr) { return arr.length ? Math.max.apply(null, arr.map((x) => x.sort || 0)) + 1 : 0; }
function needAuth() { return Promise.resolve(); } // 静态版无需登录

// ---------------- 图标抓取（仅新增/刷新时联网，打开只读本地）----------------
function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
async function fetchIcon(host) {
  if (!host) return null;
  const urls = [
    "https://logo.clearbit.com/" + host,
    "https://icons.duckduckgo.com/ip3/" + host + ".ico",
    "https://www.google.com/s2/favicons?domain=" + host + "&sz=64",
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { mode: "cors" });
      if (!r.ok) continue;
      const b = await r.blob();
      if (!b || !b.type.startsWith("image/") || b.size < 64) continue;
      return await blobToDataUrl(b);
    } catch {}
  }
  return null;
}
function refreshIconFor(host) {
  if (!host || ICONS[host]) return;
  fetchIcon(host).then((d) => { if (d) { ICONS[host] = d; persist(); renderMain(); } });
}

// ---------------- 业务数据 ----------------
function groupName(id) { const g = GROUPS.find((x) => x.id === id); return g ? g.name : "个人区"; }
function sortedCats() { return [...CATS].sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
function sortedBms() { return [...BMS].sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
function bmsOfCat(cid) { return sortedBms().filter((b) => b.category_id === cid && b.group === GROUP); }
function bmCount(cid) { return BMS.filter((b) => b.category_id === cid && b.group === GROUP).length; }
function groupBms() { return sortedBms().filter((b) => b.group === GROUP); }
function groupCats() { return sortedCats().filter((c) => c.group === GROUP); }

function loadData() {
  load();
  if (!GROUPS.find((g) => g.id === GROUP)) GROUP = GROUPS[0] ? GROUPS[0].id : "personal";
  render(); renderSite();
}

function render() { renderTabs(); renderCatNav(); renderMain(); }

function renderSite() {
  const name = SITE.name || "我的导航站";
  el("siteName").textContent = "🔖 " + name;
  document.title = name;
  el("siteAuthor").textContent = SITE.author || "";
  const u = (SITE.url || "").trim();
  el("siteUrl").textContent = u;
  el("siteUrl").href = /^https?:\/\//i.test(u) ? u : (u ? "https://" + u : "#");
  el("siteVer").textContent = "v" + VERSION;
}

function renderTabs() {
  const tabs = el("groupTabs"); tabs.innerHTML = "";
  for (const g of GROUPS) {
    const b = document.createElement("button");
    b.dataset.g = g.id;
    b.textContent = g.name;
    if (g.id === GROUP) b.classList.add("active");
    tabs.appendChild(b);
  }
}

function renderCatNav() {
  const list = el("catList"); list.innerHTML = "";
  const all = document.createElement("div");
  all.className = "cat" + (ACTIVE_CAT === "all" ? " active" : "");
  all.dataset.virtual = "1";
  all.innerHTML = `<span class="name">全部</span><span class="cnt">${groupBms().length}</span>`;
  all.onclick = () => { ACTIVE_CAT = "all"; render(); };
  list.appendChild(all);
  for (const c of groupCats()) {
    const d = document.createElement("div");
    d.className = "cat" + (ACTIVE_CAT === c.id ? " active" : "");
    d._cat = c;
    d.draggable = true;
    d.innerHTML = `<span class="name">${esc(c.name)}</span><span class="cnt">${bmCount(c.id)}</span>`;
    d.onclick = () => { ACTIVE_CAT = c.id; render(); };
    d.addEventListener("dragstart", (e) => {
      DRAG_CAT = c; e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", c.id); } catch {}
      d.classList.add("dragging");
    });
    d.addEventListener("dragend", () => { d.classList.remove("dragging"); clearDropHints(); DRAG_CAT = null; });
    list.appendChild(d);
  }
  const add = document.createElement("button");
  add.className = "ghost small"; add.style.cssText = "margin:10px 14px 0";
  add.textContent = "+ 新建分类";
  add.onclick = () => addCat();
  list.appendChild(add);
}

function renderMain() {
  const c = el("content"); c.innerHTML = "";
  el("curTitle").textContent = groupName(GROUP);
  const gbms = groupBms();
  el("curCount").textContent = `${gbms.length} 书签 / ${groupCats().length} 分类`;

  if (ACTIVE_CAT !== "all") {
    const cat = groupCats().find((x) => x.id === ACTIVE_CAT);
    if (!cat) { ACTIVE_CAT = "all"; return renderMain(); }
    const items = bmsOfCat(cat.id);
    c.appendChild(section(cat.name, items.length, items, cat));
    return;
  }
  if (!gbms.length && !groupCats().length) {
    c.innerHTML = `<div class="empty">当前分区还没有内容，点击「+ 书签」或「+ 新建分类」开始添加。</div>`;
    return;
  }
  for (const cat of groupCats()) {
    const items = bmsOfCat(cat.id);
    c.appendChild(section(cat.name, items.length, items, cat));
  }
  const uncat = gbms.filter((b) => !b.category_id);
  if (uncat.length) c.appendChild(section("未分类", uncat.length, uncat, null));
}

function section(title, count, items, cat) {
  const sec = document.createElement("section"); sec.className = "sec"; sec._cat = cat || null;
  const head = document.createElement("div"); head.className = "sec-head";
  head.innerHTML = `<h4>${esc(title)}</h4><span class="count">${count}</span>`;
  sec.appendChild(head);
  const box = document.createElement("div"); box.className = "items";
  if (!items.length) {
    box.innerHTML = `<div class="empty" style="padding:10px 0">该分类下暂无书签</div>`;
  } else {
    for (const b of items) box.appendChild(bmItem(b));
  }
  sec.appendChild(box);
  return sec;
}

function bmItem(b) {
  const h = hostOf(b.url);
  const d = document.createElement("div"); d.className = "item"; d._bm = b; d.draggable = true;
  d.title = `${esc(b.title)}\n${esc(b.url)}${b.note ? "\n" + esc(b.note) : ""}`;
  d.innerHTML = `<img src="${iconSrc(h)}" alt=""/><span class="t">${esc(b.title || b.url)}</span>`;
  d.addEventListener("dragstart", (e) => {
    DRAG_BM = b; e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", b.id); } catch {}
    d.classList.add("dragging");
  });
  d.addEventListener("dragend", () => { d.classList.remove("dragging"); clearDropHints(); DRAG_BM = null; });
  return d;
}

// ---------------- 右键菜单 ----------------
function showCtx(x, y, items) {
  const m = el("ctxMenu");
  m.innerHTML = ""; fillCtx(m, items); m.classList.add("show");
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
  m.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
}
function fillCtx(m, items) {
  for (const it of items) {
    if (it.sep) { const s = document.createElement("div"); s.className = "ctx-sep"; m.appendChild(s); continue; }
    const d = document.createElement("div");
    d.className = "ctx-item" + (it.danger ? " danger" : "") + (it.submenu ? " has-sub" : "");
    d.innerHTML = `<span>${esc(it.label)}</span>` + (it.submenu ? `<span class="ctx-arrow">▸</span>` : "");
    if (it.submenu) {
      d.addEventListener("mouseenter", () => {
        m.querySelectorAll(".ctx-sub").forEach((n) => n.remove());
        const sub = document.createElement("div"); sub.className = "ctx ctx-sub"; fillCtx(sub, it.submenu); m.appendChild(sub);
        const dr = d.getBoundingClientRect(); sub.style.left = (dr.right - 4) + "px"; sub.style.top = dr.top + "px";
        const sr = sub.getBoundingClientRect();
        if (sr.right > window.innerWidth - 8) sub.style.left = (dr.left - sr.width + 4) + "px";
        if (sr.bottom > window.innerHeight - 8) sub.style.top = (window.innerHeight - sr.height - 8) + "px";
      });
    } else {
      d.onclick = () => { hideCtx(); it.onClick && it.onClick(); };
    }
    m.appendChild(d);
  }
}
function hideCtx() { el("ctxMenu").classList.remove("show"); }
document.addEventListener("click", hideCtx);
document.addEventListener("scroll", hideCtx, true);

el("content").addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".item");
  if (!item) return;
  e.preventDefault();
  const b = item._bm;
  showCtx(e.clientX, e.clientY, [
    { label: "打开链接", onClick: () => window.open(b.url, "_blank") },
    { label: "编辑", onClick: () => editBm(b) },
    { label: "刷新图标", onClick: () => refreshBmIcon(b) },
    { label: "删除", danger: true, onClick: () => delBm(b) },
  ]);
});
el("catList").addEventListener("contextmenu", (e) => {
  const cat = e.target.closest(".cat");
  if (!cat || cat.dataset.virtual) return;
  e.preventDefault();
  const c = cat._cat;
  const groupItems = GROUPS.map((g) => ({ label: (g.id === c.group ? "✓ " : "") + g.name, onClick: () => moveCatToGroup(c, g.id) }));
  showCtx(e.clientX, e.clientY, [
    { label: "编辑", onClick: () => editCat(c) },
    { label: "移动到分区", submenu: groupItems },
    { label: "删除", danger: true, onClick: () => delCat(c) },
  ]);
});
el("content").addEventListener("click", (e) => {
  const item = e.target.closest(".item");
  if (item && item._bm) window.open(item._bm.url, "_blank");
});

// ---------------- 拖拽 ----------------
function insertSort(filtered, idx) {
  if (!filtered.length) return 0;
  if (idx <= 0) return filtered[0].sort - 1;
  if (idx >= filtered.length) return filtered[filtered.length - 1].sort + 1;
  return (filtered[idx - 1].sort + filtered[idx].sort) / 2;
}
el("groupTabs").addEventListener("dragover", (e) => {
  const b = e.target.closest("button[data-g]");
  if (b && (DRAG_BM || DRAG_CAT)) { e.preventDefault(); clearDropHints(); b.classList.add("drop-ok"); }
});
el("groupTabs").addEventListener("drop", (e) => {
  const b = e.target.closest("button[data-g]");
  if (!b) return;
  if (DRAG_BM) {
    e.preventDefault(); b.classList.remove("drop-ok"); moveToGroup(DRAG_BM, b.dataset.g);
  } else if (DRAG_CAT) {
    e.preventDefault(); b.classList.remove("drop-ok");
    if (DRAG_CAT.group === b.dataset.g) { toast("已在该分区"); return; }
    DRAG_CAT.group = b.dataset.g;
    // 级联：分类下书签跟随分区
    for (const bm of BMS) if (bm.category_id === DRAG_CAT.id) bm.group = b.dataset.g;
    persist(); toast("已移动到「" + groupName(b.dataset.g) + "」"); loadData(); renderGroupManage();
  }
});
el("content").addEventListener("dragover", (e) => {
  if (!DRAG_BM) return;
  const sec = e.target.closest(".sec");
  if (!sec) return;
  e.preventDefault(); clearDropHints(); sec.classList.add("drop-ok");
  const item = e.target.closest(".item");
  if (item && item._bm && item._bm.id !== DRAG_BM.id) {
    const r = item.getBoundingClientRect();
    item.classList.add((e.clientY - r.top) < r.height / 2 ? "drop-before" : "drop-after");
  }
});
el("content").addEventListener("drop", (e) => {
  if (!DRAG_BM) return;
  const sec = e.target.closest(".sec");
  if (!sec) return;
  e.preventDefault(); clearDropHints();
  const cat = sec._cat;
  const list = sortedBms().filter((b) => cat ? (b.category_id === cat.id && b.group === cat.group) : (!b.category_id && b.group === GROUP));
  const filtered = list.filter((b) => b.id !== DRAG_BM.id);
  const item = e.target.closest(".item");
  let idx = filtered.length;
  if (item && item._bm && item._bm.id !== DRAG_BM.id) {
    const r = item.getBoundingClientRect();
    const before = (e.clientY - r.top) < r.height / 2;
    const i = filtered.findIndex((b) => b.id === item._bm.id);
    if (i >= 0) idx = before ? i : i + 1;
  }
  applyMove(DRAG_BM, { category_id: cat ? cat.id : null, group: cat ? cat.group : GROUP, sort: insertSort(filtered, idx) });
});
el("catList").addEventListener("dragover", (e) => {
  if (!DRAG_CAT) return;
  const c = e.target.closest(".cat");
  if (!c || c.dataset.virtual) return;
  e.preventDefault(); clearDropHints();
  const r = c.getBoundingClientRect();
  c.classList.add((e.clientY - r.top) < r.height / 2 ? "drop-before" : "drop-after");
});
el("catList").addEventListener("drop", (e) => {
  if (!DRAG_CAT) return;
  const c = e.target.closest(".cat");
  if (!c || c.dataset.virtual) return;
  e.preventDefault(); clearDropHints();
  const target = c._cat;
  if (!target || target.id === DRAG_CAT.id) return;
  const list = groupCats().filter((x) => x.id !== DRAG_CAT.id);
  const r = c.getBoundingClientRect();
  const before = (e.clientY - r.top) < r.height / 2;
  const i = list.findIndex((x) => x.id === target.id);
  const idx = i >= 0 ? (before ? i : i + 1) : list.length;
  DRAG_CAT.sort = insertSort(list, idx);
  persist(); toast("已调整顺序"); loadData();
});

async function moveToGroup(bm, groupId) {
  if (bm.group === groupId) { toast("已在「" + groupName(groupId) + "」"); return; }
  bm.group = groupId; bm.category_id = null;
  persist(); toast("已移动到「" + groupName(groupId) + "」"); loadData();
}
async function moveCatToGroup(c, groupId) {
  if (c.group === groupId) { toast("已在「" + groupName(groupId) + "」"); return; }
  c.group = groupId;
  for (const bm of BMS) if (bm.category_id === c.id) bm.group = groupId;
  persist(); toast("已移动到「" + groupName(groupId) + "」"); loadData(); renderGroupManage();
}
async function applyMove(bm, patch) {
  Object.assign(bm, patch);
  persist(); toast("已更新"); loadData();
}

// ---------------- 分类 ----------------
function addCat() {
  el("catTitle").textContent = "新建分类";
  el("catName").value = ""; fillGroupSelect("catGroup", GROUP);
  el("catModal")._id = null; show("catModal"); el("catName").focus();
}
function editCat(c) {
  el("catTitle").textContent = "编辑分类";
  el("catName").value = c.name; fillGroupSelect("catGroup", c.group || "personal");
  el("catModal")._id = c.id; show("catModal"); el("catName").focus();
}
function delCat(c) {
  if (!confirm(`删除分类「${c.name}」及其下 ${bmCount(c.id)} 个书签？`)) return;
  CATS = CATS.filter((x) => x.id !== c.id);
  BMS = BMS.filter((b) => b.category_id !== c.id);
  persist(); toast("已删除"); if (ACTIVE_CAT === c.id) ACTIVE_CAT = "all"; loadData();
}

// ---------------- 书签 ----------------
function addBm() {
  el("bmTitle").textContent = "新建书签";
  el("bmTitle_in").value = ""; el("bmUrl").value = ""; el("bmNote").value = "";
  fillCatSelect(""); fillGroupSelect("bmGroup", GROUP);
  el("bmModal")._id = null; show("bmModal"); el("bmUrl").focus();
}
function editBm(b) {
  el("bmTitle").textContent = "编辑书签";
  el("bmTitle_in").value = b.title || ""; el("bmUrl").value = b.url || ""; el("bmNote").value = b.note || "";
  fillCatSelect(b.category_id || ""); fillGroupSelect("bmGroup", b.group || GROUP);
  el("bmModal")._id = b.id; show("bmModal");
}
function fillCatSelect(sel) {
  const s = el("bmCat"); s.innerHTML = `<option value="">（未分类）</option>`;
  for (const c of groupCats()) s.insertAdjacentHTML("beforeend", `<option value="${c.id}"${c.id === sel ? " selected" : ""}>${esc(c.name)}</option>`);
}
function fillGroupSelect(selId, val) {
  const s = el(selId); s.innerHTML = "";
  for (const g of GROUPS) s.insertAdjacentHTML("beforeend", `<option value="${g.id}"${g.id === val ? " selected" : ""}>${esc(g.name)}</option>`);
}
function delBm(b) {
  if (!confirm(`删除书签「${b.title || b.url}」？`)) return;
  BMS = BMS.filter((x) => x.id !== b.id);
  persist(); toast("已删除"); loadData();
}
async function refreshBmIcon(b) {
  const h = hostOf(b.url); if (!h) return;
  toast("正在刷新图标…");
  const d = await fetchIcon(h);
  if (d) { ICONS[h] = d; persist(); toast("图标已更新"); }
  else toast("未获取到，已用占位图");
  loadData();
}

// ---------------- 鉴权（静态版无后端，占位）----------------
function show(id) { el(id).classList.add("show"); }
function hide(id) { el(id).classList.remove("show"); }

// ---------------- 分类 / 书签 保存 ----------------
el("catCancel").onclick = () => hide("catModal");
el("catSave").onclick = () => {
  const name = el("catName").value.trim(); if (!name) return toast("请输入名称");
  const group = el("catGroup").value;
  const id = el("catModal")._id;
  if (id) {
    const c = CATS.find((x) => x.id === id); if (c) { c.name = name; c.group = group; }
  } else {
    CATS.push({ id: uid(), name, group, sort: nextSort(CATS) });
  }
  persist(); hide("catModal"); loadData();
};

el("bmCancel").onclick = () => hide("bmModal");
el("bmSave").onclick = () => {
  const url = el("bmUrl").value.trim(); if (!url) return toast("请输入 URL");
  const payload = {
    title: el("bmTitle_in").value.trim() || url,
    url,
    category_id: el("bmCat").value || null,
    group: el("bmGroup").value,
    note: el("bmNote").value.trim() || null,
  };
  const id = el("bmModal")._id;
  if (id) {
    const b = BMS.find((x) => x.id === id);
    if (b) Object.assign(b, payload);
  } else {
    const b = Object.assign({ id: uid(), sort: nextSort(BMS) }, payload);
    BMS.push(b);
  }
  persist(); hide("bmModal"); loadData();
  refreshIconFor(hostOf(url));
};

// ---------------- 设置抽屉 ----------------
el("btnSettings").onclick = () => { renderGroupManage(); show("settingsDrawer"); };
el("btnCloseSettings").onclick = () => hide("settingsDrawer");
el("settingsDrawer").onclick = (e) => { if (e.target === el("settingsDrawer")) hide("settingsDrawer"); };
el("btnAddBm").onclick = addBm;

// ---------------- 站点信息 ----------------
el("btnEditSite").onclick = () => {
  el("siteNameIn").value = SITE.name || "";
  el("siteAuthorIn").value = SITE.author || "";
  el("siteUrlIn").value = SITE.url || "";
  show("siteModal");
};
el("siteCancel").onclick = () => hide("siteModal");
el("siteSave").onclick = () => {
  SITE = {
    name: el("siteNameIn").value.trim() || "我的导航站",
    author: el("siteAuthorIn").value.trim(),
    url: el("siteUrlIn").value.trim(),
  };
  persist(); hide("siteModal"); renderSite(); toast("已保存站点信息");
};

function renderGroupManage() {
  const box = el("groupList"); box.innerHTML = "";
  for (const g of GROUPS) {
    const row = document.createElement("div"); row.className = "grp-row";
    row.innerHTML = `<span class="grp-name">${esc(g.name)}</span>`;
    const ren = document.createElement("button");
    ren.className = "small"; ren.textContent = "重命名"; ren.onclick = () => renameGroup(g);
    const del = document.createElement("button");
    del.className = "danger small"; del.textContent = "删除";
    del.onclick = () => {
      if (GROUPS.length <= 1) return toast("至少保留一个分区");
      const fallback = GROUPS.find((x) => x.id !== g.id).id;
      if (!confirm(`删除分区「${g.name}」？其下分类和书签会移到「${groupName(fallback)}」`)) return;
      GROUPS = GROUPS.filter((x) => x.id !== g.id);
      for (const c of CATS) if (c.group === g.id) c.group = fallback;
      for (const b of BMS) if (b.group === g.id) b.group = fallback;
      if (GROUP === g.id) { GROUP = fallback; localStorage.setItem("bm_group", GROUP); }
      persist(); toast("已删除分区"); loadData(); renderGroupManage();
    };
    row.appendChild(ren); row.appendChild(del);
    box.appendChild(row);
  }
}
el("btnAddGroup").onclick = () => {
  const name = el("newGroupName").value.trim(); if (!name) return toast("请输入分区名");
  GROUPS.push({ id: uid(), name });
  persist(); el("newGroupName").value = ""; toast("已添加分区"); loadData(); renderGroupManage();
};
function renameGroup(g) {
  el("grpTitle").textContent = "重命名分区";
  el("grpName").value = g.name;
  el("grpModal")._id = g.id; show("grpModal"); el("grpName").focus();
}
el("grpCancel").onclick = () => hide("grpModal");
el("grpSave").onclick = () => {
  const name = el("grpName").value.trim(); if (!name) return toast("请输入名称");
  const g = GROUPS.find((x) => x.id === el("grpModal")._id);
  if (g) g.name = name;
  persist(); hide("grpModal"); toast("已重命名"); loadData(); renderGroupManage();
};
el("grpName").addEventListener("keydown", (e) => { if (e.key === "Enter") el("grpSave").click(); });

el("btnBackup").onclick = () => {
  const j = { groups: GROUPS, categories: CATS, bookmarks: BMS, icons: ICONS, site: SITE };
  const blob = new Blob([JSON.stringify(j, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "bookmarks-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
  toast("已下载备份");
};
el("btnRestore").onclick = () => el("restoreFile").click();
el("restoreFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then((text) => {
    let j; try { j = JSON.parse(text); } catch { return toast("JSON 解析失败"); }
    if (Array.isArray(j.groups)) GROUPS = j.groups;
    if (Array.isArray(j.categories)) CATS = j.categories;
    if (Array.isArray(j.bookmarks)) BMS = j.bookmarks;
    if (j.icons) ICONS = j.icons;
    if (j.site) SITE = j.site;
    persist(); toast(`恢复完成：分类 ${CATS.length} / 书签 ${BMS.length} / 图标 ${Object.keys(ICONS).length}`); loadData();
    e.target.value = "";
  });
};
el("btnWipe").onclick = () => {
  if (!confirm("确定清空全部分类和书签？此操作不可恢复，建议先备份！")) return;
  CATS = []; BMS = []; ICONS = {}; persist(); toast("已清空"); ACTIVE_CAT = "all"; loadData();
};
el("btnRefreshIcons").onclick = async () => {
  const hosts = [...new Set(BMS.map((b) => hostOf(b.url)).filter(Boolean))];
  toast("正在更新图标…");
  let n = 0;
  for (const h of hosts) {
    if (ICONS[h]) continue;
    const d = await fetchIcon(h);
    if (d) { ICONS[h] = d; n++; }
  }
  persist(); toast(`图标更新：${n} 个新增`); loadData();
};

// ---------------- Tabs ----------------
el("groupTabs").onclick = (e) => {
  const b = e.target.closest("button[data-g]");
  if (!b) return;
  GROUP = b.dataset.g; localStorage.setItem("bm_group", GROUP); ACTIVE_CAT = "all"; render();
};

// ---------------- 侧栏宽度拖拽 ----------------
(function initResizer() {
  const sw = localStorage.getItem("bm_side_w");
  if (sw) el("catNav").style.width = sw + "px";
  const rz = el("sideResizer");
  rz.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = el("catNav").offsetWidth;
    function mv(ev) {
      const w = Math.max(120, Math.min(440, startW + ev.clientX - startX));
      el("catNav").style.width = w + "px";
    }
    function up() {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      localStorage.setItem("bm_side_w", el("catNav").offsetWidth);
    }
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
  });
})();

// ---------------- 启动 ----------------
loadData();
