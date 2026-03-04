# Feature: 010 Data Connection（数据连接）

> **spec 只描述业务能力（用户能做什么、验收边界）。**
> UI 布局、交互细节、组件结构 → 写在 design.md。
> 如有跨 feature 依赖，必须在"依赖与约束"节中声明，并对照 release-contract.md。

**关联 PRD**: [docs/prd/0_1_0（MVP）/数据连接（Data Connection）PRD.md]
**优先级**: P0
**所属版本**: v0.1.0

---

## 特性概述

Data Connection 负责外部数据源接入和 Dataset 管理。用户通过 Data Connection 页面将外部数据（MySQL 数据库表、Excel/CSV 文件）导入为平台内部 Dataset 快照，供 Ontology Manager 在创建对象类型时选择作为 backing datasource。

**核心模型**：数据拷贝（Dataset Import）—— 外部数据源 → 一次性快照导入 → 平台内部 Dataset → 对象类型绑定。Data Connection **生产** Dataset；Ontology Manager **消费** Dataset。

---

## 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| KD-1 | MVP 不引入通用 Connector 框架，直接实现 MySQL 连接器 + Excel/CSV 上传 | 架构文档规划的 PyAirbyte + ConnectorRegistry 是 v0.2.0+ 交付物；MVP 聚焦快速交付两个最常用数据源 |
| KD-2 | MySQL 连接密码使用 Fernet（AES-256）对称加密存储 | 满足 INV-6（密码加密存储），Fernet 提供加密+完整性校验，密钥通过环境变量注入 |
| KD-3 | 数据导入为后台异步任务，前端通过轮询获取进度 | 大表导入耗时不确定，异步模型避免 HTTP 超时；MVP 不引入 WebSocket |
| KD-4 | Dataset 行数据以 JSONB 存储在 `dataset_rows` 表中 | MVP 数据量有限，JSONB 提供 schema-free 灵活性，避免为每个 Dataset 动态建表 |
| KD-5 | 架构文档中的 `data_sources` 通用连接表延后到 v0.2.0 | MVP 使用专用 `mysql_connections` 表；通用抽象在引入 PostgreSQL 等更多连接器时再统一 |

---

## 用户故事

### US-1: 连接管理（Connection Management）

作为 **本体管理员**，
我希望 **注册和管理 MySQL 数据库连接配置**，
以便 **后续从这些数据源导入数据到平台**。

### US-2: MySQL 数据导入（MySQL Import）

作为 **本体管理员**，
我希望 **浏览 MySQL 数据库表结构、预览数据、并将选定的表导入为 Dataset 快照**，
以便 **为对象类型提供底层数据支撑**。

### US-3: 文件上传导入（File Upload）

作为 **本体管理员**，
我希望 **上传 Excel 或 CSV 文件并将其导入为 Dataset**，
以便 **无需数据库也能快速接入结构化数据**。

### US-4: Dataset 管理（Dataset Management）

作为 **本体管理员**，
我希望 **查看、搜索、预览和删除已导入的 Dataset**，
以便 **管理平台中的数据资产**。

### US-5: 导航入口（Navigation）

作为 **本体管理员**，
我希望 **通过侧边栏直接访问数据连接管理页面**，
以便 **便捷地管理数据源和 Dataset**。

### US-6: 与 Ontology Manager 集成

作为 **本体管理员**，
我希望 **在创建对象类型时能从 Dataset 列表中选择 backing datasource**，
以便 **将对象类型与实际数据关联**。

> 注：US-6 的"消费"侧实现属于 003-object-type-crud，本特性只负责提供 Dataset 列表 API 和 in-use 状态计算。

---

## 验收标准

### 连接管理（Connection Management）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-CM01 | 管理员 | 填写 MySQL 连接信息（名称、Host、Port、Database、Username、Password）并保存 | 连接保存成功，密码加密存储，返回连接信息（不含密码），HTTP 201 |
| AC-CM02 | 管理员 | 填写连接信息后点击"测试连接" | 系统尝试建立 MySQL 连接（10s 超时），返回成功/失败状态 + 耗时，HTTP 200 |
| AC-CM03 | 管理员 | 测试连接时使用已保存连接的 `connection_rid` 复用密码 | 系统从数据库解密已有密码进行连接测试，无需用户重新输入 |
| AC-CM04 | 管理员 | 查看连接列表 | 返回所有已保存的 MySQL 连接，按创建时间降序，不含密码字段 |
| AC-CM05 | 管理员 | 测试连接时填写错误的 Host/Port/凭据 | 返回连接失败信息 + 错误详情，HTTP 200（`success: false`） |
| AC-CM06 | 管理员 | 删除已保存的连接（指定 RID） | 连接配置被删除，HTTP 204 |
| AC-CM07 | 管理员 | 删除不存在的连接 RID | 返回 `CONNECTION_NOT_FOUND`，HTTP 404 |

### MySQL 导入（MySQL Import）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-MI01 | 管理员 | 选择已保存的连接，浏览数据库表 | 返回表列表（名称 + 行数），HTTP 200 |
| AC-MI02 | 管理员 | 选择一张表，查看列结构 | 返回列列表（名称、类型、可空、主键、推断的属性类型），HTTP 200 |
| AC-MI03 | 管理员 | 选择一张表，预览数据 | 返回前 50 行数据 + 总行数，HTTP 200 |
| AC-MI04 | 管理员 | 指定 Dataset 名称和选择的列，发起导入（表行数 ≤10 万） | 系统返回 ImportTask（status=pending），HTTP 202；后台异步执行导入 |
| AC-MI05 | 管理员 | 导入进行中，轮询任务状态 | 返回当前 ImportTask 状态（pending/running/completed/failed），含 row_count/duration_ms |
| AC-MI06 | 管理员 | 导入完成后查看结果 | ImportTask status=completed，含 dataset_rid、row_count、column_count、duration_ms |
| AC-MI07 | 管理员 | 导入同一张表两次 | 允许，每次创建独立的 Dataset 快照，互不影响 |
| AC-MI08 | 管理员 | 查询不存在的 task_id | 返回 HTTP 404 |

