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
      const tree = parseTreeExt.exports.getTreeForUri(editor.document.uri);

      vscode.window.showInformationMessage(`Node type: ${node?.type ?? 'none'}`);
    } catch (e) {
      vscode.window.showErrorMessage(`Error fetching node: ${e}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
