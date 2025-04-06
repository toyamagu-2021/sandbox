import { CallToolRequestSchema, ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { ArgoCDClient } from "../client/argocd-client.js";

/**
 * Class to handle ArgoCD tool implementations
 */
export class ArgoCDTools {
  private argoCDClient: ArgoCDClient;

  constructor(argoCDClient: ArgoCDClient) {
    this.argoCDClient = argoCDClient;
  }

  /**
   * Get the list of available tools
   */
  getToolsList() {
    const listApplicationSchema: Tool = {
      name: "list_applications",
      description: "List all ArgoCD applications",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    }

    const listProjectsSchema: Tool = {
      name: "list_projects",
      description: "List all ArgoCD projects",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    }

    return [
      listApplicationSchema,
      listProjectsSchema,
    ];
  }

  /**
   * Handle tool execution requests
   * @param request The tool request to handle
   */
  async handleToolRequest(request: any) {
    switch (request.params.name) {
      case "list_applications": {
        return this.listApplications();
      }

      case "list_projects": {
        return this.listProjects();
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  }

  /**
   * Implementation of the list_applications tool
   */
  private async listApplications() {
    try {
      console.log("Received list_applications tool request");

      if (!this.argoCDClient) {
        console.log("ArgoCD client not initialized");
        throw new McpError(
          ErrorCode.InternalError,
          "ArgoCD client is not initialized. Check environment variables."
        );
      }

      // Set a timeout for the operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Operation timed out")), 30000);
      });

      // Race the actual operation against the timeout
      const applications = await Promise.race([
        this.argoCDClient.listApplications(),
        timeoutPromise
      ]) as any[];

      console.log("Applications retrieved successfully, formatting response");

      // If there are no applications, return an empty array with a message
      if (!applications || applications.length === 0) {
        console.log("No applications found");
        return {
          content: [{
            type: "text",
            text: "No ArgoCD applications found."
          }]
        };
      }

      // Simplify the response format even further to reduce processing time
      const simpleApps = applications.map(app => ({
        name: app.metadata.name,
        project: app.spec.project,
        status: app.status.health?.status || "Unknown"
      }));

      console.log("Sending response with simplified applications");
      console.log("Response data:", JSON.stringify(simpleApps));

      // Return a more structured response that might be easier for the SSE transport to handle
      return {
        content: [{
          type: "text",
          text: JSON.stringify(simpleApps),
        }]
      };
    } catch (error) {
      console.error("Error in list_applications tool:", error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Implementation of the list_projects tool
   */
  private async listProjects() {
    try {
      console.log("Received list_projects tool request");

      if (!this.argoCDClient) {
        console.log("ArgoCD client not initialized");
        throw new McpError(
          ErrorCode.InternalError,
          "ArgoCD client is not initialized. Check environment variables."
        );
      }

      // Set a timeout for the operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Operation timed out")), 30000);
      });

      // Race the actual operation against the timeout
      const projects = await Promise.race([
        this.argoCDClient.listProjects(),
        timeoutPromise
      ]) as any[];

      console.log("Projects retrieved successfully, formatting response");

      // If there are no projects, return an empty array with a message
      if (!projects || projects.length === 0) {
        console.log("No projects found");
        return {
          content: [{
            type: "text",
            text: "No ArgoCD projects found."
          }]
        };
      }

      // Simplify the response format to reduce processing time
      const simpleProjects = projects.map(project => ({
        name: project.metadata.name,
        description: project.spec.description || "",
        clusterResourceWhitelist: project.spec.clusterResourceWhitelist || [],
        namespaceResourceWhitelist: project.spec.namespaceResourceWhitelist || [],
        destinations: project.spec.destinations || []
      }));

      console.log("Sending response with simplified projects");
      console.log("Response data:", JSON.stringify(simpleProjects));

      // Return a structured response
      return {
        content: [{
          type: "text",
          text: JSON.stringify(simpleProjects),
        }]
      };
    } catch (error) {
      console.error("Error in list_projects tool:", error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}
