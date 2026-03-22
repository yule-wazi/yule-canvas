# Design Document: Fix Variable Binding in Logs

## Overview

This design addresses two critical bugs in the BlockCompiler service where variable values are not properly displayed in execution logs and loop counts don't respect global variable values. The root cause is that log statements use regular string literals when they should use template strings for runtime variable evaluation, and loop count processing happens after variable replacement should occur.

The fix involves:
1. Detecting when selectors contain template string variables (`${variableName}`)
2. Using template string syntax in log statements when variables are present
3. Ensuring global variables are replaced in loop counts before code generation
4. Applying consistent variable handling across all module types

## Architecture

The BlockCompiler service follows a compilation pipeline:

```
Workflow Blocks → Topological Sort → Code Generation → Assembly
                        ↓
                  Global Variables
```

The fix modifies the code generation phase for these methods:
- `generateClickCode()` - Click module code generation
- `generateTypeCode()` - Type module code generation  
- `generateScrollCode()` - Scroll module code generation
- `generateExtractCode()` - Extract module code generation
- `generateLogCode()` - Log module code generation
- `generateLoopCode()` - Loop module code generation

All methods already call `replaceVariables()` which converts `{{variableName}}` to `${variableName}` for loop variables and replaces global variables with their actual values. The issue is that log statements don't evaluate these template variables at runtime.

## Components and Interfaces

### BlockCompiler Service

**Location:** `backend/src/services/BlockCompiler.ts`

**Modified Methods:**

```typescript
private generateClickCode(block: any, variableName?: string): string
```
- Detects if processed selector contains `${` 
- Uses template string for log when variables present
- Uses regular string for log when no variables

```typescript
private generateTypeCode(block: any, variableName?: string): string
```
- Detects if processed selector contains `${`
- Uses template string for log when variables present
- Uses regular string for log when no variables

```typescript
private generateScrollCode(block: any, variableName?: string): string
```
- Detects if processed selector contains `${`
- Uses template string for log when variables present
- Uses regular string for log when no variables

```typescript
private generateExtractCode(block: any, variableName?: string): string
```
- Detects if processed selector contains `${`
- Uses template string for log when variables present
- Uses regular string for log when no variables

```typescript
private generateLogCode(block: any): string
```
- Already correctly handles template strings
- No changes needed (already working)

```typescript
private generateLoopCode(loopBlock: any, bodyCode: string): string
```
- Already calls `replaceGlobalVariables()` on count
- Already converts to number
- No changes needed (already working)

**Helper Method (No Changes Needed):**

```typescript
private replaceVariables(text: string, variableName?: string): string
```
- Replaces `{{loopVar}}` with `${loopVar}` for loop variables
- Replaces `{{globalVar}}` with actual values for global variables
- Already working correctly

## Data Models

No data model changes required. The fix only affects code generation logic.

**Input Data:**
- `block.data.selector`: String that may contain `{{variableName}}`
- `block.data.count`: String or number that may contain `{{globalVar}}`
- `variableName`: Optional loop variable name (e.g., "index")
- `this.globalVariables`: Map of global variable names to values

**Processing:**
- After `replaceVariables()`: Selector contains `${variableName}` for loop vars
- After `replaceGlobalVariables()`: Count contains actual numeric value

**Output:**
- Generated code with proper template string syntax in logs


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Loop Variables in Selectors Generate Template String Logs

*For any* module type (Click, Type, Scroll, Extract) with a selector containing a loop variable, when the BlockCompiler generates code, the log statement should use template string syntax (backticks with `${variableName}`) to enable runtime variable evaluation.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.2**

### Property 2: Selectors Without Variables Generate Regular String Logs

*For any* module type (Click, Type, Scroll, Extract) with a selector that does not contain template string variables (no `${` present after processing), when the BlockCompiler generates code, the log statement should use regular string syntax (single quotes).

**Validates: Requirements 3.3**

### Property 3: Loop Count Respects Global Variable Values

*For any* loop module with a count field containing a global variable reference (e.g., `{{loopCount}}`), when the BlockCompiler generates loop code with global variables provided, the generated code should contain the actual numeric value from the global variable, not the variable reference string.

**Validates: Requirements 2.1, 2.4**

### Property 4: Numeric String Counts Converted to Numbers

*For any* loop module where the count value (after global variable replacement) is a numeric string (e.g., "5"), when the BlockCompiler generates loop code, the generated code should use the numeric value (e.g., `5`) not the string value (e.g., `"5"`).

**Validates: Requirements 2.3**

### Property 5: Log Module Messages with Loop Variables Use Template Strings

*For any* Log module with a message containing loop variables, when the BlockCompiler generates code, the logUser statement should use template string syntax (backticks) to enable runtime variable evaluation.

**Validates: Requirements 3.4**

## Error Handling

The fix does not introduce new error conditions. Existing error handling remains:

- Invalid selectors: Playwright will throw errors at runtime (existing behavior)
- Missing global variables: `replaceGlobalVariables()` replaces with empty string (existing behavior)
- Invalid loop counts: JavaScript will handle type coercion (existing behavior)

The fix improves debugging by showing actual values in logs, making errors easier to diagnose.

## Testing Strategy

### Dual Testing Approach

We will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples and edge cases for each module type
- **Property tests**: Verify universal properties across all valid inputs

### Property-Based Testing

We will use **fast-check** (JavaScript/TypeScript property-based testing library) to implement property tests. Each property test will:

- Run a minimum of 100 iterations with randomized inputs
- Reference its corresponding design property in a comment tag
- Tag format: `// Feature: fix-variable-binding-in-logs, Property N: [property text]`

**Property Test Coverage:**

1. **Property 1 Test**: Generate random blocks (Click, Type, Scroll, Extract) with selectors containing loop variables, verify generated code uses template strings in logs
2. **Property 2 Test**: Generate random blocks with selectors without variables, verify generated code uses regular strings in logs
3. **Property 3 Test**: Generate random loop blocks with global variable references in count, provide random global variable values, verify generated code contains the numeric value
4. **Property 4 Test**: Generate random loop blocks with numeric string counts, verify generated code uses number type
5. **Property 5 Test**: Generate random Log blocks with loop variables in messages, verify generated code uses template strings

### Unit Testing

Unit tests will cover:

- Specific examples from the bug reports (e.g., `div:nth-child(${index})`)
- Edge cases: empty selectors, special characters, multiple variables
- Integration: Full workflow compilation with loops and variables
- Regression: Ensure logUser() continues working correctly

### Test Configuration

- Property tests: 100 iterations minimum per test
- Test framework: Jest (existing framework)
- Property testing library: fast-check
- Each test must reference its design property in comments
