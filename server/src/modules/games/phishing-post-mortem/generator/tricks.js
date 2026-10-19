import { FRONT_HOSTS, TRICK_WORDS } from './pools.js'

export function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

// each trick turns a real domain name into a different domain that reads like it at a glance
const TRICKS = [
  {
    id: 'rn-for-m',
    applies: (slug) => slug.includes('m'),
    make: (slug) => ({ domain: `${slug.replace('m', 'rn')}.example` }),
    label: (owner) =>
      `The sending domain is a lookalike of ${possessive(owner)} domain, replacing the letter m with the pair r-n`,
    note: (owner, real, fake) =>
      `This is the identity evidence. ${fake} is not ${real}; r-n imitates m at small sizes and in a narrow font, so the domain reads as ${owner} at a glance.`,
  },
  {
    id: 'vv-for-w',
    applies: (slug) => slug.includes('w'),
    make: (slug) => ({ domain: `${slug.replace('w', 'vv')}.example` }),
    label: (owner) =>
      `The sending domain is a lookalike of ${possessive(owner)} domain, replacing the letter w with two v characters`,
    note: (owner, real, fake) =>
      `This is the identity evidence. ${fake} is not ${real}; two v characters side by side pass for a w unless you read slowly.`,
  },
  {
    id: 'one-for-l',
    applies: (slug) => slug.includes('l'),
    make: (slug) => ({ domain: `${slug.replace('l', '1')}.example` }),
    label: (owner) =>
      `The sending domain is a lookalike of ${possessive(owner)} domain, replacing the letter l with the digit 1`,
    note: (owner, real, fake) =>
      `This is the identity evidence. ${fake} is not ${real}; in many fonts the digit 1 and the letter l are almost identical.`,
  },
  {
    id: 'extra-word',
    applies: () => true,
    make: (slug, rng) => {
      const word = rng.pick(TRICK_WORDS)
      return { domain: `${slug}-${word}.example`, word }
    },
    label: (owner, made) =>
      `The sending domain adds the word "${made.word}" to ${possessive(owner)} real domain name, which makes it a different domain`,
    note: (owner, real, fake) =>
      `This is the identity evidence. ${fake} looks official because it contains ${possessive(owner)} name, but anyone can register a longer name. Only ${real} belongs to ${owner}.`,
  },
  {
    id: 'name-in-front',
    applies: () => true,
    make: (slug, rng) => {
      const base = `${rng.pick(FRONT_HOSTS)}.example`
      return { domain: `${slug}.${base}`, registered: base }
    },
    label: (owner, made) =>
      `The sending domain starts with ${possessive(owner)} name, but the domain it really belongs to is ${made.registered}`,
    note: (owner, real, fake) =>
      `This is the identity evidence. A domain is read from the right: ${fake} belongs to whoever owns the part after the name, not to ${owner}, whose domain is ${real}.`,
  },
]

export const TRICK_IDS = TRICKS.map((trick) => trick.id)

export function chooseTrick(slug, rng) {
  const trick = rng.pick(TRICKS.filter((candidate) => candidate.applies(slug)))
  return { trick, made: trick.make(slug, rng) }
}
