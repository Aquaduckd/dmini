import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  token: requireEnv("DISCORD_TOKEN"),
  layoutApiBaseUrl:
    process.env.LAYOUTAPI_URL?.trim() || "https://clemenpine.com/layoutapi",
  layoutApiToken: process.env.LAYOUTAPI_TOKEN?.trim() || "",
};
