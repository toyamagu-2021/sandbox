#!/usr/bin/env node

/**
 * ArgoCD MCP Server
 * This server provides tools to interact with ArgoCD API
 * Currently implements:
 * - List ArgoCD Applications
 * - List ArgoCD Projects
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { ArgoCDClient } from "./client/argocd-client.js";
import { ArgoCDTools } from "./tools/argocd-tools.js";

// Default port for the SSE server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 58082;

/**
 * Create an MCP server with capabilities for tools to interact with ArgoCD
 */
const server = new Server(
  {
    name: "argocd-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Create ArgoCD client instance
let argoCDClient: ArgoCDClient;
let argoCDTools: ArgoCDTools;

try {
  argoCDClient = new ArgoCDClient();
  argoCDTools = new ArgoCDTools(argoCDClient);
} catch (error) {
  console.error("Failed to initialize ArgoCD client:", error);
  // We'll continue without the client and report errors when tools are called
}

/**
 * Handler that lists available tools.
 * Exposes the following tools:
 * - "list_applications" tool that returns all ArgoCD applications
 * - "list_projects" tool that returns all ArgoCD projects
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: argoCDTools.getToolsList()
  };
});

/**
 * Handler for the ArgoCD tools.
 * Currently implements:
 * - list_applications: Returns a list of all ArgoCD applications
 * - list_projects: Returns a list of all ArgoCD projects
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return argoCDTools.handleToolRequest(request);
});

async function launchStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Cleanup on exit
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}


async function launchSSEServer() {
  // Create Express app
  const app = express();

  // Enable CORS
  app.use(cors());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });
  // Store multiple transports by sessionId
  const transports = new Map<string, SSEServerTransport>();

  // Set up SSE endpoint
  app.get("/sse", async (req, res) => {
    try {
      // Set appropriate headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Create SSE transport for this connection
      const transport = new SSEServerTransport("/message", res);
      const sessionId = transport.sessionId;
      console.error(`Connecting to transport ${sessionId}`);

      // Store the transport
      transports.set(sessionId, transport);
      await server.connect(transport);
      console.log(`Transport ${sessionId} connected successfully`);

      // // Send initial connection success message
      // res.write(`data: ${JSON.stringify({ type: "connection", status: "connected", sessionId })}\n\n`);

      // Handle client disconnect
      req.on('close', () => {
        console.log(`Client disconnected from transport ${sessionId}`);
        transports.delete(sessionId);
      });

      // Handle errors on the response
      res.on('error', (err) => {
        console.error(`Error on response for ${sessionId}:`, err);
        transports.delete(sessionId);
      });
    } catch (error) {
      console.error("Error in SSE endpoint:", error);
      // Only set status if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    }
  });

  app.post("/message", async (req, res) => {
    try {
      // Extract sessionId from request
      const sessionId = req.query.sessionId as string ||
        req.headers['x-mcp-session-id'] as string;

      console.log(`Received message for session ${sessionId}`);

      if (!sessionId) {
        console.log("No sessionId provided");
        res.status(400).json({ error: "No sessionId provided" });
        return;
      }

      const transport = transports.get(sessionId);

      if (!transport) {
        console.log(`No transport found for session ${sessionId}`);
        res.status(404).json({ error: "Transport not found" });
        return;
      }

      console.log(`Posting message to transport ${sessionId}`);

      transport.handlePostMessage(req, res);
      console.log(`Message for session ${sessionId} handled successfully`);
    } catch (error) {
      console.error(`Error in message endpoint:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // Start Express server
  app.listen(PORT, () => {
    console.error(`ArgoCD MCP server running on http://localhost:${PORT}/sse`);
  });
}

/**
 * Start the server using the configured transport.
 * This sets up either an Express server with an SSE endpoint or a stdio transport.
 */
async function main() {
  const transportType = process.env.MCP_SERVER_TRANSPORT || "sse";
  if (transportType === "sse") {
    return launchSSEServer();
  } else if (transportType === "stdio") {
    return launchStdioServer();
  } else {
    throw new Error(`Invalid transport type: ${transportType}`);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
