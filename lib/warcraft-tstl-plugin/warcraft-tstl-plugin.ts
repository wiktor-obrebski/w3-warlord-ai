import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

export { plugin as default };

const ApiPrefix = '@lib/warcraft3-api';

const namespaces = new Set<string>();
let deferredExports: tstl.Statement[] = [];

function isWarcraftApiModule(name: string): boolean {
  return name === ApiPrefix || name.startsWith(`${ApiPrefix}/`);
}

const plugin: tstl.Plugin = {
  visitors: {
    [ts.SyntaxKind.SourceFile]: (
      node: ts.SourceFile,
      context: tstl.TransformationContext
    ) => {
      deferredExports = [];

      const [file] = context.superTransformNode(node);

      if (!file || !tstl.isFile(file)) {
        throw new Error(`Expected a Lua file for ${node.fileName}.`);
      }

      const returnIndex = file.statements.findIndex(tstl.isReturnStatement);

      if (deferredExports.length > 0 && returnIndex === -1) {
        throw new Error(`Expected a module return in ${node.fileName}.`);
      }

      file.statements.splice(returnIndex, 0, ...deferredExports);

      return file;
    },

    // TSTL assigns `export { ... }` bindings where the block appears, and only
    // function declarations are hoisted above it. The project convention puts
    // the block at the top of the module, so its assignments are moved to the
    // end of the module, after every exported binding is initialized.
    [ts.SyntaxKind.ExportDeclaration]: (
      node: ts.ExportDeclaration,
      context: tstl.TransformationContext
    ) => {
      const statements = context.superTransformStatements(node);

      if (node.moduleSpecifier) {
        return statements;
      }

      deferredExports.push(...statements);

      return [];
    },

    [ts.SyntaxKind.ImportDeclaration]: (
      node: ts.ImportDeclaration,
      context: tstl.TransformationContext
    ) => {
      if (
        ts.isStringLiteral(node.moduleSpecifier) &&
        isWarcraftApiModule(node.moduleSpecifier.text)
      ) {
        const bindings = node.importClause?.namedBindings;

        if (bindings && ts.isNamespaceImport(bindings)) {
          namespaces.add(bindings.name.text);
        }

        return [];
      }

      return context.superTransformStatements(node);
    },

    [ts.SyntaxKind.PropertyAccessExpression]: (
      node: ts.PropertyAccessExpression,
      context: tstl.TransformationContext
    ) => {
      if (
        ts.isIdentifier(node.expression) &&
        namespaces.has(node.expression.text)
      ) {
        return tstl.createIdentifier(node.name.text, node);
      }

      return context.superTransformExpression(node);
    },
  },
};
