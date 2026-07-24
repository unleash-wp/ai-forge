const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Bundles the browser UI: src/client/index.js -> dist/main.js, and the SCSS it
// imports -> dist/main.css. The server serves both from /assets/.
module.exports = {
  entry: './src/client/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: 'main.css' })],
  devtool: false,
  performance: { hints: false },
};
