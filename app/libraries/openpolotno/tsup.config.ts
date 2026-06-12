import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'raeditor-app': 'src/raeditor-app.tsx',
    'model/store': 'src/model/store.ts',
    'canvas/workspace': 'src/canvas/workspace.tsx',
    'side-panel/side-panel': 'src/side-panel/side-panel.tsx',
    'side-panel/index': 'src/side-panel/index.ts',
    'side-panel/images-grid': 'src/side-panel/images-grid.tsx',
    'toolbar/toolbar': 'src/toolbar/toolbar.tsx',
    'toolbar/zoom-buttons': 'src/toolbar/zoom-buttons.tsx',
    'utils/api': 'src/utils/api.ts',
    'utils/image': 'src/utils/image.ts',
    'utils/l10n': 'src/utils/l10n.ts',
    'pages-timeline/index': 'src/pages-timeline/index.ts',
  },
  format: ['esm'],
  dts: false,
  splitting: true,
  sourcemap: false,
  clean: true,
  treeshake: false,
  external: ['react', 'react-dom'],
  esbuildOptions(options) {
    options.banner = {};
  },
});
