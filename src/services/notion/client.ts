import { Client } from '@notionhq/client';

export function createNotionClient(token: string): Client {
  return new Client({
    auth: token,
    notionVersion: '2022-06-28',
  });
}
