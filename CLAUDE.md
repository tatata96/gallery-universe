# Coding Rules

## Functions and Components

- Always use the `function` keyword for declaring functions and React components.
- Arrow functions are allowed only for inline callbacks: `map`, `filter`, `reduce`, state setters, event handlers passed inline, etc.

```tsx
// correct
function MyComponent() { ... }
function handleClick() { ... }

// correct — inline arrow ok
items.map((item) => <Item key={item.id} {...item} />)
setState((prev) => prev + 1)

// wrong
const MyComponent = () => { ... }
const handleClick = () => { ... }
```

## Spacing

- Always keep one blank line between sibling JSX elements.
- Always keep one blank line after each function (between functions).

```tsx
// correct — sibling JSX
<Header />

<Main />

<Footer />

// correct — between functions
function foo() { ... }

function bar() { ... }
```

## Variable Declarations

- Never use `var`. Use `const` by default; use `let` only when reassignment is necessary.

## Component Structure

- Each component lives in its own folder named after the component.
- The folder contains:
  - `ComponentName.tsx` — the component
  - `ComponentName.css` — styles
  - `helpers.ts` — helper functions specific to that component (if needed)

```
src/components/Button/
  Button.tsx
  Button.css
  helpers.ts
```
