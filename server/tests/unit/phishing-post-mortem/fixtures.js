import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULE = '../../../src/modules/games/phishing-post-mortem'

function load(relativePath) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'))
}

export function readCase(caseId) {
  return load(`${MODULE}/cases/${caseId}.public.json`)
}

export function readAnswers(caseId) {
  return load(`${MODULE}/cases/answers/${caseId}.answers.json`)
}
