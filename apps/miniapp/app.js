const auth = require('./utils/auth.js');

App({
  globalData: {
    authReady: false,
    isBound: false,
    employee: null,
  },

  onLaunch() {
    this.authPromise = this.initAuth();
  },

  async initAuth() {
    try {
      const result = await auth.silentLogin();
      this.globalData.isBound = result.bound;
      this.globalData.employee = result.bound ? result.employee : null;
    } catch (err) {
      console.error('[app] initAuth failed', err);
      this.globalData.isBound = auth.isTokenValid();
      this.globalData.employee = auth.getEmployee();
    } finally {
      this.globalData.authReady = true;
    }
    return this.globalData;
  },
});
