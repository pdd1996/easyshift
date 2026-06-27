const auth = require('../../utils/auth.js');
const { request } = require('../../utils/request.js');
const dateUtil = require('../../utils/date.js');

function mapDay(day) {
  const { shift } = day;
  let shiftLabel = '暂无排班';
  let timeRange = '';
  let isRest = false;

  if (shift) {
    isRest = dateUtil.isRestShift(shift);
    shiftLabel = shift.name;
    timeRange = dateUtil.formatShiftTimeRange(shift.startTime, shift.durationMinutes);
  }

  return {
    workDate: day.workDate,
    weekdayLabel: dateUtil.weekdayLabel(day.weekday),
    monthDay: dateUtil.formatMonthDay(day.workDate),
    shiftLabel,
    timeRange,
    note: day.note || '',
    color: shift ? shift.color : '',
    isRest,
    hasShift: !!shift,
  };
}

Page({
  data: {
    authChecking: true,
    loading: false,
    weekStart: '',
    weekRangeLabel: '',
    isCurrentWeek: true,
    notPublished: false,
    publishedAtLabel: '',
    employeeName: '',
    days: [],
  },

  async onLoad() {
    const globalData = await auth.waitForAppAuth();
    const isBound = globalData.isBound || auth.isTokenValid();

    if (!isBound) {
      wx.reLaunch({ url: '/pages/bind/bind' });
      return;
    }

    const verified = await this.verifyAccess();
    if (!verified) return;

    const employee = auth.getEmployee();
    const weekStart = dateUtil.weekStartFromDate(new Date());
    this.setData({
      authChecking: false,
      weekStart,
      weekRangeLabel: dateUtil.formatWeekRange(weekStart),
      isCurrentWeek: true,
      employeeName: employee ? employee.name : '',
    });
    await this.loadSchedule();
  },

  async onShow() {
    if (this.data.authChecking) return;
    const verified = await this.verifyAccess();
    if (!verified) return;
    await this.loadSchedule();
  },

  async verifyAccess() {
    try {
      const ok = await auth.verifyBoundSession();
      if (!ok) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return false;
      }
      return true;
    } catch (err) {
      wx.showToast({ title: err.message || '验证失败', icon: 'none' });
      return false;
    }
  },

  async onPullDownRefresh() {
    try {
      await this.loadSchedule();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadSchedule() {
    const { weekStart } = this.data;
    this.setData({ loading: true });

    try {
      const data = await request({
        path: `/staff/schedule?weekStart=${weekStart}`,
        auth: true,
      });

      const notPublished = data.status === 'not_published' || !data.publishedAt;
      const currentWeekStart = dateUtil.weekStartFromDate(new Date());

      this.setData({
        notPublished,
        publishedAtLabel: notPublished ? '' : `${dateUtil.formatPublishedAt(data.publishedAt)} 发布`,
        days: notPublished ? [] : (data.days || []).map(mapDay),
        weekRangeLabel: dateUtil.formatWeekRange(data.weekStart || weekStart),
        isCurrentWeek: (data.weekStart || weekStart) === currentWeekStart,
      });
    } catch (err) {
      if (auth.isSessionInvalidError(err)) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return;
      }
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onPrevWeek() {
    const weekStart = dateUtil.addWeeks(this.data.weekStart, -1);
    const currentWeekStart = dateUtil.weekStartFromDate(new Date());
    this.setData({
      weekStart,
      weekRangeLabel: dateUtil.formatWeekRange(weekStart),
      isCurrentWeek: weekStart === currentWeekStart,
    });
    await this.loadSchedule();
  },

  async onNextWeek() {
    const weekStart = dateUtil.addWeeks(this.data.weekStart, 1);
    const currentWeekStart = dateUtil.weekStartFromDate(new Date());
    this.setData({
      weekStart,
      weekRangeLabel: dateUtil.formatWeekRange(weekStart),
      isCurrentWeek: weekStart === currentWeekStart,
    });
    await this.loadSchedule();
  },

  async onBackToCurrentWeek() {
    const weekStart = dateUtil.weekStartFromDate(new Date());
    this.setData({
      weekStart,
      weekRangeLabel: dateUtil.formatWeekRange(weekStart),
      isCurrentWeek: true,
    });
    await this.loadSchedule();
  },
});
