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
  syncAppSession(true, data.employee);
  return data;
}

function syncAppSession(isBound, employee) {
  const app = getApp();
  if (!app) return;

  app.globalData.isBound = isBound;
  app.globalData.employee = employee || null;
}

function clearBoundSession() {
  storage.clearSession();
  syncAppSession(false, null);
}

function localBoundSession() {
  if (!storage.isTokenValid()) {
    return null;
  }

  return { bound: true, employee: storage.getEmployee() };
}

async function silentLogin() {
  try {
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

    clearBoundSession();
    return { bound: false };
  } catch (err) {
    console.warn('[auth] silentLogin remote check failed', err);
  }

  const localSession = localBoundSession();
  if (localSession) {
    return localSession;
  }

  clearBoundSession();
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

async function fetchStaffMe() {
  const data = await request({
    path: '/staff/me',
    auth: true,
  });

  storage.updateEmployee(data.employee);
  syncAppSession(true, data.employee);
  return data.employee;
}

async function unbindAccount() {
  await request({
    path: '/auth/miniprogram/unbind',
    method: 'POST',
    auth: true,
    data: { confirm: true },
  });
  clearBoundSession();
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
  clearSession: clearBoundSession,
  silentLogin,
  bindAccount,
  fetchStaffMe,
  unbindAccount,
  waitForAppAuth,
};
