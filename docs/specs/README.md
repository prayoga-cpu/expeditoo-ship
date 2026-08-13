# Feature Specifications

This directory contains detailed specifications for features.

## Purpose

Specs document **WHAT** the feature should do:
- Expected behavior (exact)
- All inputs and outputs
- Edge cases and error scenarios
- Validation rules
- Success/failure criteria

## Naming Convention

`<feature_name>.md`

Examples:
- `auth.md` - Authentication specification
- `chat_api.md` - Chat API specification
- `stripe_payments.md` - Stripe payment specification

## Template

```markdown
# Specification: [Feature Name]

## Overview
What this feature does and why it exists

## User Stories
- As a [user type], I want to [action] so that [benefit]

## Functional Requirements

### Feature 1: [Name]

**Input:**
- Parameter: type, description, validation rules

**Output:**
- Success: Expected result
- Error: Error codes and messages

**Behavior:**
1. When X happens, Y should occur
2. If condition A, then B
3. Edge case: What happens when...

**Validation Rules:**
- Field must be...
- Cannot be empty
- Must match pattern...

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Missing field | "Field X is required" | 400 |
| Invalid format | "Invalid format for Y" | 400 |

## API Endpoints (if applicable)

### POST /api/[endpoint]

**Request:**
```json
{
  "field": "value"
}
```

**Response (Success):**
```json
{
  "id": "123",
  "status": "success"
}
```

**Response (Error):**
```json
{
  "error": "Error message"
}
```

## Database Schema (if applicable)

```typescript
interface Entity {
  id: string;
  field: type;
}
```

## Edge Cases

1. **Case 1:** What happens when...
   - Expected: ...

2. **Case 2:** If user does X...
   - Expected: ...

## Testing Checklist

- [ ] All inputs validated
- [ ] Success scenarios work
- [ ] Error scenarios return correct errors
- [ ] Edge cases handled
- [ ] Security considerations met

## Notes

Additional implementation notes or considerations
```

## Workflow

1. Create plan first (`docs/plans/plan_<feature>.md`)
2. Write spec (`docs/specs/<feature>.md`) - THIS IS THE CONTRACT
3. Implement according to spec
4. When bugs occur, refer to spec to verify expected behavior
5. Update spec if requirements change (with documentation of why)

## Important

**Specs are the source of truth.** When debugging:
1. Check the spec first
2. Verify if implementation matches spec
3. If spec is wrong, update it with reason
4. If implementation is wrong, fix to match spec
