(function () {
  var root =
    typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
        ? self
        : this;

  if (typeof root.globalThis === 'undefined') {
    try {
      Object.defineProperty(root, 'globalThis', {
        value: root,
        writable: true,
        configurable: true
      });
    } catch (error) {
      root.globalThis = root;
    }
  }
})();
