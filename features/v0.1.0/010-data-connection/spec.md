# Feature: 010 Data Connection（数据连接）

> **⚠️ 写 spec 前，必须完整准确理解 PRD（不可遗漏任何功能点）。**
> **前置步骤**：本文档编写前必须已完成 Spec Discovery（架构师提问），确保 PRD 中的不确定性已与用户对齐。
> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。
> 如有跨 feature 依赖，必须在"依赖与约束"节中声明，并对照 release-contract.md。

**关联 PRD**: [docs/prd/0.1.0（MVP）/数据连接（Data Connection）PRD.md]
**优先级**: P0
**所属版本**: v0.1.0

---

## 特性概述

Data Connection 负责外部数据源接入和 Dataset 管理。支持**两种数据接入模式**：

- **快照导入（Snapshot Import）**：从外部数据源（MySQL 数据库表、Excel/CSV 文件）将数据一次性复制到平台内部，创建 Dataset 快照。数据存储在平台 PostgreSQL 中，外部数据源断开后仍可查看。
- **实时连接（Live Connection）**：仅注册外部 MySQL 表的 schema 元数据，数据保留在外部数据库中，按需实时查询。适用于大数据量表或需要数据始终最新的场景。

```
快照导入路径：外部数据源 → [一次性快照导入] → 平台内部 Dataset → 对象类型（Object Type）
实时连接路径：外部数据源 ← [按需实时查询] ← Live Dataset（仅元数据） → 对象类型（Object Type）
```

Data Connection **生产** Dataset（Snapshot 或 Live）；Ontology Manager **消费** Dataset。

**页面职责分离**（PRD §3.2/§3.3）：
- **Connections Tab**：管理连接配置（列表、新建、测试、删除、Schema 浏览），是连接创建和配置的**唯一入口**
- **Datasets Tab**：管理已有 Dataset + 提供导入/注册入口（Import from MySQL / Connect to MySQL / Upload File）

**向导中的连接选择规则**：MySQL 快照导入向导（§3.4）和实时连接向导（§3.6）的第一步均为**选择已有连接**（下拉选择器），不允许内联创建新连接。连接的创建和配置统一在 Connections Tab 完成。

---

## 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| KD-1 | MVP 不引入通用 Connector 框架，直接实现 MySQL 连接器 + Excel/CSV 上传 | 架构文档规划的 PyAirbyte + ConnectorRegistry 是 v0.2.0+ 交付物；MVP 聚焦快速交付两个最常用数据源 |
| KD-2 | MySQL 连接密码使用 Fernet（AES-256）对称加密存储 | 满足 INV-6（密码加密存储），Fernet 提供加密+完整性校验，密钥通过环境变量注入 |
| KD-3 | 数据导入为后台异步任务，前端通过轮询获取进度 | 大表导入耗时不确定，异步模型避免 HTTP 超时；MVP 不引入 WebSocket |
| KD-4 | Snapshot Dataset 行数据以 JSONB 存储在 `dataset_rows` 表中 | MVP 数据量有限，JSONB 提供 schema-free 灵活性，避免为每个 Dataset 动态建表；Live Dataset 不存储行数据 |
| KD-5 | 架构文档中的 `data_sources` 通用连接表延后到 v0.2.0 | MVP 使用专用 `mysql_connections` 表；通用抽象在引入 PostgreSQL 等更多连接器时再统一 |
| KD-6 | Snapshot 和 Live Dataset 复用同一个 `datasets` 表，通过 `mode` 字段区分 | 两种模式共享大部分字段（名称、来源、列定义、in_use 状态），`mode` 字段为 `snapshot` 或 `live`；Live Dataset 额外记录 `connection_rid` 引用 |
| KD-7 | Live Dataset 数据预览不做连接池和限流，由外部 MySQL 自身连接上限兜底 | MVP 阶段 Live Dataset 使用量有限，短连接模型足够；后续如需高并发访问，可在 v0.2.0+ 引入连接池 |

---

## 用户故事

### US-1: 连接管理（Connection Management）

作为 **本体管理员**，
我希望 **注册、测试、浏览和管理 MySQL 数据库连接配置**，
以便 **后续从这些数据源导入数据到平台**。

### US-2: MySQL 快照导入（MySQL Snapshot Import）

