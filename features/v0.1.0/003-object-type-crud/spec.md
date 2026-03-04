# Feature: Object Type CRUD（对象类型增删改查）

**关联 PRD**: docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §2.1–§2.2, §8
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 特性概述

本特性覆盖对象类型（Object Type）的完整生命周期管理，包括：

1. **创建**：通过 5 步向导（Datasource → Metadata → Properties → Actions → Save Location）引导用户创建对象类型
2. **数据源选择**：从平台内已有的 Dataset 中选择作为底层数据源（数据导入由 Data Connection 模块负责）
3. **手动补全**：向导中途退出后，通过编辑页逐步补全数据源、元数据、属性映射
4. **编辑**：修改已有对象类型的元数据、数据源、属性映射
5. **删除**：删除对象类型及其级联资源

**范围边界（本期不做）：**
- Groups（对象类型分组）— 延后 P2
- Plural display name（复数展示名称）— 延后 v0.2.0
- Aliases（别名）— 延后 v0.2.0
- API Name 手动配置（§2.1.3）— 本期自动推断，不提供手动修改 UI
- Action Type 完整 CRUD — 本期仅记录勾选意图
- MySQL 导入 — 移至 Data Connection 特性
- Excel/CSV 上传 — 移至 Data Connection 特性
- 定期同步外部数据源 — 移至 Data Connection 特性

---

## 关键设计决策

| 编号 | 决策 | 理由 |
|------|------|------|
| KD-1 | 数据源选择仅展示已有 Dataset，导入能力由 Data Connection 模块提供 | 对齐 Palantir 模式：数据导入属于 Foundry/Data Connection 模块，Ontology Manager 是纯 Schema 管理工具 |
| KD-2 | 创建向导 Step 1 提供已有数据集列表 + "Continue without datasource" 按钮 | 简化创建流程，将数据导入解耦到独立模块 |
| KD-3 | Action Types 步骤仅记录 Create/Modify/Delete 三个 checkbox 的勾选意图到对象类型元数据，不创建 ActionType 实体 | MVP 阶段 Action Type 完整 CRUD 为 P2，先预留数据结构 |
| KD-4 | 向导可在任意步骤提前退出，对象类型以不完整状态（incomplete）创建 | 对齐 PRD §2.1.2 手动创建流程，用户可后续通过编辑页补全 |
| KD-5 | 数据源唯一性约束（同一 Dataset 只能关联一个 Object Type）在前端列表中标注 "In use" 警告 + 后端保存时严格校验 | 双重保障，前端提升体验、后端确保一致性 |

---

## 用户故事

### US-1 向导创建对象类型
作为**本体管理员**，我希望通过分步向导创建对象类型，以便系统引导我完成数据源选择、元数据配置、属性映射、动作类型和保存位置的完整流程。

### US-2 从已有数据集创建
作为**本体管理员**，我希望在向导 Step 1 中选择平台内已有的 Dataset 作为底层数据源，以便快速关联数据并自动映射属性。

### US-3 手动补全对象类型
作为**本体管理员**，当我在向导中途退出后，我希望在编辑页面逐步补全数据源、元数据和属性映射，以便完成对象类型的配置。

### US-4 编辑对象类型
作为**本体管理员**，我希望修改已有对象类型的元数据（名称、描述、图标、状态、可见性）和数据源配置，以便在业务需求变化时更新语义模型。

### US-5 删除对象类型
作为**本体管理员**，我希望删除不再需要的对象类型及其关联资源，以便保持本体模型的整洁。

---

## 验收标准

### 一、创建向导 — 整体流程

**AC-W1** 用户从 Ontology Manager 首页点击"创建你的第一个对象类型"或右上角"创建 > 创建对象类型"，弹出 5 步创建向导对话框，步骤条（Stepper）显示：Datasource → Metadata → Properties → Actions → Save Location。

**AC-W2** 向导步骤条中，已完成的步骤显示完成图标（✓），当前步骤高亮，未完成步骤置灰。用户可通过"上一步/下一步"按钮在步骤间导航。

**AC-W3** 向导每一步的"下一步"按钮需满足当前步骤的最低要求后才可点击（如 Step 1 允许不选数据集直接点下一步跳过；Step 2 至少填写 Display name）；不满足时按钮置灰并显示 Tooltip 提示缺少项。

**AC-W4** 向导支持在任意步骤提前退出：用户点击"创建"或"关闭"时，系统以当前已填写的信息创建一个不完整状态的对象类型（参见 KD-4），并跳转到该对象类型的编辑页。

