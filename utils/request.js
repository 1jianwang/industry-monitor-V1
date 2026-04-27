/**
 * 云函数调用封装
 * 已修复：TC43 - 添加超时控制
 * @param {string} name - 云函数名称
 * @param {object} data - 传递给云函数的数据
 * @param {number} timeout - 超时时间（毫秒），默认30秒
 * @returns {Promise} 返回云函数调用的结果
 */
function callCloud(name, data = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    // 超时计时器
    const timer = setTimeout(() => {
      reject(new Error(`云函数 ${name} 调用超时（${timeout/1000}秒）`));
    }, timeout);

    wx.cloud.callFunction({
      name: name,
      data: data,
      success: res => {
        clearTimeout(timer);
        console.log(`云函数 ${name} 调用成功`, res);
        if (res.errMsg === 'cloud.callFunction:ok') {
          resolve(res.result);
        } else {
          reject(res);
        }
      },
      fail: err => {
        clearTimeout(timer);
        console.error(`云函数 ${name} 调用失败`, err);
        reject(err);
      }
    });
  });
}

module.exports = {
  callCloud: callCloud
};