const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core')

const createModule = (id, path) => {
  // 读取代码文件
  const sourceCode = fs.readFileSync(path, {
    encoding: 'utf-8'
  })

  // 将代码转换成 AST
  const ast = parser.parse(sourceCode, {
    sourceType: 'module'
  })

  // 遍历 AST，找到 import 语句
  // 把依赖收集到 dependencies 中
  const dependencies = []
  traverse(ast, {
    ImportDeclaration({
      node
    }) {
      dependencies.push(node.source.value)
    }
  })

  // 生成兼容性更强的代码
  const code = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  }).code

  // console.log(code);
  // // test
  // const module = {
  //   exports: {}
  // }

  // const wrap = new Function('require', 'module', 'exports', code)
  // wrap(require, module, module.exports)
  // console.log(module.exports);
  // // test

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
    code,
    dependencies,
    filename: path,
    mapping: {}
  }
}

const createModules = (id, module) => {
  // modules 数组中存放着项目的所有模块
  let modules = []
  const {
    dependencies,
    filename
  } = module

  // 以 module 为起点，递归地去找出所有依赖
  dependencies.forEach(depPath => {
    const absolutePath = path.resolve(path.dirname(filename), depPath)
    const depModule = createModule(id, absolutePath)
    // 将依赖模块加入到 module 的 mapping 中去
    module.mapping[depPath] = id
    id++
    modules = modules.concat(depModule)
    // 如果 module 的依赖模块也有自己的依赖，递归地找出它们的依赖
    if (depModule.dependencies.length > 0) {
      modules = modules.concat(createModules(id, depModule))
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
    output
  } = options

  // 获取入口文件
  let id = 0
  const entryModule = createModule(id++, path.resolve(__dirname, entry))
  // 根据入口文件递归找出所有依赖模块
  const modules = [entryModule].concat(createModules(id, entryModule))

  // 生成代码并输出到文件系统
  const code = createAssets(modules)
  fs.writeFile(path.resolve(output.path, output.filename), code, {
    encoding: 'utf-8'
  }, function (err, data) {
    if (err) throw err
  })
}

module.exports = {
  bundle
}