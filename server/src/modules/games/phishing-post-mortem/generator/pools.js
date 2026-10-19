// every organisation, person and domain here is fictional; hosts always end in .example

export const COMPANIES = [
  { name: 'Aurora Dynamics', short: 'Aurora', slug: 'aurora-dynamics' },
  { name: 'Harbourline Logistics', short: 'Harbourline', slug: 'harbourline-logistics' },
  { name: 'Kestrel Wealth', short: 'Kestrel', slug: 'kestrel-wealth' },
  { name: 'Meridian Health Partners', short: 'Meridian', slug: 'meridian-health' },
  { name: 'Westbrook Engineering', short: 'Westbrook', slug: 'westbrook-engineering' },
  { name: 'Tidewater Foods', short: 'Tidewater', slug: 'tidewater-foods' },
  { name: 'Summitlane Media', short: 'Summitlane', slug: 'summitlane-media' },
  { name: 'Copperfield Insurance', short: 'Copperfield', slug: 'copperfield-insurance' },
]

export const VENDORS = [
  { name: 'Northvale Supplies', slug: 'northvale-supplies', product: 'office supplies' },
  { name: 'Brightmill Print', slug: 'brightmill-print', product: 'printing' },
  { name: 'Wavecrest Couriers', slug: 'wavecrest-couriers', product: 'courier services' },
  { name: 'Palmgrove Catering', slug: 'palmgrove-catering', product: 'catering' },
  { name: 'Ironwood Office', slug: 'ironwood-office', product: 'office furniture' },
]

export const FIRST_NAMES = [
  'Kenneth',
  'Priya',
  'Wei Ling',
  'Farhan',
  'Siti',
  'Marcus',
  'Hui Min',
  'Arjun',
  'Nurul',
  'Daniel',
  'Mei',
  'Rahul',
  'Grace',
  'Jun Jie',
  'Aisha',
  'Ethan',
  'Chloe',
  'Haziq',
  'Divya',
  'Ryan',
]

export const LAST_NAMES = [
  'Lim',
  'Nair',
  'Tan',
  'Rahman',
  'Ong',
  'Menon',
  'Lee',
  'Goh',
  'Ismail',
  'Chua',
  'Pillai',
  'Ng',
  'Wong',
  'Koh',
  'Yusof',
]

export const RELAY_DOMAINS = [
  'mailbox-relay.example',
  'fastmail-forward.example',
  'inbox-hub.example',
]

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DOCUMENTS = [
  'Q4 bonus allocations',
  'Board pack - draft',
  'Salary review summary',
  'Client contract renewals',
  'Restructure proposal',
  'Year-end forecast',
]

export function pickDocument(rng) {
  return rng.pick(DOCUMENTS)
}

