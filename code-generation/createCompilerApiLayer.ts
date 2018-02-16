﻿/**
 * Code generation: Create Compiler API Layer
 * ------------------------------------------
 * This creates a file that contains the typings from the TypeScript compiler API.
 * ------------------------------------------
 */
import * as path from "path";
import {rootFolder} from "./config";
import {InspectorFactory} from "./inspectors";
import {UnionTypeNode} from "./../src/main";
import {ArrayUtils} from "./../src/utils";
import {cloneEnums, cloneInterfaces, cloneTypeAliases, cloneClasses, cloneFunctions, cloneVariables, cloneNamespaces} from "./common/cloning";

const enumsToSeparate = ["SyntaxKind", "ScriptTarget", "ScriptKind", "LanguageVariant", "EmitHint", "JsxEmit", "ModuleKind", "ModuleResolutionKind",
    "NewLineKind", "TypeFlags", "ObjectFlags", "SymbolFlags", "TypeFormatFlags", "DiagnosticCategory"];
const interfacesToSeparate = ["CompilerOptions", "MapLike"];
const typeAliasesToSeparate: string[] = [];

export function createCompilerApiLayer(factory: InspectorFactory) {
    const tsInspector = factory.getTsInspector();
    const ast = factory.getAst();
    const declarationFile = tsInspector.getDeclarationFile();

    const tsNamespaces = declarationFile.getNamespaces().filter(n => n.getName() === "ts");
    const allEnums = ArrayUtils.flatten(tsNamespaces.map(n => n.getEnums()));
    const allInterfaces = ArrayUtils.flatten(tsNamespaces.map(n => n.getInterfaces()));
    const allTypeAliases = ArrayUtils.flatten(tsNamespaces.map(n => n.getTypeAliases()));

    createTsSourceFile();

    function createTsSourceFile() {
        const sourceFile = getOrCreateSourceFile("typescript.ts");

        sourceFile.addImportDeclarations([{
            namespaceImport: "tsCompiler",
            moduleSpecifier: "typescript"
        }, {
            namedImports: [{ name: "ObjectUtils" }],
            moduleSpecifier: sourceFile.getRelativePathToSourceFileAsModuleSpecifier(ast.getSourceFileOrThrow("src/utils/ObjectUtils.ts"))
        }]);

        addSeparatedDeclarations();

        const tsNamespace = sourceFile.addNamespace({
            name: "ts",
            isExported: true
        });

        cloneNamespaces(tsNamespace, ArrayUtils.flatten(tsNamespaces.map(n => n.getNamespaces())));
        cloneInterfaces(tsNamespace, allInterfaces.filter(i => interfacesToSeparate.indexOf(i.getName()) === -1));
        cloneEnums(tsNamespace, allEnums.filter(e => enumsToSeparate.indexOf(e.getName()) === -1));
        cloneTypeAliases(tsNamespace, allTypeAliases.filter(t => typeAliasesToSeparate.indexOf(t.getName()) === -1));
        cloneClasses(tsNamespace, ArrayUtils.flatten(tsNamespaces.map(n => n.getClasses())));
        cloneFunctions(tsNamespace, ArrayUtils.flatten(tsNamespaces.map(n => n.getFunctions())));
        cloneVariables(tsNamespace, ArrayUtils.flatten(tsNamespaces.map(n => n.getVariableStatements())));

        tsNamespace.getInterfaceOrThrow("Node").addProperty({
            docs: [{
                description: "This brand prevents using nodes not created within this library or not created within the ts namespace object of this library.\n" +
                    "It's recommended that you only use this library and use its ts named export for all your TypeScript compiler needs.\n" +
                    "If you want to ignore this and are using the same TypeScript compiler version as ts.versionMajorMinor then assert it to ts.Node.\n" +
                    "If you don't use this library with this same major & minor version of TypeScript then be warned, you may encounter unexpected behaviour."
            }],
            name: "_tsSimpleAstBrand",
            type: "undefined"
        });

        sourceFile.insertStatements(0, writer => {
            writer.writeLine("/* tslint:disable */")
                .writeLine("/*")
                .writeLine(" * TypeScript Compiler Declaration File")
                .writeLine(" * ====================================")
                .writeLine(" * DO NOT EDIT - This file is automatically generated by createCompilerApiLayer.ts")
                .writeLine(" *")
                .writeLine(" * This file is contains the TypeScript compiler declarations slightly modified.")
                .writeLine(" * Note: The TypeScript compiler is licensed under the Apache 2.0 license.")
                .writeLine(" */");
        });

        tsNamespace.addStatements(writer => {
            writer.newLine();
            writer.writeLine("// overwrite this namespace with the TypeScript compiler");
            writer.write("ObjectUtils.assign((ts as any), tsCompiler);");
        });

        sourceFile.replaceWithText(sourceFile.getFullText().replace(/\r?\n/g, "\r\n"));

        sourceFile.save();

        function addSeparatedDeclarations() {
            for (const enumDec of allEnums.filter(e => enumsToSeparate.indexOf(e.getName()) >= 0))
                cloneEnums(sourceFile, [enumDec]);

            for (const interfaceDec of allInterfaces.filter(i => interfacesToSeparate.indexOf(i.getName()) >= 0))
                cloneInterfaces(sourceFile, [interfaceDec]);

            for (const typeAliasDec of allTypeAliases.filter(t => typeAliasesToSeparate.indexOf(t.getName()) >= 0))
                cloneTypeAliases(sourceFile, [typeAliasDec]);

            // todo: need a better way of doing this in the future...
            const returnTypeNode = sourceFile.getInterfaceOrThrow("CompilerOptions").getIndexSignatures()[0].getReturnTypeNode() as UnionTypeNode;
            returnTypeNode.getTypeNodes().map(n => {
                if (n.getText() === "CompilerOptionsValue" || n.getText() === "JsonSourceFile")
                    n.replaceWithText(`ts.${n.getText()}`);
            });
        }
    }

    function getOrCreateSourceFile(fileName: string) {
        const filePath = path.join(rootFolder, "src/typescript", fileName);
        const existingSourceFile = ast.getSourceFile(filePath);
        if (existingSourceFile != null)
            existingSourceFile.replaceWithText("");
        return existingSourceFile || ast.createSourceFile(filePath);
    }
}
