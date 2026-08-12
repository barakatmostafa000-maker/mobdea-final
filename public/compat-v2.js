(function (root) {
  'use strict';

  if (typeof root.globalThis === 'undefined') {
    root.globalThis = root;
  }

  if (!Object.entries) {
    Object.entries = function (object) {
      return Object.keys(object).map(function (key) {
        return [key, object[key]];
      });
    };
  }

  if (!Object.values) {
    Object.values = function (object) {
      return Object.keys(object).map(function (key) {
        return object[key];
      });
    };
  }

  if (!Object.fromEntries) {
    Object.fromEntries = function (entries) {
      var result = {};

      Array.from(entries).forEach(function (entry) {
        if (!entry || entry.length < 2) return;
        result[entry[0]] = entry[1];
      });

      return result;
    };
  }

  if (!Array.prototype.flat) {
    Object.defineProperty(Array.prototype, 'flat', {
      configurable: true,
      writable: true,
      value: function (depth) {
        var level = depth === undefined ? 1 : Number(depth) || 0;

        return level > 0
          ? this.reduce(function (output, item) {
              return output.concat(
                Array.isArray(item)
                  ? Array.prototype.flat.call(item, level - 1)
                  : item
              );
            }, [])
          : this.slice();
      }
    });
  }

  if (!Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
      configurable: true,
      writable: true,
      value: function (callback, thisArg) {
        return this.map(callback, thisArg).flat();
      }
    });
  }

  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', {
      configurable: true,
      writable: true,
      value: function (search, replacement) {
        if (search instanceof RegExp) {
          if (!search.global) {
            throw new TypeError('replaceAll requires a global RegExp');
          }

          return this.replace(search, replacement);
        }

        return this.split(String(search)).join(replacement);
      }
    });
  }

  if (!Promise.prototype.finally) {
    Promise.prototype.finally = function (callback) {
      var PromiseConstructor = this.constructor;

      return this.then(
        function (value) {
          return PromiseConstructor.resolve(callback()).then(function () {
            return value;
          });
        },
        function (reason) {
          return PromiseConstructor.resolve(callback()).then(function () {
            throw reason;
          });
        }
      );
    };
  }

  if (!Promise.allSettled) {
    Promise.allSettled = function (promises) {
      return Promise.all(
        Array.from(promises).map(function (promise) {
          return Promise.resolve(promise).then(
            function (value) {
              return { status: 'fulfilled', value: value };
            },
            function (reason) {
              return { status: 'rejected', reason: reason };
            }
          );
        })
      );
    };
  }

  if (!root.queueMicrotask) {
    root.queueMicrotask = function (callback) {
      Promise.resolve()
        .then(callback)
        .catch(function (error) {
          setTimeout(function () {
            throw error;
          }, 0);
        });
    };
  }

  if (!root.requestIdleCallback) {
    root.requestIdleCallback = function (callback) {
      return setTimeout(function () {
        callback({
          didTimeout: false,
          timeRemaining: function () {
            return 0;
          }
        });
      }, 1);
    };
  }

  if (!root.cancelIdleCallback) {
    root.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }

  if (!root.structuredClone) {
    root.structuredClone = function (value) {
      return JSON.parse(JSON.stringify(value));
    };
  }

  if (root.crypto && !root.crypto.randomUUID) {
    root.crypto.randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (character) {
          var random = Math.floor(Math.random() * 16);
          var value = character === 'x' ? random : (random & 3) | 8;
          return value.toString(16);
        }
      );
    };
  }
})(typeof window !== 'undefined' ? window : self);
