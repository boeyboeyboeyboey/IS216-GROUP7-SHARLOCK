export class LlmError extends Error {
  constructor(code, message, status = 503) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.status = status
  }
}
