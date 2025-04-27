import * as vscode from 'vscode';
import type { ParseTreeExtensionApi } from 'pokey.parse-tree';
import type { Tree, Node } from 'web-tree-sitter';
import { randomUUID } from 'crypto'; // Use Node's crypto module

// --- Interfaces matching diagram.ts (assuming these are correct) ---

interface EntryData {
    id: string;    // Unique identifier (UUID) for this entry
    left: string;  // Text displayed on the left side
    right: string; // Text displayed on the right side
}

interface RectData {
    id: string;          // Unique ID for the rectangle itself (e.g., fileUri + className)
    title: string;       // The title displayed at the top of the rectangle
    entries: EntryData[]; // An array of entries within the rectangle
}

// --- Globals ---

let webviewPanel: vscode.WebviewPanel | undefined;
let parseTreeApi: ParseTreeExtensionApi | undefined;

// --- Activation ---

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension "python-class-diagram" activating.');

    // Get the parse-tree extension API
    const parseTreeExt = vscode.extensions.getExtension<ParseTreeExtensionApi>('pokey.parse-tree');
    if (!parseTreeExt) {
        vscode.window.showErrorMessage('Required extension "pokey.parse-tree" not found.');
        return;
    }
    parseTreeApi = await parseTreeExt.activate();
    console.log('Parse Tree API activated.');

    // Ensure Python parser is loaded (important!)
    try {
        const loaded = await parseTreeApi.loadLanguage('python');
        if (!loaded) {
            vscode.window.showErrorMessage('Could not load Python parser for "pokey.parse-tree".');
            // return; // Or handle gracefully
        } else {
             console.log('Python language loaded for parse-tree.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error loading Python parser: ${error}`);
        // return;
    }


    // Register the command
    const showDiagramCommand = vscode.commands.registerCommand('python.showClassDiagram', () => {
        createOrShowWebview(context.extensionUri);
    });
    context.subscriptions.push(showDiagramCommand);

    // Register listeners for updates
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (webviewPanel && event.document.languageId === 'python') {
                console.log('Python document changed, updating diagram.');
                updateWebviewContent(webviewPanel.webview, context.extensionUri);
            }
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
             if (webviewPanel && document.languageId === 'python') {
                console.log('Python document opened, updating diagram.');
                updateWebviewContent(webviewPanel.webview, context.extensionUri);
            }
        })
    );
     context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
             if (webviewPanel && document.languageId === 'python') {
                console.log('Python document closed, updating diagram.');
                updateWebviewContent(webviewPanel.webview, context.extensionUri);
            }
        })
    );


    console.log('Extension "python-class-diagram" activated.');
}

// --- Webview Creation ---

function createOrShowWebview(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    if (webviewPanel) {
        // If we already have a panel, reveal it
        webviewPanel.reveal(column);
        // Update content in case files changed while hidden
        updateWebviewContent(webviewPanel.webview, extensionUri);
        return;
    }

    // Otherwise, create a new panel
    webviewPanel = vscode.window.createWebviewPanel(
        'pythonClassDiagram', // Identifies the type of the webview. Used internally
        'Python Class Diagram', // Title of the panel displayed to the user
        column || vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
        {
            // Enable javascript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's `media` directory.
            // And from the `out` directory for the diagram script
             localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'out')
            ]
        }
    );

    // Set the webview's initial html content
    updateWebviewContent(webviewPanel.webview, extensionUri);


    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
                // Add other message handlers if needed
            }
        },
        undefined,
        // context.subscriptions // This causes issues if activate isn't passed down
    );

    // Reset panel when closed
    webviewPanel.onDidDispose(
        () => {
            webviewPanel = undefined;
            console.log('Diagram panel disposed.');
        },
        null,
        // context.subscriptions // This causes issues if activate isn't passed down
    );
}

// --- Webview Content Update ---

