export const owaspEdition = {
  year: 2025,
  reviewedAt: '19 September 2026',
  source: 'https://top10.owasp.org/2025/',
  license: 'https://creativecommons.org/licenses/by/3.0/',
}

export const owaspRisks = [
  {
    id: 'A01',
    title: 'Broken Access Control',
    summary: 'People can read or change things their account should not be allowed to access.',
    example:
      'A town library member changes a record number in a link and sees someone else’s private borrowing history.',
    prevention:
      'Check permissions on the server for every request and every record. Deny access unless it is explicitly allowed.',
    source: 'A01_2025-Broken_Access_Control',
  },
  {
    id: 'A02',
    title: 'Security Misconfiguration',
    summary: 'Unsafe settings, default accounts or unnecessary features leave a service exposed.',
    example:
      'The town noticeboard accidentally publishes its diagnostic page, revealing internal settings to every visitor.',
    prevention:
      'Use secure defaults, remove unused features and check configuration regularly. Keep detailed errors away from public pages.',
    source: 'A02_2025-Security_Misconfiguration',
  },
  {
    id: 'A03',
    title: 'Software Supply Chain Failures',
    summary:
      'A weakness in a dependency, build tool or software delivery process can compromise the finished application.',
    example:
      'A compromised package used by the town shop adds unwanted code during an otherwise routine update.',
    prevention:
      'Track dependencies and their versions, review updates and protect build credentials. Obtain components through trusted channels.',
    source: 'A03_2025-Software_Supply_Chain_Failures',
  },
  {
    id: 'A04',
    title: 'Cryptographic Failures',
    summary:
      'Sensitive information is exposed when encryption or key handling is missing, weak or used incorrectly.',
    example: 'The town clinic sends private appointment details over an unencrypted connection.',
    prevention:
      'Use HTTPS and maintained cryptographic libraries. Protect encryption keys and store passwords with a suitable password-hashing algorithm.',
    source: 'A04_2025-Cryptographic_Failures',
  },
  {
    id: 'A05',
    title: 'Injection',
    summary:
      'An application mistakes untrusted input for instructions, allowing it to change a query or run unwanted code.',
    example:
      'A fictional shop treats a search phrase as part of a database command instead of ordinary text.',
    prevention:
      'Use parameterized database queries and safe APIs. Validate inputs and escape output for its destination, such as HTML.',
    source: 'A05_2025-Injection',
  },
  {
    id: 'A06',
    title: 'Insecure Design',
    summary:
      'The plan for a feature lacks the safeguards it needs, even if the code follows that plan correctly.',
    example:
      'A ticket booth lets one visitor reserve every seat indefinitely because no reservation limit or expiry was designed.',
    prevention:
      'Consider abuse cases before building. Add security requirements, sensible limits and tests for the rules the feature depends on.',
    source: 'A06_2025-Insecure_Design',
  },
  {
    id: 'A07',
    title: 'Authentication Failures',
    summary:
      'Weak sign-in, recovery or session handling allows someone to pretend to be another user.',
    example:
      'The town club allows unlimited password guesses and keeps old sessions usable after an account is recovered.',
    prevention:
      'Use multi-factor authentication where appropriate, limit repeated attempts and protect recovery flows. Expire and revoke sessions safely.',
    source: 'A07_2025-Authentication_Failures',
  },
  {
    id: 'A08',
    title: 'Software or Data Integrity Failures',
    summary:
      'The application trusts software or data without checking whether it was changed or came from an expected source.',
    example:
      'A town kiosk installs an update without verifying its signature, so a tampered file is accepted as genuine.',
    prevention:
      'Verify signatures and integrity where needed. Treat incoming data as untrusted and avoid unsafe deserialization.',
    source: 'A08_2025-Software_or_Data_Integrity_Failures',
  },
  {
    id: 'A09',
    title: 'Security Logging and Alerting Failures',
    summary:
      'Suspicious activity goes unnoticed because important events are not recorded or alerts do not reach someone who can respond.',
    example:
      'Hundreds of failed sign-ins hit the town archive, but nobody receives an alert or has a useful record to investigate.',
    prevention:
      'Record relevant security events without secrets, protect the logs and test that alerts lead to a response.',
    source: 'A09_2025-Security_Logging_and_Alerting_Failures',
  },
  {
    id: 'A10',
    title: 'Mishandling of Exceptional Conditions',
    summary:
      'Unexpected input, failures or resource shortages leave an application in an unsafe or inconsistent state.',
    example:
      'When a permission-check service times out, a fictional office opens the restricted record instead of refusing access.',
    prevention:
      'Plan for failure, enforce resource limits and clean up partial work. Handle errors consistently and fail securely.',
    source: 'A10_2025-Mishandling_of_Exceptional_Conditions',
  },
]
