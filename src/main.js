const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {
  applyLoaders
} = require('./applyLoaders')

const createModule = (id, path, rules) => {
  // 读取代码文件
  let content = fs.readFileSync(path, {
    encoding: 'utf-8'
  })
  const dependencies = []

  // 增加 loader 机制后，createModule 理论上就支持了其他类型的文件
  // 所以这里需要判断，parser 只能处理 js 文件
  if (/\.js$/.test(path)) {
    // 将代码转换成 AST
    const ast = parser.parse(content, {
      sourceType: 'module'
    })

    // 遍历 AST，找到 import 语句
    // 把依赖收集到 dependencies 中
    traverse(ast, {
      ImportDeclaration({
        node
      }) {
        dependencies.push(node.source.value)
      }
    })
  }

  // 把文件内容交给 loader 处理
  // applyLoaders 会返回处理后的内容，以字符串的形式
  content = applyLoaders(path, rules, content)

  /**
   * 模块包含了：
   * 1. 唯一的 id
   * 2. 代码字符串
   * 3. 所有依赖的文件路径
   * 4. 原 js 文件的路径
   * 5. mapping 是依赖的文件名和对应的模块 id 的映射
   */
  return {
    id,
    content,
    dependencies,
    filename: path,
    mapping: {}
  }
}

const createModules = (id, module, rules) => {
  // modules 数组中存放着项目的所有模块
  let modules = []
  const {
    dependencies,
    filename
  } = module

  // 以 module 为起点，递归地去找出所有依赖
  dependencies.forEach(depPath => {
    const absolutePath = path.resolve(path.dirname(filename), depPath)
    const depModule = createModule(id, absolutePath, rules)
    // 将依赖模块加入到 module 的 mapping 中去
    module.mapping[depPath] = id
    id++
    modules = modules.concat(depModule)
    // 如果 module 的依赖模块也有自己的依赖，递归地找出它们的依赖
    if (depModule.dependencies.length > 0) {
      modules = modules.concat(createModules(id, depModule, rules))
    }
  })
  return modules
}

const createAssets = modules => {
  return `
    (function (modules) {
      const webpackRequire = id => {
        const {
          code,
          mapping
        } = modules[id]

        // fake require 方法
        const require = name => {
          return webpackRequire(mapping[name])
        }

        // fake module 和 module.exports
        const module = {
          exports: {}
        }

        // 执行模块代码
        // PS 如下可以看到，在模块中 module.exports 和 exports 是同一个东西
        // 前提是不修改它们的指向
        const wrap = new Function('require', 'module', 'exports', code)
        wrap(require, module, module.exports)

        // 返回导出内容
        return module.exports
      }
      webpackRequire(0)
    })(${JSON.stringify(modules)})
  `
}

const bundle = options => {
  const {
    entry,
    output,
    module,
  } = options

  // 获取入口文件
  let id = 0
  const entryModule = createModule(id++, path.resolve(__dirname, entry), module.rules)
  // 根据入口文件递归找出所有依赖模块
  // 把 module.rules 传给 createModules 是为了进一步传给 createModule
  const modules = [entryModule].concat(createModules(id, entryModule, module.rules))

  // 生成代码并输出到文件系统
  const code = createAssets(modules)
  fs.mkdir(path.resolve(output.path), {
    recursive: true
  }, err => {
    if (err) {
      throw err
    }
    fs.writeFile(path.resolve(output.path, output.filename), code, {
      encoding: 'utf-8'
    }, function (err, data) {
      if (err) throw err
    })
  })
}

module.exports = {
  bundle
}