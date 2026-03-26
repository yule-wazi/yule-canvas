# Workflow Regression Suite

Internal workflow execution self-checks.

Run all cases:

```bash
cd backend
npm run test:workflow
```

List available cases:

```bash
npm run test:workflow -- --list
```

Run one case:

```bash
npm run test:workflow -- --case nested-loop-order-and-scope
```

Maintenance rules:

1. Keep the suite broad.
2. New executable block types must be added to `REQUIRED_BLOCK_TYPES`.
3. New executable block types must add workflow cases.
4. Behavior changes must update the affected assertions.

Files:

- `tests/workflow-regression/index.ts`
- `tests/workflow-regression/cases.ts`
- `tests/workflow-regression/mockPage.ts`
- `tests/workflow-regression/helpers.ts`
- `tests/workflow-regression/types.ts`
