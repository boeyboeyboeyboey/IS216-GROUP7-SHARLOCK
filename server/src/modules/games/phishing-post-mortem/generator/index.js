import {
  BENIGN,
  COMPANIES,
  FIRST_NAMES,
  LAST_NAMES,
  LURES,
  MONTHS,
  RELAY_DOMAINS,
  VENDORS,
  pickDocument,
} from './pools.js'
import { createRandom } from './random.js'
import { TEMPLATES, TEMPLATE_IDS } from './templates.js'
import { chooseTrick, possessive } from './tricks.js'

// bump this only together with a new ruleset version: active attempts rebuild their case
// from (seed, template, version), so changing the output of a released version would change them
export const GENERATOR_VERSION = 'gen-1'
export { TEMPLATE_IDS }

const EMAIL_COUNT = 20
const MINUTE = 60000
const DAY = 24 * 60 * MINUTE
const SGT_OFFSET = 8 * 60 * MINUTE
// monday 7 september 2026, 00:00 in singapore
const FIRST_MONDAY = Date.UTC(2026, 8, 7) - SGT_OFFSET
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TOPIC_CODES = {
  links: ['PHISH_LINK_MISMATCH_FOUND', 'PHISH_LINK_MISMATCH_MISSED'],
  spoof: ['PHISH_SPOOF_IDENTIFIED', 'PHISH_SPOOF_MISSED'],
  timeline: ['PHISH_TIMELINE_LINKED', 'PHISH_TIMELINE_MISSED'],
}

function slugUser(first, last) {
  return `${first.charAt(0)}.${last}`.toLowerCase()
}

function createPeople(rng, count) {
  const firsts = rng.sample(FIRST_NAMES, count)
  return firsts.map((first) => {
    const last = rng.pick(LAST_NAMES)
    return { first, last, full: `${first} ${last}`, user: slugUser(first.replace(' ', ''), last) }
  })
}

function sgtParts(date) {
  const local = new Date(date.getTime() + SGT_OFFSET)
  const pad = (value) => String(value).padStart(2, '0')
  return {
    clock: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
    weekday: WEEKDAYS[local.getUTCDay()],
  }
}

function createContext(rng) {
  const company = rng.pick(COMPANIES)
  const vendor = rng.pick(VENDORS)
  const [victim, ...others] = createPeople(rng, 6)
  const vendorContact = others.pop()
  const weekIndex = rng.int(0, 8)
  const monday = FIRST_MONDAY + weekIndex * 7 * DAY
  const invoiceNumber = rng.int(4000, 8999)
  const prefix = company.short.slice(0, 2).toUpperCase()
  return {
    rng,
    company,
    vendor,
    victim,
    vendorContact,
    realDomain: `${company.slug}.example`,
    vendorDomain: `${vendor.slug}.example`,
    week: 37 + weekIndex,
    month: MONTHS[new Date(monday + 3 * DAY).getUTCMonth()],
    invoice: `${prefix}-${invoiceNumber}`,
    previousInvoice: `${prefix}-${invoiceNumber - rng.int(20, 90)}`,
    document: pickDocument(rng),
    fileCode: rng.int(100000, 999999).toString(36),
    colleague: (index) => others[index],
    number: (min, max) => rng.int(min, max),
    at: (day, minutes) => new Date(monday + day * DAY + minutes * MINUTE),
    after: (date, minutes) => new Date(date.getTime() + minutes * MINUTE),
    // times after the first day carry their weekday so an overnight chain stays readable
    time: (date) =>
      date.getTime() < monday + DAY
        ? `${sgtParts(date).clock} SGT`
        : `${sgtParts(date).weekday} ${sgtParts(date).clock} SGT`,
    dayTime: (date) => `${sgtParts(date).weekday} ${sgtParts(date).clock} SGT`,
  }
}

