# Security Policy

## Project Status

Lean Bulk Tracker is a portfolio project and personal tracking PWA. It is not a medical, nutrition, or production health platform.

## Supported Versions

Security notes apply to the current `main` branch. Older commits are kept for project history and may not receive updates.

## Reporting a Vulnerability

If you find a vulnerability or a sensitive file accidentally committed to this repository, please contact the repository owner privately before opening a public issue. Include:

- affected feature or file,
- short reproduction steps or explanation,
- potential impact,
- whether any secret, credential, token, service account key, database export, or personal training data appears to be exposed.

Do not include real credentials, private keys, tokens, or personal data in public issues.

## Secret Handling

The committed `.env.e2e` file contains fake/demo Firebase values for local tests. Real production `.env` files, Firebase service account keys, private API keys, database exports, debug logs, and personal training data must stay outside Git.

If a real secret is ever committed, rotate it with the relevant provider. Removing it from the current tree is not enough because Git history may still contain the value.

## Limitations

- Recommendations are conservative learning/project logic, not professional nutrition advice.
- Local demo data is stored in the browser and should not be treated as secure storage.
- Firebase mode requires correct Auth, Firestore, and rules configuration before real use.
