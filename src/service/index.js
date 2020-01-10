/*
* service 结构
* moduleName 为 api/modules 中每个文件的文件名。可以通过在文件中export const moduleName = 'xx' 进行修改；
* name: module中文件default输出的对象的每个key
*
* data: 接收的第一个参数，用于调接口的数据，使用者只要传入一个对象就可以了,类似{key1: value1, key2: value2}。
*        config 说明：传入的参数会通过get、post的方式做不同处理，
*        get方法会自动放入params中，请求时会自动转成 ?key1=value1&key2=value2形式；
*        post方法会自动放入data中
*        ---还有一种特殊情况，有时候后台会提供类似'/user/{id}'形式的get接口，这种方式也已经做了兼容，
*        ---使用者依然是传入一个对象{id: 1}, service可以自动替换{id},调用的接口会转化成 '/user/1'
*
* callback: 接口回调，做了二次处理，成功返回response.data 失败返回{statusCode: err.response.status(404\400等), message}
*          使用时直接判断statusCode即可，不需要再分两个函数处理成功失败
*
* config: 额外配置，如headers之类的
*
*
* service = {
*   [moduleName]: {
*     [name]: function (data, callback, config) {
*       axios().then(res => callback(res)).catch(err => callback(err))
*     }
*   }
* }
*
* */

import api from './api';
import request from './request';

let service = {};

/*
* 工具函数
* 用于给service上每个模块的每个接口创建一个调用request的方法
* 接收apis中的每个模块的每个接口及方法，method默认为post
* isProcess 闭包中的变量，用于控制接口的重复调用
* */
function createRequest(url, method = 'post') {
  let isProcessing = false;
  /*
  * 返回的函数 为调用request的方法
  * data 请求数据
  * callback 请求返回的回调
  * config axios的自定义配置
  * */
  return function (data, callback, config = {}) {
    if (isProcessing) return; // 如果接口正在调用没有返回就再次被调用，直接return不做处理
    isProcessing = true;
    
    // 某些接口可能需要更多额外的配置，所以在基本配置外merge传进来的额外配置
    let option = Object.assign({
      url: url,
      method: method,
    }, config);
    
    /*
    * 针对不同的method，对data做不同处理
    * post：按照axios 需要把数据放在data中
    * get：按照axios 需要把数据放在params中，会转为 ?key1=value1&key2=value2 接在url的后面
    * get 考虑一种情况，后台有可能提供一种接口 比如现在 user中的getById: '/user/{id}'
    *     需要直接把参数id放在url上，作为url的一部分。
    *     这里对get函数的url作了一个正则校验，如果包含了{}字符串，则使用传进来的data对url上的{xxx}进行替换
    * */
    if (method === 'post') option.data = data;
    if (method === 'get') {
      if (/\{\w+\}/.test(url)) {
        Object.keys(data).forEach(name => option.url = option.url.replace(`{${name}}`, data[name]));
      } else {
        option.params = data;
      }
    }
    
    /*
    * 正式调用request
    * */
    request(option)
      .then(res => {
        callback(res.data); // 成功返回，使用callback处理res.data
      })
      .catch(err => {
        // 失败返回，这里获取了失败的状态码，作了自定义的message处理；使用callback处理自定义的对象： { statusCode, message }
        const code = err.response.status;
        callback({statusCode: code, message: `服务出错了：${code}！`});
      })
      .finally(() => {
        isProcessing = false; // 接口调用后把状态改回false，不堵塞下次调用
      });
  }
}

/*
* 对api处理
* 每个接口对应一个方法
* */
Object.keys(api).forEach(module => {
  let moduleReq = service[module] = {};
  Object.keys(api[module]).forEach(name => {
    const apiConfig = api[module][name];
    // 获取url 是一个string时默认使用post请求，是一个对象时，通过对象的method来调用对象的url
    if (typeof apiConfig === 'string') {
      moduleReq[name] = createRequest(apiConfig);
    } else {
      moduleReq[name] = createRequest(apiConfig.url, apiConfig.method);
    }
  });
});

export default service;