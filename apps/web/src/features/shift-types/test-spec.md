# 班次类型 test-spec

**PRD**：WEB-SHIFT-01～06 · **AC**：AC-02 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

| ID | 类型 | PRD | 断言 | 测试 | 状态 |
|----|------|-----|------|------|------|
| r1 | 渲染 | WEB-SHIFT-01 | 列表含名称、代码、规则类型、时间段、颜色 | COMP | — |
| i1 | 交互 | WEB-SHIFT-02 | 编辑大夜班开始时间与时长并保存 | COMP + API | ✓ `shift-types.test.ts` |
| i2 | 交互 | WEB-SHIFT-05 | 修改某班次最低覆盖人数 | COMP + API | ✓ |
| i3 | 交互 | WEB-SHIFT-06 | 新增/编辑时可选择规则类型 kind；code 可改为中文/英文 | COMP + API | ✓ |
| s1 | 状态 | WEB-SHIFT-04 | 「休息」班次时间段可为空 | UNIT + API | ✓ |
| s2 | 状态 | — | 代码重复返回 409 | API | ✓ |
| u1 | 逻辑 | WEB-SHIFT 默认 N | 大夜班 20:00 + 720min → 展示跨至次日 08:00 | UNIT | — |

**API 位置**：`apps/api/src/shift-types.test.ts`
