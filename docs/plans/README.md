# Implementation Plans

This directory contains detailed implementation plans for features.

## Purpose

Plans document **HOW** features will be built:
- Step-by-step implementation approach
- Files to be created/modified
- Dependencies and prerequisites
- Estimated complexity
- Task breakdown

## Naming Convention

`plan_<feature_name>.md`

Examples:
- `plan_auth.md` - Authentication implementation plan
- `plan_chat_backend.md` - Chat backend implementation plan
- `plan_stripe_integration.md` - Stripe payment integration plan

## Template

```markdown
# Implementation Plan: [Feature Name]

## Overview
Brief description of what will be built

## Prerequisites
- What needs to be done first
- Dependencies

## Implementation Steps

### 1. [Step Name]
**Files to Create:**
- `path/to/file.ts`

**Files to Modify:**
- `path/to/existing.ts`

**Description:**
What this step does

### 2. [Next Step]
...

## Verification
How to verify the implementation works

## Notes
Additional considerations
```

## Workflow

1. Check `docs/roadmap.md` for what to build
2. Create plan in `docs/plans/plan_<feature>.md`
3. Write spec in `docs/specs/<feature>.md`
4. Implement according to plan
5. Verify against spec
