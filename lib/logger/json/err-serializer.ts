export { isErrorLike, serializeError, type ErrorLike };

/** What Pino treats as an error: any object with a string `message`. */
interface ErrorLike {
  message: string;
  name?: unknown;
  stack?: unknown;
  cause?: unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/**
 * Pino's default `err` serializer: `type`, `message` and `stack`, where the
 * message and stack include those of the `cause` chain, then the error's
 * other enumerable properties, with nested errors serialized the same way.
 *
 * Errors in Warcraft's Lua carry no stack trace, since the runtime wrapper
 * provides no real `debug` library: `stack` is omitted when no error in
 * the cause chain has one. `name` is never copied, as TSTL makes it an own
 * property of every error and `type` already names the error.
 */
function serializeError({
  error,
}: {
  error: ErrorLike;
}): Record<string, unknown> {
  return serializeErrorTree({ error, seen: [] });
}

const ReplacedProperties = ['type', 'message', 'stack', 'name'];

interface SerializeErrorTreeArgs {
  error: ErrorLike;
  seen: object[];
}

function serializeErrorTree({
  error,
  seen,
}: SerializeErrorTreeArgs): Record<string, unknown> {
  seen.push(error);

  const serialized: Record<string, unknown> = {
    type: errorType({ error }),
    message: messageWithCauses({ error }),
  };
  const stack = stackWithCauses({ error });

  if (stack !== undefined) {
    serialized.stack = stack;
  }

  for (const key in error) {
    if (ReplacedProperties.includes(key) || serialized[key] !== undefined) {
      continue;
    }

    const property = (error as unknown as Record<string, unknown>)[key];

    if (!isErrorLike(property)) {
      serialized[key] = property;
    } else if (key !== 'cause' && !seen.includes(property)) {
      serialized[key] = serializeErrorTree({ error: property, seen });
    }
  }

  return serialized;
}

// Pino uses the constructor's name, which also names subclasses that do not
// set their own `name`. A TSTL class table carries its name like a JS
// constructor function does.
function errorType({ error }: { error: ErrorLike }): string | undefined {
  const constructorName = (
    (error as { constructor?: unknown }).constructor as
      | { name?: unknown }
      | undefined
  )?.name;

  if (typeof constructorName === 'string' && constructorName !== '') {
    return constructorName;
  }

  return typeof error.name === 'string' ? error.name : undefined;
}

function errorCause({ error }: { error: ErrorLike }): ErrorLike | undefined {
  return isErrorLike(error.cause) ? error.cause : undefined;
}

function messageWithCauses({ error }: { error: ErrorLike }): string {
  const visited: ErrorLike[] = [error];
  let message = error.message;
  let cause = errorCause({ error });

  while (cause !== undefined) {
    message += `: ${cause.message}`;

    if (visited.includes(cause)) {
      return `${message}: ...`;
    }

    visited.push(cause);
    cause = errorCause({ error: cause });
  }

  return message;
}

function stackWithCauses({ error }: { error: ErrorLike }): string | undefined {
  const visited: ErrorLike[] = [error];
  let hasStack = stackOf({ error }) !== '';
  let stack = stackOf({ error });
  let cause = errorCause({ error });

  while (cause !== undefined) {
    const causeStack = stackOf({ error: cause });

    hasStack ||= causeStack !== '';
    stack += `\ncaused by: ${causeStack}`;

    if (visited.includes(cause)) {
      stack += '\ncauses have become circular...';
      break;
    }

    visited.push(cause);
    cause = errorCause({ error: cause });
  }

  return hasStack ? stack : undefined;
}

function stackOf({ error }: { error: ErrorLike }): string {
  return typeof error.stack === 'string' ? error.stack : '';
}
