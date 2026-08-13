# Expeditoo Scripts

## Utility Scripts

### Cleanup Test Data
`scripts/cleanup-test-data.ts`

Deletes listings created in the last 3 hours. Useful for cleaning up the database after running E2E tests which generate real data.

**Usage:**
```bash
npx tsx scripts/cleanup-test-data.ts
```
