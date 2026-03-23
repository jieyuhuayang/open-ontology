---
name: e2e-test
description: >-
  为 Open Ontology 生成和运行 Playwright E2E 测试。两种模式：
  (1) SDD 模式 — 基于 feature spec.md 的 AC 生成覆盖；
  (2) 自由模式 — 对指定页面/功能写测试。
  自动处理 Ant Design 选择器、测试数据隔离、i18n 双语匹配等常见问题。
  用法：/e2e-test [feature_dir] 或 /e2e-test <描述>
  当用户说"写 E2E 测试"、"端到端测试"、"playwright 测试"、
  "E2E coverage"，或使用 /e2e-test 命令时触发。
---

# E2E Test Skill

## 概述

生成并运行 Playwright E2E 测试，覆盖 Open Ontology 的 UI 交互流程。自动处理 Ant Design 5.x 选择器、测试数据隔离、i18n 双语匹配等常见问题。

## 调用方式

```
/e2e-test <feature_dir>          # SDD 模式：基于 spec.md AC 生成
/e2e-test <描述>                  # 自由模式：对指定页面/功能写测试
```

示例：
```
/e2e-test features/v0.1.0/007-property-management
/e2e-test 为 /object-types 页面写创建流程测试
```

---

## 六步流程

### Step 1：模式识别

解析用户参数：

- **SDD 模式**：参数是 `features/` 开头的路径 → 读取该目录下的 `spec.md`
- **自由模式**：参数是自由文本描述 → 直接进入 Step 3

### Step 2：AC 分析（仅 SDD 模式）

读取 `<feature_dir>/spec.md`，从 AC 表格中筛选需要 E2E 的条目：

**纳入标准**（至少满足一项）：
- UI 交互流程（表单填写、按钮点击、拖拽等）
- 跨页面导航
- 多步骤 wizard
- 批量操作
- 数据变更后 UI 反馈

**排除标准**：
- 纯 API 行为（用后端集成测试覆盖）
- 纯样式/布局（用前端单元测试覆盖）
- 纯内部状态（用 Zustand 测试覆盖）

输出筛选后的 AC 列表，作为测试用例的依据。

### Step 3：基础设施检查

检查共享 helpers 是否存在：

```
e2e/helpers/
├── antd.ts       # Ant Design 交互函数
├── api.ts        # API 常量 + 通用 CRUD
└── fixtures.ts   # 数据隔离 + 安全 cleanup
```

如果不存在（不应该出现这种情况），按照参考文件创建它们。

如果需要新增共享函数（如新的 API helper），先加到对应的 helpers 文件中。

### Step 4：生成测试

基于 `references/test-template.md` 生成 `.spec.ts` 文件。

**文件命名**：`e2e/<feature-short-name>.spec.ts`（如 `property-management.spec.ts`）

**⚠️ 强制生成规则**：

0. **先查后写**：涉及 Dataset 列名时，必须先通过 API 查询实际 schema（`GET /api/v1/datasets/<rid>`），**禁止假设列名**
1. **数据隔离（红线）**：测试数据 ID 统一 `e2e-<feature>-` 前缀（≥5 字符）。**禁止无条件删除所有资源**——cleanup 必须按前缀或白名单过滤，只删本套件创建的数据。E2E 运行前后，非测试数据必须保持不变
2. **双重 cleanup**：setup 阶段清理上次残留 + 末尾 cleanup 任务清理本次数据
3. **共享 helpers**：导入 `e2e/helpers/antd.ts` 的函数，**禁止在文件内重新定义** `selectAntOption` 等
4. **i18n 安全**：用户可见文本用 `/English|中文/` 双语 RegExp
4. **精确匹配**：禁止用短词 `getByText('Age')` — 改用 `.filter({ hasText })` 或 `{ exact: true }`
5. **元素等待**：用 `expect().toBeVisible({ timeout })` 等待，不用硬编码 `waitForTimeout`（除了 Ant Design 动画的短暂 200-500ms 等待）
6. **fill 类型安全**：`selectAntOption` 的 search 参数用于 `input.fill()` 时**必须是 string**（不能是 RegExp）
7. **strict mode 安全**：多元素场景统一 `.first()` 或 `.nth()` 规避 strict mode 违规
8. **串行执行**：setup/cleanup 作为独立 test case，使用 `test.describe.serial`
9. **AC 追溯**：每个 test 注释标注 `// Covers: AC-NN`
10. **API 验证**：数据变更操作后，通过 API 断言最终状态（不仅依赖 UI 展示）

