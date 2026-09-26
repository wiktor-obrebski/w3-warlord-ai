import * as ts from "typescript";
import * as tstl from "typescript-to-lua";

const API_PREFIX = "@lib/warcraft3-api";

const namespaces = new Set<string>();

function isWarcraftApiModule(name: string): boolean {
  return name === API_PREFIX || name.startsWith(`${API_PREFIX}/`);
}

const plugin: tstl.Plugin = {
  visitors: {
    [ts.SyntaxKind.ImportDeclaration]: (
      node: ts.ImportDeclaration,
      context: tstl.TransformationContext,
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
      context: tstl.TransformationContext,
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

export default plugin;
