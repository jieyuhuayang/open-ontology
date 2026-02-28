# Feature: Object Type CRUD — 前端（对象类型前端界面）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §对象类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft
**前身**: 从 F003b（003-object-type-crud 前端部分）拆出为独立特性

---

## 背景

F003（003-object-type-crud）的后端部分（F003a）已完成，包含 API + Service + Storage 层及 Working State 集成。本特性聚焦于 Object Type 的前端 UI 实现，是端到端闭环的关键一步。

完成本特性 + F004（App Shell）后，将进行 **Demo 走查检查点**，验证完整的用户交互流程。

---

## 用户故事

作为 **本体管理员**，
我希望 **通过 Web UI 创建、查看、编辑和删除对象类型**，
以便 **直观地构建和维护组织的语义数据模型，无需直接操作 API**。

---

## 验收标准

### 列表页
- **AC1**: 列表页显示所有对象类型，含分页（默认每页 20 条）
- **AC2**: 列表项显示：显示名、API name、状态（status）、变更状态标签（published/created/modified/deleted）
- **AC3**: 支持点击进入详情页

### 详情页
- **AC4**: 详情页显示对象类型的所有元数据字段（id、API name、显示名、描述、图标、status、visibility）
- **AC5**: 详情页提供编辑和删除入口

### 创建
- **AC6**: 创建表单包含：id、API name、显示名、描述、图标选择
- **AC7**: API name 实时校验（仅允许字母、数字、下划线，PascalCase，不能以数字开头，不可使用保留关键字）
- **AC8**: id 实时校验（仅允许小写字母、数字、连字符，必须以小写字母开头）
- **AC9**: 唯一性冲突时，展示后端返回的错误提示

### 编辑
- **AC10**: 用户可修改：显示名、描述、图标、status、visibility
- **AC11**: id 创建后不可修改（UI 上置灰提示）；API name 在 status 为 `active` 时不可修改（UI 上置灰提示），其他状态下可修改
- **AC12**: 保存后，列表页和详情页立即反映最新数据

### 删除
- **AC13**: 删除前展示确认弹窗，提示将级联删除关联的属性和链接类型
- **AC14**: `active` 状态的对象类型不可删除，UI 上删除菜单项置灰并给出提示

### 变更状态展示
- **AC15**: 合并视图中的资源标注变更状态（`published`、`created`、`modified`、`deleted`），以视觉标签区分

---

## 边界情况

- **不支持**：批量删除（延后到 v0.2.0）
- **不支持**：对象类型分组（延后到 P2）
- **不支持**：`aliases`（别名）字段（延后到 v0.2.0）
- 表单提交中（loading 状态）按钮禁用，防止重复提交

---

## 非功能要求

- **性能**: 列表页渲染 < 200ms（1000 条数据 + 分页）
- **可用性**: 表单校验即时反馈，无需提交后才看到错误
- **i18n**: 所有用户可见文案使用 `t('key')` 国际化

---

## 相关文档

- 对象类型元数据规范: [docs/specs/object-type-metadata.md]
- 领域模型: [docs/architecture/02-domain-model.md]
- UI 设计截图: [docs/prd/0_1_0（MVP）/images/]
- 依赖特性:
  - [features/v0.1.0/004-app-shell]（UI 框架、路由、布局）
  - [features/v0.1.0/003-object-type-crud]（后端 API 已就绪）
