# 数据连接（Data Connection）PRD

## 1. 背景与定位

### 1.1 模块定位

Data Connection 是从 Ontology Manager 主 PRD 中剥离出的独立模块，负责为 Ontology 提供外部数据源接入和 Dataset 管理能力。

Open Ontology 采用**数据拷贝（Dataset Import）模型**：从外部数据源（MySQL 数据库、Excel/CSV 文件）将数据导入到平台内部，创建一份 Dataset 快照。对象类型的底层数据（backing dataset）指向平台内部的 Dataset，而非实时查询外部数据源。

```
外部数据源 → [一次性快照导入] → 平台内部 Dataset → 对象类型（Object Type）
```

### 1.2 与 Ontology Manager 的关系

- **Data Connection 生产 Dataset**：通过 MySQL 连接器导入或 Excel/CSV 上传，在平台内创建 Dataset 快照
- **Ontology Manager 消费 Dataset**：OT 创建/编辑时，从 Dataset 列表中选择已有 Dataset 作为 backing dataset

### 1.3 架构参考

详见 `docs/architecture/05-data-connectivity.md`

---

## 2. 目标及优先级

<table>
<thead>
<tr>
<th>优先级</th>
<th>目标</th>
</tr>
</thead>
<tbody>
<tr>
<td>P0（v0.1.0 必须做）</td>
<td><ol>
<li>数据连接管理页面（侧边栏一级导航入口）</li>
<li>MySQL 连接器（注册、测试、浏览表、导入快照）</li>
<li>Excel/CSV 文件上传导入</li>
<li>Dataset 管理列表页（查看、预览、删除）</li>
</ol></td>
</tr>
<tr>
<td>P1（v0.1.0 尽量做）</td>
<td><ol>
<li>连接配置复用（已有连接下拉选择）</li>
</ol></td>
</tr>
<tr>
<td>P2（延后）</td>
<td><ol>
<li>PostgreSQL 连接器</li>
<li>自动映射引擎</li>
<li>Schema Drift 检测</li>
<li>数据同步（定期/增量更新）</li>
</ol></td>
</tr>
</tbody>
</table>

---

## 3. 用户界面

### 3.1 导航与页面结构

侧边栏新增 **"Data Connection"** 一级导航入口。页面包含两个 Tab：

- **Connections**（连接管理）—— 管理外部数据源连接配置
- **Datasets**（数据集）—— 管理已导入的 Dataset 快照

