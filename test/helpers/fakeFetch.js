// -----------------------------------------------------------------------------
// A tiny fetch double for the Free Mobile API tests: records the calls and
// returns a canned Response-like object, without any real network access.
// -----------------------------------------------------------------------------

/**
 * @description Build a fake `fetch` returning a given status.
 * @param {object} [options] - Options.
 * @param {number} [options.status] - HTTP status to return (default 200).
 * @param {boolean} [options.throwAbort] - If true, throw an AbortError instead.
 * @returns {{ fetch: Function, calls: Array }} The fake fetch and its call log.
 * @example
 * const { fetch, calls } = createFakeFetch({ status: 403 });
 */
function createFakeFetch({ status = 200, throwAbort = false } = {}) {
  const calls = [];
  async function fakeFetch(url, init) {
    calls.push({ url: url.toString(), init });
    if (throwAbort) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    return {
      ok: status >= 200 && status < 300,
      status,
    };
  }
  return { fetch: fakeFetch, calls };
}

export { createFakeFetch };
