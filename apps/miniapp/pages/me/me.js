const auth = require('../../utils/auth.js');

function buildProfile(employee) {
  if (!employee) {
    return {
      name: '',
      employeeNo: '',
      departmentName: '',
      avatarText: '',
    };
  }

  const name = employee.name || '';
  return {
    name,
    employeeNo: employee.employeeNo || '—',
    departmentName: employee.departmentName || '—',
    avatarText: name ? name.slice(0, 1) : '?',
  };
}

Page({
  data: {
    authChecking: true,
    unbinding: false,
    name: '',
    employeeNo: '',
    departmentName: '',
    avatarText: '',
  },

  async onLoad() {
    await this.ensureBound();
  },

  async onShow() {
    if (this.data.authChecking) return;
    const verified = await this.verifyBinding();
    if (verified) {
      this.refreshProfile();
    }
  },

  async ensureBound() {
    const globalData = await auth.waitForAppAuth();
    const isBound = globalData.isBound || auth.isTokenValid();

    if (!isBound) {
      wx.reLaunch({ url: '/pages/bind/bind' });
      return;
    }

    const app = getApp();
    if (app && !globalData.isBound) {
      app.globalData.isBound = true;
      app.globalData.employee = auth.getEmployee();
    }

    const verified = await this.verifyBinding();
    if (!verified) return;

    this.setData({ authChecking: false });
    this.refreshProfile();
  },

  async verifyBinding() {
    try {
      const ok = await auth.verifyBoundSession();
      if (!ok) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return false;
      }
      return true;
    } catch (err) {
      wx.showToast({ title: err.message || '验证失败', icon: 'none' });
      return true;
    }
  },

  refreshProfile() {
    const employee = auth.getEmployee();
    this.setData(buildProfile(employee));
  },

  onUnbindTap() {
    wx.showModal({
      title: '确认解绑',
      content: '解绑后需重新输入绑定码才能查看班表，是否继续？',
      confirmText: '解绑',
      confirmColor: '#e34d59',
      success: async (res) => {
        if (!res.confirm) return;
        await this.handleUnbind();
      },
    });
  },

  async handleUnbind() {
    this.setData({ unbinding: true });

    try {
      await auth.unbindAccount();
      wx.reLaunch({ url: '/pages/bind/bind' });
    } catch (err) {
      if (auth.isSessionInvalidError(err)) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return;
      }

      wx.showToast({ title: err.message || '解绑失败', icon: 'none' });
    } finally {
      this.setData({ unbinding: false });
    }
  },
});
