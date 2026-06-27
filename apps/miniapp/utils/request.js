const { apiBaseUrl } = require('./config.js');
const storage = require('./storage.js');

function clearLocalSession() {
  storage.clearSession();

  const app = getApp();
  if (!app) return;

  app.globalData.isBound = false;
  app.globalData.employee = null;
}

function request(options) {
  const { path, method = 'GET', data, auth: needAuth = false } = options;

  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };

    if (needAuth) {
      const token = storage.getToken();
      if (!token) {
        reject({ code: 'UNAUTHORIZED', message: '未登录，请先绑定账号' });
        return;
      }
      header.Authorization = `Bearer ${token}`;
    }

    wx.request({
      url: `${apiBaseUrl}${path}`,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data.data);
          return;
        }

        const errBody = res.data && res.data.error;
        const error = {
          statusCode: res.statusCode,
          code: errBody && errBody.code ? errBody.code : 'REQUEST_FAILED',
          message: errBody && errBody.message ? errBody.message : '请求失败，请稍后重试',
        };

        if ((res.statusCode === 401 || res.statusCode === 403) && needAuth) {
          clearLocalSession();
        }

        reject(error);
      },
      fail() {
        reject({ code: 'NETWORK_ERROR', message: '网络异常，请检查网络后重试' });
      },
    });
  });
}

module.exports = { request };
