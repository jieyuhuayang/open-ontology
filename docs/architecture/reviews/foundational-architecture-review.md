# Open Ontology 第一性原理架构评审（Platform-Level, Updated）

## 1. 评审范围与评审基线

本次评审基于最新文档更新，重点关注平台架构的一致性与可演进性，而不是 MVP 功能细节。

输入文档：
- `docs/architecture/00-design-principles.md`
- `docs/architecture/01-system-architecture.md`
- `docs/architecture/02-domain-model.md`
- `docs/architecture/03-agent-context-architecture.md`
- `docs/architecture/04-tech-stack-recommendations.md`（已更新）
- `docs/architecture/05-data-connectivity.md`（全量重写）
- `docs/prd/0 概念定义/0 概念定义.md`

第一性原理基线：
1. 语义先于存储（Semantic > Storage）
2. 控制先于能力（Control > Capability）
3. 演进先于局部最优（Evolution > Local Optimization）

## 2. 更新后总体判断

更新是明显正向的，尤其是：
- 后端统一到 `Python + FastAPI + Pydantic v2 + SQLAlchemy async`，与 Data Connectivity 和 Agent 生态对齐；
- `05-data-connectivity.md` 把 PyAirbyte 前置为核心组件，平台“连接能力”从扩展项变成主能力；
- 前后端类型共享改为 OpenAPI codegen，解决了跨语言类型漂移问题；
- 部署图同步为 `Application Server (FastAPI)`，技术叙事更一致。

结论：  
**架构已经从“概念上支持数据连接”升级到“平台原生数据连接”。**  
但仍需补齐“契约化治理层”，否则能力增长速度会快于治理闭环。

## 3. 第一性原理复审（针对新增内容）

### 3.1 Semantic Contract（语义契约）

正向变化：
- `05-data-connectivity.md` 给出了清晰的 `ExtractedSchema` / `MappingResult` / `Compatibility` 模型；
- 类型映射矩阵（PG/MySQL/CSV/REST）增强了“可解释的语义落地”。

仍需加强：
- 目前 `inferred_base_type` 到 `PropertyBaseType` 的映射规则较完整，但“语义不变式”仍未统一收口；
- 自动映射规则与领域状态机（active/experimental/deprecated）尚未形成联动约束。

建议：
- 增加“映射契约层”章节：哪些自动映射可直接落地，哪些必须人工确认；
- 把 `lossy` 映射纳入强警告/阻断策略，并写入统一错误码体系。

### 3.2 Control Plane（控制面）

正向变化：
- 引入凭证加密、`SecretProvider` 抽象、连接状态模型，控制面意识增强。

关键缺口：
- `DATASOURCE_ENCRYPTION_KEY` 本地密钥方案适合启动期，但缺少 rotation、KMS、租户隔离策略；
- `test/extract/preview` API 尚未定义细粒度授权矩阵（谁能看 schema，谁能看样本数据，谁能触发连接测试）；
- MCP Tools 新增后，尚未给出 agent 身份委托与审计字段的强制规范。

建议：
- 在安全架构中新增 `Data Connectivity AuthZ Matrix`；
- 明确样本数据预览的脱敏策略与最大行数/字段白名单；
- 定义 agent 调用审计必填字段：`actor_type`, `delegated_from`, `datasource_rid`, `operation`, `policy_decision`。

### 3.3 Execution Model（执行模型）

正向变化：
- Python 技术栈统一后，连接器、数据推断、API 框架、MCP SDK 语言一致，执行链路变短；
- 通过 OpenAPI codegen 实现 TS 类型同步，降低了全栈协作成本。

关键缺口：
- OpenAPI codegen 缺少“破坏性变更守门”规则（仅生成不等于兼容）；
- SQLAlchemy async + PyAirbyte in-process 带来的事件循环与阻塞风险未在架构文档明确；
- 连接器执行资源治理（并发上限、超时、重试、熔断）未定义。

建议：
- 增加 API 兼容性策略：schema diff 检查 + CI fail-fast；
- 为连接器任务定义统一执行策略：`timeout/retry/concurrency limits/circuit breaker`；
- 明确 CPU/IO 重任务隔离策略（worker pool 或任务队列），避免阻塞 FastAPI 请求路径。

