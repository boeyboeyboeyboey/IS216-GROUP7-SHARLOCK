// mulberry32: small and deterministic, so a stored seed always rebuilds the same case
export function createRandom(seed) {
  let state = seed >>> 0

  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }

  function int(min, max) {
    return min + Math.floor(next() * (max - min + 1))
  }

  function pick(items) {
    return items[Math.floor(next() * items.length)]
  }

  function shuffle(items) {
    const ordered = [...items]
    for (let index = ordered.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(next() * (index + 1))
      ;[ordered[index], ordered[swap]] = [ordered[swap], ordered[index]]
    }
    return ordered
  }

  function sample(items, count) {
    return shuffle(items).slice(0, count)
  }

  return { next, int, pick, shuffle, sample }
}
