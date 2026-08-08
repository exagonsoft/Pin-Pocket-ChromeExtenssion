const isDev = !import.meta.env.PROD;

const DEV_SERVER = "https://85kg1nl8-3000.brs.devtunnels.ms";
const PROD_SERVER = "https://pinity.uk"

export const CONFIG = {
  API_BASE: isDev ? `${DEV_SERVER}/api` : `${PROD_SERVER}/api`,
  BACKEND_BASE: isDev ? DEV_SERVER : `${PROD_SERVER}`,
} as const;
