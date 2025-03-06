import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  NxMcpServerWrapper,
  NxWorkspaceInfoProvider,
} from '@nx-console/nx-mcp-server';
import { IdeCallbackMessage } from '@nx-console/shared-types';
import { getNxWorkspacePath } from '@nx-console/vscode-configuration';
import {
  getGenerators,
  getNxWorkspace,
  getNxWorkspaceProjects,
} from '@nx-console/vscode-nx-workspace';
import { getOutputChannel } from '@nx-console/vscode-output-channels';
import { getNxMcpPort, vscodeLogger } from '@nx-console/vscode-utils';
import { commands } from 'vscode';
import express from 'express';
import { window } from 'vscode';
import { getTelemetry } from '@nx-console/vscode-telemetry';

export interface McpServerReturn {
  server: NxMcpServerWrapper;
  app: express.Application;
  server_instance: ReturnType<express.Application['listen']>;
}

let mcpServerReturn: McpServerReturn | undefined;

export function tryStartMcpServer(workspacePath: string) {
  const port = getNxMcpPort();
  if (!port) {
    return;
  }
  const nxWorkspaceInfoProvider: NxWorkspaceInfoProvider = {
    nxWorkspace: async (_, __, reset) => await getNxWorkspace(reset),
    getGenerators: async (_, options) => await getGenerators(options),
  };
  const server = new NxMcpServerWrapper(
    workspacePath,
    nxWorkspaceInfoProvider,
    mcpIdeCallback,
    getTelemetry(),
    vscodeLogger,
  );

  const app = express();
  let transport: SSEServerTransport;
  app.get('/sse', async (req, res) => {
    vscodeLogger.log('SSE connection established');
    transport = new SSEServerTransport('/messages', res);
    await server.getMcpServer().connect(transport);
  });

  app.post('/messages', async (req, res) => {
    if (!transport) {
      res.status(400).send('No transport found');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  const server_instance = app.listen(port);
  vscodeLogger.log(`MCP server started on port ${port}`);

  mcpServerReturn = { server, app, server_instance };
}

export async function restartMcpServer() {
  stopMcpServer();
  tryStartMcpServer(getNxWorkspacePath());
}

export function stopMcpServer() {
  if (mcpServerReturn) {
    getOutputChannel().appendLine('Stopping MCP server');
    mcpServerReturn.server_instance.close();
  }
}

export function updateMcpServerWorkspacePath(workspacePath: string) {
  if (mcpServerReturn) {
    mcpServerReturn.server.setNxWorkspacePath(workspacePath);
  }
}

async function mcpIdeCallback({ type, payload }: IdeCallbackMessage) {
  if (type === 'focus-project') {
    const workspaceProjects = await getNxWorkspaceProjects();
    if (!workspaceProjects || !workspaceProjects[payload.projectName]) {
      window.showErrorMessage(`Cannot find project "${payload.projectName}"`);
      return;
    }
    commands.executeCommand('nx.graph.focus', payload.projectName);
  } else if (type === 'focus-task') {
    const workspaceProjects = await getNxWorkspaceProjects();
    if (!workspaceProjects || !workspaceProjects[payload.projectName]) {
      window.showErrorMessage(`Cannot find project "${payload.projectName}"`);
      return;
    }
    if (
      !workspaceProjects[payload.projectName].data.targets?.[payload.taskName]
    ) {
      window.showErrorMessage(
        `Cannot find task "${payload.taskName}" in project "${payload.projectName}"`,
      );
      return;
    }

    commands.executeCommand('nx.graph.task', {
      projectName: payload.projectName,
      taskName: payload.taskName,
    });
  }
}
