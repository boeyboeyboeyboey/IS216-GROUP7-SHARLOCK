import { describe, expect, it } from 'vitest'
import {
  GENERATOR_VERSION,
  TEMPLATE_IDS,
  generateCase,
} from '../../../src/modules/games/phishing-post-mortem/generator/index.js'
import { TRICK_IDS } from '../../../src/modules/games/phishing-post-mortem/generator/tricks.js'
import { createCaseLibrary } from '../../../src/modules/games/phishing-post-mortem/service.js'

const FICTIONAL = /\.example(\.[a-z]{2,})?$/
const REAL_BRANDS = /microsoft|outlook|gmail|office365|paypal|google|apple|amazon|dropbox|docusign/i
const CASE_COUNT = 500

// spread the seeds over the whole 32-bit range and rotate through every template
const generated = Array.from({ length: CASE_COUNT }, (_, index) => {
  const seed = Number((BigInt(index + 1) * 2654435761n) % 4294967296n)
  const templateId = TEMPLATE_IDS[index % TEMPLATE_IDS.length]
  return { seed, templateId, ...generateCase({ seed, templateId }) }
})

const domainOf = (address) => address.split('@')[1]
const hostOf = (url) => new URL(url).hostname

function checkCase({ content, answers }) {
  const emailIds = content.emails.map((email) => email.id)
  const optionIds = content.evidenceOptions.map((option) => option.id)

  expect(content.emails).toHaveLength(20)
  expect(new Set(emailIds).size).toBe(20)
  for (const email of content.emails) {
    expect(email.senderName && email.senderAddress && email.replyTo).toBeTruthy()
    expect(email.subject && email.bodyText).toBeTruthy()
    expect(Number.isNaN(Date.parse(email.sentAt))).toBe(false)
    expect(domainOf(email.senderAddress)).toMatch(FICTIONAL)
    expect(domainOf(email.replyTo)).toMatch(FICTIONAL)
  }

  const links = content.emails.flatMap((email) => email.links)
  expect(new Set(links.map((link) => link.id)).size).toBe(links.length)
  for (const link of links) {
    expect(link.destination.startsWith('https://')).toBe(true)
    expect(hostOf(link.destination)).toMatch(FICTIONAL)
  }
  expect(JSON.stringify(content)).not.toMatch(REAL_BRANDS)
  expect(JSON.stringify(answers)).not.toMatch(REAL_BRANDS)

  expect(optionIds).toHaveLength(6)
  expect(new Set(optionIds).size).toBe(6)
  const eventIds = content.timeline.map((event) => event.id)
  expect(new Set(eventIds).size).toBe(eventIds.length)
  const times = content.timeline.map((event) => Date.parse(event.at))
  expect(times).toEqual([...times].sort((first, second) => first - second))

  expect(JSON.stringify(content)).not.toMatch(/patientZero|evidenceNotes|decoys/)
  expect(emailIds).toContain(answers.patientZeroId)
  expect(answers.evidenceIds).toHaveLength(2)
  expect(optionIds).toEqual(expect.arrayContaining(answers.evidenceIds))
  expect(Object.keys(answers.evidenceNotes).sort()).toEqual([...optionIds].sort())
  const marked = Object.keys(answers.evidenceNotes).filter(
    (id) => answers.evidenceNotes[id].correct,
  )
  expect(marked.sort()).toEqual([...answers.evidenceIds].sort())
  for (const note of Object.values(answers.evidenceNotes)) {
    expect(note.note.length).toBeGreaterThan(40)
  }
  for (const decoy of answers.decoys) expect(emailIds).toContain(decoy.emailId)
  expect(answers.decoys.map((decoy) => decoy.emailId)).not.toContain(answers.patientZeroId)
  for (const topic of answers.topics) {
    expect(topic.requires === 'email' || optionIds.includes(topic.requires)).toBe(true)
  }
  expect(answers.chain.length).toBeGreaterThanOrEqual(5)
}

