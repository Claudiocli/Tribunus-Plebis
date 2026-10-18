# Security

Did you find a vulnerability or a privacy problem on this site?

**Do not open a public issue.** Use GitHub's private reporting: the **Security → Report a vulnerability** tab of this repository.

## Scope

The site is static: no server, no database, no accounts, no forms, no cookies and no personal data collected. The only published files are HTML pages, CSS, JavaScript, translations and data (news and statistics with sources).

The main defences, checked automatically by `scripts/check.mjs` on every deployment:

- A strict Content-Security-Policy on every page: scripts and styles only from the site's own domain, no requests to third parties, no `unsafe-inline` or `unsafe-eval`, Trusted Types required.
- External text is inserted only with `textContent`, never with `innerHTML`; external links are `https` only, with `rel="noopener noreferrer nofollow"`.
- Pages refuse to be displayed when framed by another site.
- Deployment with GitHub Actions pinned to the exact commit and minimal permissions.
