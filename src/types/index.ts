export type Tone =
  | 'professional'
  | 'casual'
  | 'authority'
  | 'storytelling'
  | 'educational';

export interface NotionPost {
  id: string;
  title: string;
  status: string;
  content: string;
  tone?: Tone;
  tags: string[];
  linkedinUrl?: string;
  publishedDate?: string;
  aiSummary?: string;
  blogUrl?: string;
}

export interface TransformOptions {
  content: string;
  tone: Tone;
  type: 'summary' | 'thread' | 'hook' | 'full';
  includeHooks: boolean;
  includeHashtags: boolean;
  includeThread: boolean;
  variantCount: number;
  tags?: string[];
}

export interface TransformResult {
  summary: string;
  hooks?: string[];
  hashtags?: string[];
  thread?: string[];
  variants?: string[];
  metadata: {
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
  };
}

export interface PublishOptions {
  text: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  isDryRun: boolean;
}

export interface PublishResult {
  postId: string;
  postUrl: string;
  publishedAt: Date;
}

export interface PipelineResult {
  postId: string;
  notionPageId: string;
  title: string;
  status: 'published' | 'error';
  linkedinUrl?: string;
  error?: string;
}