作为 **本体管理员**，
我希望 **选择已有连接，浏览 MySQL 数据库表结构、预览数据、并将选定的表导入为 Dataset 快照**，
以便 **为对象类型提供底层数据支撑**。

### US-3: 文件上传导入（File Upload）

作为 **本体管理员**，
我希望 **上传 Excel 或 CSV 文件并将其导入为 Dataset**，
以便 **无需数据库也能快速接入结构化数据**。

### US-4: Dataset 管理（Dataset Management）

作为 **本体管理员**，
我希望 **查看、搜索、预览和删除已有的 Dataset（包括 Snapshot 和 Live 两种模式）**，
以便 **管理平台中的数据资产**。

### US-5: 导航入口（Navigation）

作为 **本体管理员**，
我希望 **通过侧边栏直接访问数据连接管理页面**，
以便 **便捷地管理数据源和 Dataset**。

### US-6: 与 Ontology Manager 集成

作为 **本体管理员**，
我希望 **在创建对象类型时能从 Dataset 列表中选择 backing datasource（包括 Snapshot 和 Live Dataset）**，
以便 **将对象类型与实际数据关联**。

> 注：US-6 的"消费"侧实现属于 003-object-type-crud，本特性只负责提供 Dataset 列表 API 和 in-use 状态计算。

### US-7: MySQL 实时连接（MySQL Live Connection）

作为 **本体管理员**，
我希望 **选择已有连接，浏览 MySQL 数据库表结构、并将选定的表注册为 Live Dataset（仅元数据，数据保留在外部）**，
以便 **对大数据量表或需要始终最新数据的场景提供实时数据接入**。

---

## 验收标准

### 连接管理（Connection Management）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-CM01 | 管理员 | 填写 MySQL 连接信息（名称、Host、Port、Database、Username、Password）并保存 | 连接保存成功，密码加密存储，返回连接信息（不含密码），HTTP 201 |
| AC-CM02 | 管理员 | 填写连接信息后点击"测试连接" | 系统尝试建立 MySQL 连接（10s 超时），返回成功/失败状态 + 耗时，HTTP 200 |
| AC-CM03 | 管理员 | 测试连接时使用已保存连接的 `connection_rid` 复用密码 | 系统从数据库解密已有密码进行连接测试，无需用户重新输入 |
| AC-CM04 | 管理员 | 查看连接列表 | 返回所有已保存的 MySQL 连接，按创建时间降序，不含密码字段；每个连接包含关联 Dataset 数量（`datasetCount`，含 Snapshot 和 Live）和最近使用时间（`lastUsedAt`，最近一次使用该连接导入/注册 Dataset 的时间，无使用记录时为 null） |
| AC-CM05 | 管理员 | 测试连接时填写错误的 Host/Port/凭据 | 返回连接失败信息 + 错误详情，HTTP 200（`success: false`） |
| AC-CM06 | 管理员 | 删除已保存的连接（指定 RID），该连接无 in-use 状态的 Live Dataset | 连接配置被删除；关联的 Live Dataset 标记为 `disconnected`；关联的 Snapshot Dataset 不受影响；HTTP 204 |
| AC-CM07 | 管理员 | 删除不存在的连接 RID | 返回 `CONNECTION_NOT_FOUND`，HTTP 404 |
| AC-CM08 | 管理员 | 在 Connections Tab 点击"New Connection"按钮 | 打开连接配置表单（仅创建连接，不触发导入流程），填写信息后保存，连接出现在列表中 |
| AC-CM09 | 管理员 | 查看连接列表中的"关联 Dataset 数"列 | 每个连接显示通过该连接关联的 Dataset 数量（`connectionRid` 匹配的 ready 状态 Dataset 计数，含 Snapshot 和 Live） |
| AC-CM10 | 管理员 | 点击连接列表中的连接名称 | 打开 Schema 浏览器，展示该数据库下的所有表列表，支持按名称搜索过滤 |
| AC-CM11 | 管理员 | 在 Schema 浏览器中选中一张表 | 展示该表的列结构（列名、数据类型、主键标识、是否可为 NULL） |
| AC-CM12 | 管理员 | 在 Schema 浏览器中选中一张表 | 展示该表前 50 行数据预览，只读表格形式 |
| AC-CM13 | 管理员 | 查看连接列表的状态列 | 未测试的连接显示 `untested`；测试成功后显示 `connected`；测试失败后显示 `failed` |
| AC-CM14 | 管理员 | 获取单个连接详情（指定 RID） | 返回该连接的完整信息（不含密码）+ 关联 Dataset 数量，HTTP 200 |
| AC-CM15 | 管理员 | 删除连接时，该连接存在 in-use 状态的 Live Dataset（已被 ObjectType 关联） | 返回 `CONNECTION_HAS_IN_USE_LIVE_DATASETS` 错误，HTTP 409，提示用户先解除 ObjectType 关联 |

