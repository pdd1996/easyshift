# SDD 工作区（方案 A）

本目录存放 **短期变更执行包**，与 `docs/` 长期权威文档分离。

| 层级 | 路径 | 职责 |
|------|------|------|
| 产品真相 | `docs/PRD.md` 等 | 功能范围、AC、接口、表结构 |
| 变更执行 | `.doc/specs/active/{feature-id}/` | 本次要做的 spec / plan / tasks |
| 模块验收 | `**/test-spec.md`（贴代码） | `[r/i/s/u]` 测试断言 |
| 回归记录 | `.doc/runs/` | golden test 等执行记录 |

## 目录

```text
.doc/
├── prd/                    # 变更前需求草稿（可选）
├── specs/
│   ├── active/             # 进行中的 feature spec
│   └── archive/            # 已交付 spec（按日期归档）
└── runs/                   # 测试运行记录
```

## 工作流

1. **新需求**：在 `prd/` 写草稿，或直接在对话中描述。
2. **拆解**：在 `specs/active/{feature-id}/` 生成 `spec.md` → `plan.md` → `tasks.md`（每步预览确认后落盘）。
3. **执行**：按 `tasks.md` 逐项实现；同步更新模块 `test-spec.md` 与 `docs/` 权威文档（若语义变更）。
4. **交付**：整包移至 `specs/archive/YYYY-MM-{feature-id}/`；`specs/active/` 只保留进行中项。

## feature-id 命名

kebab-case，与 PRD 模块对齐，例如：`auth-web`、`employees`、`schedule-editor`、`schedule-validation`、`schedule-publish`、`miniapp-my-schedule`。

跨 Web + API 的端到端能力放在一个 spec 包内；纯 API 规则可与 Web UI 拆分。

## 与 test-spec.md 的关系

- `spec.md`：这次变更做什么、验收标准、排除项。
- `test-spec.md`：模块长期测试契约；变更时优先改 test-spec，再改测试代码。
- 权威索引见 [docs/TEST_PLAN.md](../docs/TEST_PLAN.md) §5。
