# Page Builder Workbench

## 1. Scope

This file is the stable design / architecture document for the page-builder workbench itself.

Use this file to answer:

- what the workbench should look like
- what the generated project architecture should be
- what kind of interaction model the workbench should support
- what boundaries the page-builder system should keep stable

Do not use this file as the recent task handoff log.
Use `docs/page-builder-context.md` for that.

## 2. Core Direction

The first page builder should be:

`a full-screen generated-page IDE-like workbench`

That means:

- the left side behaves like a real project explorer
- the center is the main work surface
- the generated output uses a stable project structure
- the setup drawer works as the generation / AI entry point

The first page builder should not be:

- a loose demo generator
- a card list pretending to be a file explorer
- a mixed bag of incompatible runtime files
- a heavy visual-property editor that competes with later AI editing

## 3. Layout Direction

Current intended layout:

1. left file explorer
2. center work area
3. setup drawer as overlay / popup

The center work area should support:

- `Preview`
- `Code`
- `Data`

The center should remain dominant.
The workbench is not a dashboard.

## 4. File Explorer Requirements

The left side must behave like a real IDE explorer.

Required qualities:

- collapsible folders
- nested files
- active file highlight
- stable project-root mental model
- no file-card presentation

Reference mental model:

- VS Code explorer
- normal code workspace explorers

## 5. Generated Project Structure

The generated output should use a stable top-level architecture:

```text
Page Project
  app/
    PageView.vue
  components/
    sections/
      HeroSection.vue
      FeedSection.vue
      FooterSection.vue
  data/
    bindings.ts
    tableAdapter.ts
  spec/
    page-spec.json
  styles/
    page.css
```

This structure exists to support:

- regeneration
- data binding
- preview mapping
- future AI editing

Meaning of each layer:

- `app/`
  page assembly / top-level entry
- `components/sections/`
  section-level rendering files
- `data/`
  binding contract and data access layer
- `spec/`
  stable generation spec and future AI memory anchor
- `styles/`
  page-level visual styling

## 6. Binding Contract Direction

Generated pages must bind against the data table contract, not against copied sample-only subsets.

The workbench should keep explicit structure for:

- source table id
- available fields
- field-role mapping
- section bindings

The preferred location remains:

```text
data/
  bindings.ts
  tableAdapter.ts
```

## 7. Runtime Strategy

One generated project should use one visible runtime architecture.

Rules:

- do not mix user-facing Vue files with a parallel visible standalone HTML strategy
- internal preview runtime files may exist, but should not be presented as project files
- project tree should show the user-facing generated project, not temporary preview hacks

## 8. Code Surface Direction

The code area should feel like a real editor.

Required qualities:

- active file tabs
- dark editor styling
- good scroll behavior
- syntax highlighting
- readable whitespace and indentation

Preferred long-term choice:

- `Monaco Editor`

Current lighter custom rendering is acceptable only as a temporary step.

## 9. Data Surface Direction

The workbench should include a dedicated data view.

Purpose:

- let the user inspect the current selected table payload
- keep generated-page iteration grounded in real extracted data
- make the crawler -> table -> page relationship explicit

## 10. Setup Drawer Direction

The setup drawer is no longer just a manual parameter form.

Its long-term role is:

`AI generation panel`

It must still preserve:

- data table selection
- page type
- style preset
- page title / goal / density or equivalent core context

Later it should evolve into:

- multi-turn AI dialogue
- generation history
- AI-driven regeneration / modification entry

## 11. What The Workbench Should Avoid

The workbench should avoid:

- rebuilding a complex right-side property inspector
- a second parallel editing model that fights with AI-driven code iteration
- uncontrolled file architecture changes at the top level
- sample-only fake data patterns becoming the real runtime strategy

## 12. Future AI-Friendly Direction

The workbench should eventually support:

- AI reading its previously generated files
- AI modifying existing files instead of always replacing everything
- AI maintaining a stable project memory layer

That means the future architecture should likely extend `spec/` with:

- a manifest
- a source map
- or equivalent AI-readable memory files

But the top-level workbench structure should remain stable.

## 13. Summary

The page-builder workbench should be understood as:

`a full-screen IDE-like generated page workspace with a stable project explorer on the left, preview/code/data modes in the center, and an overlay AI generation panel that preserves data table linkage`
