import { getNxWorkspaceProjects } from '@nx-console/vscode-nx-workspace';
import { getTelemetry } from '@nx-console/vscode-telemetry';
import {
  CancellationToken,
  commands,
  LanguageModelTextPart,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  PreparedToolInvocation,
} from 'vscode';

export interface VisualizeProjectGraphToolInput {
  projectName: string;
}

export class VisualizeProjectGraphTool
  implements LanguageModelTool<VisualizeProjectGraphToolInput>
{
  async invoke(
    options: LanguageModelToolInvocationOptions<VisualizeProjectGraphToolInput>,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const { projectName } = options.input;

    getTelemetry().logUsage('ai.tool-call', {
      tool: 'nx_visualize_project_graph_project',
    });

    const workspaceProjects = await getNxWorkspaceProjects();
    if (!workspaceProjects || !workspaceProjects[projectName]) {
      throw new Error(`Cannot find project "${projectName}"`);
    }

    await commands.executeCommand('nx.graph.focus', projectName);

    return new LanguageModelToolResult([
      new LanguageModelTextPart(
        `Opening the Nx project graph focused on project "${projectName}". There can only be one graph visualization open at a time so avoid similar tool calls unless the user specifically requests it.`,
      ),
    ]);
  }

  prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<VisualizeProjectGraphToolInput>,
    token: CancellationToken,
  ): PreparedToolInvocation {
    return {
      invocationMessage: `Opening project graph visualization for "${options.input.projectName}"...`,
    };
  }
}
