# Conventions

Code conventions for the project's TypeScript sources.

Declarations that mirror Warcraft natives and runtime globals, such as the ambient modules in `lib/warcraft3-api/modules/*.d.ts`, keep the names Warcraft gives them.

## Naming Convention

### File Naming

- TypeScript files and the directories containing them are named in `kebab-case`.
  A role suffix separated by a dot, such as `worker-safety.ctrl.ts`, is allowed.

### Syntax Naming

- variables scoped in a single module - `strictCamelCase`
- constants scoped in a single module - `UpperCamelCase`
- exported constants - `UPPER_CASE`
- enums, enum members - `UPPER_CASE`
- functions - `strictCamelCase`
  - decorators - `StrictPascalCase`
- classes, interfaces, type aliases - `StrictPascalCase`
- generic type parameters - `PascalCase`

Constants are fixed values, such as tuning numbers, strings, and lookup tables. A `const` holding mutable module state is a variable, and a `const` holding a function is a function.

Strict casing allows no consecutive capital letters, for example `rotate90Ccw`, not `rotate90CCW`.

## Export Convention

The first statement after the imports is the module's only export block. It shows at first glance what the module exports. Type-only exports use the inline `type` modifier in the same block, and re-exporting modules import what they re-export first.

```ts
export { myFunction, myFunction2, myFunction3, myFunction4, type MyType };

const myFunction4 = functionFactory();

interface MyType {
  ...
}

function myFunction() {
  ...
}

function myFunction2() {
  ...
}

function myFunction3() {
  ...
}

function functionFactory() {
  return function myFunction4() {
    ...
  };
}
```

TSTL assigns an export block's bindings where the block appears, so exported constants, classes, and enums would still be `nil` at the top of a module. `lib/warcraft-tstl-plugin` moves those assignments to the end of the module.

## Named Parameters

Functions, methods, constructors, and function types take their parameters as one destructured object, so every argument is named at the call site:

```ts
function nextWorkerResource({ rush }: { rush: TowerRushState }) {
  ...
}

nextWorkerResource({ rush });
```

Calls explain themselves, arguments of the same type cannot be swapped, and parameters can be added or made optional without touching the other arguments.

Signatures dictated by an external API keep their parameter list: array method callbacks, TSTL plugin visitors, Warcraft natives and runtime globals, and the bundle's `main`, called by `runtime/runtime-template.lua`.

TSTL gives function-typed properties a Lua `self` parameter, so a function declared elsewhere is passed as a callback wrapped in an arrow function: `provide: () => provideController()`.

## Parameter Types

When a signature does not fit on one line, its parameter type moves to a local interface named after the function with an `Args` suffix, declared before the function or the interface or class that owns it. A method's interface is prefixed with its owner's name.

```ts
interface BeliefsModelReviseArgs<TObservation, TBeliefs, TCommonBeliefs> {
  previous: Readonly<TBeliefs> | null;
  observation: Readonly<TObservation>;
  common: Readonly<TCommonBeliefs>;
}

interface BeliefsModel<TObservation, TBeliefs, TCommonBeliefs> {
  revise({
    previous,
    observation,
    common,
  }: BeliefsModelReviseArgs<TObservation, TBeliefs, TCommonBeliefs>): TBeliefs;
}
```

## Dependency Injection

A factory function receives its dependencies by currying: the top-level function takes the dependencies, and the function it returns takes the logic arguments.

```ts
// declare function with DI as const
const findRefreshToken =
  // introduce dependencies in top level function
  ({ redis }: { redis: Redis }) =>
    // introduce logic arguments in the returned function
    async ({ refreshToken }: { refreshToken: string }) => {
      const tokenKey = createRefreshTokenKey(refreshToken);
      const tokenValue = await redis.get(tokenKey);

      if (!tokenValue) {
        throw new Error('Invalid refresh token');
      }
      return deserializeToken(tokenValue);
    };
```

In most cases, only a single level of currying is required. The dependencies are bound once, and the returned function can be reused in the same scope.

Classes keep receiving their dependencies through the constructor; the convention applies to factory functions.
