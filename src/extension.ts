import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ClassInfo {
    name: string;
    methods: string[];
}

function parseClassesAndMethods(content: string): ClassInfo[] {
    const classRegex = /class\s+(\w+)/g;
    const methodRegex = /(?:public|private|protected)?\s*(?:async\s*)?(\w+)\s*\([^)]*\)\s*{/g;

    let classes: ClassInfo[] = [];
    let classMatch: RegExpExecArray | null;

    while ((classMatch = classRegex.exec(content)) !== null) {
        const className = classMatch[1];
        const classStart = classMatch.index;
        // Find the class body by locating the next '{' after class keyword
        const bodyStart = content.indexOf('{', classStart);
        if (bodyStart === -1) continue;

        // Find matching closing brace for the class body
        let braceCount = 1;
        let pos = bodyStart + 1;
        while (pos < content.length && braceCount > 0) {
            if (content[pos] === '{') braceCount++;
            else if (content[pos] === '}') braceCount--;
            pos++;
        }
        const classBody = content.substring(bodyStart, pos);

        // Find methods inside class body
        let methods: string[] = [];
        let methodMatch: RegExpExecArray | null;
        while ((methodMatch = methodRegex.exec(classBody)) !== null) {
            const methodName = methodMatch[1];
            if (methodName !== 'constructor') {
                methods.push(methodName);
            }
        }

        classes.push({ name: className, methods });
    }

    return classes;
}

async function scanWorkspaceForClasses(): Promise<ClassInfo[]> {
    const classes: ClassInfo[] = [];
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return classes;
    }
    const folderUri = vscode.workspace.workspaceFolders[0].uri;

    const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,java,py,cs}', '**/node_modules/**');

    for (const file of files) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            const fileClasses = parseClassesAndMethods(content);
            classes.push(...fileClasses);
        } catch (error) {
            console.error(`Failed to read file ${file.fsPath}: ${error}`);
        }
    }
    return classes;
}

function generateReadmeContent(classes: ClassInfo[]): string {
    let content = `# Project Overview\n\n`;
    if (classes.length === 0) {
        content += 'No classes or methods found in the project.\n';
    } else {
        for (const cls of classes) {
            content += `## Class: ${cls.name}\n\n`;
            if (cls.methods.length === 0) {
                content += '_No methods found_\n\n';
            } else {
                content += `### Methods:\n`;
                for (const method of cls.methods) {
                    content += `- \`${method}()\`\n`;
                }
                content += '\n';
            }
        }
    }

    content += `# How to Use\n\n`;
    content += `Explain how to use the project here.\n\n`;

    content += `# How to Contribute\n\n`;
    content += `Explain how to contribute to the project here.\n\n`;

    content += `# Additional Information\n\n`;
    content += `Add any other important information about the project here.\n`;

    return content;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('readme-generator.generateReadme', async () => {
        const classes = await scanWorkspaceForClasses();
        const readmeContent = generateReadmeContent(classes);

        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
        const readmeUri = vscode.Uri.joinPath(folderUri, 'README.md');

        try {
            await vscode.workspace.fs.writeFile(readmeUri, Buffer.from(readmeContent, 'utf8'));
            vscode.window.showInformationMessage('README.md generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write README.md: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