### 文件上传（File Upload）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-FU01 | 管理员 | 上传 CSV/Excel 文件（≤50MB） | 返回列预览（名称 + 推断类型）+ fileToken，HTTP 200 |
| AC-FU02 | 管理员 | 上传后确认导入（指定 Dataset 名称、选择列） | 系统返回 ImportTask（status=pending），HTTP 202；后台异步解析并写入 |
| AC-FU03 | 管理员 | 上传超过 50MB 的文件 | 返回文件过大错误，HTTP 422 |
| AC-FU04 | 管理员 | 上传不支持的文件格式（如 .pdf） | 返回格式不支持错误，HTTP 422 |
| AC-FU05 | 管理员 | Excel 文件包含多个 Sheet | 使用第一个 Sheet（MVP 简化处理） |
| AC-FU06 | 管理员 | CSV 列类型推断 | 采样前 1000 行；超过 5% 不匹配则回退 String 类型 |

### Dataset 管理（Dataset Management）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-DM01 | 管理员 | 查看 Dataset 列表 | 返回所有 status=ready 的 Dataset，含名称、来源类型、行数、列数、导入时间、in_use 状态；已被引用的显示关联的 ObjectType 名称 |
| AC-DM02 | 管理员 | 搜索 Dataset（关键词） | 按名称模糊匹配过滤结果 |
| AC-DM03 | 管理员 | 查看单个 Dataset 详情 | 返回 Dataset 完整信息 + 列定义列表 |
| AC-DM04 | 管理员 | 预览 Dataset 数据 | 返回指定行数（默认 50，最多 500）的行数据 |
| AC-DM05 | 管理员 | 删除未被引用的 Dataset | Dataset 及其行数据、列定义被删除，HTTP 204 |
| AC-DM06 | 管理员 | 删除已被对象类型引用（in_use）的 Dataset | 返回 `DATASET_IN_USE` 错误，HTTP 403，不允许删除 |
| AC-DM07 | 管理员 | 查询不存在的 Dataset RID | 返回 HTTP 404 |

### 导航与集成（Navigation & Integration）

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-NV01 | 管理员 | 点击侧边栏"Data Connection"入口 | 导航到数据连接管理页面，默认展示 Connections Tab |
| AC-NV02 | 管理员 | 在对象类型创建向导中查看 Dataset 列表 | 显示 status=ready 的 Dataset 列表，已被其他 OT 引用的标记为 `In use`（Tooltip 显示"该数据集已被 <ObjectTypeName> 关联"）不可选 |

---

## 边界情况

- 当 MySQL 连接超时（>10s）时，系统应返回连接失败状态并附带超时错误信息
- 当导入过程中 MySQL 连接断开时，ImportTask 应标记为 `failed` 并记录错误信息，不产生残留数据
- 当并发导入同一张表时，系统应正常创建两个独立 Dataset（无冲突）
- 当临时上传文件的 fileToken 过期或无效时，确认导入应返回 404
- **不支持**：PostgreSQL 连接器（延后到 v0.2.0）
- **不支持**：通用 Connector 抽象层 / ConnectorRegistry（延后到 v0.2.0）
- **不支持**：Schema Drift 检测（延后到 v0.3.0）
- **不支持**：数据同步 / 增量更新（延后到 v0.4.0+）
- **不支持**：连接配置更新/编辑（MVP 仅支持新建和删除）

---

## 非功能要求

- **性能**: 连接测试超时 10s；Schema 提取超时 60s；数据预览超时 30s；文件上传最大 50MB
- **安全**: 密码 AES-256 加密存储（INV-6）；API 响应和日志中不得出现明文密码；加密密钥通过环境变量注入
- **可用性**: 导入任务提供状态轮询（pending → running → completed/failed）；失败时返回可读错误信息

---

## 依赖与约束

### release-contract.md 对照

| 不变量 | 本特性职责 |
|--------|-----------|
| INV-3 | 同一 Dataset 只能关联一个 ObjectType（1:1 绑定）— Dataset 侧通过 in_use 状态标记实现 |
| INV-6 | 密码使用 AES-256 加密存储，API 响应和日志中不得出现明文 — 由 CryptoService 实现 |

### 跨 Feature 依赖

| 依赖方向 | Feature | 说明 |
|---------|---------|------|
| 本特性依赖 | 001-scaffolding | 项目骨架、路由注册 |
| 本特性依赖 | 002-db-schema | 基础数据库 Schema |
| 被依赖 | 003-object-type-crud | OT 创建向导 Step 1 读取 Dataset 列表 API |
| 被依赖 | 005-object-type-crud-frontend | 前端向导依赖 Dataset 列表组件 |

---

## 相关文档

- 架构参考: [docs/architecture/05-data-connectivity.md]
- PRD: [docs/prd/0_1_0（MVP）/数据连接（Data Connection）PRD.md]
- 版本契约: [features/v0.1.0/release-contract.md]
