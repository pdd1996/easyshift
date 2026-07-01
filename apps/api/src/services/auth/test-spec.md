# 小程序绑定 test-spec（API）

**PRD**：MP-AUTH-01～08 · **AC**：AC-10 · **索引**：[docs/TEST_PLAN.md](../../../../../docs/TEST_PLAN.md)

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| s1 | 状态 | AC-10 | 正确绑定码 + 手机号后四位 → 200，签发 Bearer Token | API |
| s2 | 状态 | MP-AUTH-06 | 错误绑定码 → 4xx + 明确 error code | API |
| s3 | 状态 | MP-AUTH-06 | 手机号后四位不匹配 → 4xx | API |
| s4 | 状态 | MP-AUTH-07 | 绑定成功后码 status=used | API |
| s5 | 状态 | MP-AUTH-04 | 已绑定员工再次绑定 → 4xx | API |
| s6 | 状态 | MP-AUTH-04 | 同一 openid 绑第二人 → 4xx | API |
| s7 | 状态 | A-03 | 解绑后旧 Token → 401 | API |
| s8 | 状态 | A-03 / WEB-EMP-04 | 已绑定员工停用后再次 login → `bound=false`，不签发 Token | API + MANUAL |

**API 位置**：`apps/api/src/binding.test.ts`
