# Feature: Object Type CRUD（对象类型增删改查）

**关联 PRD**: docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §2.1–§2.2, §8
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 特性概述

本特性覆盖对象类型（Object Type）的完整生命周期管理，包括：

1. **创建**：通过 5 步向导（Datasource → Metadata → Properties → Actions → Save Location）引导用户创建对象类型
2. **数据源导入**：支持从 MySQL 数据库导入（4 步子向导）和本地文件上传（Excel/CSV，3 步子向导）
3. **手动补全**：向导中途退出后，通过编辑页逐步补全数据源、元数据、属性映射
4. **编辑**：修改已有对象类型的元数据、数据源、属性映射
5. **删除**：删除对象类型及其级联资源

**范围边界（本期不做）：**
- Groups（对象类型分组）— 延后 P2
- Plural display name（复数展示名称）— 延后 v0.2.0
- Aliases（别名）— 延后 v0.2.0
- API Name 手动配置（§2.1.3）— 本期自动推断，不提供手动修改 UI
- Action Type 完整 CRUD — 本期仅记录勾选意图
- 定期同步外部数据源 — 仅支持一次性快照导入
- PostgreSQL 等其他数据库类型 — 仅支持 MySQL

---

## 关键设计决策

| 编号 | 决策 | 理由 |
|------|------|------|
| KD-1 | Excel/CSV 上传为 3 步子向导（上传 → 预览配置 → 结果），MySQL 导入为 4 步（连接 → 选表 → 配置 → 结果） | Excel/CSV 无需"浏览选表"步骤，文件即是数据源 |
| KD-2 | 数据源选择内嵌于向导 Step 1 和编辑页的数据源面板中，不新增独立的数据源管理页面 | 对齐 Palantir Foundry 设计，Ontology Manager 是纯 Schema 管理工具 |
| KD-3 | Action Types 步骤仅记录 Create/Modify/Delete 三个 checkbox 的勾选意图到对象类型元数据，不创建 ActionType 实体 | MVP 阶段 Action Type 完整 CRUD 为 P2，先预留数据结构 |
| KD-4 | 向导可在任意步骤提前退出，对象类型以不完整状态（incomplete）创建 | 对齐 PRD §2.1.2 手动创建流程，用户可后续通过编辑页补全 |
| KD-5 | 数据源唯一性约束（同一 Dataset 只能关联一个 Object Type）在前端列表中标注 "In use" 警告 + 后端保存时严格校验 | 双重保障，前端提升体验、后端确保一致性 |

---

## 用户故事

### US-1 向导创建对象类型
作为**本体管理员**，我希望通过分步向导创建对象类型，以便系统引导我完成数据源选择、元数据配置、属性映射、动作类型和保存位置的完整流程。

### US-2 从已有数据集创建
作为**本体管理员**，我希望在向导 Step 1 中选择平台内已有的 Dataset 作为底层数据源，以便快速关联数据并自动映射属性。

### US-3 从 MySQL 导入创建
作为**本体管理员**，我希望在向导 Step 1 中通过 MySQL 连接导入外部数据库表，以便将业务数据引入平台并创建对象类型。

### US-4 从 Excel/CSV 上传创建
作为**本体管理员**，我希望在向导 Step 1 中上传 Excel 或 CSV 文件，以便将本地数据导入平台并创建对象类型。

### US-5 手动补全对象类型
作为**本体管理员**，当我在向导中途退出后，我希望在编辑页面逐步补全数据源、元数据和属性映射，以便完成对象类型的配置。

### US-6 编辑对象类型
作为**本体管理员**，我希望修改已有对象类型的元数据（名称、描述、图标、状态、可见性）和数据源配置，以便在业务需求变化时更新语义模型。

### US-7 删除对象类型
作为**本体管理员**，我希望删除不再需要的对象类型及其关联资源，以便保持本体模型的整洁。

---

## 验收标准

### 一、创建向导 — 整体流程

**AC-W1** 用户从 Ontology Manager 首页点击"创建你的第一个对象类型"或右上角"创建 > 创建对象类型"，弹出 5 步创建向导对话框，步骤条（Stepper）显示：Datasource → Metadata → Properties → Actions → Save Location。

**AC-W2** 向导步骤条中，已完成的步骤显示完成图标（✓），当前步骤高亮，未完成步骤置灰。用户可通过"上一步/下一步"按钮在步骤间导航。

**AC-W3** 向导每一步的"下一步"按钮需满足当前步骤的最低要求后才可点击（如 Step 1 至少选中一个 Dataset；Step 2 至少填写 Display name）；不满足时按钮置灰并显示 Tooltip 提示缺少项。

