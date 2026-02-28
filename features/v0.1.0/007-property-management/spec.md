# Feature: Property Management（属性管理）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §属性管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 特性拆分

本特性拆分为三个子特性，按阶段推进：

| 子特性 | 范围 | 阶段 | 依赖 |
|--------|------|------|------|
| **F005a** — 后端（基础类型） | API + Service + Storage，支持核心/标准属性类型 | Phase 4 | F002, F009 |
| **F005b** — 前端 | 属性表格、创建/编辑表单、类型选择器、拖拽排序 | Phase 5 | F008, F005a |
| **F005c** — 属性类型扩展 | Array/Struct 完整支持 + 高级类型占位 | Phase 6 | F005b |

---

## 属性类型分级

21 种属性类型按 MVP 支持程度分为四级：

| 级别 | 类型 | MVP 支持程度 |
|------|------|-------------|
| **核心** | String, Integer, Boolean, Date, Timestamp, Double, Long | F005a/b 完整验证 + UI |
| **标准** | Short, Byte, Float, Decimal | F005a/b Schema 支持 + 基础 UI |
| **复合** | Array, Struct | F005c 中完整实现（嵌套配置 UI） |
| **高级** | Vector, Geopoint, Geoshape, Attachment, TimeSeries, MediaReference, Marking, Cipher | Schema 枚举值预留，UI 显示 "coming soon" |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够为对象类型添加、编辑和删除属性，并配置属性的类型和约束**，
以便 **精确描述业务实体的特征和状态**。

---

## 验收标准

### 创建属性
- **AC1**: 用户可以在对象类型详情页添加属性，指定：API name、显示名、属性类型、是否必填
- **AC2**: F005a/b 支持核心和标准类型（11 种），F005c 补充复合类型（2 种），高级类型（8 种）在类型选择器中显示但标记为 "coming soon"
- **AC3**: API name 在同一对象类型内唯一；重复时返回明确错误
- **AC4**: 属性类型一旦设定不可修改（UI 提示）

### 查看
- **AC5**: 对象类型详情页以表格形式展示所有属性（含类型、是否必填等信息）

### 编辑
- **AC6**: 用户可以修改属性的显示名、描述、是否必填
- **AC7**: 属性类型和 API name 不可修改

### 删除
- **AC8**: 删除属性前展示确认弹窗，说明该操作不可逆
- **AC9**: 删除成功后，属性从列表中移除

### 属性排序
- **AC10**: 用户可以拖拽调整属性的显示顺序

### Working State 集成（F005a）
- **AC11**: 所有写入操作（创建/编辑/删除属性）通过 WorkingStateService 写入草稿
- **AC12**: 属性查询返回合并视图（已发布 + 草稿变更）

### 复合类型（F005c）
- **AC13**: Array 类型支持配置元素类型（仅限核心/标准类型，不支持嵌套 Array）
- **AC14**: Struct 类型支持配置字段列表（字段类型仅限核心/标准类型，不可为 Array）

---

## 边界情况

- **不支持**：共享属性（Shared Property）—— 延后到 P2
- **不支持**：属性值格式化配置（P1，延后到后续迭代）
- **不支持**：属性类型变更（如 String → Integer）—— 语义破坏性变更，明确不支持
- 属性数量上限：单个对象类型最多 200 个属性（超出时 UI 提示）
- 高级类型属性在后端可以存储（枚举值合法），但前端不提供配置 UI

---

## 非功能要求

- **可用性**: 属性类型选择器需提供类型说明（hover tooltip），帮助用户选择合适的类型
- **安全**: 属性类型在后端严格校验，拒绝非法类型值

---

## 相关文档

- 属性类型规范: [docs/specs/supported-property-types.md]
- 对象类型元数据: [docs/specs/object-type-metadata.md]
- 属性值格式化: [docs/specs/property-value-formatting.md]（P1 特性参考）
- 依赖特性:
  - 后端（F005a）: [features/v0.1.0/002-database-schema]、[features/v0.1.0/009-working-state]
  - 前端（F005b）: [features/v0.1.0/008-app-shell]、F005a
  - 扩展（F005c）: F005b
  - 运行时依赖: [features/v0.1.0/003-object-type-crud]（属性属于对象类型）
