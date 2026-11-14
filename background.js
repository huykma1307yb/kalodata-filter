// Gọi Claude (Anthropic API) từ service worker: content script bị CORS chặn và không nên giữ API key.
const DEFAULTS = { apiKey: '', model: 'claude-opus-5-5' };

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'kf-open') { // mở tab mới ngay cạnh tab Kalodata (không bị chặn popup)
    chrome.tabs.create({ url: msg.url, index: (_sender.tab?.index ?? -2) + 1, openerTabId: _sender.tab?.id });
    reply({ ok: true });
    return;
  }
  const handler = { 'kf-ai': analyze, 'kf-plan': plan }[msg?.type];
  if (!handler) return;
  handler(msg).then(data => reply({ ok: true, ...data }), e => reply({ ok: false, error: e.message }));
  return true; // trả lời bất đồng bộ
});

async function callClaude(body) {
  const { apiKey, model } = await chrome.storage.local.get(DEFAULTS);
  if (!apiKey) throw new Error('Chưa có Claude API key. Mở trang Tuỳ chọn của extension để nhập.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: model || DEFAULTS.model, max_tokens: 16000, fallbacks: 'default', ...body })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Claude API lỗi HTTP ${res.status}`);
  if (data.stop_reason === 'refusal') throw new Error('Claude từ chối trả lời yêu cầu này.');
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// Phân tích dữ liệu bảng đang hiển thị
async function analyze({ question, csv }) {
  const text = await callClaude({
    system: 'Bạn là chuyên gia phân tích sản phẩm/ngành hàng TikTok Shop dựa trên dữ liệu Kalodata. Trả lời ngắn gọn, bằng tiếng Việt, dựa trên dữ liệu được cung cấp; nêu tên cụ thể và con số khi đưa ra nhận định. Không dùng định dạng markdown phức tạp.',
    messages: [{ role: 'user', content: `Dữ liệu (CSV):\n${csv}\n\nYêu cầu: ${question}` }]
  });
  return { text: text || '(Không có phản hồi)' };
}

// Chuyển câu lệnh tiếng Việt thành kế hoạch thao tác cho extension
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['page', 'tab', 'days', 'include', 'exclude', 'priceMin', 'priceMax', 'rules', 'sortColumn', 'question'],
  properties: {
    page: { type: 'string', enum: ['category', 'current'] },
    tab: { type: 'string' },
    days: { type: 'integer' },
    include: { type: 'string' },
    exclude: { type: 'string' },
    priceMin: { type: 'string' },
    priceMax: { type: 'string' },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['column', 'min', 'max'],
        properties: { column: { type: 'string' }, min: { type: 'string' }, max: { type: 'string' } }
      }
    },
    sortColumn: { type: 'string' },
    question: { type: 'string' }
  }
};

async function plan({ command, columns, url }) {
  const text = await callClaude({
    system: `Bạn chuyển câu lệnh tiếng Việt của người dùng thành kế hoạch thao tác cho extension lọc dữ liệu trên Kalodata (TikTok Shop Việt Nam). Trả về JSON đúng schema:
- page: "category" CHỈ khi lệnh nói rõ muốn mở danh sách ngành hàng/danh mục; còn lại "current" (giữ trang hiện tại). Nếu đang ở trang /product (danh sách sản phẩm) thì luôn "current" và tab "".
- tab: tên tab cần bấm trên trang chi tiết ngành hàng nếu lệnh liên quan: "BXH sản phẩm" (tìm sản phẩm), "BXH cửa hàng" (cửa hàng/shop), "BXH nhà sáng tạo" (KOL/creator), "Tổng quan", "Chỉ số cốt lõi"; "" nếu không cần. Khi đang ở trang /category/detail thì dùng page "current".
- days: số ngày của khoảng thời gian cần xem (vd 7, 30, 90); 0 nếu lệnh không nói.
- include: từ khoá BẮT BUỘC có (cách nhau dấu phẩy), "" nếu không có.
- exclude: từ khoá loại trừ (áp lên toàn bộ chữ của dòng, gồm tên sản phẩm/ngành hàng), cách nhau dấu phẩy, viết thường. Cú pháp ngoại lệ: "từ (trừ a/b)" nghĩa là loại dòng chứa "từ" trừ khi dòng chứa "a" hoặc "b". Mỗi từ khớp theo chuỗi con trong tên dòng, nên hãy liệt kê các cách Kalodata đặt tên ngành hàng tiếng Việt (vd thời trang → "thời trang, trang phục, đồ lót, giày, túi, phụ kiện thời trang"; đồ ăn → "đồ ăn, đồ uống, thực phẩm"; thực phẩm chức năng → "thực phẩm chức năng, thực phẩm bổ sung, vitamin"; điện tử chỉ lấy phụ kiện → "điện tử (trừ phụ kiện), điện thoại (trừ phụ kiện), máy tính (trừ phụ kiện)"; ốp điện thoại → "ốp lưng, ốp điện thoại, bao da"). Tránh từ quá ngắn dễ khớp nhầm.
- priceMin / priceMax: giới hạn GIÁ BÁN sản phẩm nếu người dùng nêu (vd "giá dưới 200k" → priceMax "200k"; "từ 50k đến 300k"), dạng "50k", "1.5tr"; "" nếu không có. Không đưa giá bán vào rules.
- rules: điều kiện min/max cho cột số. "column" PHẢI trùng chính xác một tên trong danh sách cột được cung cấp. min/max dạng "50tr", "1tỉ", "10%" hoặc "" nếu không có. Chỉ thêm khi người dùng nêu ngưỡng.
- sortColumn: tên cột (trùng chính xác danh sách cột) để xếp danh sách kết quả từ cao xuống thấp — cột người dùng quan tâm nhất; nếu không rõ thì chọn cột doanh thu. Nếu cột cần (vd tăng trưởng) chưa có trong danh sách vì sẽ xuất hiện sau khi bấm tab, cứ ghi tên mô tả như "tăng trưởng". "" nếu không có cột nào.
- question: nếu người dùng muốn xem/so sánh/xếp hạng/chọn thì viết câu yêu cầu phân tích dữ liệu sau khi lọc (vd xếp hạng theo các cột người dùng quan tâm và đề xuất ngành nên chọn); "" nếu không cần.`,
    messages: [{ role: 'user', content: `Trang hiện tại: ${url}\nCác cột số đang có: ${JSON.stringify(columns)}\n\nLệnh: ${command}` }],
    output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } }
  });
  return { plan: JSON.parse(text) };
}

// Bấm icon extension → mở/đóng panel. Nếu tab mở trước khi cài extension thì tự chèn script vào.
chrome.action.onClicked.addListener(async tab => {
  if (!/^https:\/\/([^/]+\.)?kalodata\.com\//.test(tab.url || '')) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'kf-toggle' });
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['panel.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'kf-toggle' });
  }
});
