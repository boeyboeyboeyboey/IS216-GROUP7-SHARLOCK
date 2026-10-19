// each template is one attack story; the generator supplies names, domains and times
// and the template returns patient zero, genuine look-alike mail and what the logs recorded

const CLICK_THEN_CREDENTIALS = {
  id: 'ev-click-then-credentials',
  label:
    "The proxy recorded that message's destination host being opened, and a credential submission to the same host one minute later",
  note: 'This is the causal evidence. Suspicion alone does not prove a compromise; the proxy click followed one minute later by a credential submission to the same host is what ties this message to the stolen password.',
}

function standardTakeover(c, t, { ruleLabel, ruleDetail, impactLabel, impactDetail, impactLine }) {
  const credential = c.after(t.click, 1)
  const signIn = c.after(credential, c.number(540, 720))
  const rule = c.after(signIn, c.number(15, 35))
  // the follow-up lands the next working morning, after the overnight sign-in and rule
  const impact = c.at(1, c.number(540, 630))
  return {
    signIn,
    causal: CLICK_THEN_CREDENTIALS,
    events: [
      {
        at: t.click,
        label: 'Web proxy - link opened',
        detail: `${c.victim.user} opened ${t.host}${t.path}.`,
      },
      {
        at: credential,
        label: 'Data loss prevention - credential pattern',
        detail: `A credential-shaped form submission left ${c.victim.user}'s workstation for ${t.host}.`,
      },
      {
        at: signIn,
        label: 'Identity provider - successful sign-in',
        detail: `Single sign-on succeeded for ${c.victim.user} from an unfamiliar network and an unrecognised device.`,
      },
      { at: rule, label: ruleLabel, detail: ruleDetail },
      { at: impact, label: impactLabel, detail: impactDetail },
    ],
    chain: [
      `${c.time(t.click)} - the proxy records ${c.victim.user} opening that exact destination host, ${t.delay} minutes after delivery.`,
      `${c.time(credential)} - data loss prevention sees a credential-shaped submission from ${c.victim.user}'s workstation to the same host. The password is now in the attacker's hands.`,
      `${c.time(signIn)} - single sign-on succeeds for ${c.victim.user} from an unfamiliar network and device.`,
      `${c.time(rule)} - ${ruleDetail.charAt(0).toLowerCase()}${ruleDetail.slice(1)}`,
      `${c.time(impact)} - ${impactLine}`,
    ],
  }
}

const HIDDEN_RULE = (c) => ({
  ruleLabel: 'Mailbox - hidden rule created',
  ruleDetail: `A rule was added to ${c.victim.user}'s mailbox forwarding any message containing the word invoice to an external address, then marking it read.`,
})

