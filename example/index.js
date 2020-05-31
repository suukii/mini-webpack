const { bundle } = require('../src/main.js');

bundle({
  entry: '../example/entry.js',
  output: {
    path: 'dist',
    filename: 'bundle.js'
  }
})