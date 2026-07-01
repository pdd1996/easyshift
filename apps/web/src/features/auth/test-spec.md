# 认证（Web）test-spec

**PRD**：WEB-AUTH-01～04 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-AUTH-03 | 未登录访问 `/schedule` 重定向登录页 | COMP |
| i1 | 交互 | WEB-AUTH-01 | 正确手机号+密码提交后进入首页 | COMP + E2E |
| s1 | 状态 | WEB-AUTH-01 | 错误密码显示明确错误文案 | COMP |
| s2 | 状态 | WEB-AUTH-02 | 登录响应 Set-Cookie 含 HttpOnly | API |