**AC-W4** 向导支持在任意步骤提前退出：用户点击"创建"或"关闭"时，系统以当前已填写的信息创建一个不完整状态的对象类型（参见 KD-4），并跳转到该对象类型的编辑页。

**AC-W5** 向导在首次进入 Step 2（元数据）时，若已选择 Dataset，则自动推断并填充 Display name（取自 Dataset 名称）和 API name（将 Dataset 名称转为 PascalCase）。用户可手动修改。

**AC-W6** 向导完成所有步骤后点击"创建"，对象类型以 Working State 草稿形式创建（不直接写入主表），页面跳转到 Ontology Manager 首页，顶部提示"变更已暂存，请保存到本体"。

---

### 二、Step 1 — 数据源选择

**AC-DS1** Step 1 展示数据源选择面板，包含三个区域：A. 已有数据集列表（含搜索过滤）；B. "Import from MySQL" 按钮；C. "Upload Excel/CSV" 按钮。

**AC-DS2** 已有数据集列表展示以下列：名称（Name）、来源（Source: MySQL/Excel/CSV）、行数（Rows）、列数（Columns）、导入时间（Imported At，相对时间格式）。列表支持按名称搜索过滤。

**AC-DS3** 已被其他 Object Type 关联（作为 backing datasource）的 Dataset 在列表中显示 "In use" 标签，行置灰不可选择；Tooltip 显示"该数据集已被 \<ObjectTypeName\> 关联"。

**AC-DS4** 用户选中某个可用的 Dataset 后，列表下方展开预览区域：列结构表格（列名、推断类型、是否可为 NULL）+ 前 5 行数据预览。

**AC-DS5** 选中 Dataset 后点击"Use this Dataset"确认选择；确认后向导进入 Step 2。

**AC-DS6** 点击"Import from MySQL"打开模态 4 步子向导（参见第七节 MySQL 子向导）。

**AC-DS7** 点击"Upload Excel/CSV"打开模态 3 步子向导（参见第八节 Excel/CSV 子向导）。

**AC-DS8** 子向导（MySQL 或 Excel/CSV）导入成功后，模态框关闭，主向导自动选中新创建的 Dataset，预览区域自动展示其列信息，向导自动进入 Step 2。

---

### 三、Step 2 — 元数据配置

**AC-MD1** 元数据配置步骤展示以下字段：Icon（图标选择器）、Display name（必填文本）、Description（可选文本域）。

**AC-MD2** Display name 必填；为空时"下一步"按钮置灰。

**AC-MD3** API name 基于 Display name 自动推断生成（转 PascalCase），本期不提供手动修改入口（参见 §2.1.3 本期不做）。

**AC-MD4** ID 基于 Display name 自动推断生成（转 kebab-case 小写），用户可手动修改。ID 校验规则：仅允许小写字母、数字、连字符（`-`），必须以小写字母开头，本体内唯一。

---

### 四、Step 3 — 属性配置

**AC-PR1** 若已选择 Dataset，属性配置页面以左右分栏展示：左侧为数据源列面板（Datasource Pane），右侧为属性面板（Properties Pane）。

**AC-PR2** 数据源列面板展示所选 Dataset 的所有列（列名 + 推断类型）。每列旁显示映射状态：已映射（显示关联的属性名）或未映射。

**AC-PR3** 用户可通过以下方式创建属性映射：
- 在数据源列上悬停，点击"添加为新属性"→ 自动创建属性（ID、Display name、Base type 从列名推断）
- 在数据源列上悬停，点击"添加为已有属性"→ 自动匹配已有同名属性
- 在属性面板的属性上悬停，点击"映射到列"→ 下拉选择目标列
- 数据源面板名称旁的"将所有未映射列添加为新属性"按钮 → 批量创建

**AC-PR4** 属性面板中可手动添加新属性：点击"Add"按钮，填写 Property ID、Display name、Base type（从支持的 21 种类型中选择）。

**AC-PR5** 用户必须指定 **Primary key（主键）** 和 **Title key（标题键）**：
- Primary key：用于唯一标识每个对象实例的属性，旁边 Tooltip 提示"请确保数据源中该列值不重复"
- Title key：作为对象展示名称的属性

**AC-PR6** 主键和标题键未指定时，"下一步"按钮置灰，Tooltip 提示"请设置主键和标题键"。

**AC-PR7** 属性列表中已映射的属性显示映射的列名；未映射的属性显示警告图标。

