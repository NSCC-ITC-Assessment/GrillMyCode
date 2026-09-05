---
sidebar_label: Release Notes
sidebar_position: 99
toc_max_heading_level: 2
---

# Release Notes
## v1.1.0 — 2026-09-05

### What's Changed

### Features

- generate LMS quiz packages for any Common Cartridge LMS

### Documentation

- record LMS quiz generation known issues
- document LMS quiz workflow behaviour for instructors
- update v1 snapshot

### Chores & Maintenance

- update packageManager version to pnpm@11.25.0 in package.json

## v1.0.24 — 2026-09-01

### What's Changed

### Bug Fixes

- add .classroom50.yaml to always exclude list
- update dependency audit command to ignore unfixable issues
- update Tencent Hy3 model reference in documentation and code

### Documentation

- update Google Gemini model version to 3.5 in code and documentation
- update v1 snapshot

### Chores & Maintenance

- update deps

## v1.0.23 — 2026-08-31

### What's Changed

### Bug Fixes

- improve pre-push hook to allow tag pushes on main branch
- point footer Classroom 50 link to renamed guide slug

### Documentation

- update v1 snapshot

### Chores & Maintenance

- refresh gitignore templates
- updated dependencies via pnpm
- updated dependencies via pnpm

## v1.0.22 — 2026-07-23

### What's Changed

### Features

- implement code stripping for leak checks and enhance question redaction logic

### Bug Fixes

- include pnpm-workspace.yaml in Dockerfile for dependency installation
- update vite version to avoid vulnerabilities in vitest dependencies
- update link for Classroom 50 guides to point to GitHub Classroom

### Documentation

- update v1 snapshot

### Refactoring

- update documentation and code references from GitHub Classroom to Classroom 50

### Chores & Maintenance

- update package overrides in pnpm-workspace.yaml for compatibility and security
- update package manager version to pnpm@11.7.0
- update .gitignore
- remove settings.local.json from tracking

## v1.0.21 — 2026-06-12

### What's Changed

### Documentation

- update description for Flexible Delivery feature in HomepageFeatures
- format instructor context for better readability in workflow documentation
- enhance instructor context for assignments in workflow documentation
- add warning to concurrency setting in workflow documentation
- update v1 snapshot

### Refactoring

- update package manager version to pnpm@11.6.0
- clarify question generation instructions in prompt builder
- update terminology from "Incorrect Options for Quiz" to "Distractors for Multiple-Choice Quiz"
- update paths-ignore to include LICENSE in branch and staging build workflows
- update package manager version to pnpm@11.5.3
- handle AI provider error responses with retry logic
- update package manager version to pnpm@11.5.2
- enhance guidelines for short-answer question justification and symmetry
- enhance length and elaboration guidelines for answer options in question formatting
- enhance guidelines for correct answer and distractor length in question options
- add justification symmetry rule for answer options in question constraints
- clarify length requirements in question formatting

### Chores & Maintenance

- add BSD 3-Clause License and update license in package.json

## v1.0.20 — 2026-06-04

### What's Changed

### Features

- add concurrency settings to workflows and update FAQ for clarity

### Documentation

- clarify issue body update process in FAQ
- add troubleshooting section for OpenRouter configuration errors in FAQ
- update v1 snapshot

## v1.0.19 — 2026-06-03

### What's Changed

### Features

- enhance stack detection to support Grails by adding detection for grails-app directory
- enhance stack detection to support Elixir by adding mix.exs dependency scans
- enhance stack detection to support Ruby by adding Gemfile dependency scans
- enhance stack detection to support additional signals and improve PHP framework identification

### Bug Fixes

- update exclude patterns to include Python tool caches not covered by the bundled template

### Documentation

- update v1 snapshot

## v1.0.18 — 2026-06-03

### What's Changed

### Bug Fixes

- update link to example workflows in getting started documentation
- update issue mutation for issue updates

### Documentation

- update v1 snapshot

### Refactoring

- update pre-push hook to improve main branch protection and add docs-site build verification; update example workflows link in docs
- update workflow triggers to use workflow_dispatch and improve formatting in documentation
- rework workflow triggers to use push events instead of pull requests; update documentation and code comments accordingly

### Chores & Maintenance

- remove obsolete push-to-branch workflow documentation

## v1.0.17 — 2026-06-03

### What's Changed

### Features

- update GitHub API version to 2026-03-10
- bold question lines in assessment output

### Bug Fixes

- improve regex for identifying question block headers in normaliseSeparators
- protect fenced code blocks in answer stripping to prevent corruption of question output
- add normaliseSeparators to ensure thematic breaks between question blocks

### Documentation

- internal
- update v1 snapshot

### Refactoring

- remove references to .assessment folder

