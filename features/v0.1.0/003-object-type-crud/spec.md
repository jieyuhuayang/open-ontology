# Feature: Object Type CRUD（对象类型增删改查）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §对象类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 特性拆分

本特性拆分为前后端两个子特性，支持并行开发：

| 子特性 | 范围 | 依赖 |
|--------|------|------|
| **F003a** — 后端 | API + Service + Storage 层，通过 Working State 写入 | F002, F009 |
| **F003b** — 前端 | 列表页、详情页、创建/编辑表单、删除确认 | F008, F003a |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够创建、查看、编辑和删除对象类型**，
以便 **构建和维护组织的语义数据模型**。

---

## 验收标准

### 创建
- **AC1**: 用户可以填写对象类型的基本信息（id、API name、显示名、描述、图标）并保存；status 默认为 `experimental`，visibility 默认为 `normal`
- **AC2**: API name 和 id 在本体内各自唯一；重复时返回明确的错误提示
- **AC3a**: API name 仅允许字母、数字、下划线，遵循 PascalCase 约定，不能以数字开头，不可使用保留关键字（`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`）；前端实时校验
- **AC3b**: id 仅允许小写字母、数字、连字符，必须以小写字母开头；前端实时校验

### 查看
- **AC4**: 列表页显示所有对象类型，含分页（默认每页 20 条）
- **AC5**: 详情页显示对象类型的所有元数据字段

### 编辑
- **AC6**: 用户可以修改对象类型的显示名、描述、图标、颜色
- **AC7**: API name 创建后不可修改（UI 上置灰提示）
- **AC8**: 保存后，列表页和详情页立即反映最新数据

### 删除
- **AC9**: 删除前展示确认弹窗，提示关联影响（如有属性/链接类型依赖）
- **AC10**: 有链接类型依赖的对象类型不可直接删除，错误信息明确说明依赖关系

### Working State 集成（F003a）
- **AC11**: 所有写入操作（创建/编辑/删除）通过 WorkingStateService 写入草稿，而非直接修改 `object_types` 主表
- **AC12**: 列表和详情查询返回合并视图（已发布 + 草稿变更）
- **AC13**: 合并视图中的资源标注变更状态（`published`、`created`、`modified`、`deleted`）

---

## 边界情况

- **不支持**：批量删除（延后到 v0.2.0）
- **不支持**：对象类型分组（延后到 P2）
- 当对象类型下有属性时，删除对象类型的行为待 PRD 确认（级联删除 or 阻止删除）
- 并发编辑（两个用户同时编辑同一对象类型）暂不处理（MVP 单用户模型）

---

## 非功能要求

- **性能**: 列表接口响应时间 < 500ms（1000 条数据以内）
- **可用性**: 表单提交中（loading 状态）按钮禁用，防止重复提交
- **安全**: API name 在后端进行二次校验（不依赖前端校验）

---

## 相关文档

- 对象类型元数据规范: [docs/specs/object-type-metadata.md]
- 领域模型: [docs/architecture/02-domain-model.md]
- 依赖特性:
  - 后端（F003a）: [features/v0.1.0/002-database-schema]、[features/v0.1.0/009-working-state]
  - 前端（F003b）: [features/v0.1.0/008-app-shell]、F003a