**AC-PR8** 用户可删除不需要的自动映射属性（点击属性行的删除按钮）。被删除的属性对应的数据源列恢复为"未映射"状态。

**AC-PR9** 若未选择 Dataset（无数据源创建），属性面板仅显示手动添加区域，不显示数据源列面板。

**AC-PR10** 属性 ID 校验规则：允许小写/大写字母、数字、连字符、下划线，必须以字母开头，在同一对象类型内唯一。

---

### 五、Step 4 — 动作类型

**AC-AT1** 动作类型步骤展示 3 个 Checkbox：Create \<ObjectType\>、Modify \<ObjectType\>、Delete \<ObjectType\>。默认全部不勾选。

**AC-AT2** 用户勾选后，系统将勾选状态记录在对象类型元数据中（如 `intended_actions: ["create", "modify"]`），不创建 ActionType 实体（参见 KD-3）。

**AC-AT3** 此步骤无必填项，用户可直接点击"下一步"跳过。

**AC-AT4** 每个 Checkbox 旁附带简要说明文案：Create → "允许创建该类型的新对象"；Modify → "允许修改该类型对象的非主键属性"；Delete → "允许删除该类型的对象实例"。

---

### 六、Step 5 — 保存位置

**AC-SL1** 保存位置步骤展示项目（Project）选择器，用户从下拉列表中选择一个已有项目。

**AC-SL2** 用户选中项目后，点击"创建"按钮完成向导。页面显示提示："创建 只会暂存你的变更，不会真正保存。回到 Ontology Manager 后，请在右上角选择 保存。"

**AC-SL3** 若 Space 下仅有一个 Project，则自动选中该 Project，用户无需手动选择。

---

### 七、MySQL 子向导

> 详见 PRD §8.3—§8.6。以下 AC 覆盖前端交互和后端接口的关键验收点。

**AC-MY1** 点击"Import from MySQL"后打开模态对话框，展示 4 步子向导：连接配置 → 浏览选表 → 配置导入 → 导入结果。

**AC-MY2** Step 1（连接配置）：表单包含连接名称、Host、Port（默认 3306）、Database、Username、Password（掩码）、SSL Toggle。所有必填字段为空时"下一步"按钮置灰。

**AC-MY3** 若用户此前已配置过 MySQL 连接，页面顶部展示"Use existing connection"下拉选择器，选中后自动填充表单（密码字段除外）。

**AC-MY4** "Test Connection"按钮发起连接验证，成功显示绿色提示，失败显示具体错误信息（如 `Access denied`、`Connection timed out`）。连接验证不保存配置。

**AC-MY5** Step 2（浏览选表）：左栏展示数据库所有表名，支持搜索过滤。已被平台导入过的表显示"已有快照"标签（不阻止再次导入）。选中表后右栏展示列结构 + 前 50 行数据预览。

**AC-MY6** Step 3（配置导入）：展示 Dataset 名称（默认填充表名，可修改）、列选择（复选框列表，默认全选，主键列不可取消）、预估行数（实时查询）。底部显示"此操作将创建一份数据快照"提示。

**AC-MY7** 点击"确认导入"后触发后端导入任务。后端从 MySQL 逐批读取数据（流式/分页），写入平台内部 Dataset 表。

**AC-MY8** Step 4（导入结果）：导入进行中显示进度条/Spinner。成功后展示摘要（行数、列数、耗时）+ "Use this Dataset"按钮。失败后展示错误信息 + "重试"按钮（返回 Step 3）+ "取消"按钮。

**AC-MY9** 后端对密码使用 AES-256 加密存储；API 响应和日志中不得出现密码明文。连接配置保存后可在后续导入中复用，不与特定对象类型绑定。

**AC-MY10** 同一张表允许多次导入，每次创建独立的 Dataset 快照。每个快照记录元数据：`source_connection_name`、`source_host`、`source_database`、`source_table`、`imported_at`、`row_count`、`column_count`。

---

### 八、Excel/CSV 子向导

> 详见 PRD §2.1.1.1 C 区域。以下 AC 覆盖前端交互和后端接口的关键验收点。

**AC-EX1** 点击"Upload Excel/CSV"后打开模态对话框，展示 3 步子向导：上传文件 → 预览配置 → 导入结果。

**AC-EX2** Step F1（上传文件）：展示拖拽上传区域，支持 `.xlsx`、`.xls`、`.csv` 格式，最大 50MB。超出大小限制时显示错误提示。

**AC-EX3** Excel 文件上传后，若包含多个 Sheet，展示 Sheet 选择列表（默认选中第一个）。CSV 文件无此步骤。

