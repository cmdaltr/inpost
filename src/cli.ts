import { Command } from 'commander';
import { registerAuthCommand } from './commands/auth.js';
import { registerFetchCommand } from './commands/fetch.js';
import { registerTransformCommand } from './commands/transform.js';
import { registerPublishCommand } from './commands/publish.js';
import { registerPipelineCommand } from './commands/pipeline.js';
import { registerScheduleCommand } from './commands/schedule.js';
import { registerStatusCommand } from './commands/status.js';
import { registerQueueCommand } from './commands/queue.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('inpost')
    .description(
      'Notion to LinkedIn publishing pipeline with AI-powered content transformation',
    )
    .version('0.1.0');

  registerAuthCommand(program);
  registerFetchCommand(program);
  registerTransformCommand(program);
  registerPublishCommand(program);
  registerPipelineCommand(program);
  registerScheduleCommand(program);
  registerStatusCommand(program);
  registerQueueCommand(program);

  return program;
}
