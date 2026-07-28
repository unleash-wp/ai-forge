// Shared network helper: a fetch timeout signal, so no upstream (GitHub,
// profiles.wordpress.org, Trac) can hang a request or the ingest worker forever
// on a stalled connection. On a hosted server an unbounded fetch is a liability -
// one slow peer would pin a request open indefinitely. Zero-dep: AbortSignal.timeout
// is built in on Node >=18.

// 20s is generous for these JSON/CSV endpoints yet bounds the worst case. Override
// per environment (e.g. a slow CI mirror) via UWP_FETCH_TIMEOUT_MS.
export const FETCH_TIMEOUT_MS = Math.max(1000, Number(process.env.UWP_FETCH_TIMEOUT_MS) || 20000);

// A one-shot abort signal that trips after `ms`. Pass as `fetch(url, { signal })`;
// a timeout rejects the fetch with a TimeoutError the caller already treats as a
// failed upstream (degrades to cache / "unknown"), never a hang.
export const timeoutSignal = (ms = FETCH_TIMEOUT_MS) => AbortSignal.timeout(ms);

// Bounded-concurrency map: run `fn` over `items` with at most `concurrency` in
// flight, to fan out cached profile / component lookups without opening one
// socket per item at once. `fn`'s result is ignored (callers mutate a shared
// cache); this awaits completion only.
export async function pool(items, concurrency, fn) {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
}
