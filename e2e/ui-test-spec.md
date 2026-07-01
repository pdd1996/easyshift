# E2E test-spec

**索引**：[docs/TEST_PLAN.md](../docs/TEST_PLAN.md) §6

v1 **不做**多模态视觉 diff；仅行为断言。E2E 通过 Playwright `webServer` 自动启动 Web + API，默认使用真 MySQL 与微信 mock。

| 场景 ID | 关联 AC | 步骤 | 期望 | 状态 |
|---------|---------|------|------|------|
| E2E-01 | AC-03 | 登录 → 创建隔离周周期 → 为员工排 1 格 → 保存 | 刷新后格子内容保留 | ✅ `e2e/tests/schedule.spec.ts` |
| E2E-02 | AC-05、AC-06 | 故意少排大夜 → 点发布 | 确认弹窗含 `COVERAGE_BELOW_MIN` 等排班 warning | ✅ |
| E2E-03 | AC-05、AC-06 | 排班表存在覆盖不足 | 页面统计区高亮未达标班次 | ⏸ 与 E2E-02 重叠，不做 |
| E2E-04 | AC-07 | 发布成功 | 页面显示 version=1 与发布时间 | ✅ |
| E2E-05 | AC-08 | 发布后改一格 → 查员工 API | 仍为 v1；再发布后 API 为 v2 | ✅ |
| E2E-06 | AC-09 | 发布成功 → 点复制文案 | 剪贴板/textarea 含周期信息 | ✅ |

**实现位置**：`e2e/tests/*.spec.ts` + `e2e/helpers/*.ts`
