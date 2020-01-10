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