### MySQL 快照导入（MySQL Snapshot Import）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-MI01 | 管理员 | 选择已保存的连接，浏览数据库表 | 返回表列表（名称 + 行数），HTTP 200 |
| AC-MI02 | 管理员 | 选择一张表，查看列结构 | 返回列列表（名称、类型、可空、主键、推断的属性类型），HTTP 200 |
| AC-MI03 | 管理员 | 选择一张表，预览数据 | 返回前 50 行数据 + 总行数，HTTP 200 |
| AC-MI04 | 管理员 | 指定 Dataset 名称和选择的列，发起导入（表行数 ≤10 万） | 系统返回 ImportTask（status=pending），HTTP 202；后台异步执行导入；Dataset mode=snapshot |
| AC-MI05 | 管理员 | 导入进行中，轮询任务状态 | 返回当前 ImportTask 状态（pending/running/completed/failed），含 row_count/duration_ms |
| AC-MI06 | 管理员 | 导入完成后查看结果 | ImportTask status=completed，含 dataset_rid、row_count、column_count、duration_ms |
| AC-MI07 | 管理员 | 导入同一张表两次 | 允许，每次创建独立的 Dataset 快照，互不影响 |
| AC-MI08 | 管理员 | 查询不存在的 task_id | 返回 HTTP 404 |
| AC-MI09 | 管理员 | 导入行数超过 10 万的表 | 在 Step 3 确认导入前，系统根据 `SELECT COUNT(*)` 预检行数，超限时显示 `ROW_LIMIT_EXCEEDED` 错误（HTTP 422），阻止进入 Step 4 |
| AC-MI10 | 管理员 | 在快照导入向导 Step 1 选择已有连接 | 展示该连接的只读预览信息（连接名称、Host、Database）；若无可用连接，显示引导文案跳转至 Connections Tab |

### MySQL 实时连接（MySQL Live Connection）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-LC01 | 管理员 | 在实时连接向导 Step L1 选择已有连接 | 展示该连接的只读预览信息（连接名称、Host、Database）；模态框顶部展示"实时连接模式"标识和说明文案 |
| AC-LC02 | 管理员 | 在 Step L1 选中连接后，点击"测试连接" | 系统尝试建立 MySQL 连接，返回成功/失败状态；**必须测试成功**才能进入下一步（不允许跳过） |
| AC-LC03 | 管理员 | 在 Step L1 无可用连接 | 显示引导文案："尚无连接，请先前往 Connections Tab 创建"（可点击链接跳转） |
| AC-LC04 | 管理员 | 测试连接成功后进入 Step L2，浏览数据库表 | 返回表列表（名称），每行显示标签：`已有快照` 或 `已有实时连接`（不阻止再次注册） |
| AC-LC05 | 管理员 | 在 Step L2 选中表，查看列结构和数据预览 | 展示列结构（列名、数据类型、主键、可空）+ 前 50 行数据预览 |
| AC-LC06 | 管理员 | 在 Step L2 配置 Dataset 名称和选择列，点击"确认注册" | 系统注册 Live Dataset（mode=live），记录 schema 元数据 + connection_rid 引用；HTTP 201 |
| AC-LC07 | 管理员 | 注册成功后查看结果（Step L3） | 展示摘要：列数、连接名称、源表名；点击"完成"后返回 Datasets Tab，新 Live Dataset 出现在列表中，模式列显示 `Live` |
| AC-LC08 | 管理员 | 注册失败（如连接突然断开） | 展示错误信息 + "重试"按钮（重新从 Step L2 开始）+ "取消"按钮 |
| AC-LC09 | 管理员 | 查看 Live Dataset 详情 | 展示列结构（已注册到平台内部）；数据预览实时查询外部 MySQL 数据库 |
| AC-LC10 | 管理员 | 查看 Live Dataset 详情时，外部 MySQL 不可用 | 列结构仍可正常查看；数据预览展示降级提示："外部数据源当前不可用，列结构仍可查看，数据预览暂不可用" + "重试连接"按钮 |
| AC-LC11 | 管理员 | 查看 `disconnected` 状态的 Live Dataset | 列结构仍可查看；数据预览不可用；提示用户该 Dataset 对应的连接已被删除，需删除后重新创建 |
| AC-LC12 | 管理员 | 同一张表注册为 Live Dataset 两次 | 允许，每次创建独立的 Live Dataset 注册记录 |

