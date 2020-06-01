const {
  bundle
} = require('../src/main.js');

bundle({
  entry: '../example/entry.js',
  output: {
    path: 'dist',
    filename: 'bundle.js'
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: [{
          loader: 'mock-babel-loader'
        },
        {
          loader: 'strip-slc-loader'
        }
      ]
    }]
  }
})