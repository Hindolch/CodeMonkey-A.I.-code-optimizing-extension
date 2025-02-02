const vscode = require('vscode');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyBcCjVkUfxYJi331InL5D2Hb3sj33W1Ng4');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Queue for managing concurrent requests
class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        const { task, resolve, reject } = this.queue.shift();
        
        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process();
        }
    }
}

const requestQueue = new RequestQueue();

async function optimizeCode(code) {
    try {
        const prompt = `Refactor and optimize the following code for:
        - Performance: efficient algorithms and data structures
        - Readability: clear, meaningful variable names and formatting
        - Efficiency: elimination of redundancy
        - Conciseness: streamlined, maintainable code

        Return only the optimized code without any extra text.

        ### Input Code:
        ${code}

        ### Optimized Code:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        throw new Error(`Failed to optimize code: ${error.message}`);
    }
}

async function processCodeOptimization(code, progressTitle) {
    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        },
        async () => {
            return await requestQueue.add(() => optimizeCode(code));
        }
    );
}

function activate(context) {
    console.log('CodeMonkey extension is now active');

    const disposables = [
        vscode.commands.registerCommand('codemonkey.refactorCode', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    throw new Error('No active editor');
                }

                const document = editor.document;
                const code = document.getText();
                
                const optimizedCode = await processCodeOptimization(
                    code,
                    "Optimizing entire code with CodeMonkey..."
                );

                await editor.edit(editBuilder => {
                    const fullRange = new vscode.Range(
                        document.lineAt(0).range.start,
                        document.lineAt(document.lineCount - 1).range.end
                    );
                    editBuilder.replace(fullRange, optimizedCode);
                });

                vscode.window.showInformationMessage('Code optimization complete!');
            } catch (error) {
                vscode.window.showErrorMessage(`Optimization failed: ${error.message}`);
            }
        }),

        vscode.languages.registerHoverProvider('*', {
            provideHover(document, position) {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.selection.isEmpty) return;

                const debugCommandUri = vscode.Uri.parse(
                    `command:codemonkey.debugSpecificCode?${encodeURIComponent(
                        JSON.stringify({ selectedText: document.getText(editor.selection) })
                    )}`
                );
                
                const hoverMessage = new vscode.MarkdownString(
                    `[Optimize selected code](${debugCommandUri})`
                );
                hoverMessage.isTrusted = true;
                
                return new vscode.Hover(hoverMessage);
            }
        }),

        vscode.commands.registerCommand('codemonkey.debugSpecificCode', async (args) => {
            try {
                if (!args || !args.selectedText) {
                    throw new Error('No code selected');
                }

                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    throw new Error('No active editor');
                }

                const optimizedCode = await processCodeOptimization(
                    args.selectedText,
                    "Optimizing selected code with CodeMonkey..."
                );

                await editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, optimizedCode);
                });

                vscode.window.showInformationMessage('Code optimization complete!');
            } catch (error) {
                vscode.window.showErrorMessage(`Optimization failed: ${error.message}`);
            }
        })
    ];

    context.subscriptions.push(...disposables);
}

function deactivate() {
    // Cleanup any pending operations
    requestQueue.queue = [];
}

module.exports = {
    activate,
    deactivate
};


