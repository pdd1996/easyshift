# EasyShift 测试现状总览

本文档汇总当前 EasyShift 项目的测试分层、已有测试文件、常用命令，以及绑定生命周期改动实际执行过的验证。

## 本次已执行验证

```bash
cd apps/api
npm test -- binding.test.ts
npm run typecheck
```

结果：

- `binding.test.ts`：12 个用例全部通过。
- `typecheck`：后端 TypeScript 编译检查通过。

覆盖重点：

- 小程序绑定成功。
- 错误绑定码、手机号后四位不匹配、重复绑定等失败场景。
- 解绑后旧 Token 返回 401。
- 解绑后同一微信再次 login 返回 `bound=false`。
- `GET /staff/me` 返回当前员工资料。

未执行：

- 全仓库 `pnpm test`。
- Web 组件测试。
- Playwright E2E。
- 小程序真机 / 开发者工具手工验收。

## 测试分层

当前项目大致分为五类测试：

- 单元测试：纯函数、日期、排班规则、通知文案等。
- API 集成测试：Hono `app.request()` + 测试 MySQL，覆盖真实接口、事务、权限、唯一约束。
- Web 组件测试：Vitest + jsdom + Testing Library + MSW。
- 端到端测试：Playwright，目前只有跳过的登录占位用例。
- 小程序手工验收：目前没有自动化测试，主要通过微信开发者工具 / 真机验收。

## 单元测试

`apps/api/src/services/schedule/date-utils.test.ts`

- 日期按日历日处理。
- 生成排班周 7 天日期。
- 判断日期是否属于当前排班周。
- ISO weekday：周一为 1，周日为 7。

`apps/api/src/services/schedule/rule-warnings.test.ts`

- 连续大夜超过 2 天报警。
- 大夜后 24 小时内接白班报警。
- 使用 `kind` 判断班次类型，避免依赖中文 / 英文 code。
- 非违规场景不报警。

`apps/api/src/services/schedule/validation.test.ts`

- 合并覆盖人数警告和规则警告。

`apps/api/src/services/schedule/copy.test.ts`

- 复制上周时源日期整体映射到目标周，即 +7 天。

`apps/api/src/services/schedule/notification-text.test.ts`

- 发布通知文案包含科室、周范围、版本、发布时间。

`packages/shared-types/src/__tests__/dates.test.ts`

- `weekStartFromDate` 能返回当前周周一。
- 输入本身是周一时保持不变。
- 按 Asia/Shanghai 日历日处理日期边界。
- `isMonday` 判断周一。

## API 集成测试

API 集成测试主要位于 `apps/api/src/*.test.ts`。这些测试使用 Hono `app.request()` 直接请求应用，并依赖测试 MySQL。

`apps/api/src/app.test.ts`

- health check 返回 ok。

`apps/api/src/employees.test.ts`

- 新增员工。
- 工号重复返回 409。
- 员工分页列表。
- 停用员工。
- 生成绑定码。

`apps/api/src/shift-types.test.ts`

- 新建班次。
- 班次 code 重复返回 409。
- 班次列表按 `sortOrder` 排序。
- 更新班次。
- 停用班次。

`apps/api/src/schedule.test.ts`

- 创建排班周期。
- 相同 `weekStart` 返回已有周期。
- 拒绝非周一 `weekStart`。
- 查询周期列表。
- 获取排班 grid。
- 保存排班单元格。
- 清空排班单元格。
- 保存后更新每日覆盖统计。
- 批量保存中重复员工 / 日期单元格返回 409。
- 禁止给新单元格分配 inactive 班次。
- inactive 班次仍可展示，但不参与覆盖警告。

`apps/api/src/schedule-copy.test.ts`

- 复制源周草稿到目标周，并按 +7 天映射。
- 复制时覆盖目标周已有草稿。
- 源周期不存在返回 404。

`apps/api/src/publish.test.ts`

- 发布时返回排班 warning。
- 存在覆盖 warning 时要求 `acknowledgeWarnings`。
- 空 JSON body 按默认发布参数处理。
- 发布草稿并递增 `latestPublishedVersion`。
- 无未发布改动时拒绝重复发布。
- 编辑后再次发布，版本递增到 v2。

`apps/api/src/staff-schedule.test.ts`

