import chalk from 'chalk';

interface HelpOption {
  flag: string;
  description: string;
  default?: string;
}

interface HelpSection {
  heading: string;
  options: HelpOption[];
}

interface HelpConfig {
  command: string;
  summary: string;
  sections: HelpSection[];
  examples: string[];
}

export function printCommandHelp(config: HelpConfig): void {
  console.log();
  console.log(chalk.bold(`inpost ${config.command}`));
  console.log(chalk.dim(config.summary));
  console.log();

  for (const section of config.sections) {
    console.log(chalk.bold(section.heading));
    for (const opt of section.options) {
      const flag = chalk.cyan(opt.flag.padEnd(32));
      const def = opt.default ? chalk.dim(` (default: ${opt.default})`) : '';
      console.log(`  ${flag}${opt.description}${def}`);
    }
    console.log();
  }

  console.log(chalk.bold('Examples'));
  for (const ex of config.examples) {
    console.log(`  ${chalk.dim(ex)}`);
  }
  console.log();
}
