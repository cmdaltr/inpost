import { Command } from 'commander';
import chalk from 'chalk';

export function registerAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with LinkedIn via OAuth')
    .option('--port <number>', 'OAuth callback server port', '3456')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      console.log(
        chalk.bold('\nLinkedIn OAuth Authentication\n'),
      );
      console.log(`Starting callback server on port ${port}...`);
      // Implementation in Phase 4
      const { startOAuthFlow } = await import(
        '../services/linkedin/auth.js'
      );
      await startOAuthFlow(port);
    });
}
