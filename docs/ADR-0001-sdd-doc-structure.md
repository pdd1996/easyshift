# ADR-0001: SDD 文档结构采用方案 A

| 项目 | 内容 |
|------|------|
| 状态 | 已采纳 |
| 日期 | 2026-07-01 |
| 决策人 | EasyShift 项目维护者 |
| 关联文档 | [TEST_PLAN.md](./TEST_PLAN.md) · [.doc/README.md](../.doc/README.md) · [doc-sync.mdc](../.cursor/rules/doc-sync.mdc) |

## 背景

EasyShift 已有较完整的长期文档：`PRD.md`、`API.md`、`DATABASE.md`、`TEST_PLAN.md` 等。随着 AI Agent 参与开发，单一大文档会带来上下文过大、职责混杂和重复维护的问题。

项目需要同时满足三类需求：

- 长期产品与技术事实要稳定可追溯。
- 新功能开发要有可执行的 `spec.md` / `plan.md` / `tasks.md`。
- 模块测试断言要贴近代码，便于改代码时同步维护。

## 决策

采用 **方案 A：三层分工**。

```text
docs/                # 长期权威文档
.doc/specs/active/   # 当前变更执行包
**/test-spec.md      # 模块验收契约，贴代码维护
```

具体约定：

- `docs/` 只保存长期权威事实，例如产品范围、AC、接口、数据库、安全、部署和测试策略。
- `.doc/specs/active/{feature-id}/` 只保存进行中的 SDD 执行包，包含 `spec.md`、`plan.md`、`tasks.md`。
- `.doc/specs/archive/` 保存已完成执行包，用于审计和回溯。
- `test-spec.md` 放在对应代码模块旁，维护 `[rN]`、`[iN]`、`[sN]`、`[uN]` 断言。
- `e2e/ui-test-spec.md` 属于 test-spec 族例外，用于维护端到端场景规格。
- `docs/TEST_PLAN.md` 只保留测试策略、AC 映射和模块 `test-spec.md` 索引，不再重复承载所有断言表。

## 理由

### 分离生命周期

`docs/` 是长期事实，生命周期接近产品版本；`.doc/specs/active/` 是短期执行包，生命周期接近一次需求或 PR；`test-spec.md` 跟代码一起演进。

把三者分开，可以避免把一次性执行细节写进长期 PRD，也避免把模块测试断言集中到一个越来越大的测试计划文档里。

### 降低 AI 上下文成本

执行某个新需求时，Agent 优先读取：

1. `.doc/specs/active/{feature-id}/spec.md`
2. `.doc/specs/active/{feature-id}/plan.md`
3. `.doc/specs/active/{feature-id}/tasks.md`
4. 相关模块的 `test-spec.md`
5. 必要的 `docs/` 权威文档

这样不需要每次加载完整 `PRD.md` 或完整 `TEST_PLAN.md`。

`plan.md` 只描述本次变更如何引用既有架构、接口和数据约定，不复制 `API.md`、`DATABASE.md`、`TECH_STACK.md` 等长期权威文档全文。

### 避免历史补文档负担

EasyShift 是棕地项目，已有功能不强制补完整 `spec.md` / `plan.md` / `tasks.md`。历史模块只迁出长期有价值的 `test-spec.md`。

完整三件套只在新需求或较大变更发生时创建，交付后归档。

## 工作流

详细操作见 [.doc/README.md](../.doc/README.md)。原则流程如下：

1. 新需求进入 `.doc/prd/`（可选）或直接在对话中描述。
2. 在 `.doc/specs/active/{feature-id}/` 依次生成并确认 `spec.md`、`plan.md`、`tasks.md`。
3. 用户确认后，通过“执行 `.doc/specs/active/{feature-id}`”或“按这个 spec 开始实现”触发执行。
4. Agent 按 `tasks.md` 顺序推进，必要时同步更新模块 `test-spec.md` 和 `docs/` 权威文档。
5. 完成后将整个目录移到 `.doc/specs/archive/YYYY-MM-{feature-id}/`。

当前未引入专用自动执行器；执行由 Agent 读取 `tasks.md` 后推进。如后续新增专用 rule 或 skill，应另行记录。

## 后果

### 正面影响

- 新需求有明确执行契约，减少 AI 发散。
- 模块测试断言贴近代码，降低维护成本。
- `TEST_PLAN.md` 更像测试策略和索引，不再无限膨胀。
- 已完成 spec 可归档，便于回溯当时的范围、方案和任务。

### 代价

- 仓库多出 `.doc/` 工作区，需要团队理解其用途。
- 新需求需要先拆解再执行，不能直接跳到代码。
- 若忘记归档，`.doc/specs/active/` 可能堆积，需要定期清理。

## 不采用的方案

### 方案 B：所有 spec 放代码旁

不采用。跨 Web + API 的需求（如发布、绑定）难以归属到单一代码目录，且执行包和模块长期断言容易混在一起。

### 方案 C：所有 spec 放 `docs/specs/`

不采用。`docs/` 已作为长期权威文档目录，放入短期执行包会混淆“事实文档”和“工作区文档”的边界。

## 维护规则

- 新功能、跨模块变更或行为契约变化必须先建 `.doc/specs/active/{feature-id}/`；typo、单行 bugfix、格式修复等小改可豁免。
- 只为真实变更创建 `spec.md` / `plan.md` / `tasks.md`，不为历史功能批量补齐。
- 模块行为或测试断言变化时，优先同步对应 `test-spec.md`。
- 产品、API、数据库、安全等长期语义变化时，按 `.cursor/rules/doc-sync.mdc` 同步权威文档。
