# 小程序班表 test-spec（API）

**PRD**：MP-SCH-01～07 · **AC**：AC-11、AC-12、AC-13 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| s1 | 状态 | AC-11 / MP-SCH-04 | 仅草稿无发布 → 空态「班表尚未发布」 | API + MANUAL |
| s2 | 状态 | AC-11 / MP-SCH-03 | 有发布快照 → 返回 entries | API + MANUAL |
| s3 | 状态 | AC-12 | 条目含班次名、日期、时间段、published_at | API + MANUAL |
| s4 | 状态 | MP-SCH-06 | OFF 休息班次显式展示，非空白 | API + MANUAL |
| s5 | 状态 | AC-13 | 员工 A token 查员工 B schedule → 403 | API |
| s6 | 状态 | A-03 / WEB-EMP-04 | 员工停用后旧 Token 访问 `/staff/me` / `/staff/schedule` → 401 或 403，客户端清 session 并回绑定页 | API + MANUAL |
| u1 | 逻辑 | MP-SCH / 风险表 | 大夜班跨日展示文案正确 | UNIT + MANUAL |

**API 位置**：`apps/api/src/staff-schedule.test.ts`

手工验收清单见 [docs/TEST_PLAN.md §10](../../../../../docs/TEST_PLAN.md)。
