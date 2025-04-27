import * as vscode from 'vscode';
import type { ParseTreeExtensionApi } from "pokey.parse-tree";

export async function activate(context: vscode.ExtensionContext) {
  const parseTreeExt = vscode.extensions.getExtension<ParseTreeExtensionApi>('pokey.parse-tree');
  if (!parseTreeExt) {
    vscode.window.showErrorMessage('Parse Tree extension not found.');
    return;
  }
  const { getNodeAtLocation } = await parseTreeExt.activate();

  const disposable = vscode.commands.registerCommand('sampleParseTree.showNode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }

    try {
      // Get the node at the primary selection's active position
      const position = editor.selection.active;
      const location = new vscode.Location(editor.document.uri, position);
      const node = getNodeAtLocation(location); // Call getNodeAtLocation here

      vscode.window.showInformationMessage(`Node type: ${node?.type ?? 'none'}`);
    } catch (e) {
       // Check if e is an Error object before accessing message
       const errorMessage = e instanceof Error ? e.message : String(e);
       vscode.window.showErrorMessage(`Error fetching node: ${errorMessage}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
