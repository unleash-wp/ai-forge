const path = require('path');

// Bundles the browser UI: src/client/index.jsx -> dist/main.js, served from
// /assets/. Styles are Chakra UI (Emotion), injected at runtime, with no CSS file.
// The core CLI (bin/ + src/*.mjs) stays zero-dep vanilla Node; React + Chakra
// live only in this bundle.
module.exports = {
  entry: './src/client/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              // modules:false keeps ES modules intact so webpack owns module
              // resolution (incl. require.context) - otherwise the CJS output
              // leaves a bare `require` that dies in the browser.
              ['@babel/preset-env', { targets: 'defaults', modules: false }],
              ['@babel/preset-react', { runtime: 'automatic', development: false }],
            ],
          },
        },
      },
      // Brand SVGs import as raw markup strings for inlining into components.
      {
        test: /\.svg$/,
        type: 'asset/source',
      },
    ],
  },
  devtool: false,
  performance: { hints: false },
};