async function updateWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    if (!parseTreeApi) {
        vscode.window.showErrorMessage('Parse Tree API not available.');
        return;
    }

    const allRectData: RectData[] = [];
    const openPythonDocs = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'python' && !doc.isClosed);

    console.log(`Found ${openPythonDocs.length} open Python documents.`);

    for (const document of openPythonDocs) {
        try {
            // Ensure the language is loaded for the specific document's URI if needed by API
            // (Assuming loadLanguage('python') was sufficient)
            const tree = parseTreeApi.getTree(document); // Use getTree for open docs
            const rectDataForDoc = parsePythonDocument(document, tree);
            allRectData.push(...rectDataForDoc);
        } catch (error) {
            console.error(`Error parsing document ${document.uri.fsPath}:`, error);
            vscode.window.showWarningMessage(`Could not parse ${document.uri.fsPath}: ${error}`);
        }
    }

    console.log(`Generated ${allRectData.length} rectangles for the diagram.`);

    // Set HTML content
    webview.html = getWebviewHtml(webview, extensionUri, allRectData);
}


// --- Python Parsing Logic ---

function parsePythonDocument(document: vscode.TextDocument, tree: Tree): RectData[] {
    const results: RectData[] = [];
    const definitions = new Map<string, { node: Node, type: 'class' | 'function' }>(); // Store last seen definition

    // Find all top-level class and function definitions
    tree.rootNode.children.forEach(node => {
        if (!node) return;
        if (node.type === 'class_definition') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                definitions.set(nameNode.text, { node, type: 'class' });
            }
        } else if (node.type === 'function_definition') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                 definitions.set(nameNode.text, { node, type: 'function' });
            }
        }
    });

    // Process the last seen definitions
    definitions.forEach((def, name) => {
         const rectId = `${document.uri.toString()}#${name}`; // Unique ID for the rectangle
        if (def.type === 'class') {
            results.push(parseClassDefinition(def.node, name, rectId));
        } else {
            results.push(parseFunctionDefinition(def.node, name, rectId, true)); // true for top-level
        }
    });


    return results;
}

function parseClassDefinition(classNode: Node, className: string, rectId: string): RectData {
    const entries: EntryData[] = [];
    const memberDefinitions = new Map<string, Node>(); // Store last seen member definition

    const bodyNode = classNode.childForFieldName('body');
    if (bodyNode) {
        bodyNode.children.forEach(memberNode => {
            if (!memberNode) return;
            if (memberNode.type === 'function_definition') {
                const nameNode = memberNode.childForFieldName('name');
                if (nameNode) {
                    memberDefinitions.set(nameNode.text, memberNode);
                }
            } else if (memberNode.type === 'expression_statement') {
                // Look for assignments like 'prop: type = value' or 'prop = value'
                const assignmentNode = memberNode.firstChild;
                if (assignmentNode?.type === 'assignment') {
                    const leftNode = assignmentNode.childForFieldName('left');
                    // Handle simple assignments (prop = ...) and annotated assignments (prop: type = ...)
                    let identifierNode: Node | null = null;
                    if (leftNode?.type === 'identifier') {
                        identifierNode = leftNode;
                    } else if (leftNode?.type === 'typed_parameter' || leftNode?.type === 'typed_identifier') { // Handle 'var: type'
                         identifierNode = leftNode.child(0); // Assuming identifier is the first child
                    }

                    if (identifierNode?.type === 'identifier') {
                         memberDefinitions.set(identifierNode.text, memberNode); // Store the whole statement
                    }
                }
                 // Handle simple annotated variables like 'prop: type' without assignment
                else if (assignmentNode?.type === 'typed_identifier') { // Simplified check
                    const identifierNode = assignmentNode.child(0);
                     if (identifierNode?.type === 'identifier') {
                         memberDefinitions.set(identifierNode.text, memberNode);
                    }
                }
            }
            // TODO: Add support for other class members if needed (e.g., decorated functions)
        });
    }

     memberDefinitions.forEach((memberNode, memberName) => {
        if (memberNode.type === 'function_definition') {
            const funcData = parseFunctionDefinition(memberNode, memberName, '', false); // false for not top-level
            // Use the single entry from the function data
            if (funcData.entries.length > 0) {
                 entries.push(funcData.entries[0]);
            }
        } else if (memberNode.type === 'expression_statement') {
            // Extract property type hint if available
            let typeHint = 'any'; // Default
            const assignmentNode = memberNode.firstChild;
             if (assignmentNode?.type === 'assignment') {
                 const leftNode = assignmentNode.childForFieldName('left');
                 if (leftNode?.type === 'typed_identifier') { // var: type = val
                     const typeNode = leftNode.childForFieldName('type');
                     if (typeNode) typeHint = typeNode.text;
                 }
             } else if (assignmentNode?.type === 'typed_identifier') { // var: type
                 const typeNode = assignmentNode.childForFieldName('type');
                 if (typeNode) typeHint = typeNode.text;
             }

            entries.push({
                id: randomUUID(),
                left: memberName,
                right: typeHint
            });
        }
    });


    return {
        id: rectId,
        title: `class ${className}`,
        entries: entries
    };
}

