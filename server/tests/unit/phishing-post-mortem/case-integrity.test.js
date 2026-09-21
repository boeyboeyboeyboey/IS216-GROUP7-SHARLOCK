import { describe, expect, it } from 'vitest'
import { CASE_IDS } from '../../../src/modules/games/phishing-post-mortem/service.js'
import { readAnswers, readCase } from './fixtures.js'

const FICTIONAL = /\.example(\.[a-z]{2,})?$/

describe.each(CASE_IDS)('authored case %s', (caseId) => {
  const content = readCase(caseId)
  const answers = readAnswers(caseId)
  const emailIds = content.emails.map((email) => email.id)
  const optionIds = content.evidenceOptions.map((option) => option.id)

  it('contains exactly twenty uniquely identified emails', () => {
    expect(content.emails).toHaveLength(20)
    expect(new Set(emailIds).size).toBe(20)
  })

  it('gives every email the fields the inspector renders', () => {
    for (const email of content.emails) {
      expect(email.senderName && email.senderAddress && email.replyTo).toBeTruthy()
      expect(email.subject && email.bodyText).toBeTruthy()
      expect(Number.isNaN(Date.parse(email.sentAt))).toBe(false)
      expect(Array.isArray(email.links)).toBe(true)
    }
  })

  it('uses inert fictional destinations over https and no real brands', () => {
    const links = content.emails.flatMap((email) => email.links)
    expect(new Set(links.map((link) => link.id)).size).toBe(links.length)
    for (const link of links) {
      expect(link.destination.startsWith('https://')).toBe(true)
      expect(new URL(link.destination).hostname).toMatch(FICTIONAL)
    }
    expect(JSON.stringify(content)).not.toMatch(/microsoft|outlook|gmail|office365|paypal/i)
  })

  it('offers six distinct evidence options and a dated timeline', () => {
    expect(optionIds).toHaveLength(6)
    expect(new Set(optionIds).size).toBe(6)
    expect(new Set(content.timeline.map((event) => event.id)).size).toBe(content.timeline.length)
    for (const event of content.timeline) expect(Number.isNaN(Date.parse(event.at))).toBe(false)
  })

  it('keeps every answer out of the public case file', () => {
    expect(JSON.stringify(content)).not.toMatch(/patientZero|evidenceNotes|decoys/)
  })

  it('has one resolvable patient zero and exactly two correct clues', () => {
    expect(emailIds).toContain(answers.patientZeroId)
    expect(answers.evidenceIds).toHaveLength(2)
    expect(optionIds).toEqual(expect.arrayContaining(answers.evidenceIds))
  })

  it('explains every evidence option and marks only the correct ones', () => {
    expect(Object.keys(answers.evidenceNotes).sort()).toEqual([...optionIds].sort())
    const marked = Object.keys(answers.evidenceNotes).filter(
      (id) => answers.evidenceNotes[id].correct,
    )
    expect(marked.sort()).toEqual([...answers.evidenceIds].sort())
    for (const note of Object.values(answers.evidenceNotes))
      expect(note.note.length).toBeGreaterThan(40)
  })

  it('resolves every decoy and topic requirement', () => {
    for (const decoy of answers.decoys) expect(emailIds).toContain(decoy.emailId)
    for (const topic of answers.topics)
      expect(topic.requires === 'email' || optionIds.includes(topic.requires)).toBe(true)
    expect(answers.chain.length).toBeGreaterThanOrEqual(5)
  })

  it('makes patient zero solvable from the evidence on the page', () => {
    const patientZero = content.emails.find((email) => email.id === answers.patientZeroId)
    expect(patientZero.links.some((link) => link.label !== link.destination)).toBe(true)
    const otherDomains = content.emails
      .filter((email) => email.id !== patientZero.id)
      .map((email) => email.senderAddress.split('@')[1])
    expect(otherDomains).not.toContain(patientZero.senderAddress.split('@')[1])
  })
})
