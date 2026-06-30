const state = { digests: [], selectedDate: "", type: "all", tag: "", query: "", view: "latest" };
const typeLabels = { policy: "官方政策", discussion: "卖家讨论", case: "实战案例" };

async function init() {
  const response = await fetch("data/digests.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state.digests = (await response.json()).sort((a, b) => b.date.localeCompare(a.date));
  state.selectedDate = state.digests[0]?.date || "";
  bindEvents();
  populateDates();
  render();
}

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.type = state.view === "cases" ? "case" : "all";
    state.tag = "";
    state.selectedDate = state.view === "latest" ? state.digests[0]?.date || "" : "all";
    document.getElementById("dateSelect").value = state.selectedDate;
    document.querySelectorAll(".nav-link").forEach(item => item.classList.toggle("active", item === button));
    syncTypeButtons();
    render();
  }));
  document.querySelectorAll(".filter-button").forEach(button => button.addEventListener("click", () => {
    state.type = button.dataset.type;
    syncTypeButtons();
    render();
  }));
  document.getElementById("dateSelect").addEventListener("change", event => {
    state.selectedDate = event.target.value;
    render();
  });
  document.getElementById("searchInput").addEventListener("input", event => {
    state.query = event.target.value.trim().toLocaleLowerCase("zh-CN");
    render();
  });
  document.getElementById("clearFilters").addEventListener("click", clearFilters);
}

function clearFilters() {
  state.type = state.view === "cases" ? "case" : "all";
  state.tag = "";
  state.query = "";
  document.getElementById("searchInput").value = "";
  syncTypeButtons();
  render();
}

function populateDates() {
  document.getElementById("dateSelect").innerHTML =
    `<option value="all">全部日期</option>` +
    state.digests.map(digest => `<option value="${digest.date}">${formatDate(digest.date)}</option>`).join("");
  document.getElementById("dateSelect").value = state.selectedDate;
}

function getItems() {
  const digests = state.selectedDate === "all"
    ? state.digests
    : state.digests.filter(digest => digest.date === state.selectedDate);
  return digests.flatMap(digest => digest.items.map(item => ({ ...item, digestDate: digest.date })));
}

function filteredItems(items) {
  return items.filter(item => {
    const haystack = [item.title, item.summary, item.detail, item.dateLabel, ...item.tags].join(" ").toLocaleLowerCase("zh-CN");
    return (state.type === "all" || item.type === state.type)
      && (!state.tag || item.tags.includes(state.tag))
      && (!state.query || haystack.includes(state.query));
  });
}

function render() {
  const digest = state.selectedDate === "all"
    ? state.digests[0]
    : state.digests.find(item => item.date === state.selectedDate) || state.digests[0];
  const items = getItems();
  renderHeader(digest, items);
  renderExecutive(digest, items);
  renderTags(items);
  renderFeed(filteredItems(items));
  renderActions(state.selectedDate === "all" ? null : digest);
  updateCounts(items);
}

function renderHeader(digest, items) {
  const copy = {
    latest: ["今天值得关注的变化", "把政策变化、卖家风险和可复用的方法压缩到一个页面。"],
    archive: ["历史情报档案", "跨日期检索已收录的政策、讨论与运营案例。"],
    cases: ["实战案例库", "快速找到可复用的方法、踩坑记录和解决路径。"]
  }[state.view];
  document.getElementById("pageTitle").textContent = copy[0];
  document.getElementById("pageDescription").textContent = copy[1];
  document.getElementById("dateSelect").disabled = false;
  document.getElementById("updateLabel").textContent = `更新至 ${formatDate(state.digests[0]?.date)}`;
  document.getElementById("actionDate").textContent = digest ? formatShortDate(digest.date) : "";
  const count = type => items.filter(item => item.type === type).length;
  document.getElementById("policyCount").textContent = count("policy");
  document.getElementById("discussionCount").textContent = count("discussion");
  document.getElementById("caseCount").textContent = count("case");
  document.getElementById("actionCount").textContent = items.filter(item => item.priority === "high").length;
}

