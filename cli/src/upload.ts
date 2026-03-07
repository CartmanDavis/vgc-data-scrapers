#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';

async function uploadPaste(paste: string, title = '', author = '', notes = ''): Promise<string> {
  paste = paste.replace(/\n/g, '\r\n');
  const data = { paste, title, author, notes };
  const response = await axios.post('https://pokepast.es/create', data, {
    maxRedirects: 5,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.request.res?.responseUrl || String(response.request.res?.url) || '';
}

const program = new Command();

program
  .name('upload')
  .description('Upload a Pokemon team paste to pokepast.es')
  .option('--paste <text>', 'The team paste content')
  .option('--author <name>', 'Author of the paste', '')
  .option('--title <text>', 'Title of the paste', '')
  .option('--notes <text>', 'Notes for the paste', '')
  .action(async (options) => {
    if (!options.paste) {
      console.error('Error: --paste is required');
      process.exit(1);
    }

    const url = await uploadPaste(
      options.paste,
      options.title,
      options.author,
      options.notes
    );
    console.log(url);
  });

program.parse();
