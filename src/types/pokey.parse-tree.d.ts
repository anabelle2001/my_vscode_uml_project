declare module 'pokey.parse-tree' {
  export interface ParseTreeExtensionApi {
    getNodeAtLocation(path: string, offset: number): Promise<{ type: string } | null>;
    registerLanguage?(languageId: string, wasmPath: string): void;
  }
}