function workingTime(c, { nextMorning = false } = {}) {
  if (nextMorning || c.rng.next() < 0.2) return c.at(1, c.number(510, 660))
  return c.at(0, c.number(510, 1080))
}

function buildPatientZero(c, template) {
  const impersonated = template.impersonate(c)
  const { trick, made } = chooseTrick(impersonated.slug, c.rng)
  const message = template.message(c)
  const sentAt = c.at(0, c.number(600, 960))
  const delay = c.number(2, 9)
  const click = c.after(sentAt, delay)
  const email = {
    senderName: impersonated.senderName,
    senderAddress: `${impersonated.local}@${made.domain}`,
    replyTo: `${impersonated.local}@${c.rng.pick(RELAY_DOMAINS)}`,
    subject: message.subject,
    sentAt,
    bodyText: message.bodyText,
    links: [{ label: message.label, destination: `https://${made.domain}${message.path}` }],
  }
  const attack = template.attack(c, { click, host: made.domain, path: message.path, delay })
  return {
    impersonated,
    trick,
    made,
    message,
    email,
    attack,
    realDomain: `${impersonated.slug}.example`,
  }
}

function buildDecoy(c, archetype, lure, patientZero) {
  const sentBefore = patientZero.email.sentAt.getTime() - 40 * MINUTE
  const email = {
    senderName: lure.senderName,
    senderAddress: `${lure.local}@${lure.host}`,
    replyTo: `${lure.local}@${lure.host}`,
    subject: lure.subject,
    bodyText: lure.bodyText,
    links: [{ label: lure.label, destination: `https://${lure.host}${lure.path}` }],
  }
  if (archetype === 'clicked') {
    const earliest = c.at(0, 525).getTime()
    email.sentAt = new Date(earliest + c.rng.next() * Math.max(0, sentBefore - earliest))
    const click = c.after(email.sentAt, c.number(5, 25))
    return {
      email,
      event: {
        at: click,
        label: 'Web proxy - link opened',
        detail: `${c.colleague(1).user} opened ${lure.host}${lure.path}. No credential submission followed and the host appears in no later event.`,
      },
      note: `The strongest decoy. It is a real ${lure.kind} and it was clicked at ${c.time(click)}, before the compromise. But no credentials were submitted and the host appears in no later event, so it did not cause the intrusion.`,
    }
  }
  if (archetype === 'after') {
    email.sentAt = c.after(patientZero.attack.signIn, c.number(60, 360))
    return {
      email,
      note: `A convincing ${lure.kind}, but it arrived ${c.dayTime(email.sentAt)}, after the attacker had already signed in at ${c.time(patientZero.attack.signIn)}. Timing rules it out.`,
    }
  }
  if (archetype === 'blocked') {
    email.sentAt = workingTime(c)
    return {
      email,
      event: {
        at: c.after(email.sentAt, c.number(3, 20)),
        label: 'Web proxy - request blocked',
        detail: `${c.colleague(3).user}'s request to ${lure.host} was blocked by the web filter before any page loaded.`,
      },
      note: `A ${lure.kind}, clicked and blocked by the web filter before the page loaded. Worth reporting, but no credentials could have been entered.`,
    }
  }
  email.sentAt = workingTime(c)
  return {
    email,
    note: `A ${lure.kind}. It is suspicious, but nobody opened its link and it appears in no log event, so it is unconnected to the incident.`,
  }
}

function buildCompanions(c, template, patientZero) {
  const { senderName, local } = patientZero.impersonated
  return template.companions(c).map((companion) => ({
    senderName,
    senderAddress: `${local}@${patientZero.realDomain}`,
    replyTo: `${local}@${patientZero.realDomain}`,
    subject: companion.subject,
    sentAt: workingTime(c),
    bodyText: companion.bodyText,
    links: [],
  }))
}

