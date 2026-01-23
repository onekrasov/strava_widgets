require('esbuild').build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'scriptable.js',
  format: 'iife',
  target: 'es2017',
  platform: 'neutral',
  banner: {
    js: '// Variables automatically injected by Scriptable.app are used below\n',
  },
  footer: {
    js: ''
  }
}).catch(() => process.exit(1))