### 文件上传（File Upload）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-FU01 | 管理员 | 上传 CSV/Excel 文件（≤50MB） | 返回列预览（名称 + 推断类型）+ fileToken，HTTP 200 |
| AC-FU02 | 管理员 | 上传后确认导入（指定 Dataset 名称、选择列） | 系统返回 ImportTask（status=pending），HTTP 202；后台异步解析并写入；Dataset mode=snapshot |
| AC-FU03 | 管理员 | 上传超过 50MB 的文件 | 返回文件过大错误，HTTP 422 |
| AC-FU04 | 管理员 | 上传不支持的文件格式（如 .pdf） | 返回格式不支持错误，HTTP 422 |
| AC-FU05 | 管理员 | Excel 文件包含多个 Sheet | 展示 Sheet 列表供用户选择；默认选中第一个 Sheet |
| AC-FU06 | 管理员 | CSV 列类型推断 | 采样前 1000 行；超过 5% 不匹配则回退 String 类型 |

### Dataset 管理（Dataset Management）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-DM01 | 管理员 | 查看 Dataset 列表 | 返回所有 status=ready 的 Dataset（含 Snapshot 和 Live），含名称、**模式**（`Snapshot` / `Live`）、来源类型、行数（Snapshot 显示实际行数，Live 显示 `Live` 标签）、列数、导入/注册时间、in_use 状态；已被引用的显示 `In use` + 关联的 ObjectType 名称；未被引用的显示 `Available` |
| AC-DM02 | 管理员 | 搜索 Dataset（关键词） | 按名称模糊匹配过滤结果 |
| AC-DM03 | 管理员 | 查看单个 Dataset 详情 | 返回 Dataset 完整信息 + 列定义列表；Live Dataset 额外返回连接状态信息 |
| AC-DM04 | 管理员 | 预览 Snapshot Dataset 数据 | 从平台内部存储读取，返回指定行数（默认 50，最多 500）的行数据 |
| AC-DM05 | 管理员 | 预览 Live Dataset 数据 | 实时查询外部 MySQL 数据库，返回前 50 行数据；外部不可用时返回降级提示 |
| AC-DM06 | 管理员 | 删除未被引用的 Snapshot Dataset | Dataset 及其行数据、列定义被删除，HTTP 204 |
| AC-DM07 | 管理员 | 删除未被引用的 Live Dataset | Dataset 元数据注册信息被删除（不影响外部 MySQL 数据库中的任何数据），HTTP 204 |
| AC-DM08 | 管理员 | 删除已被对象类型引用（in_use）的 Dataset（Snapshot 或 Live） | 返回 `DATASET_IN_USE` 错误，HTTP 403，不允许删除 |
| AC-DM09 | 管理员 | 查询不存在的 Dataset RID | 返回 HTTP 404 |
| AC-DM10 | 管理员 | 在 Datasets Tab 点击"Import Dataset"按钮 | 弹出选择器（Import from MySQL / Connect to MySQL / Upload Excel/CSV），选择后打开对应向导 |

### 导航与集成（Navigation & Integration）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-NV01 | 管理员 | 点击侧边栏"Data Connection"入口 | 导航到数据连接管理页面，默认展示 Connections Tab |
| AC-NV02 | 管理员 | 在对象类型创建向导中查看 Dataset 列表 | 显示 status=ready 的 Dataset 列表（含 Snapshot 和 Live，标注模式标签），已被其他 OT 引用的标记为 `In use`（Tooltip 显示"该数据集已被 <ObjectTypeName> 关联"）不可选 |

