import { Command } from 'commander';
import chalk from 'chalk';

export function registerAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with LinkedIn or OneNote via OAuth')
    .option('--onenote', 'Authenticate with Microsoft OneNote (instead of LinkedIn)', false)
    .option('--port <number>', 'OAuth callback server port', '3456')
    .action(async (options) => {
      const port = parseInt(options.port, 10);

      if (options.onenote) {
        console.log(chalk.bold('\nOneNote OAuth Authentication\n'));
        console.log(`Starting callback server on port ${port}...`);
        const { startOneNoteOAuthFlow } = await import('../services/notes/onenote-auth.js');
        await startOneNoteOAuthFlow(port);
      } else {
        console.log(chalk.bold('\nLinkedIn OAuth Authentication\n'));
        console.log(`Starting callback server on port ${port}...`);
        const { startOAuthFlow } = await import('../services/linkedin/auth.js');
        await startOAuthFlow(port);
      }
    });
}