### 3.4 Agent Boundedness（Agent 边界）

正向变化：
- MCP Python SDK 成熟，技术选型与后端统一，降低实现摩擦；
- `05` 已定义面向 Agent 的数据源工具集（list/test/extract/suggest/preview）。

关键缺口：
- Agent 工具还缺少 “最小权限 + 最小数据暴露” 默认策略；
- `preview_datasource_data` 是高风险接口，需明确默认脱敏与审计强制性。

建议：
- 将 MCP 工具分级：`L1 metadata-only`、`L2 schema`、`L3 sample-data`；
- 默认仅开放 L1/L2，L3 需额外策略授权；
- 增加“拒绝策略”文档：无权限、敏感字段命中、超预算 token/rows 时返回规范错误。

## 4. 关键问题分级（Updated）

### Critical

1. **统一契约层仍缺失**  
语义契约、安全契约、变更契约尚未形成一个平台级规范入口，新增的数据连接能力会放大分叉风险。

2. **Data Connectivity 的权限与审计尚未闭环**  
连接测试、schema 提取、样本预览是高敏操作，但授权矩阵和审计规范尚未落地为硬约束。

3. **连接器执行治理缺失**  
尚未定义并发/超时/隔离策略，存在拖垮 API 主路径的系统性风险。

### High

1. **OpenAPI codegen 缺少兼容性门禁**  
需要从“能生成类型”升级为“能防止破坏性变更”。

2. **密钥治理停留在本地密钥阶段**  
需规划 rotation、KMS/Vault、多环境与多租户隔离。

3. **In-process PyAirbyte 缺少资源边界定义**  
需要明确何时直连请求线程、何时异步任务化。

### Medium

1. 术语仍有细小不一致（`id`/`rid`/`resource id`）；  
2. 控制面可观测性（AuthZ deny rate、connector latency、preview usage）尚未成体系。

## 5. 对当前更新的专项评审意见

### 5.1 关于 Python 后端切换（04）

结论：**正确且必要**。  
原因：Data Connectivity 与 Agent 生态的核心能力都更贴近 Python 原生栈。

补充建议：
- 明确 `uv + pytest + alembic` 的标准工程模板；
- 在 `justfile` 中固化跨语言命令入口，避免团队脚本分裂。

### 5.2 关于 OpenAPI 类型共享（04）

结论：**方向正确，但必须加门禁**。

补充建议：
- CI 增加 `openapi diff`（breaking changes fail）；
- 生成的 TS 类型要版本化或绑定 commit hash，保证前后端可追溯。

### 5.3 关于 PyAirbyte Core 化（05）

结论：**平台能力跃升**。  
从扩展能力变成核心能力，显著提高数据源覆盖率与落地速度。

补充建议：
- 定义连接器健康度与失败分级（可重试/不可重试/认证失败/速率限制）；
- 增加 connector capability profile（支持 schema、preview、drift、incremental 的能力位图）。

## 6. 结构化改进路线（文档层）

由于 `05` 已被数据连接占用，建议新增：

1. `docs/architecture/06-platform-contracts.md`  
统一语义契约、安全契约、变更契约。

2. `docs/architecture/07-security-control-plane.md`  
PDP/PEP、AuthZ matrix、审计事件 schema、数据预览脱敏规范。

3. `docs/architecture/08-change-and-commit-model.md`  
Command/ChangeSet/Commit、并发冲突协议、回滚与重放。

4. `docs/architecture/09-runtime-and-reliability.md`  
连接器执行治理、任务隔离、SLO/SLI、容量与故障策略。

## 7. 最终结论

这轮更新显著提升了平台的工程可实现性，尤其是 Python 统一栈和 PyAirbyte 核心化。  
下一步的关键不是继续加能力，而是把能力“契约化、治理化、边界化”：

1. 平台统一契约  
2. 数据连接控制面闭环  
3. 执行与可靠性治理

完成这三步后，Open Ontology 才能从“架构上可行”升级为“平台上可运营”。
