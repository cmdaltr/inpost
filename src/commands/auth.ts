import { Command } from 'commander';
import chalk from 'chalk';

export function registerAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with a publishing platform or notes source via OAuth')
    .argument('<platform>', 'Publishing platform to authenticate: linkedin | x | bluesky | mastodon | medium')
    .option('--onenote', 'Authenticate with Microsoft OneNote (notes source)', false)
    .option('--port <number>', 'OAuth callback server port', '3456')
    .action(async (platform: string, options) => {
      const port = parseInt(options.port, 10);

      if (options.onenote) {
        console.log(chalk.bold('\nOneNote OAuth Authentication\n'));
        console.log(`Starting callback server on port ${port}...`);
        const { startOneNoteOAuthFlow } = await import('../services/notes/onenote-auth.js');
        await startOneNoteOAuthFlow(port);
        return;
      }

      const normalised = platform.toLowerCase();

      const notYetSupported = ['x', 'twitter', 'bluesky', 'mastodon', 'medium'];

      if (normalised === 'linkedin') {
        console.log(chalk.bold('\nLinkedIn OAuth Authentication\n'));
        console.log(`Starting callback server on port ${port}...`);
        const { startOAuthFlow } = await import('../services/linkedin/auth.js');
        await startOAuthFlow(port);
      } else if (notYetSupported.includes(normalised)) {
        console.error(chalk.yellow(`"${platform}" is not yet supported. Only "linkedin" is currently available.`));
        process.exit(1);
      } else {
        console.error(chalk.red(`Unknown platform: "${platform}". Supported: linkedin`));
        process.exit(1);
      }
    });
}