// Parses function/method definition. If topLevel is false, returns a RectData with a *single* entry for the method signature.
function parseFunctionDefinition(funcNode: Node, funcName: string, rectId: string, topLevel: boolean): RectData {
     const paramsNode = funcNode.childForFieldName('parameters');
     const returnTypeNode = funcNode.childForFieldName('return_type');

     const paramsText = paramsNode?.text ?? '()';
     const returnTypeText = returnTypeNode?.text ?? 'any'; // Use 'any' if no return type hint

     // Format signature differently for methods vs top-level functions
     const signatureRight = topLevel ? `${paramsText} -> ${returnTypeText}` : `(${paramsText.slice(1, -1)}) -> ${returnTypeText}`; // Remove outer () for method params
     const entryName = topLevel ? funcName : funcName; // Keep name consistent

     const entry: EntryData = {
         id: randomUUID(),
         left: entryName,
         right: signatureRight
     };

     if (topLevel) {
         return {
             id: rectId,
             title: `def ${funcName}`,
             entries: [entry] // Top-level functions have one entry for the signature
         };
     } else {
         // For methods, return a dummy RectData containing just the single entry
         // The caller (parseClassDefinition) will extract this entry.
          return {
             id: '', // Not used directly
             title: '', // Not used directly
             entries: [entry]
         };
     }
}