**AC-W5** 向导在首次进入 Step 2（元数据）时，若已选择 Dataset，则自动推断并填充 Display name（取自 Dataset 名称）和 API name（将 Dataset 名称转为 PascalCase）。用户可手动修改。

**AC-W6** 向导完成所有步骤后点击"创建"，对象类型以 Working State 草稿形式创建（不直接写入主表），页面跳转到 Ontology Manager 首页，后续通过右上角"保存"按钮进行对本体的修改。

---

### 二、Step 1 — 数据源选择

**AC-DS1** Step 1 展示数据源选择面板，包含已有数据集列表（含搜索过滤）。底部不设导入入口按钮，仅提供引导文字「需要导入新数据？请前往 数据连接」链接。不选数据集直接点击「下一步」即可跳过进入 Step 2。

**AC-DS2** 已有数据集列表展示以下列：名称（Name）、来源（Source: MySQL/Excel/CSV）、行数（Rows）、列数（Columns）、导入时间（Imported At，相对时间格式）。列表支持按名称搜索过滤。

**AC-DS3** 已被其他 Object Type 关联（作为 backing datasource）的 Dataset 在列表中显示 "In use" 标签，行置灰不可选择；Tooltip 显示"该数据集已被 \<ObjectTypeName\> 关联"。

**AC-DS4** 用户选中某个可用的 Dataset 后，列表下方展开预览区域：列结构表格（列名、推断类型、是否可为 NULL）+ 前 5 行数据预览。

**AC-DS5** 选中数据集行即视为确认使用（无需独立的「使用此数据集」确认按钮），点击「下一步」进入 Step 2。

**AC-DS6** 数据集列表排序：可用数据集在前（按导入时间降序），「已使用」数据集沉底。

**AC-DS7** 选中数据集行即视为确认使用，不需要独立的「使用此数据集」确认按钮。

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

### 七、手动创建流程

> 对应 PRD §2.1.2。向导中途退出后的补全路径。

**AC-MC1** 向导在任意步骤点击"创建"或关闭对话框时，系统以当前已填写信息创建对象类型，进入该对象类型的 Overview（概览）编辑页。缺少必填信息的区域显示"待补全"提示。

**AC-MC2** 概览页的"属性"区域，若尚未关联数据源，显示"Add a backing datasource"按钮。点击后打开数据源选择面板（与向导 Step 1 相同的已有数据集列表布局）。

**AC-MC3** 概览页的"元数据"区域展示当前元数据（Display name、Description、Icon、ID），可直接内联编辑。

**AC-MC4** 关联数据源后，概览页的"属性"区域显示"编辑属性映射"按钮，点击进入属性编辑器（与向导 Step 3 相同的左右分栏布局）。

**AC-MC5** 对象类型在以下所有条件满足前无法保存到本体：有 backing datasource、有 Display name、有 ID、有 API name、至少一个属性已映射、已设置 Primary key 和 Title key。

**AC-MC6** 未满足保存条件时，Ontology Manager 的"保存"按钮旁显示 Tooltip 列出缺少的必填项。

---

### 八、编辑对象类型

> 对应 PRD §2.2.1—§2.2.4。

**AC-ED1** 用户可在侧边栏对象类型列表中点击进入某个对象类型的编辑页，或在顶部搜索栏搜索对象类型名称快速跳转。

**AC-ED2** 编辑页 Overview 标签展示元数据区域，用户可修改以下字段：Icon、Display name、Description、Status（`active`/`experimental`/`deprecated` 下拉）、Visibility（`prominent`/`normal`/`hidden` 下拉）。

**AC-ED3** API name 展示但本期不可编辑（置灰）。ID 创建后不可修改（置灰提示"对象类型 ID 创建后无法更改"）。

**AC-ED4** 数据源更换（§2.2.3）：用户在属性页点击"编辑属性映射"进入属性编辑器，在数据源面板顶部点击"替换"按钮，打开数据源选择面板选择新 Dataset。更换后移除旧数据源的所有属性映射；若新 Dataset 的 schema 与旧 Dataset 相同，自动重新映射属性。

**AC-ED5** 所有编辑操作通过 Working State 写入草稿，修改后页面顶部显示"未保存变更"提示，直到用户在 Ontology Manager 执行"保存"操作。

---

### 九、删除对象类型

> 对应 PRD §2.2.2。

