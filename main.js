// Chạy trong trang Kalodata (MAIN world): khi extension bật chế độ "ghi link",
// chặn việc mở tab / chuyển trang và lưu lại đường link Kalodata định mở.
(() => {
  const root = document.documentElement;
  const capturing = () => root.dataset.kfCapture === '1';
  const record = url => { root.dataset.kfUrl = new URL(url, location.href).href; };
  const fakeWin = { focus() {}, blur() {}, close() {}, closed: false, opener: null, location: { href: '' }, document: { write() {}, close() {} } };

  const open = window.open;
  window.open = function (url, ...rest) {
    if (capturing() && url) { record(url); return fakeWin; }
    return open.call(this, url, ...rest);
  };
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (state, title, url) {
      if (capturing() && url) { record(url); return; }
      return orig.apply(this, arguments);
    };
  }
  // link <a target="_blank"> được bấm
  document.addEventListener('click', e => {
    if (!capturing()) return;
    const a = e.target.closest?.('a[href]');
    if (a) { record(a.href); e.preventDefault(); }
  }, true);
})();
