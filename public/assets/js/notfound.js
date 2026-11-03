(() => {
  // Fallback for hosts without _redirects support: /s/<shop-link> -> /shop?s=<shop-link>
  const m = location.pathname.match(/^\/s\/([^/?#]+)/);
  if (m) { location.replace('/shop?s=' + m[1]); return; }
  window.M.start(async () => {});
})();
