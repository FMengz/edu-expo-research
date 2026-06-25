
const data = window.EXPO_DATA || [];
const totals = window.EXPO_TOTALS || {};
let activeIndex = -1;
let query = "";
let viewMode = "compare";
let searchScope = "global";

const tabsEl = document.getElementById("tabs");
const contentEl = document.getElementById("content");
const searchInput = document.getElementById("searchInput");
const compareViewButton = document.getElementById("compareView");
const cardViewButton = document.getElementById("cardView");
const globalSearchButton = document.getElementById("globalSearch");
const categorySearchButton = document.getElementById("categorySearch");

document.getElementById("sheetCount").textContent = totals.sheetCount || data.length;
document.getElementById("recordCount").textContent =
  totals.recordCount || data.reduce((sum, sheet) => sum + sheet.records.length, 0);
document.getElementById("redCount").textContent =
  totals.redCount || data.reduce((sum, sheet) => sum + sheet.redCount, 0);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRuns(field) {
  const runs = field.runs && field.runs.length ? field.runs : [{ text: field.text, red: field.red }];
  const hasRunRed = runs.some((run) => run.red);
  const inner = runs
    .filter((run) => run.text)
    .map((run) => {
      const text = escapeHtml(run.text);
      return run.red ? `<span class="red-text">${text}</span>` : text;
    })
    .join("");
  const wrapped = field.red && !hasRunRed ? `<span class="whole-red">${inner}</span>` : inner;
  if (field.hyperlink) {
    return `<a href="${escapeHtml(field.hyperlink)}" target="_blank" rel="noreferrer">${wrapped}</a>`;
  }
  return wrapped;
}

function fieldText(record) {
  return record.fields.map((field) => `${field.label} ${field.text}`).join(" ").toLowerCase();
}

function chooseTitle(record) {
  const preferred = ["公司", "厂商", "单位", "企业", "名称", "品牌"];
  const direct = record.fields.find((field) => preferred.some((key) => field.label.includes(key)) && field.text);
  if (direct) return direct.text;
  const first = record.fields.find((field) => field.text);
  return first ? first.text : `第 ${record._row} 行`;
}

function visibleFields(record) {
  const title = chooseTitle(record);
  return record.fields.filter((field) => field.text && field.text !== title);
}

function recordMatches(record) {
  if (!query) return true;
  return fieldText(record).includes(query);
}

function matchedSheetIndexes() {
  if (!query) return new Set();
  return new Set(
    data
      .map((sheet, index) => ({ index, count: sheet.records.filter(recordMatches).length }))
      .filter((item) => item.count > 0)
      .map((item) => item.index)
  );
}

function renderTabs() {
  const matched = matchedSheetIndexes();
  const totalMatched = query
    ? data.reduce((sum, sheet) => sum + sheet.records.filter(recordMatches).length, 0)
    : totals.recordCount || data.reduce((sum, sheet) => sum + sheet.records.length, 0);
  const allClasses = ["tab"];
  if (activeIndex === -1) allClasses.push("active");
  if (query && totalMatched > 0) allClasses.push("matched");
  const allTab = `<button class="${allClasses.join(" ")}" type="button" data-index="-1">
    全部 (${query ? `${totalMatched}/${totals.recordCount || totalMatched}` : totals.recordCount || totalMatched})
  </button>`;
  tabsEl.innerHTML =
    allTab +
    data
    .map((sheet, index) => {
      const matchCount = query ? sheet.records.filter(recordMatches).length : 0;
      const classes = ["tab"];
      if (index === activeIndex) classes.push("active");
      if (matched.has(index)) classes.push("matched");
      const countText = query ? `${matchCount}/${sheet.records.length}` : sheet.records.length;
      return `<button class="${classes.join(" ")}" type="button" data-index="${index}">
          ${escapeHtml(sheet.name)} (${countText})
        </button>`
    })
    .join("");
}

function companySubtitle(record) {
  const brand = record.fields.find((field) => field.label.includes("品牌") && field.text);
  const direction = record.fields.find((field) => field.label.includes("方向") && field.text);
  return [brand?.text, direction?.text].filter(Boolean).join(" / ");
}

