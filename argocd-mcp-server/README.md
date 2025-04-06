# ArgoCD MCP Server

This is a Model Context Protocol (MCP) server that provides tools to interact with ArgoCD using Server-Sent Events (SSE).

## Features

Currently, this server provides the following tools:

- `list_applications`: Lists all ArgoCD applications with their status
- `list_projects`: Lists all ArgoCD projects with their details

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the server:
   ```
   npm run build
   ```
4. Set up environment variables:
   - Create a `.env` file in the root directory of the project and add your ArgoCD server URL and credentials.
   - Example `.env` file:
     ```
     ARGOCD_SERVER_URL=https://argocd.example.com
     ARGOCD_TOKEN=your-token
     ```
     ```
     ARGOCD_SERVER_URL=https://argocd.example.com
     ARGOCD_USERNAME=your-username
     ARGOCD_PASSWORD=your-password
     ```
5. Start the server:
   ```
   npm run start
   ```

## Configuration

The server requires the following environment variables:

- `ARGOCD_SERVER_URL`: The URL of your ArgoCD server (e.g., `https://argocd.example.com`)

And either:
- `ARGOCD_TOKEN`: An ArgoCD API token

Or:
- `ARGOCD_USERNAME`: ArgoCD username
- `ARGOCD_PASSWORD`: ArgoCD password

You can also set the port for the SSE server (default is 58082):
- `PORT`: The port number for the SSE server

## Usage with Claude

To use this MCP server with Claude, add it to your MCP settings configuration file.

### Cline Configuration

For the Cline VSCode extension, edit the MCP settings file at:
`~/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

#### Command-based Configuration (Recommended)

```json
{
  "mcpServers": {
    "argocd": {
      "command": "node",
      "args": ["/path/to/argocd-mcp-server/build/index.js"],
      "env": {
        "ARGOCD_SERVER_URL": "https://argocd.example.com",
        "ARGOCD_TOKEN": "your-argocd-token",
        "PORT": "58082"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### URL-based Configuration (Alternative)

If you're running the server separately:

```json
{
  "mcpServers": {
    "argocd": {
      "url": "http://localhost:58082/sse",
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop Configuration

For the Claude desktop app, edit the configuration file at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

The format is the same as shown above.

## Example Usage

Once the MCP server is configured and running, you can ask Claude to use it:

```
Can you list all my ArgoCD applications?
```

Claude will use the `list_applications` tool to fetch and display your ArgoCD applications.

You can also ask:

```
Can you show me all my ArgoCD projects?
```

Claude will use the `list_projects` tool to fetch and display your ArgoCD projects.

## Development

To run the server directly:

```
npm run start
```

To run the server in watch mode during development:

```
npm run watch
```

To test the server with the MCP inspector:

```
npm run inspector
```

Note: When running the server directly with `npm run start`, you need to set the required environment variables:

```
ARGOCD_SERVER_URL=https://argocd.example.com ARGOCD_TOKEN=your-token npm run start
```