function buildBenign(c, count) {
  return c.rng.sample(BENIGN, count).map((make) => {
    const message = make(c)
    const domain = message.vendor ? c.vendorDomain : c.realDomain
    return {
      senderName: message.senderName,
      senderAddress: `${message.local}@${domain}`,
      replyTo: `${message.local}@${domain}`,
      subject: message.subject,
      sentAt: workingTime(c),
      bodyText: message.bodyText,
      links: [],
    }
  })
}

function distractorPool(c, patientZero, decoys) {
  const owner = patientZero.impersonated.owner
  const pool = [
    {
      id: 'ev-urgent-language',
      label: 'The message pressures the reader with a same-day deadline',
      note: 'True, but it is true of several messages here, including some harmless ones. Urgency is a prompt to slow down, not proof of a compromise.',
    },
    {
      id: 'ev-display-name',
      label: `The sender's display name matches a real ${owner} mailbox`,
      note: `True, and that is the trap: genuine messages from ${patientZero.impersonated.senderName} carry exactly the same name. Display names are free text that anyone can set, so they prove nothing on their own.`,
    },
    {
      id: 'ev-macro-attachment',
      label: 'The message carried a macro-enabled attachment',
      note: 'No message in this case carries an attachment. The theft here was credential phishing through a web form, not malware.',
    },
    {
      id: 'ev-outside-hours',
      label: 'The message was sent outside office hours',
      note: `False. It arrived at ${c.time(patientZero.email.sentAt)} on a working day, which is part of why it blended in with ordinary mail.`,
    },
    {
      id: 'ev-reported',
      label: 'A colleague reported the message to the security team before it was opened',
      note: 'Nothing in this case shows a report. The first sign of trouble in the logs is the proxy record of the click.',
    },
  ]
  const late = decoys.find((decoy) => decoy.archetype === 'after')
  if (late) {
    pool.push({
      id: 'ev-arrived-after-signin',
      label: `The message arrived after the unfamiliar sign-in at ${c.time(patientZero.attack.signIn)}`,
      note: `False for Patient Zero and true for the ${late.lure.kind}. A message that arrives after the intrusion cannot have caused it, which is exactly why that one is a decoy.`,
    })
  }
  const blocked = decoys.find((decoy) => decoy.archetype === 'blocked')
  if (blocked) {
    pool.push({
      id: 'ev-blocked-request',
      label: `A request to ${blocked.lure.host} was blocked by the web filter`,
      note: 'The blocked request never loaded a page, so no credentials could be entered there. A blocked click is evidence that a control worked, not evidence of the breach.',
    })
  }
  return pool
}

