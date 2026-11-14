// Kalodata Product Filter — lọc các dòng sản phẩm đang hiển thị trong bảng.
(() => {
  if (window.__kfLoaded) return; // tránh chèn 2 lần
  window.__kfLoaded = true;
  const STORE = 'kf-filters';

  // "1.2K" -> 1200, "₫5.128,61tỉ" -> 5128610000000, "₫132,6tr" -> 132600000, "12,5%" -> 12.5
  const UNITS = { k: 1e3, n: 1e3, 'nghìn': 1e3, m: 1e6, tr: 1e6, 'triệu': 1e6, b: 1e9, 'tỉ': 1e9, 'tỷ': 1e9 };
  function parseNum(text) {
    if (!text) return NaN;
    const m = String(text).replace(/\s/g, '').toLowerCase().match(/(-?\d[\d.,]*)(nghìn|triệu|tr|tỉ|tỷ|[knmb])?/);
    if (!m) return NaN;
    let num = m[1];
    const lastDot = num.lastIndexOf('.'), lastComma = num.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      // cả hai dấu: dấu xuất hiện sau cùng là dấu thập phân
      num = lastComma > lastDot ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, '');
    } else if (lastComma >= 0) {
      // chỉ có dấu phẩy: "1,234" (nghìn) hay "132,6" (thập phân)
      num = /^-?\d{1,3}(,\d{3})+$/.test(num) && !m[2] ? num.replace(/,/g, '') : num.replace(/,/g, (c, i) => i === lastComma ? '.' : '');
    } else if ((num.match(/\./g) || []).length > 1 || (/^-?\d{1,3}\.\d{3}$/.test(num) && !m[2])) {
      num = num.replace(/\./g, ''); // "1.234.567" hoặc "5.128"
    }
    return parseFloat(num) * (UNITS[m[2]] || 1);
  }

  // Tìm bảng: hỗ trợ <table> và bảng dạng Ant Design
  function getTable() {
    const tables = [...document.querySelectorAll('table')]
      .filter(t => t.querySelector('tbody tr'))
      .sort((a, b) => b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length);
    if (!tables.length) return null;
    const body = tables[0];
    // Ant Design tách header & body thành 2 table
    const wrap = body.closest('.ant-table') || body.parentElement;
    const headCells = [...(wrap.querySelector('thead') || body).querySelectorAll('thead th')];
    const headers = headCells.map(th => th.innerText.trim().split('\n')[0]);
    const rows = [...body.querySelectorAll('tbody tr')].filter(r => !r.classList.contains('ant-table-measure-row') && !r.classList.contains('kf-clone'));
    return { headers, rows };
  }

  function rowData(row) {
    return [...row.children].map(td => td.innerText.trim());
  }

  // Cột số = cột mà đa số giá trị parse được
  function numericCols(table) {
    const sample = table.rows.slice(0, 10).map(rowData);
    return table.headers
      .map((h, i) => ({ h: h || `Cột ${i + 1}`, i }))
      .filter(({ i }) => {
        const ok = sample.filter(r => !isNaN(parseNum(r[i])) && !/[a-zà-ỹ]{4,}/i.test(r[i] || '')).length;
        return sample.length && ok / sample.length >= 0.7;
      });
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
  const save = f => { try { localStorage.setItem(STORE, JSON.stringify(f)); } catch {} };
  // chuyển ô "Luôn loại trừ" cũ vào ô Loại trừ chính
  try {
    const old = localStorage.getItem('kf-always');
    if (old) { const f = load(); f.exc = [f.exc, old].filter(Boolean).join(', '); save(f); localStorage.removeItem('kf-always'); }
  } catch {}

  // ---- UI ----
  const toggle = document.createElement('button');
  toggle.id = 'kf-toggle';
  toggle.textContent = '🔍 Lọc sản phẩm';
  const panel = document.createElement('div');
  panel.id = 'kf-panel';
  document.body.append(toggle, panel);
  toggle.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) render(); };
  chrome.runtime.onMessage.addListener(msg => { if (msg?.type === 'kf-toggle') toggle.onclick(); });

  function render() {
    const table = getTable();
    if (!table) {
      panel.innerHTML = `      <h3>⚡ Ra lệnh <small style="color:#999;font-weight:400">v${chrome.runtime.getManifest().version}</small></h3>
      <textarea id="kf-cmd" placeholder="VD: xem danh sách ngành hàng 7 ngày, doanh thu bình quân cửa hàng và doanh thu, trừ thời trang, đồ ăn, thực phẩm chức năng, điện tử chỉ lấy phụ kiện trừ ốp điện thoại">${localStorage.getItem('kf-last-cmd') || ''}</textarea>
      <button class="primary" id="kf-run">Thực hiện</button>
      <button id="kf-cmd-clear">Xoá</button>
      <div class="stat" id="kf-cmd-status"></div>
      <ol id="kf-results"></ol>
      <hr>
<p>Không tìm thấy bảng trên trang này. Bạn vẫn có thể ra lệnh ở trên.</p>`;
      bindCmd();
      return;
    }
    const f = load();
    const cols = numericCols(table);
    panel.innerHTML = `
      <h3>⚡ Ra lệnh <small style="color:#999;font-weight:400">v${chrome.runtime.getManifest().version}</small></h3>
      <textarea id="kf-cmd" placeholder="VD: xem danh sách ngành hàng 7 ngày, doanh thu bình quân cửa hàng và doanh thu, trừ thời trang, đồ ăn, thực phẩm chức năng, điện tử chỉ lấy phụ kiện trừ ốp điện thoại">${localStorage.getItem('kf-last-cmd') || ''}</textarea>
      <button class="primary" id="kf-run">Thực hiện</button>
      <button id="kf-cmd-clear">Xoá</button>
      <div class="stat" id="kf-cmd-status"></div>
      <ol id="kf-results"></ol>
      <hr>
      <h3>Lọc sản phẩm</h3>
      <div class="row"><input class="kw" id="kf-inc" placeholder="Từ khoá phải có (cách nhau dấu phẩy)" value="${f.inc || ''}"></div>
      <div class="row"><input class="kw" id="kf-exc" placeholder="Luôn loại trừ (áp dụng cho mọi lệnh), vd: giấy, hộp" value="${f.exc || ''}"></div>
      <div class="kf-price">
        <div class="kf-price-title">💰 Giới hạn giá bán</div>
        <div class="kf-price-row">
          <label>Giá Min<input id="kf-pmin" placeholder="vd: 50k" value="${f.priceMin || ''}"></label>
          <span>—</span>
          <label>Giá Max<input id="kf-pmax" placeholder="vd: 200k" value="${f.priceMax || ''}"></label>
        </div>
      </div>
      ${cols.map(c => `
        <div class="row" title="${c.h}">
          <label>${c.h}</label>
          <input data-col="${c.h}" data-k="min" placeholder="Min" value="${f[c.h]?.min ?? ''}">
          <input data-col="${c.h}" data-k="max" placeholder="Max" value="${f[c.h]?.max ?? ''}">
        </div>`).join('')}
      <button class="primary" id="kf-apply">Áp dụng</button>
      <button id="kf-reset">Xoá lọc</button>
      <button id="kf-csv">Xuất CSV</button>
      <div class="stat" id="kf-stat"></div>
      <div class="stat">Min/Max hỗ trợ 1.5K, 2M, 10%...</div>
      <hr>
      <h3>🤖 Hỏi AI (Claude)</h3>
      <div class="chips">
        <button data-q="Chọn 5 sản phẩm tiềm năng nhất để bán và giải thích lý do.">Top 5 tiềm năng</button>
        <button data-q="Tóm tắt xu hướng chung (ngành hàng, khoảng giá, doanh thu) của các sản phẩm này.">Tóm tắt xu hướng</button>
        <button data-q="Sản phẩm nào có dấu hiệu bất thường hoặc rủi ro (giá, tỉ lệ, doanh thu)?">Tìm bất thường</button>
      </div>
      <textarea id="kf-ai-q" placeholder="Hỏi về các sản phẩm đang hiển thị..."></textarea>
      <button class="primary" id="kf-ai-ask">Hỏi AI</button>
      <div id="kf-ai-out"></div>`;
    panel.querySelectorAll('.chips button').forEach(b => b.onclick = () => { panel.querySelector('#kf-ai-q').value = b.dataset.q; askAI(); });
    panel.querySelector('#kf-ai-ask').onclick = askAI;
    panel.querySelector('#kf-apply').onclick = async () => {
      const f = readForm();
      save(f);
      collected = await collectPages(f);
      const by = showResults(lastSort, [], collected);
      setStatus([`✓ Gom được ${collected.items.length} sản phẩm khớp điều kiện`, ...(by ? [`↓ Xếp theo: ${by}`] : []), ...dropSummary(collected.dropped)].join('\n'));
    };
    panel.querySelector('#kf-reset').onclick = () => { lastItems = null; clearInjected(); collected = null; save({}); render(); apply(); };
    panel.querySelector('#kf-csv').onclick = exportCSV;
    bindCmd();
    apply();
  }

  // ---- Ra lệnh bằng tiếng Việt ----
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const PENDING = 'kf-pending-cmd';
  const setStatus = t => { const el = panel.querySelector('#kf-cmd-status'); if (el) el.textContent = t; };

  function bindCmd() {
    panel.querySelector('#kf-cmd-clear').onclick = () => {
      const box = panel.querySelector('#kf-cmd');
      box.value = '';
      try { localStorage.removeItem('kf-last-cmd'); } catch {}
      setStatus('');
      box.focus();
    };
    panel.querySelector('#kf-run').onclick = () => {
      const cmd = panel.querySelector('#kf-cmd').value.trim();
      if (cmd) runCommand(cmd);
    };
  }

  // Phần tử hiển thị, không nằm trong panel của extension
  const visibleLeaves = re => [...document.querySelectorAll('body *')].filter(el =>
    !el.closest('#kf-panel, #kf-toggle') && el.offsetParent !== null &&
    el.childElementCount === 0 && re.test(el.textContent.trim()));

  // Thử chọn khoảng thời gian trên giao diện Kalodata (dựa vào chữ hiển thị, có thể cần chỉnh nếu Kalodata đổi giao diện)
  async function setTimeRange(days) {
    const want = new RegExp(`(^|\\D)${days}\\s*ngày`, 'i');
    const current = visibleLeaves(/\d+\s*ngày/i);
    if (current.some(el => want.test(el.textContent))) return true; // đã đúng
    if (!current.length) return false;
    (current.find(el => el.textContent.includes('~')) || current[0]).click(); // ưu tiên ô "30 ngày trước (14/10 ~ 12/11)" ở cột trái
    await sleep(800);
    const opts = visibleLeaves(want);
    if (!opts.length) { document.body.click(); return false; }
    opts[opts.length - 1].click();
    await sleep(500);
    const submit = [...document.querySelectorAll('button')].find(b =>
      !b.closest('#kf-panel') && b.offsetParent !== null && !b.disabled && /^(Nộp|Xác nhận|OK|Áp dụng)$/i.test(b.innerText.trim()));
    submit?.click();
    await sleep(3000); // chờ bảng tải lại
    return true;
  }

  async function runCommand(cmd) {
    try { localStorage.setItem('kf-last-cmd', cmd); } catch {}
    const btn = panel.querySelector('#kf-run');
    if (btn) btn.disabled = true;
    try {
      setStatus('🤖 Claude đang hiểu lệnh...');
      const table = getTable();
      const columns = table ? numericCols(table).map(c => c.h) : [];
      const res = await chrome.runtime.sendMessage({ type: 'kf-plan', command: cmd, columns, url: location.href });
      if (!res?.ok) throw new Error(res?.error || 'Lỗi không xác định');
      const plan = res.plan;

      // Bước 1: chuyển sang trang Danh sách ngành hàng nếu cần (tiếp tục sau khi trang tải xong)
      if (plan.page === 'category' && !location.pathname.startsWith('/category')) {
        sessionStorage.setItem(PENDING, cmd);
        setStatus('↪️ Đang mở Danh sách ngành hàng...');
        location.href = '/category';
        return;
      }
      await executePlan(plan);
    } catch (e) {
      setStatus(`⚠️ ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Bấm tab theo chữ hiển thị, vd "BXH sản phẩm"
  async function clickTab(name) {
    const el = visibleLeaves(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))[0];
    if (!el) return false;
    el.click();
    await sleep(3000); // chờ bảng tải
    return true;
  }

  async function executePlan(plan) {
    const notes = [];
    if (plan.tab) {
      setStatus(`📑 Đang mở tab ${plan.tab}...`);
      notes.push(await clickTab(plan.tab) ? `✓ Tab: ${plan.tab}` : `⚠️ Không thấy tab "${plan.tab}"`);
    }
    // Bước 2: chọn khoảng thời gian
    if (plan.days > 0) {
      setStatus(`📅 Đang chọn ${plan.days} ngày...`);
      notes.push(await setTimeRange(plan.days) ? `✓ Thời gian: ${plan.days} ngày` : `⚠️ Không tự chọn được ${plan.days} ngày — hãy chọn tay ở cột trái rồi bấm Thực hiện lại`);
    }
    // Bước 3: áp bộ lọc
    const manual = load().exc || '';
    const prev = load();
    const f = { inc: plan.include, exc: manual, cmdExc: plan.exclude,
      priceMin: plan.priceMin || prev.priceMin || '', priceMax: plan.priceMax || prev.priceMax || '' };
    for (const r of plan.rules) {
      if (!r.min && !r.max) continue;
      f[r.column] = {};
      if (r.min) f[r.column].min = r.min;
      if (r.max) f[r.column].max = r.max;
    }
    save(f);
    render();
    notes.push(`✓ Loại trừ: ${[manual, plan.exclude].filter(Boolean).join(', ') || '(không)'}`);
    if (plan.include) notes.push(`✓ Phải có: ${plan.include}`);
    if (f.priceMin || f.priceMax) notes.push(`✓ Giá: ${f.priceMin || '…'} → ${f.priceMax || '…'}`);
    plan.rules.filter(r => r.min || r.max).forEach(r => notes.push(`✓ ${r.column}: ${r.min || '…'} → ${r.max || '…'}`));
    lastSort = plan.sortColumn;
    collected = await collectPages(f);
    const sortedBy = showResults(plan.sortColumn, plan.rules.map(r => r.column), collected);
    notes.push(`✓ Gom được ${collected.items.length} sản phẩm khớp điều kiện`);
    notes.push(...dropSummary(collected.dropped));
    if (sortedBy) notes.push(`↓ Xếp theo: ${sortedBy}`);
    setStatus(notes.join('\n'));
    // Bước 4: phân tích
    if (plan.question) {
      panel.querySelector('#kf-ai-q').value = plan.question;
      await askAI();
    }
  }

  // Danh sách kết quả (các dòng còn lại sau lọc), xếp theo cột chọn
  // ---- Gom kết quả qua nhiều trang ----
  let collected = null;
  let lastSort = ''; // cột xếp hạng của lệnh gần nhất // { headers, items } của lệnh gần nhất → dùng cho Hỏi AI
  const MAX_PAGES = 10;
  let pageWarn = '';

  // Về trang 1: ô "1" ngay dưới bảng
  function gotoPage1() {
    const table = getTable();
    const lastRow = table?.rows[table.rows.length - 1];
    const below = lastRow ? lastRow.getBoundingClientRect().bottom - 5 : 0;
    const el = visibleLeaves(/^1$/).find(e => !e.closest('table, #kf-board') && e.getBoundingClientRect().top >= below);
    if (!el) return false;
    (el.closest('li, button, a, [role="button"]') || el).click();
    return true;
  }

  // Sang trang n: tìm số trang trong thanh phân trang, nếu không có thì bấm nút "trang sau"
  function gotoPage(n) {
    const bars = [...document.querySelectorAll('[class*="pagination" i], [class*="pager" i], [class*="page-nav" i]')]
      .filter(el => !el.closest('#kf-panel, #kf-board') && el.offsetParent !== null);
    for (const bar of bars) {
      const num = [...bar.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === String(n));
      if (num) { (num.closest('li, button, a') || num).click(); return true; }
    }
    // Kalodata: thanh "‹ 1 2 3 … 14484 ›" ngay dưới bảng → tìm ô có đúng chữ số n nằm dưới bảng
    const table = getTable();
    const lastRow = table?.rows[table.rows.length - 1];
    const below = lastRow ? lastRow.getBoundingClientRect().bottom - 5 : 0;
    const prevNum = String(n - 1);
    const cands = visibleLeaves(new RegExp(`^${n}$`)).filter(el => {
      if (el.closest('table, #kf-board')) return false;
      if (el.getBoundingClientRect().top < below) return false;
      // cùng thanh phải có số trang trước đó (n-1)
      let box = el;
      for (let k = 0; k < 4 && box; k++) {
        box = box.parentElement;
        if (box && [...box.querySelectorAll('*')].some(x => x.childElementCount === 0 && x.textContent.trim() === prevNum)) return true;
      }
      return false;
    });
    if (cands.length) {
      const el = cands[0];
      (el.closest('li, button, a, [role="button"]') || el).click();
      return true;
    }
    const next = nextPageButton();
    if (next) { next.click(); return true; }
    return false;
  }

  function nextPageButton() {
    const cands = [...document.querySelectorAll('.ant-pagination-next, li[title="Next Page"], li[title="Trang sau"], li[title="Trang kế"], button[aria-label*="next" i], [class*="pagination"] [class*="next"]')]
      .filter(el => !el.closest('#kf-panel') && el.offsetParent !== null);
    const el = cands.find(e => !/disabled/i.test(e.className) && e.getAttribute('aria-disabled') !== 'true' && !e.disabled && !e.querySelector('button:disabled'));
    return el ? (el.querySelector('button') || el) : null;
  }

  const firstRowText = () => { const t = getTable(); return t?.rows[0] ? rowData(t.rows[0]).join('|') : ''; };

  async function collectPages(f) {
    busy = true;
    lastItems = null;
    clearInjected(); // dòng đang ẩn sẽ không đọc được chữ
    try { return await collectPagesInner(f); } finally { busy = false; }
  }
  async function collectPagesInner(f) {
    const items = new Map();
    const dropped = {}; // lý do loại → tên sản phẩm
    pageWarn = '';
    let pagesRead = 0;
    let headers = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const table = getTable();
      if (!table) break;
      headers = table.headers;
      const why = makeMatcher(f, headers);
      let kept = 0;
      table.rows.forEach(row => {
        const d = rowData(row);
        const reason = why(d);
        const name = rowName(d);
        if (reason) { (dropped[reason] ||= []).push(name); return; }
        if (name && !items.has(name)) { items.set(name, { name, d, img: row.querySelector('img')?.src || '', node: row.cloneNode(true), page, key: row.getAttribute('data-row-key') || '', row }); kept++; }
      });
      // ghi link chi tiết của các dòng vừa giữ (trước khi sang trang khác)
      for (const it of items.values()) if (it.row) { it.link = await captureLink(it.row, it.name); delete it.row; }
      pagesRead = page;
      setStatus(`📄 Trang ${page}: giữ ${kept} — tổng ${items.size}`);
      if (page === MAX_PAGES) break;
      const before = firstRowText(), countBefore = table.rows.length;
      table.rows[table.rows.length - 1]?.scrollIntoView({ block: 'center' });
      await sleep(300);
      if (gotoPage(page + 1)) {
        for (let t = 0; t < 20 && firstRowText() === before; t++) await sleep(400); // chờ trang mới
        await sleep(600);
        if (firstRowText() === before) break;
      } else {
        // không có nút trang sau → thử cuộn xuống để Kalodata tải thêm
        window.scrollTo(0, document.body.scrollHeight);
        table.rows[table.rows.length - 1]?.scrollIntoView({ block: 'end' });
        for (let t = 0; t < 10 && (getTable()?.rows.length || 0) <= countBefore; t++) await sleep(400);
        if ((getTable()?.rows.length || 0) <= countBefore) { pageWarn = `⚠️ Không tìm thấy nút sang trang ${page + 1} — chỉ đọc được ${page} trang`; break; }
      }
    }
    // quay lại trang 1
    if (pagesRead > 1) {
      const t = getTable(); t?.rows[t.rows.length - 1]?.scrollIntoView({ block: 'center' });
      await sleep(300);
      const before = firstRowText();
      if (gotoPage1()) for (let t2 = 0; t2 < 20 && firstRowText() === before; t2++) await sleep(400);
      await sleep(600);
    }
    window.scrollTo(0, 0);
    apply();
    return { headers, items: [...items.values()], dropped, pages: pagesRead };
  }

  // Bảng kết quả lớn phủ lên bảng Kalodata: sản phẩm từ mọi trang, đã lọc và xếp hạng
  const board = document.createElement('div');
  board.id = 'kf-board';
  document.body.append(board);
  function showBoard(items, hs, show, si) {
    const esc = t => (t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    board.innerHTML = `
      <div class="kf-board-head">
        <b>Kết quả: ${items.length} sản phẩm${si >= 0 ? ` · xếp theo ${esc(hs[si])}` : ''}</b>
        <span><button id="kf-board-csv">Xuất CSV</button><button id="kf-board-close">✕ Đóng</button></span>
      </div>
      <div class="kf-board-body"><table>
        <thead><tr><th>#</th><th></th><th>Sản phẩm</th>${show.map(i => `<th>${esc(hs[i])}</th>`).join('')}</tr></thead>
        <tbody>${items.map((it, k) => `<tr><td>${k + 1}</td><td>${it.img ? `<img src="${esc(it.img)}">` : ''}</td><td>${esc(it.name)}</td>${show.map(i => `<td>${esc(it.d[i])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    board.classList.toggle('open', items.length > 0);
    board.querySelector('#kf-board-close').onclick = () => board.classList.remove('open');
    board.querySelector('#kf-board-csv').onclick = () => {
      const q = v => `"${(v || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`;
      const lines = [hs.map(q).join(','), ...items.map(it => it.d.map(q).join(','))];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
      a.download = `kalodata-ketqua-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    };
  }

  // ---- Đưa kết quả vào thẳng bảng Kalodata: ẩn dòng bị loại, chèn dòng hợp lệ (từ mọi trang) lên đầu ----
  let injected = []; // các dòng đã chèn
  let lastItems = null; // danh sách đã lọc đang được giữ trên bảng
  let listUrl = '';     // trang của danh sách đó
  let busy = false;     // extension đang tự lật trang → tạm không dựng lại danh sách
  function injectRows(items) {
    clearInjected();
    const table = getTable();
    if (!table || !table.rows.length || !items.length) return;
    const tbody = table.rows[0].parentElement;
    table.rows.forEach(r => r.classList.add('kf-hidden'));
    injected = items.map((it, k) => {
      const tr = it.node.cloneNode(true);
      tr.classList.add('kf-clone');
      tr.classList.remove('kf-hidden');
      const rank = tr.querySelector('td'); // cột số thứ tự
      if (rank && /^\d+$/.test(rank.innerText.trim())) rank.innerText = k + 1;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openItem(items[k]); }, true);
      return tr;
    });
    tbody.prepend(...injected);
  }
  // Bấm thử tên/ảnh của dòng gốc ở chế độ "ghi link" (main.js chặn mở tab) → lấy link Kalodata định mở
  const titleEl = (row, name) => [...row.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim().length > 5 && name.startsWith(el.textContent.trim().slice(0, 15)));
  async function captureLink(row, name) {
    const a = row.querySelector('a[href]');
    if (a) return a.href;
    const root = document.documentElement;
    const before = location.href;
    root.dataset.kfCapture = '1';
    delete root.dataset.kfUrl;
    try {
      for (const el of [titleEl(row, name), row.querySelector('img')].filter(Boolean)) {
        el.click();
        for (let t = 0; t < 4 && !root.dataset.kfUrl; t++) await sleep(25);
        if (root.dataset.kfUrl) break;
      }
    } finally {
      root.dataset.kfCapture = '0';
    }
    const url = root.dataset.kfUrl || '';
    return url && url !== before ? url : '';
  }
  const openTab = url => chrome.runtime.sendMessage({ type: 'kf-open', url });

  // Mở trang chi tiết sản phẩm của dòng đã chèn
  async function openItem(it) {
    if (it.link) return openTab(it.link);
    // mở thẳng trang chi tiết bằng mã: ngành hàng (6 số, vd 600001) hoặc sản phẩm (dãy số dài)
    const isCategory = location.pathname.startsWith('/category');
    const html = it.node?.outerHTML || '';
    const id = isCategory
      ? (/^\d{4,}$/.test(it.key) ? it.key : (html.match(/\b(6\d{5})\b/) || [])[1])
      : (/^\d{8,}$/.test(it.key) ? it.key : (html.match(/\b(\d{15,20})\b/) || [])[1]);
    if (id) {
      // giữ nguyên ngôn ngữ/tiền tệ/khu vực/thời gian của trang hiện tại
      const cur = new URLSearchParams(location.search);
      const q = new URLSearchParams({ id });
      for (const k of ['language', 'currency', 'region', 'dateRange']) if (cur.get(k)) q.set(k, cur.get(k));
      return openTab(new URL(`/${isCategory ? 'category' : 'product'}/detail?${q}`, location.origin).href);
    }
    // dự phòng: quay về trang gốc chứa sản phẩm rồi bấm vào dòng thật
    setStatus(`↪️ Đang tìm "${it.name.slice(0, 40)}…" ở trang ${it.page}`);
    busy = true;
    try {
    clearInjected();
    const findRow = () => getTable()?.rows.find(r => rowName(rowData(r)) === it.name);
    // chờ bảng đổi sang trang khác (tối đa ~8 giây)
    const waitChange = async before => { for (let w = 0; w < 20 && firstRowText() === before; w++) await sleep(400); await sleep(300); };
    const step = async n => {
      const t = getTable(); t?.rows[t.rows.length - 1]?.scrollIntoView({ block: 'center' });
      await sleep(300);
      const before = firstRowText();
      if (!(n === 1 ? gotoPage1() : gotoPage(n))) return false;
      await waitChange(before);
      return true;
    };
    let row = findRow();
    if (!row) {
      // luôn bắt đầu lại từ trang 1 (bảng có thể đang ở trang khác sau lần bấm trước)
      await step(1);
      for (let p = 2; p <= it.page && !(row = findRow()); p++) {
        if (!(await step(p))) break;
      }
      row = findRow();
      // thứ hạng có thể xê dịch → thử thêm trang kế tiếp
      if (!row && await step(it.page + 1)) row = findRow();
    }
    if (!row) return setStatus('⚠️ Không tìm thấy sản phẩm, hãy bấm Áp dụng lại');
    setStatus(`✓ Đã mở "${it.name.slice(0, 40)}…"`);
    row.scrollIntoView({ block: 'center' });
    const title = [...row.querySelectorAll('*')].find(el => el.childElementCount === 0 && it.name.startsWith(el.textContent.trim().slice(0, 15)) && el.textContent.trim().length > 5);
    (title || row.querySelector('img') || row).click();
    // Kalodata mở chi tiết ở tab mới → đưa bảng về trang 1 và dựng lại danh sách đã lọc
    await sleep(1500);
    if (location.href === listUrl && lastItems) {
      await step(1);
      injectRows(lastItems);
    }
    } finally { busy = false; }
  }

  function clearInjected() {
    injected.forEach(tr => tr.remove());
    injected = [];
    document.querySelectorAll('tr.kf-hidden').forEach(r => r.classList.remove('kf-hidden'));
  }

  // Tóm tắt lý do bị loại, vd: ✗ "hộp": 4 (vd: Hộp đựng cơm...)
  function dropSummary(dropped) {
    return [`📄 Đã đọc ${collected?.pages || 0} trang`, ...(pageWarn ? [pageWarn] : [])].concat( Object.entries(dropped).sort((a, b) => b[1].length - a[1].length).slice(0, 6)
      .map(([r, names]) => `✗ Loại vì ${r}: ${names.length} (vd: ${(names[0] || '').slice(0, 50)}…)`));
  }

  function showResults(sortCol, extraCols, result) {
    const box = panel.querySelector('#kf-results');
    if (!box) return;
    const { headers, items } = result;
    const hs = headers.map((h, i) => h || `Cột ${i + 1}`);
    const isNum = i => items.filter(it => !isNaN(parseNum(it.d[i])) && !/[a-zà-ỹ]{4,}/i.test(it.d[i] || '')).length >= items.length * 0.7;
    const key = (sortCol || '').toLowerCase();
    let si = hs.findIndex(h => h === sortCol);
    if (si < 0 && key) si = hs.findIndex((h, i) => isNum(i) && (h.toLowerCase().includes(key) || key.includes(h.toLowerCase())));
    if (si < 0 && /tăng trưởng/.test(key)) si = hs.findIndex((h, i) => isNum(i) && /tăng trưởng/i.test(h));
    if (si < 0) si = hs.findIndex((h, i) => isNum(i) && /doanh thu/i.test(h));
    const show = [...new Set([si >= 0 ? hs[si] : '', ...extraCols, ...hs.filter(h => /doanh thu/i.test(h))])]
      .map(h => hs.indexOf(h)).filter(i => i >= 0 && isNum(i)).slice(0, 3);
    if (si >= 0) items.sort((a, b) => (parseNum(b.d[si]) || -Infinity) - (parseNum(a.d[si]) || -Infinity));
    const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    box.innerHTML = items.length ? items.map(it => `
      <li><b class="kf-name" title="${esc(it.name)}">${esc(it.name)}</b><small>${[...(isNaN(rowPrice(it.d)) ? [] : [`Giá: ${rowPrice(it.d).toLocaleString('vi-VN')}₫`]), ...show.map(i => `${esc(hs[i])}: ${esc(it.d[i] || '')}`)].join(' · ')}</small></li>`).join('')
      : '<li>Không có sản phẩm nào khớp điều kiện.</li>';
    // bấm tên trong danh sách → mở trang chi tiết như bấm trong bảng
    [...box.children].forEach((li, k) => { if (items[k]) li.onclick = () => openItem(items[k]); });
    lastItems = items;
    listUrl = location.href;
    injectRows(items);
    return si >= 0 ? hs[si] : '';
  }

  // Tiếp tục lệnh sau khi đã chuyển trang
  (async () => {
    const cmd = sessionStorage.getItem(PENDING);
    if (!cmd) return;
    sessionStorage.removeItem(PENDING);
    for (let i = 0; i < 20 && !getTable(); i++) await sleep(500); // chờ bảng xuất hiện
    panel.classList.add('open');
    render();
    runCommand(cmd);
  })();

  function readForm() {
    const f = { inc: panel.querySelector('#kf-inc').value, exc: panel.querySelector('#kf-exc').value, cmdExc: load().cmdExc || '',
      priceMin: panel.querySelector('#kf-pmin').value.trim(), priceMax: panel.querySelector('#kf-pmax').value.trim() };
    panel.querySelectorAll('input[data-col]').forEach(inp => {
      if (inp.value.trim() === '') return;
      (f[inp.dataset.col] ||= {})[inp.dataset.k] = inp.value.trim();
    });
    return f;
  }

  const words = s => (s || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

  // Tên của dòng = 2 dòng chữ đầu của ô có nhiều chữ nhất
  const rowName = d => d.reduce((a, t) => (t.length > a.length ? t : a), '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 2).join(' ');

  // Giá bán = giá đầu tiên dạng "₫134,94k" trong ô thông tin sản phẩm (khoảng giá "₫92k - ₫194k" → lấy giá thấp)
  const rowPrice = d => {
    const cell = d.reduce((a, t) => (t.length > a.length ? t : a), '');
    const m = cell.match(/[₫đ]\s*\d[\d.,]*\s*(?:nghìn|triệu|tr|tỉ|tỷ|k|m)?/i);
    return m ? parseNum(m[0]) : NaN;
  };

  // Hàm kiểm tra 1 dòng có qua bộ lọc không (dùng cho cả lọc tại chỗ và gom nhiều trang)
  function makeMatcher(f, headers) {
    const inc = words(f.inc);
    // "điện tử (trừ phụ kiện/sạc)" → loại "điện tử" nhưng giữ dòng có "phụ kiện" hoặc "sạc"
    const exc = words(`${f.exc || ''},${f.cmdExc || ''}`).map(w => {
      const m = w.match(/^(.*?)\s*\(\s*trừ\s+(.*)\)$/);
      return m ? { w: m[1].trim(), keep: m[2].split('/').map(x => x.trim()).filter(Boolean) } : { w, keep: [] };
    });
    return data => {
      const text = data.join(' ').toLowerCase();
      if (!text.trim()) return 'dòng trống';
      const name = rowName(data).toLowerCase(); // từ khoá chỉ so với tên sản phẩm/ngành hàng
      const miss = inc.find(w => !name.includes(w));
      if (miss) return `thiếu "${miss}"`;
      const hit = exc.find(e => name.includes(e.w) && !e.keep.some(k => name.includes(k)));
      if (hit) return `"${hit.w}"`;
      if (f.priceMin || f.priceMax) {
        const p = rowPrice(data);
        if (!isNaN(p)) { // trang không có giá (vd danh sách ngành hàng) thì bỏ qua
          if (f.priceMin && p < parseNum(f.priceMin)) return `giá < ${f.priceMin}`;
          if (f.priceMax && p > parseNum(f.priceMax)) return `giá > ${f.priceMax}`;
        }
      }
      for (let i = 0; i < headers.length; i++) {
        const rule = f[headers[i] || `Cột ${i + 1}`];
        if (!rule) continue;
        const v = parseNum(data[i]);
        if (rule.min !== undefined && !(v >= parseNum(rule.min))) return `${headers[i]} < ${rule.min}`;
        if (rule.max !== undefined && !(v <= parseNum(rule.max))) return `${headers[i]} > ${rule.max}`;
      }
      return '';
    };
  }

  function apply() {
    const table = getTable();
    if (!table) return;
    const why = makeMatcher(load(), table.headers);
    if (injected.length && injected[0].isConnected) table.rows.forEach(r => r.classList.add('kf-hidden')); // đang xem kết quả đã gom
    else if (!busy && lastItems && location.href === listUrl) { injectRows(lastItems); return; } // Kalodata vẽ lại bảng → dựng lại danh sách đã lọc
    else if (injected.length) clearInjected();
    const shown = table.rows.filter(r => !why(rowData(r))).length;
    const stat = panel.querySelector('#kf-stat');
    if (stat) stat.textContent = `Trang này: ${shown}/${table.rows.length} dòng khớp điều kiện`;
  }

  // CSV của các dòng đang hiển thị (sau lọc)
  function visibleCSV(limit = Infinity) {
    const table = getTable();
    if (!table) return null;
    const esc = s => `"${(s || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`;
    const lines = [table.headers.map(esc).join(',')];
    table.rows.filter(r => !r.classList.contains('kf-hidden')).slice(0, limit)
      .forEach(r => lines.push(rowData(r).map(esc).join(',')));
    return lines;
  }

  async function askAI() {
    const q = panel.querySelector('#kf-ai-q').value.trim();
    const out = panel.querySelector('#kf-ai-out');
    const btn = panel.querySelector('#kf-ai-ask');
    if (!q) return;
    const esc = s => `"${(s || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`;
    // ưu tiên danh sách đã gom qua nhiều trang (theo thứ tự xếp hạng), giới hạn 100 dòng
    const lines = collected?.items.length
      ? [collected.headers.map(esc).join(','), ...collected.items.slice(0, 100).map(it => it.d.map(esc).join(','))]
      : visibleCSV(100);
    if (!lines || lines.length < 2) { out.textContent = 'Không có sản phẩm nào đang hiển thị.'; out.classList.add('show'); return; }
    out.textContent = `Đang phân tích ${lines.length - 1} sản phẩm...`;
    out.classList.add('show');
    btn.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'kf-ai', question: q, csv: lines.join('\n') });
      out.textContent = res?.ok ? res.text : `⚠️ ${res?.error || 'Lỗi không xác định'}`;
    } catch (e) {
      out.textContent = `⚠️ ${e.message} (thử tải lại trang sau khi cập nhật extension)`;
    } finally {
      btn.disabled = false;
    }
  }

  function exportCSV() {
    const lines = visibleCSV();
    if (!lines) return;
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kalodata-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // Tự lọc lại khi bảng thay đổi (chuyển trang, cuộn tải thêm)
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 400); })
    .observe(document.body, { childList: true, subtree: true });
})();
