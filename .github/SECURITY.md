# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a vulnerability, use GitHub's private [Security Advisory](https://github.com/NSCC-ITC-Assessment/GrillMyCode/security/advisories/new) feature. This keeps the disclosure private until a fix is available.

Include as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The affected version(s) (e.g. `@v1`, `@v1.0.2`)
- Any suggested mitigations

## Scope

This action handles sensitive values including `GITHUB_TOKEN` and third-party AI provider API keys (Ex. OpenRouter). Issues related to credential exposure, prompt injection, or unintended access to repository contents are considered in scope.

## Response

Confirmed vulnerabilities will be patched and released as a patch version on all active major lines. See [versioning.md](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/versioning) for the release process.