**AC-DEL1** 用户在对象类型视图右上角"三点"菜单中选择"删除"，弹出确认对话框，提示"是否要删除该对象类型及其所有关联的链接类型？"。

**AC-DEL2** 确认删除后，系统通过 Working State 标记该对象类型为"已删除"（不立即从主表移除），关联的链接类型同步标记为删除。

**AC-DEL3** 状态为 `active` 的对象类型不可删除：菜单中"删除"选项置灰，Tooltip 提示"active 状态的对象类型无法删除，请先将状态改为 experimental 或 deprecated"。

**AC-DEL4** 删除操作仅在用户执行 Ontology Manager 的"保存到本体"后真正生效，并级联删除关联的属性和链接类型。

**AC-DEL5** 不支持批量删除（延后 v0.2.0）。

---

### 十、校验规则

> 对应 PRD §2.1.4。前端实时校验 + 后端保存时二次校验。

**AC-V1** 对象类型 ID 校验：仅允许小写字母、数字、连字符（`-`），必须以小写字母开头，本体内唯一。前端实时校验格式，后端保存时校验唯一性。

**AC-V2** API name 校验：仅允许字母、数字、下划线，PascalCase 约定，不能以数字开头，不可使用保留关键字（`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`），本体内唯一。

**AC-V3** 数据源唯一性约束：同一 Dataset 只能作为一个 Object Type 的 backing datasource。前端在数据集列表中标注 "In use" 并阻止选择；后端保存时校验，冲突时返回 `DATASET_ALREADY_REGISTERED` 错误。

**AC-V4** 保存前校验缺失字段（§2.1.4）：ID、Display name、Backing datasource、API name、至少一个映射属性、Primary key、Title key。缺少时后端返回 `INCOMPLETE_OBJECT_TYPE` 错误及缺失字段列表。

**AC-V5** 属性 ID 在同一对象类型内唯一，属性 API name 在同一对象类型内唯一。前端实时提示"该 ID 已存在"。

**AC-V6** 类型兼容性校验：属性的 Base type 必须与 backing datasource 列的数据类型兼容（参见 §8.7 映射规则）。不兼容时后端返回 `FIELD_TYPE_INCOMPATIBLE` 错误。

---

### 十一、Working State 集成

**AC-WS1** 所有写入操作（创建、编辑、删除）通过 WorkingStateService 写入草稿（Working State），不直接修改 `object_types` 主表。

**AC-WS2** 对象类型列表和详情查询返回合并视图（已发布数据 + Working State 草稿变更），用户看到的是"如果保存后"的最终效果。

**AC-WS3** 合并视图中的每个资源标注变更状态：`published`（无修改）、`created`（新建未发布）、`modified`（已修改未保存）、`deleted`（已标记删除未保存）。UI 中通过颜色/标签区分。

---

## 边界情况

1. **并发编辑**：MVP 为单用户模型，暂不处理并发编辑冲突
2. **空 Dataset**：若 Dataset 无数据行（仅有表头/列结构），仍可被关联，用户可正常创建对象类型
3. **向导中途退出**：对象类型以不完整状态创建，在 Ontology Manager 的"保存"操作时会被 AC-V4 的缺失字段校验拦截
4. **无可用 Dataset**：若平台内暂无 Dataset，列表显示空状态提示"暂无可用数据集，请先通过 Data Connection 导入数据"；用户仍可通过"Continue without datasource"跳过

---

## 非功能要求

- **性能**：对象类型列表接口响应时间 < 500ms（1000 条数据以内）；Dataset 列表查询含 in-use 合并计算 < 500ms
- **可用性**：表单提交中按钮禁用防止重复提交；向导中表单数据在步骤间导航时不丢失
- **安全**：API name 和 ID 在后端进行二次校验（不依赖前端）
- **可访问性**：向导步骤条支持键盘导航；所有表单字段有 label 关联

---

## 相关文档

- PRD 主文档: docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md
  - §2.1.1 向导创建、§2.1.1.1 数据源选择详细交互
  - §2.1.2 手动创建、§2.1.3 API 名称配置（本期不做）、§2.1.4 保存校验
  - §2.2 编辑对象类型
- 对象类型元数据规范: docs/specs/object-type-metadata.md
- 支持的属性类型: docs/specs/supported-property-types.md
- 领域模型: docs/architecture/02-domain-model.md
- 系统架构（Working State）: docs/architecture/01-system-architecture.md (AD-2, AD-3)