**AC-EX4** Step F2（预览配置）：展示 Dataset 名称（默认为文件名去扩展名，可修改）、首行是否表头 Toggle（默认开启）、列选择复选框列表（含列名 + 推断类型，可手动修改类型）、前 50 行数据预览、总行数。

**AC-EX5** 首行表头 Toggle 关闭时，系统以 `Column_1`、`Column_2` 等作为列名，预览区域实时刷新。

**AC-EX6** 列选择至少保留 1 列，全部取消时显示错误提示"至少选择一列"。

**AC-EX7** 字段类型推断规则：系统解析前 1000 行数据，按以下优先级推断：全整数 → Integer、含小数 → Double、ISO 日期 → Date、ISO 时间戳 → Timestamp、true/false → Boolean、其他 → String。某列超过 5% 的值不匹配推断类型时回退为 String。

**AC-EX8** 点击"确认导入"后触发后端解析任务。Step F3（导入结果）：进行中显示 Spinner；成功后展示摘要（行数、列数、耗时）+ "Use this Dataset"按钮；失败后展示错误信息 + "重试"（返回 F2）+ "取消"按钮。

**AC-EX9** 每次上传创建独立的 Dataset 快照。快照记录元数据：`source_type`（`excel` 或 `csv`）、`source_filename`（原始文件名）、`imported_at`、`row_count`、`column_count`。

---

### 九、手动创建流程

> 对应 PRD §2.1.2。向导中途退出后的补全路径。

**AC-MC1** 向导在任意步骤点击"创建"或关闭对话框时，系统以当前已填写信息创建对象类型，进入该对象类型的 Overview（概览）编辑页。缺少必填信息的区域显示"待补全"提示。

**AC-MC2** 概览页的"属性"区域，若尚未关联数据源，显示"Add a backing datasource"按钮。点击后打开数据源选择面板（与向导 Step 1 相同的三区域布局）。

**AC-MC3** 概览页的"元数据"区域展示当前元数据（Display name、Description、Icon、ID），可直接内联编辑。

**AC-MC4** 关联数据源后，概览页的"属性"区域显示"编辑属性映射"按钮，点击进入属性编辑器（与向导 Step 3 相同的左右分栏布局）。

**AC-MC5** 对象类型在以下所有条件满足前无法保存到本体：有 backing datasource、有 Display name、有 ID、有 API name、至少一个属性已映射、已设置 Primary key 和 Title key。

**AC-MC6** 未满足保存条件时，Ontology Manager 的"保存"按钮旁显示 Tooltip 列出缺少的必填项。

---

### 十、编辑对象类型

> 对应 PRD §2.2.1—§2.2.4。

**AC-ED1** 用户可在侧边栏对象类型列表中点击进入某个对象类型的编辑页，或在顶部搜索栏搜索对象类型名称快速跳转。

**AC-ED2** 编辑页 Overview 标签展示元数据区域，用户可修改以下字段：Icon、Display name、Description、Status（`active`/`experimental`/`deprecated` 下拉）、Visibility（`prominent`/`normal`/`hidden` 下拉）。

**AC-ED3** API name 展示但本期不可编辑（置灰）。ID 创建后不可修改（置灰提示"对象类型 ID 创建后无法更改"）。

**AC-ED4** 数据源更换（§2.2.3）：用户在属性页点击"编辑属性映射"进入属性编辑器，在数据源面板顶部点击"替换"按钮，打开数据源选择面板选择新 Dataset。更换后移除旧数据源的所有属性映射；若新 Dataset 的 schema 与旧 Dataset 相同，自动重新映射属性。

**AC-ED5** 所有编辑操作通过 Working State 写入草稿，修改后页面顶部显示"未保存变更"提示，直到用户在 Ontology Manager 执行"保存"操作。

---

### 十一、删除对象类型

> 对应 PRD §2.2.2。

**AC-DEL1** 用户在对象类型视图右上角"三点"菜单中选择"删除"，弹出确认对话框，提示"是否要删除该对象类型及其所有关联的链接类型？"。

**AC-DEL2** 确认删除后，系统通过 Working State 标记该对象类型为"已删除"（不立即从主表移除），关联的链接类型同步标记为删除。

**AC-DEL3** 状态为 `active` 的对象类型不可删除：菜单中"删除"选项置灰，Tooltip 提示"active 状态的对象类型无法删除，请先将状态改为 experimental 或 deprecated"。

**AC-DEL4** 删除操作仅在用户执行 Ontology Manager 的"保存到本体"后真正生效，并级联删除关联的属性和链接类型。