// ordinary work mail: each entry builds one message from the case context
export const BENIGN = [
  (c) => ({
    senderName: c.colleague(0).full,
    local: c.colleague(0).user,
    subject: `Ops standup notes - week ${c.week}`,
    bodyText:
      'Morning all. Notes from the standup are in the shared drive. Two items are still waiting on sign-off. Shout if you need anything before Thursday.',
  }),
  (c) => ({
    senderName: c.colleague(1).full,
    local: c.colleague(1).user,
    subject: 'Friday lunch order - reply by Wednesday',
    bodyText:
      'Collecting the Friday lunch order again. Reply with your choice and any allergies by Wednesday evening and I will place it in one go.',
  }),
  (c) => ({
    senderName: `${c.company.short} Facilities`,
    local: 'facilities',
    subject: 'Fire drill this Thursday at 10am',
    bodyText:
      'A fire drill will run on Thursday at 10am. Please leave by the nearest stairwell and gather at the assembly point across the road. It should take about fifteen minutes.',
  }),
  (c) => ({
    senderName: `${c.company.short} Facilities`,
    local: 'facilities',
    subject: `Canteen menu for week ${c.week + 1}`,
    bodyText:
      'Next week the canteen adds a noodle station on Tuesday and Thursday. The full menu is pinned by the lifts.',
  }),
  (c) => ({
    senderName: `${c.company.short} IT Service Desk`,
    local: 'it-servicedesk',
    subject: 'Wi-Fi maintenance on Saturday morning',
    bodyText:
      'Office Wi-Fi will be unavailable on Saturday between 7am and 9am while access points are upgraded. No action is needed.',
  }),
  (c) => ({
    senderName: `${c.company.short} IT Service Desk`,
    local: 'it-servicedesk',
    subject: 'Your work password expires in 7 days',
    bodyText:
      'Your work password expires in 7 days. Change it from your laptop lock screen with Ctrl+Alt+Del, or ask the service desk in person. We will never ask you to sign in through an email link.',
  }),
  (c) => ({
    senderName: `${c.company.short} Expenses`,
    local: 'no-reply',
    subject: `Your expense claim EX-${c.number(20000, 29999)} was approved`,
    bodyText:
      'Your expense claim has been approved and will be paid with the next payroll run. No further action is needed.',
  }),
  (c) => ({
    senderName: `${c.company.short} People Team`,
    local: 'people',
    subject: 'Team photo next Tuesday',
    bodyText:
      'The annual team photo is next Tuesday at 3pm on level 5. Wear whatever you are comfortable in. It takes ten minutes.',
  }),
  (c) => ({
    senderName: `${c.company.short} People Team`,
    local: 'people',
    subject: 'Updated travel policy takes effect 1 November',
    bodyText:
      'The updated travel policy takes effect on 1 November. The main change is that economy-plus is allowed on flights over six hours. The policy is on the intranet.',
  }),
  (c) => ({
    senderName: `${c.company.short} Security Awareness`,
    local: 'security-awareness',
    subject: 'Your annual security training is due',
    bodyText:
      'Your annual security awareness module is due by the end of the month. Open the learning portal from the intranet home page and search for Security Basics.',
  }),
  (c) => ({
    senderName: c.colleague(2).full,
    local: c.colleague(2).user,
    subject: 'Moving our Thursday catch-up to 3pm',
    bodyText:
      'Something came up on Thursday morning. Can we move our catch-up to 3pm? Same room. Let me know if that clashes.',
  }),
  (c) => ({
    senderName: c.colleague(3).full,
    local: c.colleague(3).user,
    subject: 'Client deck - comments by Friday please',
    bodyText:
      'I have put the client deck in the team folder. Could you add comments on the pricing slides by Friday? No rush before then.',
  }),
  (c) => ({
    senderName: `${c.company.short} Communications`,
    local: 'comms',
    subject: 'Quarterly town hall - save the date',
    bodyText:
      'The quarterly town hall is on the last Thursday of the month at 4pm in the main auditorium, with a livestream for remote colleagues. Questions can be sent in advance.',
  }),
  (c) => ({
    senderName: `${c.company.short} Facilities`,
    local: 'facilities',
    subject: 'Carpark allocations for next quarter',
    bodyText:
      'Carpark allocations for next quarter have been sent to approved applicants. If you applied and have not heard back, please visit the facilities counter on level 2.',
  }),
  (c) => ({
    senderName: c.colleague(1).full,
    local: c.colleague(1).user,
    subject: 'Cake in the pantry',
    bodyText: `It is ${c.colleague(2).first}'s birthday tomorrow. Cake in the level 4 pantry at 3pm.`,
  }),
  (c) => ({
    senderName: `${c.company.short} IT Service Desk`,
    local: 'it-servicedesk',
    subject: 'Level 4 printer replaced',
    bodyText:
      'The level 4 printer has been replaced. It should appear automatically on your laptop within a day. If it does not, restart once before raising a ticket.',
  }),
  (c) => ({
    senderName: `${c.company.short} People Team`,
    local: 'no-reply',
    subject: 'Your leave request was approved',
    bodyText:
      'Your leave request has been approved by your manager. The dates now show in the team calendar.',
  }),
  (c) => ({
    senderName: c.vendorContact.full,
    local: c.vendorContact.user,
    vendor: true,
    subject: 'Quarterly statement for your records',
    bodyText: `Hi, attached for your records is the quarterly statement for ${c.vendor.product}. Nothing is outstanding. Thanks as always.`,
  }),
  (c) => ({
    senderName: c.vendorContact.full,
    local: c.vendorContact.user,
    vendor: true,
    subject: 'Notes from our call this morning',
    bodyText:
      'Thanks for the call this morning. As agreed, the next delivery slot moves to Wednesday. I will confirm once the schedule is locked.',
  }),
  (c) => ({
    senderName: `${c.company.short} Facilities`,
    local: 'facilities',
    subject: 'Desk moves this weekend',
    bodyText:
      'The analytics team moves to level 6 this weekend. Please clear personal items from desks on level 3 by Friday at 5pm.',
  }),
  (c) => ({
    senderName: `${c.company.short} Communications`,
    local: 'comms',
    subject: 'This month in brief',
    bodyText:
      'This month: a new client win in the north region, the volunteer day results and a reminder about the photo competition. Read it on the intranet when you have a moment.',
  }),
  (c) => ({
    senderName: c.colleague(2).full,
    local: c.colleague(2).user,
    subject: 'Re: project timeline',
    bodyText:
      'Updated the timeline with the vendor dates. Testing now starts a week later, but the launch date does not move.',
  }),
  (c) => ({
    senderName: c.colleague(3).full,
    local: c.colleague(3).user,
    subject: 'Can you cover the 11am call?',
    bodyText:
      'I am stuck at the dentist until noon. Could you cover the 11am supplier call? The agenda is in the invite.',
  }),
  (c) => ({
    senderName: `${c.company.short} People Team`,
    local: 'people',
    subject: 'Pulse survey closes Friday',
    bodyText:
      'The quarterly pulse survey closes on Friday. It is anonymous and takes five minutes. Find it on the intranet home page.',
  }),
]

