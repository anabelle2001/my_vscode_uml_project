
declare module "pokey.parse-tree" {
  import type * as vscode from "vscode";
  import type { Language, Tree, Node } from "web-tree-sitter";
  export interface ParseTreeExtensionApi {
    /**
     * Load the parser model for a given language
     * @param languageId The vscode language id of the language to load
     * @returns a promise resolving to boolean an indicating whether the language could be loaded
     */
    loadLanguage(languageId: string): Promise<boolean>;

    /**
     * Get the tree-sitter Language object for a given language id, if already loaded.
     * Returns undefined if the language is not loaded or not supported.
     * @param languageId The vscode language id
     * @returns The tree-sitter Language object or undefined
     */
    getLanguage(languageId: string): Language | undefined;

    /**
     * Register a parser wasm file for a language not supported by this extension.
     * Note that `wasmPath` must be an absolute path, and `languageId` must not
     * already have a registered parser.
     * @param languageId The VSCode language id that you'd like to register a parser for
     * @param wasmPath The absolute path to the wasm file for your parser
     */
    registerLanguage(languageId: string, wasmPath: string): void;

    /**
     * Get the parse tree for a given document. Will throw an error if the
     * language is not supported or the parser is still loading.
     * @param document The document to get the tree for
     * @returns The parse tree for the document
     */
    getTree(document: vscode.TextDocument): Tree;

    /**
     * Get the parse tree for a given URI. Will throw an error if the URI is not
     * open, the language is not supported or the parser is still loading.
     * @param uri The URI to get the tree for
     * @returns The parse tree for the URI
     */
    getTreeForUri(uri: vscode.Uri): Tree;

    /**
     * Get the syntax node at a given location. Will throw an error if the
     * document is not open, the language is not supported or the parser is still loading.
     * @param location The location to get the node at
     * @returns The syntax node at the location
     */
    getNodeAtLocation(location: vscode.Location): Node;
  }
}
