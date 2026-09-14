import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

export type CommandCapabilityRequirement = {
  readonly module: string;
  readonly capability: string;
};

export type ProductionCommandDeclaration = {
  readonly command: string;
  readonly file: string;
  readonly line: number;
  readonly explicitCapability?: CommandCapabilityRequirement;
};

function location(sourceFile: ts.SourceFile, node: ts.Node): string {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `${sourceFile.fileName}:${line}`;
}

function stringValue(
  property: ts.ObjectLiteralElementLike | undefined,
  sourceConstants: ReadonlyMap<string, string> = new Map(),
): string | undefined {
  if (!property || !ts.isPropertyAssignment(property)) {
    return undefined;
  }
  if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
  if (ts.isIdentifier(property.initializer)) return sourceConstants.get(property.initializer.text);
  return undefined;
}

function namedProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) =>
    ts.isPropertyAssignment(property)
    && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    && property.name.text === name,
  );
}

function explicitCapability(
  sourceFile: ts.SourceFile,
  property: ts.ObjectLiteralElementLike | undefined,
): CommandCapabilityRequirement | undefined {
  if (!property) return undefined;
  if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
    throw new Error(`${location(sourceFile, property)}: command capability must be a literal object`);
  }
  const moduleName = stringValue(namedProperty(property.initializer, "module"));
  const capability = stringValue(namedProperty(property.initializer, "capability"));
  if (!moduleName || !capability) {
    throw new Error(`${location(sourceFile, property)}: command capability must contain literal module and capability`);
  }
  return { module: moduleName, capability };
}

/**
 * Parse a production source file rather than importing it: command modules can
 * depend on Next request state, while this check must remain independent of the
 * envelope's runtime guard and its COMMAND_CAPABILITIES registry.
 */
export function scanCommandDeclarations(sourceText: string, fileName: string): ProductionCommandDeclaration[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const defineCommandNames = new Set<string>();
  const sourceConstants = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.endsWith("/envelope")) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.propertyName?.text === "defineCommand" || (!element.propertyName && element.name.text === "defineCommand")) {
            defineCommandNames.add(element.name.text);
          }
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isStringLiteral(declaration.initializer)) {
          sourceConstants.set(declaration.name.text, declaration.initializer.text);
        }
      }
    }
  }

  const declarations: ProductionCommandDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && defineCommandNames.has(node.expression.text)) {
      const config = node.arguments[0];
      if (!config || !ts.isObjectLiteralExpression(config)) {
        throw new Error(`${location(sourceFile, node)}: defineCommand requires a literal configuration object`);
      }
      const commandProperty = namedProperty(config, "command");
      const command = stringValue(commandProperty, sourceConstants);
      if (!command) {
        throw new Error(`${location(sourceFile, commandProperty ?? config)}: defineCommand command must be a literal string`);
      }
      declarations.push({
        command,
        file: fileName,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        explicitCapability: explicitCapability(sourceFile, namedProperty(config, "capability")),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) ? [path] : [];
  });
}

/**
 * Scan all production source, excluding the envelope's own declaration. This
 * prevents a future command module outside src/server/commands from silently
 * escaping registry coverage while still excluding test-only probe declarations.
 */
export function scanProductionCommandDeclarations(projectRoot = process.cwd()): ProductionCommandDeclaration[] {
  const sourceDirectory = join(projectRoot, "src");
  return sourceFiles(sourceDirectory)
    .filter((file) => relative(projectRoot, file).replaceAll("\\", "/") !== "src/server/commands/envelope.ts")
    .flatMap((file) => scanCommandDeclarations(readFileSync(file, "utf8"), relative(projectRoot, file).replaceAll("\\", "/")));
}

/**
 * Cross-check source declarations against the registry from a separate parser
 * pass. This catches missing registry rows even when a declaration supplies an
 * explicit capability and catches stale or duplicate registry coverage.
 */
export function validateProductionCommandEnrollment(
  declarations: readonly ProductionCommandDeclaration[],
  registry: Readonly<Record<string, CommandCapabilityRequirement>>,
): void {
  const byCommand = new Map<string, ProductionCommandDeclaration>();
  for (const declaration of declarations) {
    const prior = byCommand.get(declaration.command);
    if (prior) {
      throw new Error(`duplicate production command declaration: ${declaration.command} (${prior.file}:${prior.line}, ${declaration.file}:${declaration.line})`);
    }
    byCommand.set(declaration.command, declaration);
  }

  const missing = declarations.filter((declaration) => !registry[declaration.command]);
  if (missing.length > 0) {
    throw new Error(`command capability enrollment missing for production declaration: ${missing.map((entry) => `${entry.command} (${entry.file}:${entry.line})`).join(", ")}`);
  }
  const stale = Object.keys(registry).filter((command) => !byCommand.has(command));
  if (stale.length > 0) {
    throw new Error(`command capability enrollment has no production declaration: ${stale.sort().join(", ")}`);
  }
  for (const declaration of declarations) {
    if (!declaration.explicitCapability) continue;
    const enrolled = registry[declaration.command];
    if (enrolled.module !== declaration.explicitCapability.module || enrolled.capability !== declaration.explicitCapability.capability) {
      throw new Error(`command capability enrollment drift for ${declaration.command} (${declaration.file}:${declaration.line})`);
    }
  }
}
