# my-vue-axios-service

> axios的一个二次封装方案

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

# Axios 二次封装

## 简单介绍

axios作为一个请求库，可以说每一个vue开发者都使用过。这里不再赘述，详情可以观看[文档](https://www.kancloud.cn/yunye/axios/234845)

## 原始使用

通常我们对axios的应用非常简单粗暴。

```javascript
import axios from 'axios';
Vue.prototype.$http = axios;
```

引入axios后，绑定到Vue的原型上，这样我们就可以直接通过this.$http调用axios啦。

```javascript
this.$http.post(url, data).then(res => {}).catch(err => {});
```

## 发现问题

一开始我也是这么愉悦地使用axios，但是后来我遇到了几个问题。

- 如果某个url很多地方用到，突然这个url需要换成另外一个url时，会比较麻烦，需要改很多个地方；
- 在开发过程中，可能会因为后台修改了转发配置，导致整个后台接口的前缀发生改变，如“/sys1/url1”, “/sys1/url2”变成“/sys2/url1”, “/sys2/url1”；
- 项目中多个接口调用时，代码不清晰。

总结起来：
1. 接口url需要增加统一的管理
2. axios使用时逻辑更好区分

## 二次封装

针对以上目的，进行了axios的二次封装。

### 结构

```
project
|--src // 项目主要代码目录
|  |--service // axios二次封装目录
|  |  |--api // api统一管理目录
|  |  |  |--module // api分模块管理
|  |  |  | |--login.js // login模块
|  |  |  | |--user.js // user模块
|  |  |  |--index.js // 集成各模块输出
|  |  |--baseUrl.js // 统一管理接口前缀
|  |  |--request.js // axios基本配置
|  |  |--index.js // 封装axios和api
```

### api管理

#### 模块分割

将后台提供的模块按照模块进行分割，并且结合es6的规范，在module目录下一个文件代表一个模块。

```javascript
// login.js
export default {
  in: '/login/in',
  out: '/login/out',
};
```

```javascript
// user.js
export default {
  getById: { url: '/user/{id}', method: 'get' },
  add: '/user/add',
  delete: { url: '/user/delete', method: 'get' },
};
```

#### 模块集成

在index.js中，我们需要将我们各个模块集成到一起，暴露出去。
采用了webpack提供的require.context方法，获取所有在module目录下的js文件，并将它们export出来的东西统合在一起。

```javascript
// api/index.js
let apis = {};

const files = require.context('./modules', false, /\.js$/); // 第二个argument为false，不处理子目录

files.keys().forEach(filename => {
  // 取文件中export出来的moduleName作为模块名，如果没有moduleName则取文件名为模块名 ( login.js => login )
  const moduleName = files(filename).moduleName || /\/(\w+)\.js$/.exec(filename)[1];
  apis[moduleName] = files(filename).default;
});

export default apis;
```

根据上面的module下的文件内容，index.js中export出来的apis应该是这样的：
```javascript
apis = {
  login: {
    in: '/login/in',
    out: '/login/out',
  },
  user: {
    getById: { url: '/user/{id}', method: 'get' },
    add: '/user/add',
    delete: { url: '/user/delete', method: 'get' },
  }
}
```

### baseUrl

后台提供的接口一般会包含一个统一的前缀，是后台工程的标志。
比如上面的login in这个登入的接口，完整的接口调用应该是 “/web/login/in”这个样子的。
但是因为不同开发人员不同的部署习惯或者布置转发等某些情况下，这个工程的名称可能会有所变化。
所以，这里把这个前缀提取出来做管理，不需要在改动时对所有接口进行改动。

```javascript
export default '/web';
```

### 基本配置

以上对后台提供的接口地址做了充分的处理，接下来要对axios做处理了。
在request.js中对axios做了初始化的处理，以及拦截器的设置，这里一般是用于处理请求权限验证及返回的报错处理。

```javascript
// request.js
import axios from 'axios'; // 引入axios
import baseUrl from './baseUrl'; // 引入上面设置的baseUrl

/*
* 初始化一个axios实例
* 设置baseURL, 使用这个示例调用的接口都会默认加上baseURL
* */
let request = axios.create({
  baseURL: baseUrl
});

/*
* 拦截器设置
* */
request.interceptors.request.use(config => {
  // 这里可以做自定义的权限处理，比如对headers或者auth的设置等...
  return config;
}, err => {
  return Promise.reject(err);
});

request.interceptors.response.use(response => {
  return response;
}, err => {
  // 这里可以做自定义的错误处理，比如跳转自定义404页面等
  return Promise.reject(err);
});

export default request;
```

经过上面的处理，拿到一个具有通用配置的axios实例。

### 接口api化处理

接下来对上面拿到apis的接口组合和request这个axios实例做进一步的处理。
将原来的用法：
```javascript
axios.post(url, data).then(res => {}).catch(err => {});
```
转换成：
```javascript
service[module][name](data, callback, config);
```

```javascript
// index.js
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
```

输出的service的内容应该是：

```javascript
service = {
  login: {
    in(data, callback, config){},
    out(data, callback, config){},
   },
  user: {
    getById(data, callback, config){},
    add(data, callback, config){},
    delete(data, callback, config){},
  }
}
```

### 使用方法

在service中对axios二次封装后，要如果使用封装后的东西呢？

在业务代码中：

```javascript
import service from '../service';
service.login.in({ username: '', password: '' }, (res) => { 
  // 假设后台返回成功的状态码为 200
  if (res.statusCode === '200') {
    // 成功 处理
  } else {
    // 错误处理
  } 
});
service.user.getById({ id: 1 }, (res) => {
  // ...
});
```

## 总结

在经过上面一系列的操作之后，我们得到了一个service对象；
在使用service调用时，把原来的传入一个url的方式转换成了模块化的api调用方式，更直观地反映出业务代码的逻辑，而且对url的管理更加的人性化。