- 非周一 `weekStart` 返回 400。
- 未绑定 staff 账号返回 403。
- 未发布周期返回 `not_published`。
- 没有排班周期时返回 `not_published`。
- 员工小程序只读取最新发布快照。
- 员工隔离：员工 A 只能看到员工 A 的班表。
- 发布后管理员再编辑草稿，小程序仍看到旧发布快照。
- 再次发布后，小程序看到 v2 快照。
- 休息班显式展示，而不是空白。
- 不传 `weekStart` 时默认当前上海周。

`apps/api/src/binding.test.ts`

- 正确绑定码 + 手机号后四位绑定成功，并签发 Bearer Token。
- 错误绑定码返回 `BINDING_CODE_INVALID`。
- 手机号后四位不匹配返回 `PHONE_MISMATCH`。
- 绑定成功后绑定码状态变为 `used`。
- 已绑定员工再次绑定返回 `ALREADY_BOUND`。
- 同一 openid 绑定第二个员工返回 `ALREADY_BOUND`。
- 未绑定微信 login 返回 `bound=false`。
- 绑定码复用失败。
- 并发绑定同一个绑定码时只有一个成功。
- 已预绑定员工不能再次绑定。
- 解绑后旧 Token 返回 401。
- `GET /staff/me` 返回当前绑定员工资料。

## Web 组件测试

Web 组件测试位于 `apps/web/src/**/__tests__`，使用 Vitest、jsdom、Testing Library 和 MSW。

`apps/web/src/features/shift-types/__tests__/ShiftTypesPage.test.tsx`

- 班次列表渲染名称、代码、规则类型、时间段、颜色。

`apps/web/src/features/schedule/__tests__/SchedulePage.test.tsx`

- 初次进入不展示 warnings 摘要，点击「检查排班」后展示。
- 排班 grid 接口失败时显示加载失败错误态。

`apps/web/src/features/schedule/components/__tests__/ScheduleGrid.test.tsx`

- 渲染 10 行员工 × 7 列周一至周日。
- 点击空单元格选择班次后保存，并刷新显示。

## 端到端测试

E2E 位于 `e2e/tests`，使用 Playwright。

`e2e/tests/login.spec.ts`

- 当前只有一个登录页占位用例：`E2E-01 login placeholder`。
- 该用例目前是 `test.skip`，所以实际不会执行。

结论：现阶段项目没有有效运行的 E2E 覆盖。

## 小程序手工验收

小程序目前没有自动化测试，建议使用微信开发者工具或真机做手工验收。

绑定生命周期相关验收：

- 已绑定冷启动后直接进入班表 Tab。
- Tab 切换正常。
- 「我的」页姓名、工号、科室正确。
- 「我的」页进入时会调用 `/staff/me` 校验绑定状态。
- 服务端解绑或 Token 失效后进入「我的」页，自动清本地 session 并跳绑定页。
- 点击「解绑账号」后出现二次确认。
- 确认解绑后跳绑定页。
- 解绑后旧 Token 不能再访问 `/staff/me` 或 `/staff/schedule`。
- 重新绑定后可重新进入班表。
- 深色模式下 TabBar 和「我的」页显示正常。

班表相关验收：

- 未发布周显示「暂无已发布班表」。
- 已发布周显示 7 天班表。
- 员工只能看到自己的班表。
- 管理员发布后小程序可见。
- 管理员只改草稿但未重新发布时，小程序仍显示旧快照。

## 常用命令

根目录命令：

```bash
pnpm test
pnpm test:api
pnpm --filter @easyshift/web test
pnpm test:e2e
pnpm typecheck
pnpm build
```

API 单独执行：

```bash
cd apps/api
npm test
npm test -- binding.test.ts
npm run typecheck
```

Web 单独执行：

```bash
cd apps/web
npm test
npm run typecheck
```

E2E：

```bash
pnpm test:e2e
```

注意：

- API 集成测试依赖测试 MySQL。
- API 测试配置会使用 `easyshift_test` 数据库，并设置 `WX_MOCK=true`。
- E2E 当前只有跳过的占位测试，不能代表真实端到端质量。
- 小程序缺少自动化测试，需要手工验收补足。

## 当前测试风险

- 小程序没有自动化测试，绑定、TabBar、深色模式、真机兼容性都需要手工确认。
- Playwright E2E 仍是占位，Web 关键路径缺少真实端到端保护。
- Web 管理端 P1 功能继续推进后，需要同步补组件测试和 API 集成测试。
- API 集成测试依赖真实 MySQL，CI / 本地环境需要保证测试数据库可用。
