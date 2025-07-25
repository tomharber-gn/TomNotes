import path from 'node:path';

import { partytownVite } from '@builder.io/partytown/utils';
import legacy from '@vitejs/plugin-legacy';

import _config from './_config.js';

const HOST = _config.server.host;
const PORT = _config.server.port;

export default {
  base: '/TomNotes/',
  server: {
    host: HOST,
    port: PORT
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  plugins: [
    legacy(),
    partytownVite({
      dest: path.join(__dirname, 'dist', '~partytown')
    })
  ]
};