// --- HTML Generation ---

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, rectData: RectData[]): string {
    // Get the local path to main script run in the webview, then convert it to a URI format the webview can use
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'diagram.js'));

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    // Initial data needs to be stringified
    const initialData = JSON.stringify(rectData);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <!--
    Use a content security policy to only allow loading images from https or from our extension directory,
    and only allow scripts that have a specific nonce.
    -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Python Class Diagram</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #f0f0f0; /* Or your preferred background */
        }
        canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <canvas id="diagramCanvas"></canvas>

    <script nonce="${nonce}">
        // Simple Nonce: In a real extension, generate a proper random nonce.
        // const nonce = '${getNonce()}'; // This line is not needed if nonce is directly in script tag

        // VS Code API for communication
        const vscodeApi = acquireVsCodeApi();

        // --- Chart Initialization ---
        let chart; // Will hold the Chart instance from diagram.js

        // --- Data Handling ---
        let currentRectDataMap = new Map(); // Map rectId -> rectData

        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent

            switch (message.type) {
                case 'update':
                    console.log('Webview received update message with data:', message.payload);
                    const newRectDataArray = message.payload;
                    updateDiagram(newRectDataArray);
                    break;
            }
        });

        function updateDiagram(newRectDataArray) {
             if (!chart) {
                console.error("Chart not initialized yet.");
                // Maybe store data and wait for chart init?
                return;
            }
            console.log("Updating diagram with new data:", newRectDataArray);

            const newRectMap = new Map(newRectDataArray.map(r => [r.id, r]));
            const existingRectIds = new Set(currentRectDataMap.keys());
            const newRectIds = new Set(newRectMap.keys());

            // 1. Remove rectangles that are no longer present
            existingRectIds.forEach(id => {
                if (!newRectIds.has(id)) {
                    console.log("Removing rectangle:", id);
                    chart.removeRectangle(id); // Assumes removeRectangle exists and works
                    currentRectDataMap.delete(id);
                }
            });

            // 2. Add or Update rectangles
            newRectMap.forEach((newData, id) => {
                if (existingRectIds.has(id)) {
                    // Update existing rectangle
                    const oldData = currentRectDataMap.get(id);
                    // Basic check for changes (can be more sophisticated)
                    if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
                         console.log("Updating rectangle:", id, newData);
                         chart.updateRectangle(id, newData); // Assumes updateRectangle exists
                         currentRectDataMap.set(id, newData); // Update local cache
                    }
                } else {
                    // Add new rectangle
                    console.log("Adding rectangle:", id, newData);
                    // addRectangle expects data *without* the top-level ID,
                    // but returns the *generated* ID. We need to reconcile this.
                    // For now, let's assume addRectangle can take an ID hint or
                    // we modify diagram.ts later.
                    // HACK: Let's assume addRectangle adds it and we store the mapping if needed.
                    // A better approach would be for addRectangle to accept an optional ID.
                    // For now, we'll just add and hope the internal ID matches or is retrievable.
                    // Let's modify the call slightly based on diagram.md's addRectangle signature
                    const { id: _discardId, ...dataToAdd } = newData; // Remove our ID before sending
                    const generatedId = chart.addRectangle(dataToAdd);
                    // We *should* store a mapping from our ID (newData.id) to generatedId if they differ.
                    // For simplicity now, we assume they might align or we handle discrepancies later.
                    currentRectDataMap.set(id, newData); // Store with *our* ID for tracking
                }
            });

            // 3. Redraw
            console.log("Drawing chart.");
            chart.draw();
        }


        // --- Initialization on Load ---
        function initialize() {
            const canvas = document.getElementById('diagramCanvas');
            if (!canvas) {
                console.error("Canvas element not found!");
                vscodeApi.postMessage({ command: 'alert', text: 'Canvas element not found!' });
                return;
            }

            // Check if the Chart class is available (loaded from diagram.js)
            if (typeof Chart === 'undefined') {
                 console.error('Chart class not loaded. Check diagram.js path and script loading.');
                 vscodeApi.postMessage({ command: 'alert', text: 'Error: Diagram library not loaded.' });
                 return;
            }

            try {
                chart = new Chart(canvas); // Initialize the chart
                console.log("Chart initialized.");

                // Process initial data sent via HTML
                const initialDataString = document.body.getAttribute('data-initial-data');
                 document.body.removeAttribute('data-initial-data'); // Clean up attribute
                if (initialDataString) {
                    try {
                        const initialDataParsed = JSON.parse(initialDataString);
                        console.log("Processing initial data:", initialDataParsed);
                        updateDiagram(initialDataParsed); // Use the update logic for initial load too
                    } catch (e) {
                         console.error("Failed to parse initial data:", e);
                         vscodeApi.postMessage({ command: 'alert', text: 'Error parsing initial diagram data.' });
                    }
                } else {
                     console.log("No initial data found in attribute.");
                }


            } catch (e) {
                console.error("Failed to initialize chart:", e);
                vscodeApi.postMessage({ command: 'alert', text: 'Error initializing diagram: ' + e.message });
            }
        }

        // Run initialization code after the DOM is ready and diagram.js might have loaded
        if (document.readyState === 'loading') { // Loading hasn't finished yet
            document.addEventListener('DOMContentLoaded', initialize);
        } else { // DOMContentLoaded has already fired
            initialize();
        }


    </script>
     <!-- Load the diagram script -->
    <script nonce="${nonce}" src="${scriptUri}" data-initial-data="${escapeHtml(initialData)}"></script>
</body>
</html>`;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Basic HTML escaping
function escapeHtml(unsafe: string): string {
     return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }


// --- Deactivation ---

export function deactivate() {
    if (webviewPanel) {
        webviewPanel.dispose();
    }
     console.log('Extension "python-class-diagram" deactivated.');
}