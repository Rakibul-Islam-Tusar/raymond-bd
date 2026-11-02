(() => {
  const nativeFetch = window.fetch.bind(window);
  const products = Array.isArray(window.__RAYMOND_PRODUCTS__)
    ? window.__RAYMOND_PRODUCTS__.map(product => ({
        ...product,
        imageUrl: typeof product.imageUrl === 'string'
          ? product.imageUrl.replace(/^\/assets\//, 'assets/')
          : product.imageUrl
      }))
    : [];

  window.__RAYMOND_PRODUCTS__ = products;

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/(^|\/)data\/products\.json(?:[?#]|$)/.test(url) && products.length) {
      return Promise.resolve(new Response(JSON.stringify(products), {status: 200, headers: {'Content-Type': 'application/json'}}));
    }
    return nativeFetch(input, init);
  };
})();