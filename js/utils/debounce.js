export function debounce(callback, wait = 200, options = {}) {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  const leading = Boolean(options.leading);
  const trailing = options.trailing !== false;

  function invoke() {
    const args = lastArgs;
    const context = lastThis;

    lastArgs = null;
    lastThis = null;

    result = callback.apply(context, args);

    return result;
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const shouldCallNow = leading && !timeoutId;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      timeoutId = null;

      if (trailing && lastArgs) {
        invoke();
      }
    }, wait);

    if (shouldCallNow) {
      return invoke();
    }

    return result;
  }

  debounced.cancel = () => {
    clearTimeout(timeoutId);

    timeoutId = null;
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (!timeoutId) {
      return result;
    }

    clearTimeout(timeoutId);
    timeoutId = null;

    if (lastArgs) {
      return invoke();
    }

    return result;
  };

  return debounced;
}

export function throttle(callback, wait = 200) {
  let lastCall = 0;
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    lastCall = Date.now();
    timeoutId = null;

    callback.apply(lastThis, lastArgs);

    lastArgs = null;
    lastThis = null;
  }

  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      invoke();
    } else if (!timeoutId) {
      timeoutId = setTimeout(invoke, remaining);
    }
  };
}

export function rafThrottle(callback) {
  let frameId = null;
  let lastArgs = null;
  let lastThis = null;

  return function throttledWithRaf(...args) {
    lastArgs = args;
    lastThis = this;

    if (frameId) return;

    frameId = requestAnimationFrame(() => {
      frameId = null;
      callback.apply(lastThis, lastArgs);
    });
  };
}
