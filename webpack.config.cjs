const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Bundles the browser UI: src/client/index.jsx -> dist/main.js, and the SCSS it
// imports -> dist/main.css. The server serves both from /assets/. The core CLI
// (bin/ + src/*.mjs) stays zero-dep vanilla Node; React lives only in this bundle.
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
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      // Brand SVGs import as raw markup strings for inlining into components.
      {
        test: /\.svg$/,
        type: 'asset/source',
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: 'main.css' })],
  devtool: false,
  performance: { hints: false },
};
