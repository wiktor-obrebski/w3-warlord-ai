import type { PreloadNatives } from '../../preload-transport';

export { createFakePreloadEngine, renderPreloadFile, type FakePreloadEngine };

interface FakePreloadEngine {
  readonly natives: PreloadNatives;
  /** The arguments of every `Preload` call, in order. */
  readonly preloadArguments: string[];
}

/**
 * Stands in for Warcraft's preload natives, writing files the way
 * `PreloadGenEnd` does, as documented by Jassdoc. Portable, so the Lua
 * compatibility driver uses it too.
 */
function createFakePreloadEngine({
  writeFile,
}: {
  writeFile: ({
    fileName,
    content,
  }: {
    fileName: string;
    content: string;
  }) => void;
}): FakePreloadEngine {
  const preloadArguments: string[] = [];
  let buffered: string[] = [];

  return {
    preloadArguments,
    natives: {
      preloadGenClear() {
        buffered = [];
      },
      preloadGenStart() {},
      preload(text) {
        preloadArguments.push(text);
        buffered.push(text);
      },
      preloadGenEnd(fileName) {
        writeFile({
          fileName,
          content: renderPreloadFile({ preloadArguments: buffered }),
        });
      },
    },
  };
}

interface RenderPreloadFileArgs {
  preloadArguments: string[];
  lineEnd?: string;
}

/** The content `PreloadGenEnd` writes for these `Preload` arguments. */
function renderPreloadFile({
  preloadArguments,
  lineEnd = '\n',
}: RenderPreloadFileArgs): string {
  const lines = ['function PreloadFiles takes nothing returns nothing', ''];

  lines.push('\tcall PreloadStart()');
  for (const preloadArgument of preloadArguments) {
    // Preload escapes backslashes and nothing else.
    lines.push(
      `\tcall Preload( "${preloadArgument.split('\\').join('\\\\')}" )`
    );
  }
  lines.push('\tcall PreloadEnd( 0.0 )', '', 'endfunction', '');

  return lines.join(lineEnd);
}
