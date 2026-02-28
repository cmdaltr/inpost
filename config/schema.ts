import { z } from 'zod';

export const envSchema = z
  .object({
    NOTION_API_TOKEN: z.string().min(1, 'NOTION_API_TOKEN is required'),
    NOTION_DATABASE_ID: z.string().uuid('NOTION_DATABASE_ID must be a valid UUID'),
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_REDIRECT_URI: z
      .string()
      .url()
      .default('http://localhost:3456/callback'),
    GROQ_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    LOG_LEVEL: z
      .string()
      .optional()
      .transform((val) => (val === undefined || val === '' ? 'info' : val))
      .pipe(z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])),
    SCHEDULE_CRON: z.string().default('0 11 * * 1'),
    SCHEDULE_LIMIT: z.coerce.number().int().min(1).default(1),
    SCHEDULE_TIMEZONE: z.string().default('Europe/London'),
    DEFAULT_TONE: z
      .enum(['professional', 'casual', 'authority', 'storytelling', 'educational'])
      .default('professional'),
  })
  .refine((data) => data.GROQ_API_KEY || data.GEMINI_API_KEY || data.ANTHROPIC_API_KEY, {
    message: 'One of GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY must be provided',
  });

export type EnvConfig = z.infer<typeof envSchema>;

export const linkedInAuthSchema = z.object({
  LINKEDIN_CLIENT_ID: z.string().min(1, 'LINKEDIN_CLIENT_ID is required'),
  LINKEDIN_CLIENT_SECRET: z
    .string()
    .min(1, 'LINKEDIN_CLIENT_SECRET is required'),
});

export const toneSchema = z.enum([
  'professional',
  'casual',
  'authority',
  'storytelling',
  'educational',
]);

export type Tone = z.infer<typeof toneSchema>;
