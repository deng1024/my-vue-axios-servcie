/*
* 统一所有module的api
* 获取module目录下所有js文件，注意：不获取子目录
* 把js文件的名字作为key，文件中export default的东西作为value
* apis[key] = value
* 输出apis
* */

let apis = {};

const files = require.context('./modules', false, /\.js$/); // 第二个argument为false，不处理子目录

files.keys().forEach(filename => {
  // 取文件中export出来的moduleName作为模块名，如果没有moduleName则取文件名为模块名 ( login.js => login )
  const moduleName = files(filename).moduleName || /\/(\w+)\.js$/.exec(filename)[1];
  apis[moduleName] = files(filename).default;
});

export default apis;
