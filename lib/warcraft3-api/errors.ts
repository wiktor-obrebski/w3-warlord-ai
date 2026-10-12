export { UnexpectedWarcraftApiResponseError };

interface UnexpectedWarcraftApiResponseErrorConstructorArgs {
  api: string;
  response: unknown;
  context?: string;
}

class UnexpectedWarcraftApiResponseError extends Error {
  constructor({
    api,
    response,
    context,
  }: UnexpectedWarcraftApiResponseErrorConstructorArgs) {
    super(
      `Unexpected Warcraft III API response from ${api}: ${String(response)}${
        context ? ` (${context})` : ''
      }`
    );

    this.name = 'UnexpectedWarcraftApiResponseError';
  }
}
