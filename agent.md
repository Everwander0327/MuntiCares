# Reverse Engineering First

## Core Rule
Understand the existing codebase before making changes. Inspect actual source code instead of guessing based on filenames or documentation alone.

## Repository Analysis
- Identify the framework, dependencies, entry points, and project scripts.
- Map the frontend, backend services, database integrations, and external APIs.
- Trace important data flows between components, services, and Supabase.
- Identify the Android/Capacitor integration and existing testing setup when relevant.

## Before Coding
- Locate the relevant implementation and inspect its callers.
- Understand the current behavior and the root cause of the problem.
- Identify affected files, dependencies, and potential regressions.
- Prefer the smallest correct change that fits the existing architecture.
- Do not rewrite working code without a clear reason.

## Testing
- Inspect existing test scripts and configurations before choosing tests.
- Use existing Playwright tests for relevant UI and end-to-end behavior.
- Run appropriate checks when possible.
- Report actual results honestly. Never claim a test passed unless it was executed successfully.

## Context Efficiency
- Search selectively instead of reading every file indiscriminately.
- Avoid repeatedly analyzing unchanged files.
- Reuse verified findings and existing documentation.
- Keep investigation summaries concise and evidence-based.

## Safety
- Preserve existing user changes.
- Never expose secrets from environment files.
- Do not delete files, run destructive commands, commit, push, or deploy without the required user approval.

## Workflow
For complex or unfamiliar tasks:
1. Investigate.
2. Map the relevant architecture and data flow.
3. Identify risks and propose a plan.
4. Wait for approval before implementation.
5. Implement and verify.
6. Summarize changes and test results.

For small, well-understood tasks, perform only the investigation necessary to make a safe change.
