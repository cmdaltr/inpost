import type { Tone } from '../../types/index.js';
import type { AIProviderConfig } from '../ai/provider.js';

export interface OrchestratorConfig {
  notionToken: string;
  notionDatabaseId: string;
  aiConfig: AIProviderConfig;
  defaultTone: Tone;
  includeHooks: boolean;
  includeHashtags: boolean;
  isDryRun: boolean;
  requireConfirmation: boolean;
  order: 'oldest' | 'newest';
}

export interface SchedulerConfig {
  cron: string;
  timezone: string;
  limit: number;
  runOnce: boolean;
  notionToken: string;
  notionDatabaseId: string;
  aiConfig: AIProviderConfig;
  order: 'oldest' | 'newest';
}