function renderCompare(sheet, records) {
  if (!records.length) {
    return `<div class="empty">当前搜索没有匹配结果。</div>`;
  }
  const labels = sheet.headers.filter((label) => label !== "序号");
  const head = records
    .map(
      (record) => `<th scope="col">
        <div class="company-head">
          <span class="company-name">${escapeHtml(chooseTitle(record))}</span>
          ${companySubtitle(record) ? `<span class="company-meta">${escapeHtml(companySubtitle(record))}</span>` : ""}
        </div>
      </th>`
    )
    .join("");
  const rows = labels
    .map((label) => {
      const cells = records
        .map((record) => {
          const field = record.fields.find((item) => item.label === label) || { text: "", red: false, runs: [] };
          const hasRed = field.red || (field.runs || []).some((run) => run.red);
          return `<td class="${hasRed ? "has-red" : ""}"><div class="value">${field.text ? renderRuns(field) : ""}</div></td>`;
        })
        .join("");
      return `<tr><th class="field-head" scope="row">${escapeHtml(label)}</th>${cells}</tr>`;
    })
    .join("");
  return `<div class="compare-wrap">
    <table class="compare-table">
      <thead><tr><th class="field-head" scope="col">字段</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderCards(records) {
  if (!records.length) {
    return `<div class="empty">当前搜索没有匹配结果。</div>`;
  }
  return `<div class="grid">${records
    .map((record) => {
      const hasRed = record.fields.some((field) => field.red || (field.runs || []).some((run) => run.red));
      const fields = visibleFields(record)
        .map(
          (field) => `<div class="field">
            <span class="label">${escapeHtml(field.label)}</span>
            <div class="value">${renderRuns(field)}</div>
          </div>`
        )
        .join("");
      return `<article class="card ${hasRed ? "has-red" : ""}">
        ${hasRed ? `<span class="badge">重点标注</span>` : ""}
        <h3 class="card-title">${escapeHtml(chooseTitle(record))}</h3>
        ${fields}
      </article>`;
    })
    .join("")}</div>`;
}

function renderContent() {
  if (activeIndex === -1 || searchScope === "global") {
    renderGlobalContent();
    return;
  }
  const sheet = data[activeIndex];
  if (!sheet) {
    contentEl.innerHTML = `<div class="empty">没有可展示的数据。</div>`;
    return;
  }
  const records = sheet.records.filter(recordMatches);
  contentEl.innerHTML = `<section class="section">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(sheet.name)}</h2>
        <p>${records.length} / ${sheet.records.length} 条信息</p>
      </div>
      <p>${sheet.redCount} 处重点标注</p>
    </div>
    ${viewMode === "compare" ? renderCompare(sheet, records) : renderCards(records)}
  </section>`;
}

function renderGlobalContent() {
  const groups = data
    .map((sheet) => ({ sheet, records: sheet.records.filter(recordMatches) }))
    .filter((group) => group.records.length);
  const totalMatched = groups.reduce((sum, group) => sum + group.records.length, 0);
  if (!groups.length) {
    contentEl.innerHTML = `<div class="empty">全局搜索没有匹配结果。</div>`;
    return;
  }
  contentEl.innerHTML = groups
    .map(
      ({ sheet, records }) => `<section class="section global-section">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(sheet.name)}</h2>
            <p>全局结果：${records.length} / ${sheet.records.length} 条信息</p>
          </div>
          <p>${totalMatched} 条匹配</p>
        </div>
        ${viewMode === "compare" ? renderCompare(sheet, records) : renderCards(records)}
      </section>`
    )
    .join("");
}

function renderViewButtons() {
  compareViewButton.classList.toggle("active", viewMode === "compare");
  cardViewButton.classList.toggle("active", viewMode === "cards");
}

function renderSearchScopeButtons() {
  globalSearchButton.classList.toggle("active", searchScope === "global");
  categorySearchButton.classList.toggle("active", searchScope === "category");
}

tabsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  activeIndex = Number(button.dataset.index);
  searchScope = activeIndex === -1 ? "global" : "category";
  renderTabs();
  renderSearchScopeButtons();
  renderContent();
});

searchInput.addEventListener("input", (event) => {
  query = event.target.value.trim().toLowerCase();
  renderTabs();
  renderContent();
});

compareViewButton.addEventListener("click", () => {
  viewMode = "compare";
  renderViewButtons();
  renderContent();
});

cardViewButton.addEventListener("click", () => {
  viewMode = "cards";
  renderViewButtons();
  renderContent();
});

globalSearchButton.addEventListener("click", () => {
  searchScope = "global";
  activeIndex = -1;
  renderTabs();
  renderSearchScopeButtons();
  renderContent();
});

categorySearchButton.addEventListener("click", () => {
  searchScope = "category";
  if (activeIndex === -1) activeIndex = 0;
  renderTabs();
  renderSearchScopeButtons();
  renderContent();
});

renderTabs();
renderViewButtons();
renderSearchScopeButtons();
renderContent();
