# 排班表 test-spec

**PRD**：WEB-SCH-01～12 · **AC**：AC-03、AC-06 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

主要测试：`apps/web/src/features/schedule/components/__tests__/ScheduleGrid.test.tsx`、`packages/shared-types/src/__tests__/chinese-calendar.test.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-SCH-01 / AC-03 | 10 行员工 × 7 列（周一至周日） | COMP + E2E |
| r2 | 渲染 | WEB-SCH-03 | 顶部展示周期起止日期与状态徽章 | COMP |
| r3 | 渲染 | WEB-SCH-09 | 单元格展示班次简称与配置颜色 | COMP |
| r4 | 渲染 | WEB-SCH-10 / AC-06 | 每日各班次「已排/最低」统计行 | COMP |
| r5 | 渲染 | WEB-STAT-03 / AC-06 | 未达标单元格/行高亮 | COMP |
| r6 | 渲染 | WEB-SCH-12 | 表头展示法定节日名（如「端午」「春节」）、普通周末「休」、调休上班「班」；节日优先于周末 | COMP |
| r7 | 渲染 | WEB-SCH-10 | 覆盖统计隐藏 `0/0`；`min=0` 且已排人数 > 0 时仅展示人数 | COMP |
| i1 | 交互 | WEB-SCH-02 / AC-03 | 点击空格弹出班次选择，选中后格内更新 | COMP + E2E |
| i2 | 交互 | WEB-SCH-02 | 支持清空单元格班次 | COMP |
| i3 | 交互 | WEB-SCH-04 | 「创建下周排班」生成空草稿周期 | COMP + API |
| i4 | 交互 | WEB-DEPT-03 | 切换上一周/下一周加载对应周期 | COMP |
| i5 | 交互 | WEB-SCH-05 | 已发布周期编辑首格时弹出二次确认 | COMP |
| i6 | 交互 | WEB-SCH-11 | 周 / 月视图切换后，月视图可浏览整月并跳转到对应周视图 | COMP |
| s1 | 状态 | WEB-SCH-06 / AC-08 | 已发布周期改草稿后徽章「有未发布变更」 | COMP + API + E2E |
| s2 | 状态 | WEB-SCH-08 | 停用员工不出现在新周期行中 | API |
| s3 | 状态 | — | 接口 500 时排班表显示「加载失败」 | COMP |

## 发布（Web UI）

发布交互在 `SchedulePage.tsx`；与排班表同页验收。

**PRD**：WEB-PUB-01～05 · **AC**：AC-07、AC-08、AC-09

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-PUB-04 / AC-07 | 已发布周期显示版本号与发布时间 | COMP + E2E |
| i1 | 交互 | WEB-PUB-01 / AC-07 | 草稿态「发布本周期」可点击 | COMP + E2E |
| i2 | 交互 | WEB-PUB-02 | 发布前弹窗展示 warnings 摘要 | COMP + E2E |
| i3 | 交互 | WEB-PUB-05 / AC-09 | 发布成功后「复制通知文案」可用 | COMP |
| s1 | 状态 | WEB-PUB-01 | 无未发布变更的已发布周期按钮 disabled | COMP |

**API 位置**：`apps/api/src/publish.test.ts`