## v1.0.16 — 2026-06-02

### What's Changed

### Features

- update workflows to ignore changes in docs directory

## v1.0.15 — 2026-06-02

### What's Changed

### Features

- enhance student login resolution and skip committers handling
- implement untrusted input boundary for student submissions

### Bug Fixes

- rename context parameter clarity

### Documentation

- enhance security notes for assignment context and inputs
- update v1 snapshot

## v1.0.14 — 2026-06-02

### What's Changed

### Bug Fixes

- clarify wording in StepFileOptions component regarding code comments
- clarify wording in the StepFileOptions component description

### Documentation

- update v1 snapshot

### Refactoring

- add FAQ entry about missing questions in student reports and clarify answer container requirements
- add sanitising renderer for PDF generation

### Chores & Maintenance

- update packageManager version to pnpm@11.5.1
- update packageManager version to pnpm@11.5.1

### Other

- enhance question formatting by splitting bold markers around inline code
- make question text bold for easier reading

## v1.0.13 — 2026-06-02

### What's Changed

### Documentation

- update v1 snapshot

### Refactoring

- rename `additional context` label to `instructor context` for clarity
- rename `additional_context` to `instructor_context` across the codebase

## v1.0.12 — 2026-06-02

### What's Changed

### Features

- enhance stripAnswers function to improve answer stripping logic for quiz generation
- add studentLogin parameter to run function for enhanced context handling
- add safeFilePart function for filesystem-safe string handling and update PDF filename generation

### Documentation

- add timeout-minutes to generate-questions job in workflow examples
- fixed broken links in AI Providers category
- update v1 snapshot

### Refactoring

- update PDF filename generation to include a prefix for better identification

## v1.0.11 — 2026-06-02

### What's Changed

### Features

- add functionality to pin newly created gmc issues

### Bug Fixes

- update pnpm-workspace.yaml to use allowBuilds for puppeteer and clarify comments
- rename pnpm.yaml to pnpm-workspace.yaml and update paths in workflows
- add pnpm.yaml to workflow ignore lists for branch and staging builds
- adjust PDF margin settings for improved layout and add logging for issue body length
- update GitHub issue body limit to 65,000 characters
- enhance PDF asset upload to handle concurrent uploads and retry on conflict
- improve PDF generation logging and handle issue body length limit
- add PDF options for margin, background printing, and header/footer templates
- enhance PDF download link with a badge for better visibility
- add source repository information to PDF report generation
- add token parameter for secure PDF asset upload and improve upload method
- enhance PDF generation and upload logging for better debugging
- improve PDF asset upload reliability by using direct upload URL
- enhance PDF generation options for better compatibility in Docker
- handle empty PDF content and improve upload asset parameters

### Documentation

- update to clarify assessment issue pinning and PDF generation details
- add documentation for GrillMyCode GitHub App and its permissions
- comprehensive updates to documentation
- enhance OpenRouter setup instructions and add links for clarity
- update v1 snapshot
- update v1 snapshot

### Refactoring

- streamline output file handling and remove commit delivery
- **workflow:** remove issue types from workflow dispatch configuration
- **workflow:** update Renovate workflow permissions and issue types
- **workflow:** add formatting step for gitignore templates output file
- **workflow:** update app token usage in refresh gitignore templates workflow
- **ci:** update renovate
- **ci:** update paths ignored in GitHub workflows for better clarity and maintenance
- standardize project name to 'GrillMyCode' across all files
- remove GitHub Discussions delivery option and related configurations

### Chores & Maintenance

- **deps:** update dependency lint-staged to v17.0.7
- **deps:** update actions/setup-node action to v6
- **deps:** update commitlint monorepo to v21.0.2
- **deps:** update dependency lint-staged to v17.0.6

## v1.0.10 — 2026-06-01

### What's Changed

### Documentation

- enhance OpenRouter setup instructions and add links for clarity
- update v1 snapshot

### Refactoring

- standardize project name to 'GrillMyCode' across all files

## v1.0.9 — 2026-05-31

### What's Changed

### Documentation

- update v1 snapshot

### Refactoring

- remove GitHub Discussions delivery option and related configurations

## v1.0.8 — 2026-05-31

### What's Changed

### Documentation

- **wizard:** reorder workflow steps and update step index references for clarity
- update AI provider and model descriptions, enhance workflow wizard labels, and clarify context file examples
- add vetted models for OpenRouter to enhance user guidance
- update v1 snapshot

### Refactoring

- update default discussion category from 'Assessments' to 'GrillMyCode'

## v1.0.7 — 2026-05-31

### What's Changed

### Features

- implement retry logic for writing assessment files to instructor repository for concurrency purposes

### Documentation

- update v1 snapshot

## v1.0.6 — 2026-05-31

