const STORAGE_KEYS = {
  token: 'easyshift_token',
  expiresAt: 'easyshift_expires_at',
  employee: 'easyshift_employee',
};

function getToken() {
  return wx.getStorageSync(STORAGE_KEYS.token) || '';
}

function getEmployee() {
  const raw = wx.getStorageSync(STORAGE_KEYS.employee);
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function isTokenValid() {
  const token = getToken();
  const expiresAt = wx.getStorageSync(STORAGE_KEYS.expiresAt);
  if (!token || !expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function saveSession(session) {
  wx.setStorageSync(STORAGE_KEYS.token, session.token);
  wx.setStorageSync(STORAGE_KEYS.expiresAt, session.expiresAt);
  wx.setStorageSync(STORAGE_KEYS.employee, session.employee);
}

function clearSession() {
  wx.removeStorageSync(STORAGE_KEYS.token);
  wx.removeStorageSync(STORAGE_KEYS.expiresAt);
  wx.removeStorageSync(STORAGE_KEYS.employee);
}

function updateEmployee(employee) {
  wx.setStorageSync(STORAGE_KEYS.employee, employee);
}

module.exports = {
  getToken,
  getEmployee,
  isTokenValid,
  saveSession,
  updateEmployee,
  clearSession,
};
