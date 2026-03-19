# E2E 测试常见陷阱与诊断修复

## 陷阱 1：Strict Mode 违规

**症状**：`Error: locator.click: Error: strict mode violation: locator resolved to N elements`

**原因**：Playwright 默认 strict mode，单个 locator 匹配到多个元素时报错。

**修复**：
```typescript
// ❌ 会匹配多个
page.getByText('E2E Employee')

// ✅ 用 .first() 或 .nth(N)
page.getByText('E2E Employee').first()

// ✅ 用 .filter() 缩小范围
page.locator('.ant-table-row').filter({ hasText: 'E2E Employee' })
```

---

## 陷阱 2：RegExp 传给 fill()

**症状**：`Error: input.fill: expected string, got object`

**原因**：`input.fill()` 只接受 string，不接受 RegExp。

**修复**：
```typescript
// ❌ fill 不接受 RegExp
await input.fill(/Integer|整数/);

// ✅ fill 用 string，hasText 用 RegExp
await input.fill('Integer');
// 或在 selectAntOption 中用 string 参数触发搜索
await selectAntOption(page, select, 'Integer');
```

**规则**：`selectAntOption` 的 search 参数为 string 时触发 fill 搜索；为 RegExp 时仅用于 hasText 匹配（不 fill）。

---

## 陷阱 3：短词误匹配

**症状**：`getByText('Age')` 匹配到 "Man**age**ment" 等包含子串的元素。

**修复**：
```typescript
// ❌ 子串匹配
page.getByText('Age')

// ✅ exact match
page.getByText('Age', { exact: true })

// ✅ 在行级别 filter
page.locator('.ant-table-row').filter({ hasText: 'Age' })
```

---

## 陷阱 4：networkidle 卡住

**症状**：`page.waitForLoadState('networkidle')` 超时，测试挂起。

**原因**：页面有轮询 API（如心跳、WebSocket）导致网络永远不 idle。

**修复**：
```typescript
// ❌ 可能永远不 idle
await page.waitForLoadState('networkidle');

// ✅ 等待具体元素可见
await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

// ✅ 等待特定 API 响应
await page.waitForResponse(resp => resp.url().includes('/api/v1/object-types'));
```

**注意**：现有测试中的 `networkidle` 目前能正常工作（当前无轮询 API），但新测试建议使用元素等待模式。

---

## 陷阱 5：测试数据互相干扰

**症状**：断言 count 不对，或者找到了其他测试套件创建的数据。

**原因**：多个测试套件创建了同名或同类型的数据。

**修复**：
```typescript
// ✅ 统一使用 e2e-<feature>- 前缀
const OT_ID = 'e2e-prop-mgmt-employee';  // 不是 'employee'

// ✅ 只断言自己创建的数据
const testOts = data.items.filter((ot: { id: string }) => ot.id.startsWith('e2e-prop-mgmt-'));
expect(testOts).toHaveLength(2);

// ✅ cleanup 只删自己的数据
await cleanupByPrefix(request, 'e2e-prop-mgmt-');
```

---

## 陷阱 6：PK/Active 属性删不掉

**症状**：`DELETE /properties/:rid` 返回 400/409，cleanup 失败，后续测试也失败。

**原因**：业务规则禁止直接删除 isPrimaryKey=true 或 status=active 的属性。

**修复**：
```typescript
import { cleanupByPrefix } from '../helpers/fixtures';

// cleanupByPrefix 自动处理：
// 1. unset isPrimaryKey → false
// 2. deprecate active → 'deprecated'
// 3. delete property
// 4. delete object type
await cleanupByPrefix(request, 'e2e-');
```

---

## 陷阱 7：下拉选不到选项

**症状**：`selectAntOption` 等不到选项，超时失败。

**原因**：
1. Grouped option（optgroup）未在可视区域内
2. 选项列表太长，目标被虚拟滚动隐藏

**修复**：
```typescript
// ✅ 用 string 搜索触发过滤，减少选项数量
await selectAntOption(page, select, 'fund_company');  // 部分匹配即可

// ❌ 不要用 RegExp 搜索（无法 fill）
await selectAntOption(page, select, /fund_company/);
```

---

## 陷阱 8：批量操作栏定位困难

**症状**：批量选择后找不到操作栏元素。

**原因**：批量操作栏的 CSS 类名可能变化，不可靠。

**修复**：
```typescript
// ✅ 通过文本内容定位批量栏
const batchBar = page.getByText(/selected|已选/).locator('..');

// 在批量栏内找子元素
const statusSelect = batchBar.locator('.ant-select').first();
const deleteBtn = batchBar.locator('button').filter({ hasText: /Delete|删除/ });
```

---

## 快速诊断表

| 错误关键词 | 可能原因 | 首先检查 |
|-----------|---------|---------|
| `strict mode violation` | locator 匹配多个 | 加 `.first()` 或 `.filter()` |
| `expected string, got object` | fill 传了 RegExp | 改为 string |
| `Timeout exceeded` (locator) | 元素不存在或不可见 | 检查选择器、打开 headed 模式调试 |
| `Timeout exceeded` (navigation) | 页面加载慢 | 增加 timeout 或改用元素等待 |
| `expect(received).toHaveCount` | 数据干扰或异步未完成 | 检查前缀隔离 + 增加 timeout |
| `400/409 on DELETE` | PK/active 约束 | 用 cleanupByPrefix |
| `net::ERR_CONNECTION_REFUSED` | 后端未启动 | 确认 localhost:8000 可访问 |