### What's Changed

### Features

- update README template to include workflow URL for generating Brightspace quizzes

### Documentation

- update v1 snapshot

### Refactoring

- replace student questions workflow with generate Brightspace quizzes workflow and update README

## v1.0.5 — 2026-05-31

### What's Changed

### Features

- add README template for generated instructor repo with detailed structure and usage instructions

### Documentation

- update instructor repository setup and delivery process with README and quiz export details
- update v1 snapshot

## v1.0.4 — 2026-05-31

### What's Changed

### Features

- enhance question generation with context summary and improved prompt instructions

### Documentation

- clarify output descriptions for generated questions in using-outputs and inputs-outputs guides
- **wizard:** add Google Gemini 3.1 Flash Lite model to list of options
- **rationale:** update wording for clarity on code submission sources
- update v1 snapshot

## v1.0.3 — 2026-05-31

### What's Changed

### Bug Fixes

- **prompt:** enforce mandatory question structure with filename headers and code snippets
- **ci:** add update floating version tags step to release workflow

### Documentation

- **exclude-patterns:** update description of Docker image template management
- **wizard:** add Xiaomi Mimo V2.5 Pro to OpenRouter model options
- update v1 snapshot

### Refactoring

- **stack-detection:** streamline template loading and error handling

## v1.0 — 2026-05-31

### What's Changed

### Features

- **ci:** add categorized release notes generation to release workflow
- enhance issue and PR comment updates with regeneration notes
- add FAQ section to documentation and update navigation

### Bug Fixes

- **docs:** update FAQ link to be version-aware in Docusaurus config

### Documentation

- remove unused sidebar entry from Docusaurus config
- update release notes for version 1.0.1

## v1 — 2026-05-31

### What's Changed

### Features

- **ci:** add categorized release notes generation to release workflow
- enhance issue and PR comment updates with regeneration notes
- add FAQ section to documentation and update navigation

### Bug Fixes

- **docs:** update FAQ link to be version-aware in Docusaurus config

### Documentation

- remove unused sidebar entry from Docusaurus config
- update release notes for version 1.0.1

## v1.0.2 — 2026-05-31

### What's Changed

### Features

- **ci:** add categorized release notes generation to release workflow
- enhance issue and PR comment updates with regeneration notes
- add FAQ section to documentation and update navigation

### Bug Fixes

- **docs:** update FAQ link to be version-aware in Docusaurus config

### Documentation

- remove unused sidebar entry from Docusaurus config
- update release notes for version 1.0.1

## v1.0.1 — 2026-05-31

### What's Changed
* chore: remove dependabot configuration and add renovate workflow with… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/51
* chore(deps-dev): bump eslint from 10.4.0 to 10.4.1 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/50
* fix(docs): version routing under /docs/vN, auto-derived from versions… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/52
* feat: introduce versioning of Workflow Wizard for generating GitHub A… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/53


**Full Changelog**: https://github.com/NSCC-ITC-Assessment/GrillMyCode/compare/v1.0.0...v1.0.1

## v1.0.0 — 2026-05-30

### What's Changed
* feat: add Docusaurus site for actions documentation by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/20
* fix: remove version specification for pnpm action setup by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/22
* docs: add comprehensive documentation for GrillMyCode GitHub Action by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/24
* feat: add ai_retry_max_attempts input for configurable retry logic in… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/26
* chore(deps): bump actions/upload-pages-artifact from 3 to 5 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/27
* chore(deps): bump actions/deploy-pages from 4 to 5 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/28
* chore(deps-dev): bump @commitlint/cli from 20.5.3 to 21.0.1 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/29
* chore(deps-dev): bump vitest from 4.1.5 to 4.1.6 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/30
* chore(deps-dev): bump @commitlint/config-conventional from 20.5.3 to 21.0.1 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/31
* chore(deps-dev): bump lint-staged from 16.4.0 to 17.0.4 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/32
* 18 assignment context by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/33
* fix: add DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS const to limit characte… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/35
* Instructor resources by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/38
* chore(deps-dev): bump lint-staged from 17.0.4 to 17.0.5 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/39
* chore(deps-dev): bump vitest from 4.1.6 to 4.1.7 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/40
* chore(deps-dev): bump eslint from 10.3.0 to 10.4.0 by @dependabot[bot] in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/41
* Generate quiz by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/42
* Gen question choices by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/43
* Workflow wizard by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/44
* Release update by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/45
* feat!: auto-detect repo stack for exclude patterns; rename exclude_pa… by @w0244079 in https://github.com/NSCC-ITC-Assessment/GrillMyCode/pull/46


**Full Changelog**: https://github.com/NSCC-ITC-Assessment/GrillMyCode/commits/v1.0.0
