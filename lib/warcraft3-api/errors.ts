export { UnexpectedWarcraftApiResponseError };

class UnexpectedWarcraftApiResponseError extends Error {
  constructor(api: string, response: unknown, context?: string) {
    super(
      `Unexpected Warcraft III API response from ${api}: ${String(response)}${
        context ? ` (${context})` : ""
      }`,
    );

    this.name = "UnexpectedWarcraftApiResponseError";
  }
}