function renderExecutive(digest, items) {
  const section = document.querySelector(".executive-brief");
  if (state.selectedDate === "all") {
    section.classList.add("archive-brief");
    document.getElementById("executiveTitle").textContent = "历史情报总览";
    document.getElementById("executiveSummary").textContent =
      `当前收录 ${state.digests.length} 个日期、${items.length} 条情报。建议使用主题标签和搜索定位具体政策、风险或案例。`;
    document.getElementById("confidenceLabel").textContent = "跨日期归档";
    const counts = [
      ["政策与规则", items.filter(item => item.type === "policy").length, "追踪生效日期和规则变化"],
      ["经营风险", items.filter(item => item.priority === "high").length, "优先复核高影响事项"],
      ["可复用案例", items.filter(item => item.type === "case").length, "沉淀运营方法和复盘框架"]
    ];
    document.getElementById("insightGrid").innerHTML = counts.map(([title, value, text], index) =>
      `<article class="insight-card"><span>0${index + 1}</span><strong>${title} · ${value}</strong><p>${text}</p></article>`
    ).join("");
    return;
  }
  section.classList.remove("archive-brief");
  document.getElementById("executiveTitle").textContent = "今日商业判断";
  document.getElementById("confidenceLabel").textContent = digest.confidence || "基于今日公开信号";
  document.getElementById("executiveSummary").textContent =
    digest.executiveSummary || "今日信息以运营风险和执行方法为主，暂无足以改变整体经营策略的官方规则变化。";
  const insights = digest.insights || deriveInsights(items);
  document.getElementById("insightGrid").innerHTML = insights.map((insight, index) =>
    `<article class="insight-card"><span>0${index + 1}</span><strong>${insight.title}</strong><p>${insight.text}</p><small>${insight.signal}</small></article>`
  ).join("");
}

function deriveInsights(items) {
  return items.slice(0, 3).map(item => ({
    title: item.title,
    text: item.detail,
    signal: item.type === "policy" ? "官方规则" : "卖家公开信号"
  }));
}

function renderTags(items) {
  const counts = {};
  items.forEach(item => item.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
  const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const container = document.getElementById("tagFilters");
  container.innerHTML = tags.map(([tag, count]) =>
    `<button class="tag-filter ${state.tag === tag ? "active" : ""}" data-tag="${tag}">${tag} ${count}</button>`
  ).join("");
  container.querySelectorAll(".tag-filter").forEach(button => button.addEventListener("click", () => {
    state.tag = state.tag === button.dataset.tag ? "" : button.dataset.tag;
    render();
  }));
}

function renderFeed(items) {
  const list = document.getElementById("feedList");
  const template = document.getElementById("itemTemplate");
  list.innerHTML = "";
  items.forEach(item => {
    const node = template.content.cloneNode(true);
    const badge = node.querySelector(".type-badge");
    badge.textContent = typeLabels[item.type];
    badge.classList.add(`type-${item.type}`);
    node.querySelector(".item-date").textContent = `${formatShortDate(item.digestDate)} · ${item.dateLabel}`;
    node.querySelector(".priority-badge").textContent = item.priority === "high" ? "优先处理" : "";
    node.querySelector("h2").textContent = item.title;
    node.querySelector(".summary").textContent = item.summary;
    node.querySelector(".detail-label").textContent = item.detailLabel;
    node.querySelector(".detail-text").textContent = item.detail;
    node.querySelector(".item-tags").innerHTML = item.tags.map(tag => `<span class="item-tag">${tag}</span>`).join("");
    node.querySelector(".source-link").href = item.source;
    list.appendChild(node);
  });
  document.getElementById("resultLabel").textContent = `${state.type === "all" ? "全部内容" : typeLabels[state.type]} · ${items.length} 条`;
  document.getElementById("emptyState").hidden = items.length > 0;
}

function renderActions(digest) {
  const container = document.getElementById("actionList");
  document.querySelector(".daily-actions").hidden = !digest;
  if (!digest) return;
  container.innerHTML = digest.actions.map((action, index) => {
    const id = `${digest.date}-${index}`;
    const checked = localStorage.getItem(id) === "done" ? "checked" : "";
    return `<div class="action-item"><label><input type="checkbox" data-id="${id}" ${checked}><span>${action.text}</span></label><small>${action.category}</small></div>`;
  }).join("");
  container.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
    localStorage.setItem(input.dataset.id, input.checked ? "done" : "");
  }));
}

function updateCounts(items) {
  const count = type => items.filter(item => item.type === type).length;
  document.getElementById("allCount").textContent = items.length;
  document.getElementById("policyFilterCount").textContent = count("policy");
  document.getElementById("discussionFilterCount").textContent = count("discussion");
  document.getElementById("caseFilterCount").textContent = count("case");
}

function syncTypeButtons() {
  document.querySelectorAll(".filter-button").forEach(button =>
    button.classList.toggle("active", button.dataset.type === state.type));
}

function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${date}T00:00:00`));
}

function formatShortDate(date) { return date ? date.slice(5).replace("-", "/") : ""; }

init().catch(error => {
  document.getElementById("feedList").innerHTML =
    `<div class="empty-state"><strong>数据加载失败</strong><p>${error.message}。请通过本地服务器访问网页。</p></div>`;
});
