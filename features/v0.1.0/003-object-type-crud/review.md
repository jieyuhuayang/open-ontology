# 003 Object Type CRUD 技术方案评审意见

- 评审日期：2026-03-02
- 评审范围：`spec.md`、`design.md`、PRD §2 / §8
- 结论：**暂不通过（需先处理 Blocker）**

---

> **2026-03-03 更新**：需求变更——数据源导入（MySQL、Excel/CSV）已从 003 剥离至 Data Connection 特性。以下标注各意见在需求变更后的处理状态。

---

## Blocker（必须先改）

1. **Working State 与 Dataset 关联状态设计冲突，可能导致"丢弃草稿后数据源仍被占用"**
- 证据：
  - `spec.md:290` 要求所有写操作通过 Working State。
  - `design.md:80` 明确 Dataset 不进 Working State。
  - `design.md:987`、`design.md:988` 通过 `link_to_object_type` / `unlink_from_object_type` 直接改 Dataset 关联状态。
  - `design.md:1079` 更换数据源时直接更新 Dataset 关联。
- 风险：草稿未发布时就改变"in-use"判定；丢弃草稿后无法自动回滚关联；与 AC-WS1、AC-V3 的语义不一致。
- 建议：将"Dataset 是否被占用"改为由"已发布 ObjectType + Working State 草稿"合并计算；只在 publish 时落库最终关联，discard 时不需要补偿写。
- **✅ 已解决**：design.md AD-8 已改为合并计算方案。DatasetService.is_in_use() 扫描已发布 OT + WS 草稿，publish 时随 OT 自然落库，discard 无需补偿。

2. **导入失败"无残留"没有事务化保证**
- 证据：
  - `spec.md:302` 与 PRD `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md:1519` 要求导入中断不产生残留部分数据。
  - `design.md:1002`-`1007`、`design.md:1021`-`1026` 只有分步插入描述，没有事务边界/失败清理策略。
- 风险：MySQL/文件导入中途失败后产生"半成品 Dataset"，后续重试和数据预览会异常。
- 建议：导入流程必须事务化（或使用 `importing` 状态 + 失败时硬删除）；保证失败后 `datasets/dataset_columns/dataset_rows` 一致回滚。
- **🔄 需求变更消解**：导入功能已从 003 移至 Data Connection 特性。003 仅负责 Dataset 的查询能力（列表、详情、in-use 判定），不涉及数据写入。此意见将在 Data Connection 特性中重新评估。

3. **数据库主键方案违反仓库硬约束**
- 证据：
  - `design.md:180` 使用 `SERIAL PRIMARY KEY`。
  - `design.md:195` 使用 `BIGSERIAL PRIMARY KEY`。
  - `design.md:265`、`design.md:285` ORM 仍是自增整型主键。
  - `AGENTS.md:160` 明确要求主键使用 `rid` 文本，禁止自增 ID。
- 风险：与全仓统一 RID 模型冲突，后续跨服务引用、迁移和审计成本显著上升。
- 建议：改为 `rid TEXT PRIMARY KEY`；或对行数据使用复合主键（如 `dataset_rid + row_index`）并移除自增键。
- **✅ 已解决**：design.md 已修正。`datasets` 使用 `rid TEXT PK`；`dataset_columns` 使用 `rid TEXT PK`（格式 `ri.ontology.dataset-column.<uuid>`）。`dataset_rows` 表已移至 Data Connection 特性。

## Major（建议本轮一并修正）

4. **Save Location（Project 选择）需求未被方案覆盖**
- 证据：
  - `spec.md:162`、`spec.md:166` 要求 Step 5 项目选择和单项目自动选择。
  - PRD `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md:403`-`405` 明确最后一步要选择 project。
  - `design.md:35` 仍是固定默认 `project_rid`，且全文无 `projectRid` 相关 API/字段设计。
- 风险：AC-SL1/SL3 无法验收，后续前后端接口会返工。
- 建议：补充 project 列表接口或复用现有项目查询；创建请求显式接收 `projectRid` 并校验可访问性。
- **✅ 部分采纳**：ObjectTypeCreateRequest 新增可选字段 `project_rid`，默认回退 AD-5 默认值。MVP 单 Project 场景下前端自动选中默认 Project。不新增 Project 列表接口（属于 Space/Project 管理模块）。

5. **"任意步骤提前退出创建不完整对象类型"与请求约束冲突**
- 证据：
  - `spec.md:78` 要求任意步骤退出都可创建不完整对象类型。
  - `design.md:100`、`design.md:601` 将 `display_name` 设为创建唯一必填。
- 风险：用户在 Step 1（尚未填写 display name）关闭向导时，后端无法满足 AC-W4。
- 建议：允许 `display_name` 为空并在服务端给临时占位名；或在 spec 中明确"Step 2 前关闭不创建资源"并同步改 AC。
- **✅ 已解决**：design.md AD-9 已将 `display_name` 改为可选。为空时服务端自动生成占位名 `"Untitled Object Type xxxx"`（4 位随机后缀），`id` 和 `api_name` 从占位名自动推断。

