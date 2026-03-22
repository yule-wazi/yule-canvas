# Requirements Document

## Introduction

This specification addresses two critical issues with variable binding in the workflow editor's code generation system. The problems occur in the BlockCompiler service when generating Playwright code that uses variables in selectors and loop configurations.

## Glossary

- **BlockCompiler**: The service responsible for converting workflow blocks into executable Playwright code
- **Loop_Variable**: A variable (e.g., `{{index}}`) that represents the current iteration in a loop
- **Global_Variable**: A user-defined variable (e.g., `{{loopCount}}`) stored in the workflow's global variables
- **Template_String**: JavaScript template literal syntax using backticks and `${variable}` for runtime evaluation
- **Selector**: A CSS selector string used to identify DOM elements
- **Log_Message**: Output text displayed in the execution logs

## Requirements

### Requirement 1: Display Loop Variables in Logs

**User Story:** As a workflow developer, I want to see the actual runtime values of loop variables in execution logs, so that I can debug and verify that my selectors are targeting the correct elements.

#### Acceptance Criteria

1. WHEN a selector contains a loop variable reference like `{{index}}`, THE BlockCompiler SHALL generate log statements that evaluate the variable at runtime
2. WHEN generating code for Click modules with loop variables, THE BlockCompiler SHALL use template string syntax in log statements
3. WHEN generating code for Type modules with loop variables, THE BlockCompiler SHALL use template string syntax in log statements
4. WHEN generating code for Scroll modules with loop variables, THE BlockCompiler SHALL use template string syntax in log statements
5. WHEN generating code for Extract modules with loop variables, THE BlockCompiler SHALL use template string syntax in log statements
6. WHEN a log message displays a selector containing `${variableName}`, THE Log_Message SHALL show the actual numeric value at runtime

### Requirement 2: Respect Global Variables in Loop Count

**User Story:** As a workflow developer, I want loop counts to use the actual values from global variables, so that I can dynamically control loop iterations based on configuration.

#### Acceptance Criteria

1. WHEN a loop module's count field contains a global variable reference like `{{loopCount}}`, THE BlockCompiler SHALL replace it with the actual value before code generation
2. WHEN generating loop code with a count containing global variables, THE BlockCompiler SHALL call replaceGlobalVariables on the count value
3. WHEN the replaced count value is a numeric string, THE BlockCompiler SHALL convert it to a number
4. WHEN the loop code is generated, THE generated code SHALL use the resolved numeric value, not the variable reference

### Requirement 3: Consistent Variable Handling

**User Story:** As a workflow developer, I want consistent variable handling across all module types, so that I can predict how variables will behave in different contexts.

#### Acceptance Criteria

1. WHEN any module generates a log statement with a selector, THE BlockCompiler SHALL detect if the selector contains template string variables
2. WHEN a selector contains template string variables (indicated by `${`), THE BlockCompiler SHALL wrap the log message in template string syntax
3. WHEN a selector does not contain template string variables, THE BlockCompiler SHALL use regular string syntax in log statements
4. WHEN the Log module generates code with loop variables, THE BlockCompiler SHALL use template string syntax for the message
5. THE BlockCompiler SHALL maintain the existing behavior for logUser() calls, which already work correctly
