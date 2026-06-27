const ToastModule = require('tdesign-miniprogram/toast/index');
const auth = require('../../utils/auth.js');

const Toast = ToastModule.default || ToastModule;

Page({
  data: {
    bindingCode: '',
    phoneLastFour: '',
    submitting: false,
    authChecking: true,
  },

  async onLoad() {
    const globalData = await auth.waitForAppAuth();
    const isBound = globalData.isBound || auth.isTokenValid();

    if (isBound) {
      const app = getApp();
      if (app && !globalData.isBound) {
        app.globalData.isBound = true;
        app.globalData.employee = auth.getEmployee();
      }
      wx.switchTab({ url: '/pages/schedule/schedule' });
      return;
    }
    this.setData({ authChecking: false });
  },

  onBindingCodeChange(e) {
    this.setData({ bindingCode: (e.detail.value || '').toUpperCase() });
  },

  onPhoneChange(e) {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, 4);
    this.setData({ phoneLastFour: value });
  },

  showToast(message, theme) {
    if (typeof Toast === 'function') {
      Toast({
        context: this,
        selector: '#bind-toast',
        message,
        theme: theme || 'error',
      });
      return;
    }

    try {
      wx.showToast({ title: message, icon: theme === 'success' ? 'success' : 'none' });
    } catch {
      // ignore toast failures; form submission should keep its normal flow
    }
  },

  async onSubmit() {
    const { bindingCode, phoneLastFour, submitting } = this.data;
    if (submitting) return;

    const code = bindingCode.trim();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      this.showToast('请输入 6 位绑定码');
      return;
    }
    if (!/^\d{4}$/.test(phoneLastFour)) {
      this.showToast('请输入手机号后四位');
      return;
    }

    this.setData({ submitting: true });
    try {
      await auth.bindAccount(code, phoneLastFour);
      const app = getApp();
      if (app) {
        app.globalData.isBound = true;
        app.globalData.employee = auth.getEmployee();
      }
      this.showToast('绑定成功', 'success');
      setTimeout(() => {
        wx.switchTab({ url: '/pages/schedule/schedule' });
      }, 600);
    } catch (err) {
      this.showToast(err.message || '绑定失败，请重试');
    } finally {
      this.setData({ submitting: false });
    }
  },
});
