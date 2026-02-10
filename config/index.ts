import dotenv from 'dotenv';
import { envSchema, type EnvConfig } from './schema.js';
import { defaultConfig } from './default.js';

dotenv.config();

let cachedEnv: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function tryLoadEnv(): Partial<EnvConfig> {
  try {
    return loadEnv();
  } catch {
    // Return whatever we can parse without validation
    return process.env as Partial<EnvConfig>;
  }
}

export function clearEnvCache(): void {
  cachedEnv = null;
}

export { defaultConfig };
export type { EnvConfig };
