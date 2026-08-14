# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities through public Issues or Discussions.

Use GitHub's private vulnerability reporting/security advisory workflow for this repository when available:

https://github.com/oliver4441/veyra/security/advisories/new

Include enough information to reproduce the issue, affected components, potential impact, and any suggested mitigation. Do not include live credentials or secrets in reports.

## Secrets

Never commit:

- API keys
- Database credentials
- JWT signing secrets
- Cloudflare credentials
- R2 credentials
- `.env` files
- Personal access tokens

If a secret is accidentally committed, rotate/revoke it immediately. Removing the file from the latest commit is not sufficient if the secret exists in Git history.
