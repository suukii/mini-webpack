const babel = require('@babel/core')

module.exports = content => {
  return babel.transformSync(content, {
    presets: ['@babel/preset-env']
  }).code
}