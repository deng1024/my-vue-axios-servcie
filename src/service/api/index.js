/*
* 统一所有module的api
* 获取module目录下所有js文件，注意：不获取子目录
* 把js文件的名字作为key，文件中export default的东西作为value
* apis[key] = value
* 输出apis
* */

const modulesFiles = require.context('./modules', false, /\.js$/);  // 第二个argument为false，不处理子目录

const apis = modulesFiles.keys().reduce((modules, modulePath) => {
  const value = modulesFiles(modulePath);
  // set './app.js' => 'app' : modulePath.replace(/^\.\/(.*)\.\w+$/, '$1')
  // 取文件中export出来的moduleName作为模块名，如果没有moduleName则取文件名为模块名 ( login.js => login )
  const moduleName = value.moduleName || modulePath.replace(/^\.\/(.*)\.\w+$/, '$1');
  modules[moduleName] = value.default;
  return modules;
}, {});

export default apis;