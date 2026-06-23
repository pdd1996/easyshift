# EasyShift 安全与权限

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 关联文档 | [PRD.md](./PRD.md) 第 4.3 节、第 5.3 节 · [API.md](./API.md) |

---

## 1. 安全目标（v1）

| 目标 | 说明 |
|------|------|
| 身份可信 | 管理员密码、微信 openid、绑定码均服务端校验 |
| 最小权限 | 员工只能读本人已发布班表；管理功能仅 Web admin |
| 会话可控 | 停用、解绑、改密后旧会话立即失效 |
| 传输安全 | 生产全站 HTTPS |
| 数据隔离 | v1 单科室；员工数据仅本科室管理员可管 |

---

## 2. 角色与权限矩阵

| 能力 | admin (Web) | staff (小程序) |
|------|-------------|----------------|
| 登录方式 | 手机号 + 密码 | 微信 code + 绑定 |
| 员工 CRUD | ✅ | ❌ |
| 班次配置 | ✅ | ❌ |
| 排班编辑 | ✅ | ❌ |
| 发布班表 | ✅ | ❌ |
| 生成绑定码 | ✅ | ❌ |
| 查看本人班表（已发布快照） | ❌* | ✅ |
| 查看他人班表 | ❌ | ❌ |
| 查看草稿排班 | ✅ | ❌ |

\* 若护士长需小程序看本人班表：她仍使用 `admin` 账号登录 Web；同时像普通员工一样通过绑定码创建独立的 `staff` 账号。小程序只识别 `staff` 账号，仅读本人数据。

### 2.1 接口鉴权规则（PRD P-01～P-04）

- 路径前缀 `/auth/admin/*`、`/employees`、`/shift-types`、`/schedule/*`（管理类）→ 要求 `role = admin` 且 `status = active`
- 路径前缀 `/auth/miniprogram/*`、`/staff/*` → 要求 `role = staff` 且 `status = active`
- `/staff/schedule` 响应必须按当前 `employee_id` 过滤，禁止通过参数指定他人 ID

---

## 3. 认证机制

### 3.1 Web — HttpOnly Cookie

| 项 | 约定 |
|----|------|
| 载体 | HttpOnly Cookie 承载 Web JWT |
| 下发 | `POST /auth/admin/login` Set-Cookie |
| 属性 | `HttpOnly`、`Secure`（生产）、`SameSite=Lax` 或 `Strict` |
| 有效期 | 默认 7 天（`WEB_SESSION_TTL_DAYS`） |
| 存储禁令 | **禁止**将访问令牌存入 `localStorage` / `sessionStorage` |

### 3.2 小程序 — Bearer Token

| 项 | 约定 |
|----|------|
| 载体 | JWT 或等价签名 Token |
| 传递 | `Authorization: Bearer <token>` |
| 有效期 | 默认 30 天（`MINIAPP_TOKEN_TTL_DAYS`） |
| 续期 | 登录成功签发新 Token；v1 不做滑动续期 |
| 作废依据 | `users.token_valid_after` |

### 3.3 Token 失效场景（PRD A-01～A-04）

| 事件 | 动作 |
|------|------|
| 员工 `inactive` | 拒绝该 staff 用户所有 Token |
| 员工解绑 | 删除/失效 staff 用户，拒绝旧 Token |
| 重新绑定 | 签发新 Token，旧 Token 拒绝 |
| 管理员 `disabled` | 拒绝所有 Web 会话 |
| 管理员改密 | 拒绝改密前签发的所有 Web 会话 |

v1 统一使用 `users.token_valid_after` 作废旧 Token / Web JWT 会话。所有 Web JWT 与小程序 Bearer Token 都必须包含签发时间 `iat`；服务端校验时读取当前用户记录，若 `iat < users.token_valid_after`，即使签名和过期时间合法也必须返回 `401`。员工停用、解绑、重新绑定、管理员停用、管理员改密时，更新对应用户的 `token_valid_after = 当前时间`。

---

## 4. 密码与绑定码

### 4.1 管理员密码

- 算法：bcrypt（cost ≥ 10）或同等强度
- 传输：HTTPS 下提交；日志禁止打印明文
- 初始密码：seed 仅用于开发；生产首次部署后强制修改

### 4.2 绑定码

- 生成：6～8 位随机字母数字，**仅响应体返回一次**
- 存储：`employee_binding_codes.code_hash` = bcrypt(绑定码)
- 生命周期：一次性；绑定成功 → `used`；管理员重置 → 旧 `active` 标 `expired`
- 二次校验：手机号后四位与 `employees.phone` 比对
- 并发：同一员工仅一个 `active` 绑定码

---

## 5. CSRF 与 XSS（Web）

| 威胁 | v1 对策 |
|------|---------|
| CSRF | Cookie + `SameSite`；写接口校验 `Origin`/`Referer` |
| XSS 窃取 Cookie | `HttpOnly` Cookie 不可被 JS 读取 |
| XSS 注入 | React 默认转义；富文本 v1 无 |

---

## 6. 微信 openid

- `wx_openid` 仅存服务端 `users` 表
- API 不向其他用户暴露 openid
- `code2session` 仅服务端调用，Secret 仅存 `WX_SECRET` 环境变量

---

## 7. 敏感操作

以下操作除鉴权外须服务端二次校验资源归属（本科室）：

| 操作 | 额外校验 |
|------|----------|
| 发布 | period 属于当前科室；事务内防并发 |
| 解绑 | 当前 staff 本人 |
| 停用员工 | 员工属于本科室 |
| 生成绑定码 | 员工属于本科室 |

---

## 8. 日志与审计

- **禁止**记录：密码、绑定码明文、完整 Token、微信 Secret
- **可记录**：操作人、period_id、action、时间（`schedule_change_logs`）
- 应用日志：请求 ID、路径、状态码、耗时；错误栈仅服务端

---

## 9. 合规与隐私（v1）

| 项 | 说明 |
|----|------|
| 收集信息 | 微信 openid、工号、姓名、手机号、排班数据 |
| 使用范围 | 本科室排班管理；不向第三方共享 |
| 公开链接 | v1 不提供班表公开分享 URL |
| 隐私政策 | 上线前需提供用户可读的隐私说明（产品侧文档） |

---

## 10. 生产安全检查清单

- [ ] 所有密钥通过环境变量注入，不入库、不进 Git
- [ ] `JWT_SECRET` 长度 ≥ 32，随机生成
- [ ] `COOKIE_SECURE=true`，全站 HTTPS
- [ ] 默认管理员密码已修改
- [ ] MySQL 不暴露公网或仅白名单
- [ ] API _rate limit_ 登录与绑定接口（建议）
- [ ] 数据库定期备份（见 [DEPLOYMENT.md](./DEPLOYMENT.md)）

---

## 11. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-06-23 | 初版 |
