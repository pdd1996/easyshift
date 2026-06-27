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
    this.refreshProfile();
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

    this.setData({ authChecking: false });
    this.refreshProfile();
  },

  refreshProfile() {
    const employee = auth.getEmployee();
    this.setData(buildProfile(employee));
  },
});
