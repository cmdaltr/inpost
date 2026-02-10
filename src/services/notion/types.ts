import type { Tone } from '../../types/index.js';

export interface NotionPage {
  id: string;
  title: string;
  status: string;
  tone?: Tone;
  tags: string[];
  linkedinUrl?: string;
  publishedDate?: string;
  aiSummary?: string;
  variants?: string;
  errorLog?: string;
}

export interface NotionBlockContent {
  type: string;
  text: string;
  children?: NotionBlockContent[];
}
