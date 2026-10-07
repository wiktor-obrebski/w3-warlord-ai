# Warcraft III API declarations

Scoped TypeScript declarations for the Warcraft III API.

## Modules

Declaration files live in `modules/`, one file per scoped module (e.g. `modules/unit.d.ts`).

Add declarations to the appropriate scoped module, for example:

```ts
@lib/warcraft3-api/player
@lib/warcraft3-api/unit
@lib/warcraft3-api/ui
```

APIs not needed for normal bot gameplay (installation and tests only) belong in
`@lib/warcraft3-api/privileged`, even when they would otherwise fit another module.
Only code in `src/privileged/` may use it; see `src/privileged/README.md`.

`@lib/warcraft3-api/warlord` declares globals provided by our own runtime wrapper
(`runtime/runtime-template.lua`), not by Warcraft, such as `guard`. Keep its declarations in
sync with the wrapper and document them from the wrapper; there is no Jassdoc or
`war3-types-strict` source for them.

Application code should use namespace imports:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";

UnitApi.KillUnit(unit);
```

Do not use named imports or import `war3-types-strict` directly in application code.

## Declarations

Use `war3-types-strict` as the reference for API names, parameters, and TypeScript signatures.

Do not blindly copy its nullability. It conservatively marks many handle/reference returns as `| undefined`,
even when no real failure case is documented.

Use:

```ts
export function CreateGroup(): group;
```

not:

```ts
export function CreateGroup(): group | undefined;
```

Use `null` when a Warcraft API is documented to return JASS `null` or you have other good reason to think the `null` can be returned.. 
When nullability is unclear, check Jassdoc and documented runtime behavior.

Use `void` for functions that return nothing.

## Types

If a function in a module uses a Warcraft type in its return type,
that module must also declare and export that type.

Duplicating the same Warcraft type across multiple API modules is intentional.

Example:

```ts
export interface group extends agent {
  __group: never;
}

export function CreateGroup(): group;
```

Document type declarations using the same Jassdoc-based rules as functions.

## Documentation

Every new API declaration must include JSDoc.

Get Jassdoc data with:

```bash
bin/jassdoc/jassdoc.sh <symbol>
```

Preserve useful descriptions and tags such as `@param`, `@note`, `@bug`, and `@patch`.

Use Jassdoc for documentation and semantic behavior. Use `war3-types-strict` for the TypeScript declaration shape.

If there is "in-code" comment in Jassdoc data add it to our description.

```jass
type player             extends     agent  // a single player reference
```

If Jassdoc provides no description, write a concise description based on known Warcraft API behavior and mark it:

```ts
/**
 * @ai-generated Creates a new empty group.
 */
```

Do not add `@ai-generated` to documentation copied or derived from Jassdoc.

Separate each declaration from the next declaration's documentation with exactly one blank line.

## Runtime

These modules contain declarations only.

`@lib/warcraft-tstl-plugin` removes their imports and rewrites calls to Warcraft III globals during TSTL compilation.

Do not add runtime implementations.
