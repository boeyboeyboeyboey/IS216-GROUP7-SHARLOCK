// private answer data: only the alert reaches the browser before the debrief
// addresses use the rfc 5737 documentation ranges and internal 10.x lab space; names are fictional

export const TOPICS = {
  'firewall-blocking': 'Firewall blocking',
  'account-security': 'Account security',
  'incident-containment': 'Incident containment',
}

export const SCENARIOS = [
  {
    id: 'ssh-brute-force',
    topic: 'firewall-blocking',
    alert: {
      title: 'Repeated SSH login failures',
      severity: 'high',
      source: 'Firewall log',
      lines: [
        'src 203.0.113.45 -> dst lab-gw (10.20.0.1) port 22',
        '412 failed logins in 90 seconds, usernames rotating',
        'no successful sign-in recorded',
      ],
    },
    expected: { verb: 'block-ip', target: '203.0.113.45' },
    explanation:
      'A single outside address is guessing passwords and nothing has been compromised yet. Blocking that source stops the attack; lab-gw is the victim, not the attacker.',
  },
  {
    id: 'web-scanner',
    topic: 'firewall-blocking',
    alert: {
      title: 'Automated vulnerability scan',
      severity: 'medium',
      source: 'Web gateway',
      lines: [
        'src 198.51.100.23 -> portal-web (10.20.0.15)',
        '900 requests/min for /admin, /.env, /backup.zip',
        'all requests returned 404 or 403',
      ],
    },
    expected: { verb: 'block-ip', target: '198.51.100.23' },
    explanation:
      'The probing comes from one external scanner and found nothing. Block the scanner; isolating portal-web would take the healthy site offline.',
  },
  {
    id: 'password-spray',
    topic: 'firewall-blocking',
    alert: {
      title: 'Password spraying across accounts',
      severity: 'high',
      source: 'Identity provider',
      lines: [
        'src 203.0.113.77 tried "Spring2026!" against 140 accounts',
        'accounts include trainee-03, ops-lee, finance-ana',
        '0 successful sign-ins',
      ],
    },
    expected: { verb: 'block-ip', target: '203.0.113.77' },
    explanation:
      'No account was breached, so disabling users would only lock out staff. The single source address is what needs blocking.',
  },
  {
    id: 'sqli-probe',
    topic: 'firewall-blocking',
    alert: {
      title: 'SQL injection attempts blocked by WAF',
      severity: 'medium',
      source: 'Web application firewall',
      lines: [
        "src 198.51.100.140 -> shop-api: ?id=1' OR '1'='1",
        '37 payload variations in 2 minutes',
        'database returned no rows; no data left the server',
      ],
    },
    expected: { verb: 'block-ip', target: '198.51.100.140' },
    explanation:
      'The attacker is still probing from one address and has not succeeded. Blocking it buys time to confirm shop-api uses parameterized queries.',
  },
  {
    id: 'port-scan',
    topic: 'firewall-blocking',
    alert: {
      title: 'Port sweep from the internet',
      severity: 'low',
      source: 'Firewall log',
      lines: [
        'src 192.0.2.66 swept ports 1-1024 on 10.20.0.0/24',
        'open ports found: 22 on lab-gw, 443 on portal-web',
        'no exploit traffic observed',
      ],
    },
    expected: { verb: 'block-ip', target: '192.0.2.66' },
    explanation:
      'Reconnaissance from one external address is the earliest point to stop an attack. The internal hosts listed are targets, not threats.',
  },
  {
    id: 'smtp-relay-abuse',
    topic: 'firewall-blocking',
    alert: {
      title: 'Open-relay abuse attempt',
      severity: 'medium',
      source: 'Mail gateway',
      lines: [
        'src 203.0.113.150 -> mail-gw (10.20.0.25) port 25',
        '600 relay attempts to outside recipients, all rejected',
        'sender addresses forged as payroll@corp.example',
      ],
    },
    expected: { verb: 'block-ip', target: '203.0.113.150' },
    explanation:
      'A spammer is trying to use the mail gateway as a relay. The forged sender is not a real account to disable; block the source address.',
  },
  {
    id: 'impossible-travel',
    topic: 'account-security',
    alert: {
      title: 'Impossible travel sign-in',
      severity: 'high',
      source: 'Identity provider',
      lines: [
        'user trainee-03 signed in from 203.0.113.9 (Singapore)',
        'then from 198.51.100.61 (another continent) 4 minutes later',
        'MFA reset requested from the second session',
      ],
    },
    expected: { verb: 'disable-user', target: 'trainee-03' },
    explanation:
      'The account itself is compromised and is being used from changing addresses. Disabling trainee-03 stops every session; blocking one IP would not.',
  },
  {
    id: 'credential-stuffing-success',
    topic: 'account-security',
    alert: {
      title: 'Successful sign-in after credential stuffing',
      severity: 'critical',
      source: 'Identity provider',
      lines: [
        '30 failed logins for ops-lee from 40 rotating addresses',
        'sign-in succeeded from 198.51.100.200',
        'new API token created by ops-lee',
      ],
    },
    expected: { verb: 'disable-user', target: 'ops-lee' },
    explanation:
      'The attacker already has a working password and rotates addresses. Disable the account to cut off its sessions and new token.',
  },
  {
    id: 'mail-forwarding-rule',
    topic: 'account-security',
    alert: {
      title: 'Suspicious mailbox forwarding rule',
      severity: 'high',
      source: 'Mail audit',
      lines: [
        'user finance-ana created rule: forward all mail to drop@mailbox.example',
        'rule created from an unrecognised device',
        'finance-ana is on leave this week',
      ],
    },
    expected: { verb: 'disable-user', target: 'finance-ana' },
    explanation:
      'A hidden forwarding rule from an unknown device means someone controls the mailbox. Disable finance-ana before more mail leaks.',
  },
  {
    id: 'dormant-admin',
    topic: 'account-security',
    alert: {
      title: 'Dormant account gained admin rights',
      severity: 'critical',
      source: 'Directory audit',
      lines: [
        'service account svc-backup unused for 200 days',
        'svc-backup added itself to the Domain Admins group',
        'change made from host lab-02',
      ],
    },
    expected: { verb: 'disable-user', target: 'svc-backup' },
    explanation:
      'A forgotten account escalating its own privileges is a classic takeover sign. Disable svc-backup first, then investigate lab-02.',
  },
  {
    id: 'password-posted',
    topic: 'account-security',
    alert: {
      title: 'Password shared in a public channel',
      severity: 'high',
      source: 'Data loss prevention',
      lines: [
        "user intern-02's password posted in #general-chat",
        'sign-in for intern-02 from an unknown device 5 minutes later',
        'channel has 300 members including contractors',
      ],
    },
    expected: { verb: 'disable-user', target: 'intern-02' },
    explanation:
      'The credential is exposed and already being used. Disable intern-02 until the password is reset; there is no single address to block.',
  },
  {
    id: 'c2-beacon',
    topic: 'incident-containment',
    alert: {
      title: 'Command-and-control beaconing',
      severity: 'critical',
      source: 'Endpoint detection',
      lines: [
        'host lab-02 contacts 203.0.113.200 every 60 seconds',
        '203.0.113.200 is on the threat-intel C2 list',
        'unsigned process updater.exe started at boot',
      ],
    },
    expected: { verb: 'isolate-host', target: 'lab-02' },
    explanation:
      'Malware is running on lab-02. Blocking one C2 address leaves the infection active and able to switch servers; isolate the host.',
  },
  {
    id: 'ransomware-encryption',
    topic: 'incident-containment',
    alert: {
      title: 'Mass file encryption',
      severity: 'critical',
      source: 'Endpoint detection',
      lines: [
        'host hr-pc-07 renamed 2,300 files to *.locked in 3 minutes',
        'ransom note README_RESTORE.txt written to shares',
        'logged-in user: trainee-03',
      ],
    },
    expected: { verb: 'isolate-host', target: 'hr-pc-07' },
    explanation:
      'Ransomware spreads to network shares within minutes. Isolate hr-pc-07 to stop encryption; the user is a victim, not the cause.',
  },
  {
    id: 'lateral-movement',
    topic: 'incident-containment',
    alert: {
      title: 'Internal SMB sweep',
      severity: 'high',
      source: 'Network sensor',
      lines: [
        'host kiosk-04 attempted SMB logins on 30 internal hosts',
        'kiosk-04 normally only talks to print-srv',
        'attempts use the local admin account',
      ],
    },
    expected: { verb: 'isolate-host', target: 'kiosk-04' },
    explanation:
      'A compromised kiosk is trying to move sideways inside the network. Isolating kiosk-04 contains it before it reaches other machines.',
  },
  {
    id: 'cryptominer',
    topic: 'incident-containment',
    alert: {
      title: 'Cryptocurrency miner detected',
      severity: 'medium',
      source: 'Endpoint detection',
      lines: [
        'host build-runner-1 at 100% CPU for 6 hours',
        'outbound stratum traffic to 198.51.100.210:3333',
        'miner binary dropped by a modified build script',
      ],
    },
    expected: { verb: 'isolate-host', target: 'build-runner-1' },
    explanation:
      'The miner lives on build-runner-1 and could pivot further. Isolate the host; blocking the pool address leaves the tampered build script in place.',
  },
  {
    id: 'usb-autorun',
    topic: 'incident-containment',
    alert: {
      title: 'Malware from a USB drive',
      severity: 'high',
      source: 'Antivirus',
      lines: [
        'host reception-pc ran autorun.exe from a USB drive',
        'quarantine failed: file in use',
        'reception-pc shares a network with the visitor kiosk',
      ],
    },
    expected: { verb: 'isolate-host', target: 'reception-pc' },
    explanation:
      'Quarantine failed, so the malware is still running. Isolate reception-pc until it can be cleaned or reimaged.',
  },
]