// real phishing that did not cause this incident; host never contains the company name
export const LURES = [
  {
    senderName: 'Rewards Centre',
    host: 'prize-claim-now.example',
    local: 'rewards',
    subject: 'Congratulations! Your colleague reward is waiting',
    bodyText:
      'You have been selected for an employee appreciation gift card worth 500 dollars. Claim within 24 hours or the reward passes to another employee.',
    label: 'Claim your reward now',
    path: '/claim',
    kind: 'reward scam',
  },
  {
    senderName: 'City Parking Office',
    host: 'city-parking-fines.example',
    local: 'notice',
    subject: 'Outstanding parking charge - final notice',
    bodyText:
      'An unpaid parking charge is registered to your vehicle. Pay today to avoid an additional penalty and possible towing.',
    label: 'Pay the charge now',
    path: '/fine',
    kind: 'parking fine phish',
  },
  {
    senderName: 'Mail Administrator',
    host: 'mail-quota-support.example',
    local: 'admin',
    subject: 'Urgent: your mailbox quota is full',
    bodyText:
      'Your mailbox has reached its storage limit and incoming messages are being held. Restore delivery now to avoid losing mail.',
    label: 'Restore mailbox delivery',
    path: '/quota/verify',
    kind: 'mailbox quota phish',
  },
  {
    senderName: 'Benefits Enrolment',
    host: 'hr-benefits-portal.example',
    local: 'benefits',
    subject: 'Benefits enrolment closes tonight',
    bodyText:
      'This is the final reminder that benefits enrolment closes tonight. Confirm your selection or you will be enrolled in the default plan.',
    label: 'Confirm your benefits selection',
    path: '/enrol/confirm',
    kind: 'benefits enrolment phish',
  },
  {
    senderName: 'Parcel Redelivery',
    host: 'parcel-redelivery.example',
    local: 'tracking',
    subject: 'We missed you - schedule your redelivery',
    bodyText:
      'A parcel addressed to you could not be delivered. Schedule a new delivery slot within 48 hours or it will be returned to the sender.',
    label: 'Choose a delivery slot',
    path: '/redeliver',
    kind: 'parcel delivery phish',
  },
  {
    senderName: 'Voice Message Centre',
    host: 'voice-message-centre.example',
    local: 'voicemail',
    subject: 'You have 1 new voice message (0:47)',
    bodyText:
      'A caller left you a 47 second voice message. Listen to it online within 24 hours before it is deleted.',
    label: 'Play voice message',
    path: '/listen',
    kind: 'voicemail phish',
  },
  {
    senderName: 'Staff Survey Rewards',
    host: 'staff-survey-rewards.example',
    local: 'survey',
    subject: 'Complete a 2 minute survey for a 50 dollar voucher',
    bodyText:
      'Your feedback matters. Complete our two minute staff survey today and receive a 50 dollar shopping voucher straight away.',
    label: 'Start the survey',
    path: '/survey',
    kind: 'survey voucher scam',
  },
]

export const TRICK_WORDS = ['secure', 'support', 'portal', 'verify', 'online']
export const FRONT_HOSTS = ['login-gateway', 'account-check', 'sso-portal']