```
┌─────────────────────────────────────────────────────────┐
│  Data Connection                                         │
├─────────────┬───────────────────────────────────────────┤
│  Connections │  Datasets                                 │
├─────────────┴───────────────────────────────────────────┤
│                                                          │
│  （Tab 内容区域）                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Connections Tab — 连接管理

#### 3.2.1 连接列表

以表格形式展示所有已注册的连接：

| 列 | 说明 |
|-----|------|
| 名称（Name） | 连接的 display name |
| 类型（Type） | 连接器类型：`MySQL`（MVP 仅支持） |
| 状态（Status） | 连接状态：`connected` / `failed` / `untested` |
| 关联 Dataset 数 | 通过该连接导入的 Dataset 数量 |
| 最近使用时间 | 最近一次使用该连接导入数据的时间 |

#### 3.2.2 新建连接

点击 **"New Connection"** 按钮打开连接配置表单（详见 §3.4 第 1 步）。

#### 3.2.3 测试连接

在连接列表中，每个连接行提供 **"Test"** 操作按钮，发起连接验证。成功显示绿色提示；失败显示具体错误信息。

#### 3.2.4 连接详情页

点击连接名称进入详情页，展示 Schema 浏览器：

- **表列表**：该数据库下的所有表（Tables），支持按名称搜索过滤
- **列结构**：选中表后展示列名、数据类型、主键标识、是否可为 NULL
- **数据预览**：选中表后展示前 **50 行**数据，只读表格形式

---

### 3.3 Datasets Tab — 数据集管理

#### 3.3.1 Dataset 列表

以表格形式展示所有已导入的 Dataset：

| 列 | 说明 |
|-----|------|
| 名称（Name） | Dataset 的 display name |
| 来源类型（Source） | 数据来源标识：`MySQL`、`Excel`、`CSV` |
| 行数（Rows） | 数据行数，超过 1000 时以 `K` 为单位缩写（如 `12K`） |
| 列数（Columns） | 数据列数 |
| 导入时间（Imported At） | 导入时间，展示相对时间（如 "3 天前"） |
| 关联 OT 状态 | 是否已被 Object Type 关联为 backing dataset，显示 `In use` 或 `Available` |

#### 3.3.2 Dataset 详情页

点击 Dataset 名称进入详情页：

- **列结构表格**：列名、推断类型、是否可为 NULL
- **数据预览**：前 **50 行**数据，只读表格形式

#### 3.3.3 删除 Dataset

- 删除前需先解除 Object Type 关联（若已关联则按钮置灰，Tooltip 提示"该数据集已被 \<ObjectTypeName\> 关联，请先解除关联"）
- 删除操作需二次确认

#### 3.3.4 Import Dataset

点击 **"Import Dataset"** 按钮，弹出选择器：

- **Import from MySQL** → 触发 MySQL 导入向导（§3.4）
- **Upload Excel/CSV** → 触发 Excel/CSV 上传向导（§3.5）

---

### 3.4 MySQL 导入向导（4 步模态子向导）

> 迁移自主 PRD §8.3—§8.6

点击 **"Import from MySQL"** 后，以**模态框向导（modal wizard）** 形式展开导入流程，共 4 步。

#### Step 1：配置 MySQL 连接

模态框展示 MySQL 连接配置表单：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| 连接名称 | 文本输入 | 是 | — | 便于识别的名称，如 "生产订单库" |
| 主机（Host） | 文本输入 | 是 | — | 数据库服务器 IP 或域名 |
| 端口（Port） | 数字输入 | 是 | `3306` | MySQL 默认端口 |
| 数据库名（Database） | 文本输入 | 是 | — | 要连接的目标数据库 |
| 用户名（Username） | 文本输入 | 是 | — | 数据库登录用户名 |
| 密码（Password） | 密码输入 | 是 | — | 掩码显示，后端加密存储 |
| 启用 SSL | Toggle | 否 | 关闭 | 是否使用 SSL 加密连接 |

若用户此前已配置过连接，页面顶部展示**"使用已有连接（Use existing connection）"** 下拉选择器，选中后自动填充上方表单（密码字段除外）。

**操作：**
- **测试连接（Test Connection）**：发起连接验证，不保存配置。成功显示绿色提示；失败显示具体错误（如 `Access denied for user` 或 `Connection timed out`）
- **下一步**：保存连接配置并进入第 2 步；若未测试连接，弹出确认提示

**业务规则：**
1. 密码在后端使用 AES-256 加密存储；任何 API 响应和日志中均不得出现密码明文
2. 连接配置保存后可在后续导入中复用，不与特定对象类型绑定

#### Step 2：浏览并选择表

连接成功后，系统拉取该数据库下的所有表（Tables）列表，以左右分栏布局展示：

**左栏——表列表：**
- 搜索框支持按名称过滤
- 每行显示表名；已被本平台导入过的表显示 `已有快照` 标签（不阻止再次导入）

**右栏——表详情（选中表后展示）：**

*列结构：*

| 列名 | 数据类型 | 主键 | 可为 NULL |
|------|---------|------|----------|
| id | INT | ✓ PK | NOT NULL |
| name | VARCHAR(255) | — | NOT NULL |
| created_at | DATETIME | — | NULL |

*数据预览：* 展示前 **50 行**数据，只读表格形式。

选中目标表后，点击 **"下一步"** 进入第 3 步。

#### Step 3：配置导入选项

| 配置项 | 说明 |
|--------|------|
| Dataset 名称 | 默认填充为表名，用户可修改；作为平台内部 Dataset 的 display name |
| 选择导入列 | 列列表带复选框，默认全选；可取消勾选不需要的列（主键列不可取消） |
| 预估行数 | 通过 `SELECT COUNT(*)` 实时查询并展示，非用户输入项 |

页面底部展示提示文案：

> **注意：** 此操作将创建一份数据快照，导入完成后不会自动与 MySQL 保持同步。如需更新数据，请重新执行导入，届时会创建一份新的快照。

点击 **"确认导入（Confirm Import）"** 触发后台导入任务，进入第 4 步。

#### Step 4：导入结果

**导入进行中：** 展示进度条（或 Spinner）及当前状态文案（如 "正在读取数据…"）。

**导入成功：**
- 展示摘要：已导入行数、列数、耗时
- 模态框底部显示 **"完成（Done）"** 按钮

点击 **"完成"** 后：
1. 模态框关闭，返回 Datasets Tab
2. 新导入的 Dataset 出现在列表中

**导入失败：**
- 展示错误信息
- 提供 **"重试（Retry）"** 按钮（重新从第 3 步开始）和 **"取消"** 按钮

**业务规则：**
1. **允许重复导入**：同一张表可多次导入，每次创建独立的 Dataset 快照；旧快照不自动删除
2. **导入中断**：若导入过程中连接断开，任务标记为失败，不产生残留的部分数据，允许重试
3. **元数据保留**：每个 Dataset 快照记录以下元数据：
   - `source_connection_name`：连接名称
   - `source_host` / `source_database` / `source_table`：来源信息
   - `imported_at`：导入时间戳
   - `row_count` / `column_count`：行列数

---

### 3.5 Excel/CSV 上传向导（3 步模态子向导）

> 迁移自主 PRD §2.1.1.1 C 区

点击 **"Upload Excel/CSV"** 后，以**模态框向导（modal wizard）** 形式展开上传流程，共 3 步。

#### Step F1：上传文件

| 配置项 | 说明 |
|--------|------|
| 上传区域 | 支持拖拽（drag & drop）和点击选择，区域内显示图标与提示文案 |
| 支持格式 | `.xlsx`、`.xls`、`.csv` |
| 文件大小限制 | 最大 **50 MB**；超出时显示错误提示 |
| Sheet 选择（仅 Excel） | Excel 文件上传后，若包含多个 Sheet，展示 Sheet 列表供用户选择；默认选中第一个 Sheet |

**操作：**
- 上传成功后自动进入 Step F2
- 上传失败时显示具体错误（如"文件格式不支持"、"文件大小超过 50MB 限制"）

#### Step F2：预览与配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| Dataset 名称 | 文本输入 | 文件名（不含扩展名） | 作为平台内部 Dataset 的 display name |
| 首行是否表头 | Toggle | 开启 | 若关闭，系统以 `Column_1`、`Column_2` 等作为列名 |
| 列选择 | 复选框列表 | 全选 | 每列显示：复选框 + 列名 + 推断类型（可手动修改）；至少保留 1 列 |
| 数据预览 | 只读表格 | — | 展示前 **50 行**数据 |
| 总行数 | 只读文本 | — | 解析后展示总数据行数 |

**操作：**
- 点击 **"确认导入（Confirm Import）"** 触发导入，进入 Step F3

#### Step F3：导入结果

- **导入进行中：** 展示 Spinner 及进度文案（如"正在解析文件…"）
- **导入成功：** 展示摘要信息：
  - 已导入行数、列数、耗时
  - **"完成（Done）"** 按钮
- **导入失败：** 展示错误信息 + **"重试"** 按钮（返回 Step F2）+ **"取消"** 按钮

点击 **"完成"** 后：模态框关闭，返回 Datasets Tab，新 Dataset 出现在列表中。

**业务规则：**
1. 每次上传创建独立的 Dataset 快照，同一文件可多次上传
2. Dataset 元数据记录：`source_type`（`excel` 或 `csv`）、`source_filename`（原始文件名）、`imported_at`（导入时间）、`row_count` / `column_count`（行列数）

---

## 4. 字段类型映射规则

### 4.1 MySQL → Ontology Property Type

导入完成后，系统根据以下规则自动推断属性类型，用户可手动修改：

| MySQL 类型 | 推荐 Ontology Property 类型 |
|-----------|---------------------------|
| `INT`, `BIGINT`, `TINYINT` | Integer |
| `DECIMAL`, `FLOAT`, `DOUBLE` | Double |
| `VARCHAR`, `TEXT`, `CHAR` | String |
| `DATE` | Date |
| `DATETIME`, `TIMESTAMP` | Timestamp |
| `BOOLEAN`, `BIT(1)` | Boolean |
| 其他 | String（默认回退） |

### 4.2 Excel/CSV 类型推断规则

系统解析前 **1000 行**数据进行类型推断。若某列超过 **5%** 的值不匹配推断类型，则回退为 `String`。

| 判定条件 | 推断类型 | 示例值 |
|----------|----------|--------|
| 全部为整数（含负数） | Integer | `42`、`-7`、`0` |
| 含小数点的数字 | Double | `3.14`、`-0.5` |
| 符合 ISO 8601 日期格式（`YYYY-MM-DD`） | Date | `2024-01-15` |
| 符合 ISO 8601 时间戳格式（`YYYY-MM-DDTHH:mm:ss`） | Timestamp | `2024-01-15T08:30:00` |
| 值为 `true`/`false`（不区分大小写） | Boolean | `true`、`FALSE` |
| 以上均不匹配 | String | `Hello`、`混合123` |

> **注意：** 推断结果仅作为默认值，用户可在预览与配置步骤中手动修改每列的类型。

---

## 5. 业务规则

### 5.1 安全

- 密码在后端使用 **AES-256** 加密存储；任何 API 响应和日志中均不得出现密码明文

### 5.2 连接管理

- 连接配置保存后可在后续导入中**复用**，不与特定对象类型绑定
- 连接配置可跨多次导入使用

### 5.3 导入规则

- **允许重复导入**：同一张表/文件可多次导入，每次创建独立的 Dataset 快照；旧快照不自动删除
- **导入中断无残留**：若导入过程中连接断开或上传失败，任务标记为失败，不产生残留的部分数据，允许重试
- **文件上传大小限制**：最大 50MB

### 5.4 Dataset 约束

- Dataset 与 Object Type **1:1 绑定**：同一个 Dataset 只能作为一个 Object Type 的 backing dataset
- Dataset in-use 状态由 Object Type 发布状态 + Working State 合并计算决定

---

## 6. 与 Ontology Manager 的集成点

| 集成场景 | 描述 |
|---------|------|
| OT 创建向导 Step 1 | "选择已有 Dataset" → 读取本模块的 Dataset 列表 API |
| Dataset in-use 判定 | 已被 OT 关联的 Dataset 在列表中显示 `In use` 标签，不可被其他 OT 选择 |
| OT 编辑页"替换数据源" | 从本模块的 Dataset 列表中选择新的 Dataset |
| 提示引导 | OT 创建向导中展示"需要导入新数据？请前往 Data Connection 模块"引导文案 |
