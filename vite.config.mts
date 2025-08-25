import { defineConfig } from 'vite';
import path from 'path';
import { name, version } from './package.json';
import fg from 'fast-glob';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';

const filesDir = fs.readdirSync('./');

// the json result that will be generated
let themeFiles = [];

filesDir.forEach((file) => {
  console.log(file);
  if (fs.lstatSync(file).isDirectory()) {
    let fileContents = fg.globSync(`${file}/**`, {
      ignore: [
        '!build/js/**/*.js',
        '**/**/tier-1-definitions/*.json',
        '**/**/tier-2-usage',
        '**/**/tier-3-components/*.json',
        `**/build/css/${file}.css`
      ]
    });
    fileContents = fileContents;
    themeFiles.push(fileContents);
  }
});
themeFiles = themeFiles.flat(1);

export default defineConfig({
  build: {
    sourcemap: false,
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      entry: './index.ts',
      formats: ['es']
    },
    rollupOptions: {
      input: fg.sync(['./index.ts']).map((file) => path.resolve(__dirname, file)),
      external: [/node_modules/, /\.(json|css|scss|sass|less|styl|png|jpe?g|gif|svg|ico|webp)$/]
    }
  },
  define: {
    pkgJson: { name, version }
  },
  plugins: [
    viteStaticCopy({
      structured: true,
      targets: [
        {
          src: 'package.json',
          dest: ''
        },
        {
          src: themeFiles.filter((file) => !file.includes('node_modules') && !file.includes('dist/')),
          dest: ''
        }
      ]
    }),
    {
      name: 'delete-dist-js',
      closeBundle() {
        const distFile = './dist/bfw-tokens.mjs';
        if (fs.existsSync(distFile)) {
          fs.unlinkSync(distFile);
        }
      }
    }
  ]
});
