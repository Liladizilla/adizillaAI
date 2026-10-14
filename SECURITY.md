# Security Policy

## Supported deployment

The primary public service is https://adizillaai.vercel.app. Security reports should identify the affected deployment, endpoint or feature, and the steps needed to reproduce the issue without accessing other users' data.

## Reporting a vulnerability

Please do not publish exploit details, credentials, personal data, or an unpatched vulnerability in a public issue.

Use GitHub's **Report a vulnerability** feature in this repository's Security tab when private vulnerability reporting is available. If that option is not available, contact the repository maintainer privately through their verified GitHub account and ask for a private reporting channel. Do not include secrets or real user data in the initial report.

Include:
- A concise impact statement and affected component.
- Reproduction steps using your own test account and non-sensitive test data.
- Any relevant request IDs and approximate UTC timestamps, with authorization headers, cookies, tokens, and personal data removed.

## Scope and response

Authentication bypass, cross-account data access, exposed secrets, injection, unsafe file handling, and bypasses of usage or payment controls are in scope. Denial-of-service testing, social engineering, physical attacks, and access to other users' data are not authorized.

Please allow time to investigate and prepare a fix before public disclosure. Do not assume a report has been received until the maintainer acknowledges it. No bounty or response-time guarantee is currently offered.

## User data and incident handling

Do not send production user content in a report. If an incident may have exposed personal data, the maintainer should preserve relevant logs securely, contain the incident, assess affected data subjects and legal notification duties, and document remediation.
