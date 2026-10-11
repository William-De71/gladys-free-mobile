// -----------------------------------------------------------------------------
// A tiny fetch double for the Free Mobile API tests: records the calls and
// returns canned Response-like objects, without any real network access.
// -----------------------------------------------------------------------------

/**
 * @description Build a fake `fetch` returning a given status, or one status per
 * call.
 * @param {object} [options] - Options.
 * @param {number|number[]} [options.status] - HTTP status to return (default
 * 200), or the list of statuses of the successive calls (the last one repeats).
 * @param {boolean} [options.throwAbort] - If true, throw an AbortError instead.
 * @param {Error} [options.throwError] - If set, throw this error instead.
 * @returns {{ fetch: Function, calls: Array }} The fake fetch and its call log.
 * @example
 * const { fetch, calls } = createFakeFetch({ status: [402, 200] });
 */
function createFakeFetch({ status = 200, throwAbort = false, throwError = null } = {}) {
  const statuses = Array.isArray(status) ? status : [status];
  const calls = [];
  async function fakeFetch(url, init) {
    calls.push({ url: url.toString(), init, body: init.body ? JSON.parse(init.body) : null });
    if (throwAbort) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (throwError) {
      throw throwError;
    }
    const current = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return {
      ok: current >= 200 && current < 300,
      status: current,
    };
  }
  return { fetch: fakeFetch, calls };
}

export { createFakeFetch };
