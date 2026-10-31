# Conventions

Code conventions for the project's TypeScript sources.

Declarations that mirror Warcraft natives and runtime globals, such as the ambient modules in `lib/warcraft3-api/modules/*.d.ts`, keep the names Warcraft gives them.

## Naming Convention

### File Naming

- TypeScript files and the directories containing them are named in `kebab-case`.
  A role suffix separated by a dot, such as `tower-rush.run.ts`, is allowed.

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

### Specific Names

A name says what it holds. General words that could name almost anything are not allowed as variable, parameter, or field names, such as `value`, `state`, `control`, `target`, `next`, `current`, `helper`, `entry`, `item`, `container`, `instance`, `result`, `data`, `registered`, `context`, `node`, or `args`. Pair the word with the concept it holds:

```ts
const beliefsContainer = createBeliefContainer({ commonModel });
const registeredComponents: object[] = [];
const currentUnit = units[0];
```

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

## Declaration Order

Public declarations come first, private ones below. The public interface is what matters most in a module, so it is visible at first glance. After the export block, declare the exported functions, interfaces, and types, then the module's private declarations.

```ts
export { createActorControl };

function createActorControl() {
  return createArbiter({ policy: actorControlPolicy });
}

const actorControlPolicy = ...;
```

Where initialization order forbids it, the declaration stays above its use: a module-level `const` evaluated while the module loads, such as the exported constant `myFunction4` above, cannot move below the code that reads it at load time. Function bodies run later, so a private `const` they use may sit below them.

### Intention Kind Public API

Every Intention kind module has one public entry point, `<kind-name>.api.ts`. It declares nothing itself; it only re-exports what other modules need to use the kind, such as the function creating it and its Capabilities. Other modules import the kind only through this file; the rest of the module, such as its plans' runs, is internal.

```ts
// execute-strategy.api.ts
import {
  createExecuteStrategyKind,
  ExecuteStrategyCapabilities,
} from './execute-strategy.kind';

export { createExecuteStrategyKind, type ExecuteStrategyCapabilities };
```

### Capabilities

An Intention kind, a Unit Behavior or one of its parts such as a reflex, or a part of a plan run declares what it needs from outside as a `<Name>Capabilities` interface, next to the code using it or, once it grows, in a file of its own, and only when it needs something. The function or constructor creating it receives them as `capabilities`. The owner supplies a `<name>CapabilitiesProvider` object implementing the interface; it needs no type of its own.

```ts
interface ExecuteStrategyCapabilities {
  readonly playbooks: Readonly<Record<PlaybookName, Playbook>>;
  readonly recorder: DecisionRecorder;
}

const executeStrategyCapabilitiesProvider: ExecuteStrategyCapabilities = {
  playbooks: Playbooks,
  recorder,
};

createExecuteStrategyKind({
  capabilities: executeStrategyCapabilitiesProvider,
});
```

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

TSTL gives function-typed properties and the callbacks of array methods a Lua `self` parameter, so a function declared elsewhere is passed wrapped in an arrow function: `kindOf: ({ outcome }) => kindOf({ outcome })`, `entries.sort((a, b) => agendaOrder(a, b))`. TSTL does not always report a missing wrapper: a generic function passed to `sort` compiled, and then received the `self` argument as its first entry.

## Parameter Types

When a signature does not fit on one line, its parameter type moves to a local interface named after the function with an `Args` suffix, declared before the function or the interface or class that owns it. A method's interface is prefixed with its owner's name.

```ts
interface BeliefsModelReviseArgs<TBeliefs, TCommonBeliefs, TObservation> {
  previous: Readonly<TBeliefs> | null;
  observation: Readonly<TObservation>;
  commonBeliefs: Readonly<TCommonBeliefs>;
}

interface BeliefsModel<TBeliefs, TCommonBeliefs, TObservation> {
  revise({
    previous,
    observation,
    commonBeliefs,
  }: BeliefsModelReviseArgs<TBeliefs, TCommonBeliefs, TObservation>): TBeliefs;
}
```

## Return Values

A function whose return value its name and type do not make obvious returns an object that names it, so call sites say what they receive. Every function returning `unknown` qualifies:

```ts
reviseScopedBeliefs({ component }: { component: object }): { beliefs: unknown };

const { beliefs } = beliefsContainer.reviseScopedBeliefs({ component });
```

An obvious value of a simple type is returned as is: `getUserName({ user }): string`.

`observe()` and `revise()` of a belief model keep returning their value directly; their names and type parameters say what it is.

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
