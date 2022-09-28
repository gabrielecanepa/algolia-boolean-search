const path = require('path')
const packageJSON = require('./package.json')

const HtmlWebpackPlugin = require('html-webpack-plugin')

const mode = process.env.NODE_ENV || 'development'

module.exports = {
  mode,
  devServer: {
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.m?jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.(sa|sc)ss$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              modules: false,
            },
          },
          {
            loader: 'sass-loader',
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      {
        test: /\.html$/,
        use: 'html-loader',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
      favicon: path.resolve(__dirname, 'public', 'favicon.ico'),
      meta: {
        description: packageJSON.description,
      },
      link: {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/npm/instantsearch.css@7/themes/satellite-min.css',
      },
    }),
  ],
}
