# 排班服务 test-spec（API）

**索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

## 冲突与校验

**PRD**：WEB-VAL-01～06 · **AC**：AC-05 · **实现**：`rule-warnings.ts`、`warnings.ts`

| ID | 类型 | PRD | 断言 | 测试 | 状态 |
|----|------|-----|------|------|------|
| u1 | 逻辑 | WEB-VAL-01 / AC-05 | 同员工同天两班次 → 保存 API 返回 `409 SCHEDULE_ENTRY_CONFLICT` | API | ✓ `schedule.test.ts` |
| u2 | 逻辑 | WEB-VAL-02 | 大夜结束后 24h 内白班 → `warnings` 含 `REST_VIOLATION` | UNIT | ✓ `rule-warnings.test.ts` |
| c1 | 交互 | WEB-VAL-06 | 初次进入排班页不展开 warnings 摘要，点击「检查排班」后展示 | COMP | — |
| u3 | 逻辑 | WEB-VAL-03 | 连续 3 天大夜 → `warnings` 含 `CONSECUTIVE_NIGHT` | UNIT | ✓ `rule-warnings.test.ts` |
| u6 | 逻辑 | WEB-VAL-02 / WEB-SHIFT-06 | code 为「夜/白」但 kind 为 night/day → 规则仍生效 | UNIT | ✓ `rule-warnings.test.ts` |
| u4 | 逻辑 | WEB-VAL-04 / AC-05 | 白班最低 3 人只排 2 人 → `warnings` 含 `COVERAGE_BELOW_MIN` | UNIT + API | ✓ `validation.test.ts`、`schedule.test.ts` |
| u5 | 逻辑 | WEB-VAL-05 | 大夜次数 > 均值+1 → `warnings` 含公平性警告 | UNIT | 未实现（P2） |
| s1 | 状态 | WEB-VAL-01 | 保存含 hard error 时 API 返回 409 | API | ✓ `schedule.test.ts` |
| s2 | 状态 | WEB-VAL-04 | 仅 warnings 时保存成功；warnings 经 grid / validation 接口返回 | API | ✓ |
| i1 | 交互 | AC-05 | 同天双班时 UI 阻止保存并展示错误 | COMP + E2E | — |

**UNIT 位置**：`rule-warnings.test.ts`、`validation.test.ts`

## 覆盖人数统计

**PRD**：WEB-STAT-03 · **AC**：AC-06 · **实现**：`coverage.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| u1 | 逻辑 | AC-06 | 某日白班 3 人、最低 3 → 不标记 under | UNIT |
| u2 | 逻辑 | AC-06 | 某日大夜 0 人、最低 1 → 标记 under | UNIT |
| u3 | 逻辑 | — | 「休息」班次不计入当班覆盖（除非业务定义计入） | UNIT |
| u4 | 逻辑 | — | 停用班次不可新排，历史快照计数不变 | API |

## 复制上周

**PRD**：WEB-SCH-07 · **AC**：AC-04 · **实现**：`copy.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| u1 | 逻辑 | AC-04 | 源周条目日期 +7 天映射到目标周 | UNIT |
| s1 | 状态 | AC-04 | 复制后目标周草稿条目数 = 源周非空条目数 | API |
| s2 | 状态 | WEB-SCH-07 | 复制覆盖目标周已有草稿 | API |

**API 位置**：`apps/api/src/schedule-copy.test.ts`、`copy.test.ts`

## 发布

**PRD**：WEB-PUB-01～05 · **AC**：AC-07、AC-08、AC-09 · **实现**：`publish.ts`、`notification-text.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| s1 | 状态 | AC-07 | 发布后 `latest_published_version` 递增 | API |
| s2 | 状态 | AC-08 | 改草稿后员工 API 仍返回旧 snapshot version | API + E2E |
| s3 | 状态 | AC-08 | 再次发布后员工 API 返回新 snapshot version | API + E2E |
| s4 | 状态 | PRD 5.4 | 并发两次发布不产生重复 version | API |
| u1 | 逻辑 | WEB-PUB-05 / AC-09 | 通知文案含周期、版本、发布时间 | UNIT |

**API 位置**：`apps/api/src/publish.test.ts`、`notification-text.test.ts`