// builds one case in the same shape as the authored cases/<id>.public.json and answers file
export function generateCase({ seed, templateId }) {
  const template = TEMPLATES.find((candidate) => candidate.id === templateId)
  if (!template || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null
  const c = createContext(createRandom(seed))
  const patientZero = buildPatientZero(c, template)

  // one sample of lures keeps every decoy's lure different
  const lures = c.rng.sample(LURES, 3)
  const decoys = c.rng
    .sample(['clicked', 'after', 'blocked', 'unclicked'], 3)
    .map((archetype, index) => ({
      archetype,
      lure: lures[index],
      ...buildDecoy(c, archetype, lures[index], patientZero),
    }))

  const companions = buildCompanions(c, template, patientZero)
  const benign = buildBenign(c, EMAIL_COUNT - 1 - decoys.length - companions.length)
  const emails = [
    patientZero.email,
    ...decoys.map((decoy) => decoy.email),
    ...companions,
    ...benign,
  ]

  const ids = c.rng.shuffle(
    Array.from({ length: EMAIL_COUNT }, (_, index) => `m${String(index + 1).padStart(2, '0')}`),
  )
  const finished = emails.map((email, index) => ({
    id: ids[index],
    senderName: email.senderName,
    senderAddress: email.senderAddress,
    replyTo: email.replyTo,
    subject: email.subject,
    sentAt: email.sentAt.toISOString(),
    bodyText: email.bodyText,
    links: email.links.map((link, linkIndex) => ({
      id: `${ids[index]}-l${linkIndex + 1}`,
      label: link.label,
      destination: link.destination,
    })),
  }))
  const patientZeroId = finished[0].id
  const decoyIds = finished.slice(1, 1 + decoys.length).map((email) => email.id)
  const companionId = finished[1 + decoys.length].id

  const events = [
    ...patientZero.attack.events,
    ...decoys.map((decoy) => decoy.event).filter(Boolean),
  ]
    .sort((first, second) => first.at - second.at)
    .map((event, index) => ({
      id: `t${index + 1}`,
      at: event.at.toISOString(),
      label: event.label,
      detail: event.detail,
    }))

  const { impersonated, trick, made } = patientZero
  const identity = {
    id: 'ev-lookalike-domain',
    label: trick.label(impersonated.owner, made),
    note: trick.note(impersonated.owner, patientZero.realDomain, made.domain),
  }
  const causal = patientZero.attack.causal
  const distractors = c.rng.sample(distractorPool(c, patientZero, decoys), 4)
  const options = c.rng.shuffle([identity, causal, ...distractors])

  const content = {
    caseId: `g-${seed.toString(36)}`,
    datasetVersion: GENERATOR_VERSION,
    title: template.title(c),
    organisation: c.company.name,
    briefing: `Someone at ${c.company.name} gave away their password this week. Soon afterwards an attacker used it and ${template.impact}. ${template.handedBy} has handed you the mailbox and the security logs. Several of these messages are suspicious. Only one of them caused the compromise.`,
    timezoneLabel: 'SGT (UTC+8)',
    emails: finished,
    timeline: events,
    evidenceOptions: options.map((option) => ({ id: option.id, label: option.label })),
  }

  const handedOver =
    causal.id === 'ev-click-then-mfa'
      ? 'the password and an MFA approval were handed over'
      : 'credentials left the network'
  const answers = {
    caseId: content.caseId,
    datasetVersion: GENERATOR_VERSION,
    patientZeroId,
    evidenceIds: [identity.id, causal.id],
    summary: `Patient Zero is the ${template.description}. It is the only suspicious message whose destination host appears in the logs immediately before ${handedOver}, and the only one whose sending domain imitates ${possessive(impersonated.owner)} domain.`,
    chain: [
      `${c.time(patientZero.email.sentAt)} - a message signed ${impersonated.senderName} arrives from ${patientZero.email.senderAddress}. Read quickly it looks right, but ${impersonated.owner} only sends from ${patientZero.realDomain}.`,
      `The visible link text reads ${patientZero.message.label}, but the destination is ${patientZero.email.links[0].destination}, on the same lookalike domain as the sender.`,
      ...patientZero.attack.chain,
    ],
    evidenceNotes: Object.fromEntries(
      options.map((option) => [
        option.id,
        { correct: option === identity || option === causal, note: option.note },
      ]),
    ),
    decoys: [
      ...decoys.map((decoy, index) => ({ emailId: decoyIds[index], note: decoy.note })),
      {
        emailId: companionId,
        note: `Genuine. It comes from the real ${patientZero.realDomain} domain and carries no link. Same display name as Patient Zero, different domain: a useful contrast.`,
      },
    ],
    topics: [
      {
        topic: 'deceptive-links',
        requires: 'email',
        achievedCode: TOPIC_CODES.links[0],
        missedCode: TOPIC_CODES.links[1],
      },
      {
        topic: 'sender-spoofing',
        requires: identity.id,
        achievedCode: TOPIC_CODES.spoof[0],
        missedCode: TOPIC_CODES.spoof[1],
      },
      {
        topic: 'incident-timeline',
        requires: causal.id,
        achievedCode: TOPIC_CODES.timeline[0],
        missedCode: TOPIC_CODES.timeline[1],
      },
    ],
  }
  return { content, answers, templateId, trickId: trick.id }
}
