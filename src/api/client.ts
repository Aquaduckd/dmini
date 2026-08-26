import { config } from "../config.js";

export const LAYOUT_API_BASE = `${config.layoutApiBaseUrl.replace(/\/$/, "")}/v1`;

export function requireLayoutApiToken(): string {
  const token = config.layoutApiToken;
  if (!token) {
    throw new Error(
      "LAYOUTAPI_TOKEN is not configured. Add it to .env to use write commands.",
    );
  }
  return token;
}

export function layoutApiAuthHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${requireLayoutApiToken()}`,
  };
}
