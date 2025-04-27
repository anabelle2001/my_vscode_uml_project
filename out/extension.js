"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const parseTreeExt = vscode.extensions.getExtension('pokey.parse-tree');
        if (!parseTreeExt) {
            vscode.window.showErrorMessage('Parse Tree extension not found.');
            return;
        }
        const { getNodeAtLocation } = yield parseTreeExt.activate();
        const disposable = vscode.commands.registerCommand('sampleParseTree.showNode', () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }
            const doc = editor.document;
            const pos = editor.selection.active;
            const offset = doc.offsetAt(pos);
            try {
                const node = yield getNodeAtLocation(doc.uri.fsPath, offset);
                vscode.window.showInformationMessage(`Node type: ${(_a = node === null || node === void 0 ? void 0 : node.type) !== null && _a !== void 0 ? _a : 'none'}`);
            }
            catch (e) {
                vscode.window.showErrorMessage(`Error fetching node: ${e}`);
            }
        }));
        context.subscriptions.push(disposable);
    });
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map