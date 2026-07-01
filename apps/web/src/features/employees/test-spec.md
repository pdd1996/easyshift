# 员工管理 test-spec

**PRD**：WEB-EMP-01～07 · **AC**：AC-01 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-EMP-01 | 表格列：姓名、工号、岗位、手机号、状态 | COMP |
| r2 | 渲染 | WEB-EMP-05 | 绑定状态列显示「已绑定」/「未绑定」 | COMP |
| i1 | 交互 | WEB-EMP-02 | 点「新增员工」打开表单 | COMP |
| i2 | 交互 | WEB-EMP-02 | 提交合法表单后列表刷新含新员工 | COMP + API |
| i3 | 交互 | WEB-EMP-06 | 点「生成绑定码」展示码并提供复制 | COMP + API |
| s1 | 状态 | WEB-EMP-02 / AC-01 | 工号重复 → 表单错误「工号已存在」 | COMP + API |
| s2 | 状态 | WEB-EMP-04 | 停用员工后状态为 inactive | API |
| s3 | 状态 | — | POST 重复工号返回 409 | API |
| s4 | 状态 | WEB-EMP-06 / WEB-EMP-07 | 已绑定员工不展示「绑定码」操作，后端生成绑定码返回 `ALREADY_BOUND` | COMP + API |
