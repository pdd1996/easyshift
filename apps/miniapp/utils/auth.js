const { request } = require('./request.js');
const storage = require('./storage.js');

function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code);
        } else {
          reject({ code: 'WECHAT_AUTH_FAILED', message: '微信登录失败，请重试' });
        }
      },
      fail() {
        reject({ code: 'WECHAT_AUTH_FAILED', message: '微信登录失败，请重试' });
      },
    });
  });
}

function applyBoundSession(data) {
  storage.saveSession({
    token: data.token,
    expiresAt: data.expiresAt,
    employee: data.employee,
  });
  return data;
}

async function silentLogin() {
  const code = await getWxLoginCode();
  const data = await request({
    path: '/auth/miniprogram/login',
    method: 'POST',
    data: { code },
  });

  if (data.bound) {
    applyBoundSession(data);
    return { bound: true, employee: data.employee };
  }

  storage.clearSession();
  return { bound: false };
}

async function bindAccount(bindingCode, phoneLastFour) {
  const code = await getWxLoginCode();
  const data = await request({
    path: '/auth/miniprogram/bind',
    method: 'POST',
    data: {
      code,
      bindingCode: bindingCode.trim().toUpperCase(),
      phoneLastFour,
    },
  });

  applyBoundSession(data);
  return data;
}

async function waitForAppAuth() {
  const app = getApp();
  if (app && app.authPromise) {
    await app.authPromise;
  }
  return app ? app.globalData : { authReady: true, isBound: storage.isTokenValid() };
}

module.exports = {
  getToken: storage.getToken,
  getEmployee: storage.getEmployee,
  isTokenValid: storage.isTokenValid,
  clearSession: storage.clearSession,
  silentLogin,
  bindAccount,
  waitForAppAuth,
};
