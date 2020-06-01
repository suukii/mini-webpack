const path = require('path')

/**
 * 
 * @param {string} modulePath 当前文件的路径
 * @param {array<object>} rules 文件类型的匹配模式和对应的处理 loader
 * @param {string} content 当前文件的内容
 */
exports.applyLoaders = (modulePath, rules, content) => {
  // hit 用来标识该文件有没有合适的 loader 来处理
  // 没有的话给出提示
  let hit = false
  const res = rules.reduce((content, rule) => {
    if (rule.test.test(modulePath)) {
      hit = true
      // loader 的处理顺序是从右到左
      return rule.use.reduceRight((content, {
        loader
      }) => {
        // 引入 loader 函数并传入源码
        // 返回处理后的源码给下一个 loader
        // 我把自己写的 loader 模块都放在了 loaders 文件夹下面
        // 所以要去这个文件夹里找，找到后调用 loader 函数并传入文件内容
        return require(path.resolve('loaders', loader))(content)
      }, content)
    }
  }, content)

  hit || console.log(`${path}: You may need an appropriate loader to handle this file type.`);
  return res
}