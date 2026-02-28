# Feature: Link Type CRUD（链接类型增删改查）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §链接类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 特性拆分

本特性拆分为前后端两个子特性，支持并行开发：

| 子特性 | 范围 | 依赖 |
|--------|------|------|
| **F004a** — 后端 | API + Service + Storage 层，通过 Working State 写入 | F002, F009 |
| **F004b** — 前端 | 列表页、详情页、创建/编辑表单、删除确认 | F008, F004a |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够创建、查看、编辑和删除对象类型之间的链接类型**，
以便 **定义实体间的语义关系，构建完整的业务知识图谱**。

---

## 验收标准

### 创建
- **AC1**: 用户可以选择链接的两端对象类型（Object Type A → Object Type B）
- **AC2**: 用户可为链接的两端分别设置：API name、显示名、基数（Cardinality）
- **AC3**: 链接类型的 API name 在本体内唯一；重复时返回明确错误提示
- **AC4**: 基数选项包括：ONE_TO_ONE、ONE_TO_MANY、MANY_TO_ONE、MANY_TO_MANY

### 查看
- **AC5**: 列表页显示所有链接类型，含两端对象类型信息
- **AC6**: 支持按对象类型过滤（仅显示涉及某对象类型的链接）

### 编辑
- **AC7**: 用户可以修改显示名、基数、描述
- **AC8**: 两端对象类型和 API name 创建后不可修改

### 删除
- **AC9**: 删除前展示确认弹窗
- **AC10**: 删除链接类型不影响两端对象类型本身

### Working State 集成（F004a）
- **AC11**: 所有写入操作（创建/编辑/删除）通过 WorkingStateService 写入草稿，而非直接修改 `link_types` 主表
- **AC12**: 列表和详情查询返回合并视图（已发布 + 草稿变更）
- **AC13**: 合并视图中的资源标注变更状态（`published`、`created`、`modified`、`deleted`）

---

## 边界情况

- **不支持**：自链接（Object Type 链接到自身）—— 待 PRD 确认是否 MVP 支持
- **不支持**：链接类型上的属性（延后到 v0.2.0）
- **不支持**：Object Supported Links（P1，延后）
- 两个对象类型之间可以有多条链接类型（但 API name 不同）
- 并发编辑暂不处理（MVP 单用户模型）

---

## 非功能要求

- **可用性**: 创建链接类型时，对象类型选择器支持搜索（候选对象类型可能很多）
- **性能**: 列表接口响应时间 < 500ms

---

## 相关文档

- 链接类型元数据规范: [docs/specs/link-type-metadata.md]
- 领域模型: [docs/architecture/02-domain-model.md]
- 依赖特性:
  - 后端（F004a）: [features/v0.1.0/002-database-schema]、[features/v0.1.0/009-working-state]
  - 前端（F004b）: [features/v0.1.0/008-app-shell]、F004a
  - 运行时依赖: [features/v0.1.0/003-object-type-crud]（需要已有对象类型可选择）