6. **类型兼容性校验（AC-V6）缺失**
- 证据：
  - `spec.md:284` 要求后端返回 `FIELD_TYPE_INCOMPATIBLE`。
  - `design.md` 未定义该错误码，也未描述校验流程（错误码表从 `design.md:1213` 开始）。
- 风险：发布阶段可能写入不兼容映射，后续查询/索引失败。
- 建议：在 publish 校验中加入 Property `baseType` 与 Dataset 列类型兼容性检查，并新增错误码与 `details`。
- **✅ 已解决**：design.md AD-11 新增类型兼容性校验。publish 校验中加入兼容矩阵检查，新增错误码 `FIELD_TYPE_INCOMPATIBLE`，details 含 propertyId、propertyType、columnType。类型推断逻辑由 Data Connection 负责，003 仅消费已推断的 `inferredType`。

7. **`.xls` 支持声明与实现手段不一致**
- 证据：
  - `spec.md:202`、PRD `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md:297` 要求支持 `.xls`。
  - `design.md:1017`、`design.md:1248` 仅使用 `openpyxl`。
- 风险：用户上传 `.xls` 将在运行时报错，直接不满足 AC-EX2。
- 建议：要么补充 `.xls` 解析链路（如 `xlrd==1.2.0` + 安全限制），要么调整 spec/PRD 范围仅保留 `.xlsx/.csv`。
- **🔄 需求变更消解**：文件上传功能已从 003 移至 Data Connection 特性。此意见将在 Data Connection 特性中重新评估。

8. **active 状态不可删除规则未在后端方案中落地**
- 证据：
  - `spec.md:262`、PRD `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md:631` 要求 `active` ObjectType 不可删除。
  - `design.md:1076`-`1082` 的 ObjectTypeService 变更未包含 delete 规则与错误码。
- 风险：仅靠前端置灰无法防止越权调用，导致违规删除。
- 建议：在 delete 服务端强校验 `status != active`，并补充统一错误码。
- **✅ 已解决**：ObjectTypeService.delete() 新增 status 校验（已发布检查主表、未发布检查 Working State），新增错误码 `OBJECT_TYPE_ACTIVE_CANNOT_DELETE`。

## Medium（建议补强）

9. **MySQL 测试连接返回结构不符合统一错误格式**
- 证据：
  - `design.md:745`-`746` 失败返回 `200 + {success:false,error:string}`。
  - `AGENTS.md:161` 要求统一 `{error:{code,message,details}}`。
- 风险：前端错误处理分叉，日志和可观测性不一致。
- 建议：失败改用 4xx/5xx + 统一错误体；成功返回 200。
- **🔄 需求变更消解**：MySQL 连接管理已从 003 移至 Data Connection 特性。此意见将在 Data Connection 特性中重新评估。

10. **明文密码通过自定义 Header 传递存在泄露面，且可运维性差**
- 证据：
  - `design.md:1196`-`1203` 设计 `X-MySQL-Password` Header。
- 风险：代理/网关日志误采集 Header；每次浏览/预览都需重复传敏感信息。
- 建议：改为短时会话令牌（连接测试成功后签发）或复用已加密存储的连接信息，避免重复传明文密码。
- **🔄 需求变更消解**：MySQL 连接管理已从 003 移至 Data Connection 特性。此意见将在 Data Connection 特性中重新评估。

11. **MySQL 类型映射与 PRD 8.7 推荐规则不一致**
- 证据：
  - PRD `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md:1532`-`1535` 推荐 `BIGINT→Integer`、`DECIMAL/FLOAT/DOUBLE→Double`。
  - `design.md:488`、`design.md:490`、`design.md:492` 采用 `long/float/decimal`。
- 风险：前后端默认行为与产品预期不一致，影响自动映射可解释性。
- 建议：统一到 PRD 映射，或在 design 中显式写明"偏离 PRD 的理由 + 对应 UI 提示/校验策略"。
- **🔄 需求变更消解**：类型映射逻辑已从 003 移至 Data Connection 特性。此意见将在 Data Connection 特性中重新评估。

---

## 处理状态汇总

| # | 级别 | 状态 | 说明 |
|---|------|------|------|
| 1 | Blocker | ✅ 已解决 | 改为合并计算方案 |
| 2 | Blocker | 🔄 需求变更消解 | 导入移至 Data Connection |
| 3 | Blocker | ✅ 已解决 | 改为 rid TEXT PK |
| 4 | Major | ✅ 部分采纳 | 新增 project_rid 可选字段 |
| 5 | Major | ✅ 已解决 | display_name 可选 + 占位名 |
| 6 | Major | ✅ 已解决 | 新增类型兼容性校验 |
| 7 | Major | 🔄 需求变更消解 | 文件上传移至 Data Connection |
| 8 | Major | ✅ 已解决 | active 状态删除校验 |
| 9 | Medium | 🔄 需求变更消解 | MySQL 移至 Data Connection |
| 10 | Medium | 🔄 需求变更消解 | MySQL 移至 Data Connection |
| 11 | Medium | 🔄 需求变更消解 | 类型映射移至 Data Connection |

**结论更新**：所有 Blocker 和 Major 意见已解决或因需求变更自然消解。标注"🔄 需求变更消解"的意见需在 Data Connection 特性中重新评估。
