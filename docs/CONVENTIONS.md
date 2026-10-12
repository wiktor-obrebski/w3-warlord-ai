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

A function takes its parameters as a single destructured object, so every argument is named where the function is called.

```ts
function nextWorkerResource({ rush }: { rush: TowerRushState }) {
  ...
}

nextWorkerResource({ rush });
isWithinRange({ unit, target: tower, range: TowerRange });
```

The convention applies to function declarations, arrow functions, methods, constructors, and the function types and method signatures the project declares. A function without parameters keeps an empty parameter list.

Named parameters have these advantages:

- A call site explains itself: `isWithinRange({ unit, target: tower, range: TowerRange })` says what `isWithinRange(unit, tower, TowerRange)` leaves to the declaration.
- Arguments cannot be passed in the wrong order. Swapping two parameters of the same type, such as two units, two points, or two coordinates, is a silent bug with positional parameters and impossible with named ones.
- Adding, removing, or making a parameter optional does not shift the other arguments, and an optional parameter needs no `undefined` placeholders before it.
- The shorthand `{ rush }` keeps calls short when the argument's variable has the parameter's name, which rewards naming the same concept the same way across modules.
- Functions share one shape with the dependency injection convention below, which passes dependencies and logic arguments as objects.

Each call builds a Lua table for its arguments. That cost is accepted for clarity; do not depart from the convention for performance without evidence that a specific path needs it.

TSTL gives a function-typed property a Lua `self` parameter even under `noImplicitSelf`, so a callback parameter such as `provide: () => Provided` takes one. Pass a function declared elsewhere wrapped in an arrow function, `provide: () => provideController()`; TSTL reports a missing wrapper at compile time.

Signatures that an external API dictates keep its parameter list: callbacks for array methods such as `map`, `filter`, and `sort`, visitors of the TSTL plugin API, the Warcraft natives and runtime globals named above, and the bundle's `main`, which `runtime/runtime-template.lua` calls.

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