---

## 边界情况

### 连接相关
- 当 MySQL 连接超时（>10s）时，系统应返回连接失败状态并附带超时错误信息
- 当导入过程中 MySQL 连接断开时，ImportTask 应标记为 `failed` 并记录错误信息，不产生残留数据

### 快照导入相关
- 当并发导入同一张表时，系统应正常创建两个独立 Dataset（无冲突）
- 当临时上传文件的 fileToken 过期或无效时，确认导入应返回 404

### 连接删除与 Dataset 影响
- 当连接被删除后，通过该连接**快照导入**的 Snapshot Dataset 不受影响（数据已完整复制到平台内部）
- 当连接被删除后，通过该连接注册的 Live Dataset 标记为 `disconnected` 状态（仅可查看 schema，数据预览不可用）
- `disconnected` 状态的 Live Dataset **只能删除后重新创建**，不支持重新关联到其他连接
- 当连接存在 in-use 状态的 Live Dataset 时，**阻止删除连接**（HTTP 409），用户需先解除 ObjectType 关联

### Live Dataset 相关
- 当外部 MySQL 数据源临时不可用时，Live Dataset 列结构仍可正常查看，数据预览返回降级提示 + "重试连接"按钮
- Live Dataset 不受 10 万行导入限制（数据不复制到平台内部）
- 同一个连接可同时用于快照导入和实时连接，两种模式互不影响

### 不支持（明确排除）
- **不支持**：PostgreSQL 连接器（延后到 v0.2.0）
- **不支持**：通用 Connector 抽象层 / ConnectorRegistry（延后到 v0.2.0）
- **不支持**：Schema Drift 检测（延后到 v0.3.0）
- **不支持**：数据同步 / 增量更新（延后到 v0.4.0+）
- **不支持**：连接配置更新/编辑（MVP 仅支持新建和删除）
- **不支持**：Live Dataset 重新关联连接（disconnected 后只能删除重建）
- **不支持**：Live Dataset 数据预览的连接池和并发限流（由外部 MySQL 兜底）

---

## 非功能要求

- **性能**: 连接测试超时 10s；Schema 提取超时 60s；数据预览超时 30s（Snapshot 从内部存储读取，Live 从外部 MySQL 实时查询）；文件上传最大 50MB；单次 MySQL 快照导入上限 10 万行；Live Dataset 无行数限制
- **部署约束**: MVP 版本 ImportTaskService 使用进程内存存储，**仅支持单 worker 部署**（`uvicorn --workers 1`）
- **安全**: 密码 AES-256 加密存储（INV-6）；API 响应和日志中不得出现明文密码；加密密钥通过环境变量注入
- **可用性**: 导入任务提供状态轮询（pending → running → completed/failed）；失败时返回可读错误信息；Live Dataset 外部不可用时提供降级体验（schema 可查看 + 数据预览降级提示）

---

## 依赖与约束

### release-contract.md 对照

| 不变量 | 本特性职责 |
|--------|-----------|
| INV-3 | 同一 Dataset 只能关联一个 ObjectType（1:1 绑定）— **010 职责**：只读 in_use 计算 + 占用者名称返回（Snapshot 和 Live Dataset 均适用）；**003 职责**：保存 ObjectType 时由 OT Service 做唯一性校验（DB 级约束），冲突时返回 `DATASET_ALREADY_BOUND` 错误 |
| INV-6 | 密码使用 AES-256 加密存储，API 响应和日志中不得出现明文 — 由 CryptoService 实现 |

### 跨 Feature 依赖

| 依赖方向 | Feature | 说明 |
|---------|---------|------|
| 本特性依赖 | 001-scaffolding | 项目骨架、路由注册 |
| 本特性依赖 | 002-db-schema | 基础数据库 Schema |
| 被依赖 | 003-object-type-crud | OT 创建向导 Step 1 读取 Dataset 列表 API（含 Snapshot 和 Live） |
| 被依赖 | 005-object-type-crud-frontend | 前端向导依赖 Dataset 列表组件 |

---

## 相关文档

- 架构参考: [docs/architecture/05-data-connectivity.md]
- PRD: [docs/prd/0.1.0（MVP）/数据连接（Data Connection）PRD.md]
- 版本契约: [features/v0.1.0/release-contract.md]