**AC-DEL5** 不支持批量删除（延后 v0.2.0）。

---

### 十二、校验规则

> 对应 PRD §2.1.4。前端实时校验 + 后端保存时二次校验。

**AC-V1** 对象类型 ID 校验：仅允许小写字母、数字、连字符（`-`），必须以小写字母开头，本体内唯一。前端实时校验格式，后端保存时校验唯一性。

**AC-V2** API name 校验：仅允许字母、数字、下划线，PascalCase 约定，不能以数字开头，不可使用保留关键字（`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`），本体内唯一。

**AC-V3** 数据源唯一性约束：同一 Dataset 只能作为一个 Object Type 的 backing datasource。前端在数据集列表中标注 "In use" 并阻止选择；后端保存时校验，冲突时返回 `DATASET_ALREADY_REGISTERED` 错误。

**AC-V4** 保存前校验缺失字段（§2.1.4）：ID、Display name、Backing datasource、API name、至少一个映射属性、Primary key、Title key。缺少时后端返回 `INCOMPLETE_OBJECT_TYPE` 错误及缺失字段列表。

**AC-V5** 属性 ID 在同一对象类型内唯一，属性 API name 在同一对象类型内唯一。前端实时提示"该 ID 已存在"。

**AC-V6** 类型兼容性校验：属性的 Base type 必须与 backing datasource 列的数据类型兼容（参见 §8.7 映射规则）。不兼容时后端返回 `FIELD_TYPE_INCOMPATIBLE` 错误。

---

### 十三、Working State 集成

**AC-WS1** 所有写入操作（创建、编辑、删除）通过 WorkingStateService 写入草稿（Working State），不直接修改 `object_types` 主表。

**AC-WS2** 对象类型列表和详情查询返回合并视图（已发布数据 + Working State 草稿变更），用户看到的是"如果保存后"的最终效果。

**AC-WS3** 合并视图中的每个资源标注变更状态：`published`（无修改）、`created`（新建未发布）、`modified`（已修改未保存）、`deleted`（已标记删除未保存）。UI 中通过颜色/标签区分。

---

## 边界情况

1. **并发编辑**：MVP 为单用户模型，暂不处理并发编辑冲突
2. **大文件上传**：Excel/CSV 超过 50MB 时前端拒绝上传并提示，后端也有文件大小校验
3. **MySQL 连接超时**：导入过程中连接断开时，任务标记为失败，不产生残留的部分数据，用户可重试
4. **空 Dataset**：若 MySQL 表或上传文件无数据行（仅有表头），仍创建 Dataset（row_count=0），用户可正常关联
5. **向导中途退出**：对象类型以不完整状态创建，在 Ontology Manager 的"保存"操作时会被 AC-V4 的缺失字段校验拦截
6. **重复导入**：同一 MySQL 表或同一文件允许多次导入，每次创建独立快照，不影响已有关联
7. **Sheet 选择**：Excel 文件仅单 Sheet 时跳过选择，直接进入 F2 预览配置
8. **类型推断回退**：Excel/CSV 中混合类型列（如同时含数字和文本）自动回退为 String 类型

---

## 非功能要求

- **性能**：对象类型列表接口响应时间 < 500ms（1000 条数据以内）；MySQL 导入支持 10 万行级别数据（超时上限 5 分钟）；Excel/CSV 文件解析 50MB 以内应在 30 秒内完成
- **可用性**：所有异步操作（导入、上传）展示进度反馈（Spinner/进度条）；表单提交中按钮禁用防止重复提交；向导中表单数据在步骤间导航时不丢失
- **安全**：MySQL 密码后端 AES-256 加密存储，API 响应和日志不含密码明文；API name 和 ID 在后端进行二次校验（不依赖前端）；上传文件由后端校验格式和大小
- **可访问性**：向导步骤条支持键盘导航；所有表单字段有 label 关联

---

## 相关文档

- PRD 主文档: docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md
  - §2.1.1 向导创建、§2.1.1.1 数据源选择详细交互
  - §2.1.2 手动创建、§2.1.3 API 名称配置（本期不做）、§2.1.4 保存校验
  - §2.2 编辑对象类型
  - §8 从 MySQL 导入数据集
- 对象类型元数据规范: docs/specs/object-type-metadata.md
- 支持的属性类型: docs/specs/supported-property-types.md
- 领域模型: docs/architecture/02-domain-model.md
- 系统架构（Working State）: docs/architecture/01-system-architecture.md (AD-2, AD-3)
