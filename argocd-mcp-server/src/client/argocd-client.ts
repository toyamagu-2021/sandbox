import axios, { AxiosInstance } from "axios";
import https from "https";

/**
 * ArgoCD API Client
 * Handles communication with the ArgoCD API
 */
export class ArgoCDClient {
  private axiosInstance: AxiosInstance;
  private token: string | null = null;

  constructor() {
    // Get ArgoCD server URL and credentials from environment variables
    const serverUrl = process.env.ARGOCD_SERVER_URL;
    const username = process.env.ARGOCD_USERNAME;
    const password = process.env.ARGOCD_PASSWORD;
    const token = process.env.ARGOCD_TOKEN;

    if (!serverUrl) {
      throw new Error("ARGOCD_SERVER_URL environment variable is required");
    }

    // Create axios instance for ArgoCD API
    this.axiosInstance = axios.create({
      baseURL: serverUrl,
      headers: {
        "Content-Type": "application/json",
      },
      // Disable TLS verification for self-signed certificates
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    // If token is provided, use it directly
    if (token) {
      this.token = token;
      this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    // Otherwise, we'll need username and password for authentication
    else if (!username || !password) {
      throw new Error("Either ARGOCD_TOKEN or both ARGOCD_USERNAME and ARGOCD_PASSWORD environment variables are required");
    }
  }

  /**
   * Authenticate with ArgoCD API using username and password
   * Only needed if token wasn't provided
   */
  async authenticate(): Promise<void> {
    if (this.token) return; // Skip if we already have a token

    try {
      console.log("Starting authentication...");
      const username = process.env.ARGOCD_USERNAME;
      const password = process.env.ARGOCD_PASSWORD;

      console.log("Has username:", !!username);
      console.log("Has password:", !!password);
      console.log("Making authentication request to /api/v1/session...");

      const response = await this.axiosInstance.post("/api/v1/session", {
        username,
        password,
      });

      console.log("Authentication response received:", response.status);
      this.token = response.data.token;
      console.log("Token received:", !!this.token);
      this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;
    } catch (error) {
      console.error("Failed to authenticate with ArgoCD:", error);
      if (axios.isAxiosError(error)) {
        console.error("Request details:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw new Error("Authentication with ArgoCD failed");
    }
  }

  /**
   * List all applications in ArgoCD
   */
  async listApplications(): Promise<any[]> {
    try {
      console.log("Starting listApplications...");
      console.log("Server URL:", process.env.ARGOCD_SERVER_URL);
      console.log("Has token:", !!this.token);

      // Ensure we're authenticated
      if (!this.token) {
        console.log("No token, authenticating...");
        await this.authenticate();
        console.log("Authentication successful, token received");
      }

      console.log("Making request to /api/v1/applications...");
      const response = await this.axiosInstance.get("/api/v1/applications");
      console.log("Response received:", response.status);
      console.log("Applications count:", response.data.items?.length || 0);
      return response.data.items || [];
    } catch (error) {
      console.error("Failed to list ArgoCD applications:", error);
      if (axios.isAxiosError(error)) {
        console.error("Request details:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw new Error("Failed to list ArgoCD applications");
    }
  }

  /**
   * List all projects in ArgoCD
   */
  async listProjects(): Promise<any[]> {
    try {
      console.log("Starting listProjects...");
      console.log("Server URL:", process.env.ARGOCD_SERVER_URL);
      console.log("Has token:", !!this.token);

      // Ensure we're authenticated
      if (!this.token) {
        console.log("No token, authenticating...");
        await this.authenticate();
        console.log("Authentication successful, token received");
      }

      console.log("Making request to /api/v1/projects...");
      const response = await this.axiosInstance.get("/api/v1/projects");
      console.log("Response received:", response.status);
      console.log("Projects count:", response.data.items?.length || 0);
      return response.data.items || [];
    } catch (error) {
      console.error("Failed to list ArgoCD projects:", error);
      if (axios.isAxiosError(error)) {
        console.error("Request details:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw new Error("Failed to list ArgoCD projects");
    }
  }
}