### Step 5：运行与修复

运行生成的测试：

```bash
cd /Users/lilu/Projects/OpenOntology && npx playwright test e2e/<test-file>.spec.ts --reporter=list
```

如果失败，按照 `references/common-pitfalls.md` 的诊断表定位问题：

| 错误关键词 | 首先检查 |
|-----------|---------|
| `strict mode violation` | 加 `.first()` 或 `.filter()` |
| `expected string, got object` | fill 参数改为 string |
| `Timeout exceeded` (Select option) | 用 API 查实际 dataset columns，不要假设列名 |
| `Timeout exceeded` (其他) | 检查选择器 + headed 模式调试 |
| `toHaveCount` 失败 | 检查前缀隔离 + 增加 timeout |
| `400/409 on DELETE` OT | 先删 Link Types 再删 OTs |
| `400/409 on DELETE` property | 用 `cleanupByPrefix` |
| `API_NAME_CONFLICT` | 同 OT 对间多链接需自定义 API Name |
| 行点击无反应（半透明） | Dataset inUse，先删关联 OT |

**最多 3 轮修复**。如果 3 轮后仍有失败，输出剩余问题让用户决定。

**调试技巧**：
```bash
# headed 模式看浏览器
npx playwright test e2e/<file>.spec.ts --headed

# 单个测试
npx playwright test e2e/<file>.spec.ts -g "test name"

# 显示详细日志
DEBUG=pw:api npx playwright test e2e/<file>.spec.ts
```

### Step 6：覆盖报告

输出 AC 覆盖表：

```
## E2E 覆盖报告

| AC-ID | 描述 | 状态 | 测试文件:行号 |
|-------|------|------|-------------|
| AC-32 | /properties 展示跨 OT 属性 | ✅ 通过 | property-management.spec.ts:163 |
| AC-33 | 点击属性行导航到 OT | ✅ 通过 | property-management.spec.ts:217 |
| AC-10 | 纯 API 行为 | ⏭️ 跳过（后端集成测试覆盖） | — |

通过: N/M | 跳过: K（原因）| 失败: J
```

---

## 参考文件

生成测试前**必须阅读**以下参考文件：

| 文件 | 用途 | 何时阅读 |
|------|------|---------|
| `references/antd-patterns.md` | Ant Design 组件选择器模式 | 写任何交互代码前 |
| `references/common-pitfalls.md` | 8 大陷阱诊断表 | 测试失败时 |
| `references/test-template.md` | .spec.ts 骨架模板 | 生成新测试文件时 |

---

## 已有共享 Helpers 清单

### `e2e/helpers/antd.ts`

| 函数 | 签名 | 用途 |
|------|------|------|
| `selectAntOption` | `(page, selectLocator, search: string \| RegExp)` | 选择 Ant Select 选项 |
| `clearAntSelect` | `(page, selectLocator)` | 清除 Select 选择 |
| `confirmPopconfirm` | `(page)` | 确认 Popconfirm |
| `waitForAntMessage` | `(page, timeout?)` | 等待 Message 出现 |
| `clickAntTab` | `(container, tabText: string \| RegExp)` | 点击 Tab |

### `e2e/helpers/api.ts`

| 导出 | 用途 |
|------|------|
| `API` | 后端 API 基础 URL 常量 |
| `createObjectType(request, id, displayName)` | 创建 Object Type，返回 RID |
| `createProperty(request, otRid, id, opts?)` | 创建 Property |

### `e2e/helpers/fixtures.ts`

| 函数 | 用途 |
|------|------|
| `cleanupByPrefix(request, prefix)` | 安全删除指定前缀的 OTs（处理 PK/active 约束） |

---

## 新增 Helper 的规则

当测试需要新的共享函数时：

1. **Ant Design 交互** → 加到 `e2e/helpers/antd.ts`
2. **API CRUD** → 加到 `e2e/helpers/api.ts`
3. **数据管理/fixtures** → 加到 `e2e/helpers/fixtures.ts`
4. **特定 feature 的 helper**（如 link type wizard）→ 留在 spec 文件内，不提取

提取标准：**2 个以上 spec 文件使用** → 提取到 helpers。
