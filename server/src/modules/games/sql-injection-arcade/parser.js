const MAX_TOKENS = 32

export function evaluatePayload(input) {
  if (typeof input !== 'string' || input.length > 120) return 'UNSUPPORTED'
  const breakout = input.indexOf("'")
  if (breakout === -1) return 'NO_BREAKOUT'
  const source = input.slice(breakout + 1)
  const tokens = []
  let cursor = 0
  while (cursor < source.length) {
    const rest = source.slice(cursor)
    const whitespace = /^\s+/.exec(rest)
    if (whitespace) {
      cursor += whitespace[0].length
      continue
    }
    if (rest.startsWith('--')) {
      if (rest.slice(2).trim()) return 'UNSUPPORTED'
      tokens.push({ type: 'comment' })
      cursor = source.length
      continue
    }
    const word = /^OR\b/i.exec(rest)
    const integer = /^\d{1,12}(?!\d)/.exec(rest)
    const literal = /^'((?:[^'\r\n]|''){0,80})'/.exec(rest)
    if (word) {
      tokens.push({ type: 'or' })
      cursor += word[0].length
    } else if (integer) {
      tokens.push({ type: 'number', value: Number(integer[0]) })
      cursor += integer[0].length
    } else if (literal) {
      tokens.push({ type: 'string', value: literal[1].replaceAll("''", "'") })
      cursor += literal[0].length
    } else if (rest[0] === '=') {
      tokens.push({ type: 'equals' })
      cursor += 1
    } else return 'UNSUPPORTED'
    if (tokens.length > MAX_TOKENS) return 'UNSUPPORTED'
  }
  const [operator, left, equals, right, comment] = tokens
  if (
    tokens.length !== 5 ||
    operator?.type !== 'or' ||
    !['number', 'string'].includes(left?.type) ||
    equals?.type !== 'equals' ||
    right?.type !== left.type ||
    comment?.type !== 'comment'
  )
    return 'UNSUPPORTED'
  return left.value === right.value ? 'BYPASS' : 'FALSE_EQUALITY'
}

export function evaluateLogin(username, password) {
  const outcomes = [evaluatePayload(username), evaluatePayload(password)]
  if (outcomes.includes('UNSUPPORTED')) return 'UNSUPPORTED'
  if (outcomes.includes('BYPASS')) return 'BYPASS'
  if (outcomes.includes('FALSE_EQUALITY')) return 'FALSE_EQUALITY'
  return 'NO_BREAKOUT'
}