// the answer must follow from the page alone, and no other message may fit it as well
function checkUnambiguous({ content, answers }) {
  const patientZero = content.emails.find((email) => email.id === answers.patientZeroId)
  const others = content.emails.filter((email) => email.id !== patientZero.id)
  const fakeDomain = domainOf(patientZero.senderAddress)

  expect(patientZero.links.some((link) => link.label !== link.destination)).toBe(true)
  expect(hostOf(patientZero.links[0].destination)).toBe(fakeDomain)
  expect(others.map((email) => domainOf(email.senderAddress))).not.toContain(fakeDomain)
  expect(
    others.flatMap((email) => email.links.map((link) => hostOf(link.destination))),
  ).not.toContain(fakeDomain)
  // a genuine message from the same display name proves the name alone is not evidence
  expect(others.some((email) => email.senderName === patientZero.senderName)).toBe(true)

  const credentialEvents = content.timeline.filter((event) =>
    /credential pattern/.test(event.label),
  )
  expect(credentialEvents).toHaveLength(1)
  expect(credentialEvents[0].detail).toContain(fakeDomain)
  for (const email of others) {
    for (const link of email.links) {
      expect(credentialEvents[0].detail).not.toContain(hostOf(link.destination))
    }
  }

  const sentAt = Date.parse(patientZero.sentAt)
  const signIns = content.timeline.filter((event) => /successful sign-in/.test(event.label))
  expect(signIns).toHaveLength(1)
  expect(Date.parse(credentialEvents[0].at)).toBeGreaterThan(sentAt)
  expect(Date.parse(signIns[0].at)).toBeGreaterThan(Date.parse(credentialEvents[0].at))
}

describe('generated phishing cases', () => {
  it(`passes the authored-case integrity rules for ${CASE_COUNT} seeds`, () => {
    for (const entry of generated) checkCase(entry)
  })

  it('has exactly one evidence-supported patient zero in every case', () => {
    for (const entry of generated) checkUnambiguous(entry)
  })

  it('rebuilds the identical case from the same seed and template', () => {
    for (const entry of generated.slice(0, 50)) {
      const again = generateCase({ seed: entry.seed, templateId: entry.templateId })
      expect(again.content).toEqual(entry.content)
      expect(again.answers).toEqual(entry.answers)
    }
  })

  it('varies the case between seeds', () => {
    const titles = new Set(generated.map((entry) => entry.content.title))
    const fakeDomains = new Set(
      generated.map(({ content, answers }) =>
        domainOf(content.emails.find((email) => email.id === answers.patientZeroId).senderAddress),
      ),
    )
    expect(titles.size).toBeGreaterThan(20)
    expect(fakeDomains.size).toBeGreaterThan(50)
  })

  it('uses every template and every domain trick', () => {
    expect(new Set(generated.map((entry) => entry.templateId))).toEqual(new Set(TEMPLATE_IDS))
    expect(new Set(generated.map((entry) => entry.trickId))).toEqual(new Set(TRICK_IDS))
  })

  it('carries the generator version and refuses unknown templates or seeds', () => {
    expect(generated[0].content.datasetVersion).toBe(GENERATOR_VERSION)
    expect(generateCase({ seed: 1, templateId: 'unknown' })).toBeNull()
    expect(generateCase({ seed: -1, templateId: TEMPLATE_IDS[0] })).toBeNull()
    expect(generateCase({ seed: 2 ** 32, templateId: TEMPLATE_IDS[0] })).toBeNull()
  })

  it('serves a generated case through the library without its answer key', () => {
    const library = createCaseLibrary({ random: () => 0.99 })
    const state = library.openCase()
    const shown = JSON.stringify(library.publicCase(state))
    const { answers } = library.resolveCase(state)
    expect(shown).not.toContain(answers.summary)
    expect(answers.chain.some((step) => shown.includes(step))).toBe(false)
  })
})