export const TEMPLATES = [
  {
    id: 'sso-reverify',
    title: (c) => `The ${c.company.name} payroll incident`,
    impact: 'added a hidden mailbox rule and tried to redirect a payroll run',
    handedBy: 'Finance',
    description: 're-verification request that appears to come from the IT service desk',
    impersonate: (c) => ({
      owner: c.company.name,
      slug: c.company.slug,
      senderName: `${c.company.short} IT Service Desk`,
      local: 'it-servicedesk',
    }),
    message: (c) => ({
      subject: 'Action required: re-verify your SSO access today',
      bodyText:
        'Our directory migration finishes this evening. Accounts that have not been re-verified will lose single sign-on access tomorrow morning, including payroll and expenses. Re-verify with your usual work password using the secure link below. This takes under a minute.',
      label: `https://sso.${c.realDomain}/reverify`,
      path: `/verify?u=${c.victim.user}`,
    }),
    companions: () => [
      {
        subject: 'Scheduled maintenance for the HR system this weekend',
        bodyText:
          'The HR system will be offline on Sunday between 8am and noon for planned maintenance. No action is needed from you.',
      },
    ],
    attack: (c, t) =>
      standardTakeover(c, t, {
        ...HIDDEN_RULE(c),
        impactLabel: 'Payroll - bank change submitted',
        impactDetail: `A payroll bank detail change was submitted from ${c.victim.user}'s account and held by the approval queue.`,
        impactLine:
          'a payroll bank detail change is submitted from the account and caught by the approval queue.',
      }),
  },
  {
    id: 'vendor-invoice',
    title: (c) => `The ${c.company.name} invoice fraud`,
    impact: 'used the account to request a payment to a new bank account',
    handedBy: 'Accounts payable',
    description: 'invoice notification that appears to come from a regular supplier',
    impersonate: (c) => ({
      owner: c.vendor.name,
      slug: c.vendor.slug,
      senderName: `${c.vendor.name} Accounts`,
      local: 'accounts',
    }),
    message: (c) => ({
      subject: `Invoice ${c.invoice} is ready to view`,
      bodyText: `Your invoice ${c.invoice} for ${c.vendor.product} is ready. Payment is due today to avoid a late fee. Sign in with your work account to view and download it from our customer portal.`,
      label: `https://portal.${c.vendorDomain}/invoices/${c.invoice}`,
      path: `/invoices/view?ref=${c.invoice}`,
    }),
    companions: (c) => [
      {
        subject: `Invoice ${c.previousInvoice} paid - thank you`,
        bodyText:
          'Thank you, payment for last month has been received in full. Our bank details have not changed. Call your account manager if anything looks different.',
      },
    ],
    attack: (c, t) =>
      standardTakeover(c, t, {
        ...HIDDEN_RULE(c),
        impactLabel: 'Mailbox - payment request sent',
        impactDetail: `A message from ${c.victim.user}'s mailbox asked finance to pay invoice ${c.invoice} to a new bank account; finance held it for a call-back check.`,
        impactLine: `a message from the account asks finance to pay invoice ${c.invoice} to a new bank account, and finance holds it for a call-back check.`,
      }),
  },
  {
    id: 'shared-file',
    title: (c) => `The ${c.company.name} file leak`,
    impact: 'downloaded a large batch of confidential shared files',
    handedBy: 'Legal',
    description: 'file-sharing notification that appears to come from the company file service',
    impersonate: (c) => ({
      owner: c.company.name,
      slug: c.company.slug,
      senderName: `${c.company.short} File Share`,
      local: 'files-noreply',
    }),
    message: (c) => ({
      subject: `${c.colleague(0).full} shared "${c.document}" with you`,
      bodyText: `${c.colleague(0).full} shared a file with you: ${c.document}. The link expires today. Sign in with your work account to open it.`,
      label: `https://files.${c.realDomain}/d/${c.fileCode}`,
      path: `/d/${c.fileCode}`,
    }),
    companions: (c) => [
      {
        subject: `${c.colleague(2).full} shared "Team rota - next month" with you`,
        bodyText: `${c.colleague(2).full} shared a file with you: Team rota - next month. Open it from the Files app on your laptop.`,
      },
    ],
    attack: (c, t) =>
      standardTakeover(c, t, {
        ruleLabel: 'File share - bulk download',
        ruleDetail: `${c.number(180, 460)} files were downloaded from shared folders using ${c.victim.user}'s account in under ten minutes.`,
        impactLabel: 'Data loss prevention - unusual transfer',
        impactDetail: `An unusual volume of confidential documents left the file service for an unfamiliar network under ${c.victim.user}'s account.`,
        impactLine:
          'data loss prevention flags an unusual volume of confidential documents leaving for the same unfamiliar network.',
      }),
  },
  {
    id: 'hr-payslip',
    title: (c) => `The ${c.company.name} salary diversion`,
    impact: "changed the victim's salary bank account before the next payroll run",
    handedBy: 'The People team',
    description: 'payslip notice that appears to come from the People team',
    impersonate: (c) => ({
      owner: c.company.name,
      slug: c.company.slug,
      senderName: `${c.company.short} People Team`,
      local: 'people',
    }),
    message: (c) => ({
      subject: `Your ${c.month} payslip is ready - confirm your details`,
      bodyText: `Your ${c.month} payslip is ready. Because of a payroll system upgrade, confirm your sign-in details today so that your salary is not delayed.`,
      label: `https://hr.${c.realDomain}/payslips`,
      path: '/payslips/confirm',
    }),
    companions: () => [
      {
        subject: 'Reminder: update your emergency contact',
        bodyText:
          'Please check that your emergency contact is up to date. You can update it in the HR system from the intranet home page.',
      },
    ],
    attack: (c, t) =>
      standardTakeover(c, t, {
        ruleLabel: 'HR system - bank details changed',
        ruleDetail: `The salary bank account on ${c.victim.user}'s HR profile was changed to an account at a different bank.`,
        impactLabel: 'Mailbox - hidden rule created',
        impactDetail: `A rule was added to ${c.victim.user}'s mailbox deleting any message from the People team, so the change confirmation never arrived.`,
        impactLine:
          'a mailbox rule silently deletes messages from the People team, hiding the change confirmation.',
      }),
  },
  {
    id: 'mfa-alert',
    title: (c) => `The ${c.company.name} account takeover`,
    impact: 'registered their own sign-in device on the account',
    handedBy: 'The security team',
    description: 'security alert that appears to come from the company security team',
    impersonate: (c) => ({
      owner: c.company.name,
      slug: c.company.slug,
      senderName: `${c.company.short} Security`,
      local: 'security',
    }),
    message: (c) => ({
      subject: 'Unusual sign-in to your account - secure it now',
      bodyText:
        'We blocked an unusual sign-in to your account from overseas. Secure your account now: confirm your password and approve the prompt on your phone. If you do nothing, your account will be locked today.',
      label: `https://security.${c.realDomain}/secure`,
      path: '/secure-account',
    }),
    companions: () => [
      {
        subject: 'Phishing simulation results for last quarter',
        bodyText:
          "Thank you to everyone who reported last quarter's practice phishing emails. Report anything suspicious with the Report button. We never ask for your password or an MFA approval by email.",
      },
    ],
    attack: (c, t) => {
      const credential = c.after(t.click, 1)
      const approval = c.after(credential, 1)
      const signIn = c.after(approval, 1)
      const device = c.after(signIn, c.number(6, 12))
      const rule = c.after(device, c.number(15, 30))
      return {
        signIn,
        causal: {
          id: 'ev-click-then-mfa',
          label:
            "The proxy recorded that message's destination host being opened, followed within minutes by an MFA approval and a sign-in from an unfamiliar network",
          note: 'This is the causal evidence. The fake page passed the password and the MFA approval straight to the attacker, which is why the unfamiliar sign-in follows the click by only a few minutes.',
        },
        events: [
          {
            at: t.click,
            label: 'Web proxy - link opened',
            detail: `${c.victim.user} opened ${t.host}${t.path}.`,
          },
          {
            at: credential,
            label: 'Data loss prevention - credential pattern',
            detail: `A credential-shaped form submission left ${c.victim.user}'s workstation for ${t.host}.`,
          },
          {
            at: approval,
            label: 'Identity provider - MFA prompt approved',
            detail: `An MFA prompt was approved on ${c.victim.user}'s phone.`,
          },
          {
            at: signIn,
            label: 'Identity provider - successful sign-in',
            detail: `Single sign-on succeeded for ${c.victim.user} from an unfamiliar network and an unrecognised device.`,
          },
          {
            at: device,
            label: 'Identity provider - new MFA device registered',
            detail: `A second authenticator device was registered on ${c.victim.user}'s account.`,
          },
          {
            at: rule,
            label: 'Mailbox - hidden rule created',
            detail: `A rule was added to ${c.victim.user}'s mailbox moving security alerts to the deleted items folder.`,
          },
        ],
        chain: [
          `${c.time(t.click)} - the proxy records ${c.victim.user} opening that exact destination host, ${t.delay} minutes after delivery.`,
          `${c.time(credential)} - a credential-shaped submission goes to the same host, and one minute later an MFA prompt is approved on ${c.victim.user}'s phone. The fake page relayed both to the attacker.`,
          `${c.time(signIn)} - single sign-on succeeds from an unfamiliar network, only minutes after the click.`,
          `${c.time(device)} - the attacker registers their own authenticator, so a password reset alone would no longer lock them out.`,
          `${c.time(rule)} - a mailbox rule moves security alerts to deleted items to keep the takeover quiet.`,
        ],
      }
    },
  },
]

export const TEMPLATE_IDS = TEMPLATES.map((template) => template.id)
