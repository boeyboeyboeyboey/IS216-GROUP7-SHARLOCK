import { StringDecoder } from 'node:string_decoder'

export class TerminalInputCancelledError extends Error {
  constructor() {
    super('')
    this.name = 'TerminalInputCancelledError'
    this.code = 'TERMINAL_CANCELLED'
  }
}

export class TerminalInputTooLongError extends Error {
  constructor() {
    super('')
    this.name = 'TerminalInputTooLongError'
    this.code = 'TERMINAL_INPUT_TOO_LONG'
  }
}

export class TerminalInputInvalidError extends Error {
  constructor() {
    super('')
    this.name = 'TerminalInputInvalidError'
    this.code = 'TERMINAL_INVALID_INPUT'
  }
}

export function createTerminalInput({ stdin = process.stdin, stdout = process.stdout } = {}) {
  let closed = false
  let cancelActiveInput

  function write(message) {
    if (!closed) stdout.write(message)
  }

  function read(prompt, { hidden = false, maxLength = 256 } = {}) {
    if (closed) return Promise.reject(new TerminalInputCancelledError())
    if (!Number.isInteger(maxLength) || maxLength < 0) {
      return Promise.reject(new TypeError('A valid terminal input limit is required.'))
    }
    if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
      return Promise.reject(new Error('Interactive terminal input is required.'))
    }

    return new Promise((resolve, reject) => {
      const decoder = new StringDecoder('utf8')
      const wasRaw = Boolean(stdin.isRaw)
      const wasPaused = typeof stdin.isPaused === 'function' && stdin.isPaused()
      let value = ''
      let codePointCount = 0
      let overflowCount = 0
      let escapePending = false
      let escapeSequence
      let escapeSequenceLength = 0
      let finished = false

      function cleanup() {
        stdin.removeListener('data', onData)
        stdin.removeListener('end', onEnd)
        stdin.removeListener('error', onError)
        if (stdin.isRaw !== wasRaw) {
          try {
            stdin.setRawMode(wasRaw)
          } catch (error) {
            void error
          }
        }
        if (wasPaused && typeof stdin.pause === 'function') stdin.pause()
        if (cancelActiveInput === cancel) cancelActiveInput = undefined
      }

      function finish(error) {
        if (finished) return
        finished = true
        cleanup()
        if (error) {
          value = ''
          codePointCount = 0
          overflowCount = 0
          reject(error)
        } else {
          stdout.write('\n')
          resolve(value)
        }
      }

      function cancel() {
        finish(new TerminalInputCancelledError())
      }

      function handleCharacter(character) {
        if (character === '\u0003' || character === '\u0004') {
          cancel()
          return
        }
        if (escapePending) {
          escapePending = false
          if (character === '[' || character === 'O') {
            escapeSequence = character === '[' ? 'csi' : 'ss3'
            escapeSequenceLength = 0
          } else {
            finish(new TerminalInputInvalidError())
          }
          return
        }
        if (escapeSequence) {
          const codePoint = character.codePointAt(0)
          escapeSequenceLength += 1
          if (escapeSequenceLength > 8) {
            finish(new TerminalInputInvalidError())
            return
          }
          if (escapeSequence === 'ss3') {
            if (['A', 'B', 'C', 'D'].includes(character)) escapeSequence = undefined
            else finish(new TerminalInputInvalidError())
            return
          }
          if (codePoint >= 0x40 && codePoint <= 0x7e) {
            if (['A', 'B', 'C', 'D'].includes(character)) escapeSequence = undefined
            else finish(new TerminalInputInvalidError())
            return
          }
          if (codePoint < 0x30 || codePoint > 0x3f) finish(new TerminalInputInvalidError())
          return
        }
        if (character === '\u001b') {
          escapePending = true
          return
        }
        if (character === '\r' || character === '\n') {
          finish(overflowCount > 0 ? new TerminalInputTooLongError() : undefined)
          return
        }
        if (character === '\u0008' || character === '\u007f') {
          if (overflowCount > 0) {
            overflowCount -= 1
          } else if (codePointCount > 0) {
            const characters = Array.from(value)
            characters.pop()
            value = characters.join('')
            codePointCount -= 1
            if (!hidden) stdout.write('\b \b')
          }
          return
        }

        const codePoint = character.codePointAt(0)
        if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
          finish(new TerminalInputInvalidError())
          return
        }
        if (codePointCount >= maxLength) {
          if (overflowCount < Number.MAX_SAFE_INTEGER) overflowCount += 1
          return
        }
        value += character
        codePointCount += 1
        if (!hidden) stdout.write(character)
      }

      function onData(chunk) {
        const text = Buffer.isBuffer(chunk) ? decoder.write(chunk) : String(chunk)
        for (const character of text) {
          handleCharacter(character)
          if (finished) break
        }
      }

      function onEnd() {
        decoder.end()
        cancel()
      }

      function onError() {
        finish(new TerminalInputCancelledError())
      }

      cancelActiveInput = cancel
      stdin.on('data', onData)
      stdin.once('end', onEnd)
      stdin.once('error', onError)
      stdout.write(prompt)
      try {
        stdin.setRawMode(true)
        if (wasPaused && typeof stdin.resume === 'function') stdin.resume()
      } catch {
        finish(new TerminalInputCancelledError())
      }
    })
  }

  return Object.freeze({
    get isTTY() {
      return Boolean(stdin.isTTY && stdout.isTTY)
    },
    write,
    readLine(prompt, options) {
      return read(prompt, { ...options, hidden: false })
    },
    readSecret(prompt, options) {
      return read(prompt, { ...options, hidden: true })
    },
    close() {
      if (closed) return
      closed = true
      cancelActiveInput?.()
    },
  })
}
