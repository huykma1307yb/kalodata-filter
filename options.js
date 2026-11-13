const $ = id => document.getElementById(id);
chrome.storage.local.get({ apiKey: '', model: 'claude-opus-5-5' }, v => { $('key').value = v.apiKey; $('model').value = v.model; });
$('save').onclick = () => chrome.storage.local.set(
  { apiKey: $('key').value.trim(), model: $('model').value.trim() || 'claude-opus-5-5' },
  () => { $('msg').textContent = 'Đã lưu ✓'; setTimeout(() => $('msg').textContent = '', 2000); }
);
