# Ant Design 组件交互模式速查

> 所有模式均从已通过的 E2E 测试中提取，经过验证。

## Select 下拉选择

### 基础选择（使用共享 helper）

```typescript
import { selectAntOption, clearAntSelect } from '../../e2e/helpers/antd';

// 字符串搜索（推荐 — 触发过滤，解决 grouped option 不在视窗问题）
await selectAntOption(page, page.locator('.ant-select').first(), 'E2E Department');

// RegExp 匹配（仅用于 i18n 双语场景，不能用于 fill）
await selectAntOption(page, baseTypeSelect, /Integer|整数/);

// 清除选择
await clearAntSelect(page, page.locator('.ant-select').first());
```

### 选择器定位

```typescript
// 通过位置（当页面有多个 Select）
const modal = page.locator('.ant-modal-content');
modal.locator('.ant-select').nth(0)  // 第一个
modal.locator('.ant-select').nth(1)  // 第二个

// 通过 title 属性
page.locator('.ant-select').filter({ has: page.locator('[title*="Status"]') })

// 在特定容器内
const drawer = page.locator('.ant-drawer');
drawer.locator('.ant-select').first()
```

### readonly 检测

某些 Select 不支持搜索（readonly input）。`selectAntOption` 自动处理：
- readonly → 只打开下拉，不 fill
- 非 readonly → fill 搜索文本触发过滤

## Table 表格

```typescript
// 等待表格加载
await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

// 行数断言
await expect(page.locator('.ant-table-row')).toHaveCount(2, { timeout: 3000 });

// 按内容筛选行
const row = page.locator('.ant-table-row').filter({ hasText: 'Full-name' });

// 全选（表头 checkbox）
const headerCheckbox = page.locator('.ant-table-thead .ant-checkbox-input');
await headerCheckbox.click();

// 单行 checkbox
const firstCheckbox = page.locator('.ant-table-row .ant-checkbox-input').first();
await firstCheckbox.click();

// 表头文本
page.locator('.ant-table-thead th')
```

## Drawer 抽屉

```typescript
// 等待 Drawer 出现
const drawer = page.locator('.ant-drawer');
await expect(drawer).toBeVisible({ timeout: 5000 });

// Drawer 内的表单输入
await drawer.locator('#displayName').fill('My Value');

// Drawer 底部按钮
const createBtn = drawer.locator('.ant-drawer-footer .ant-btn-primary');
await createBtn.click();
```

## Modal 弹窗

```typescript
// 等待 Modal 出现
await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });

// Modal 底部主按钮（确认/下一步）
const okBtn = page.locator('.ant-modal-footer .ant-btn-primary');
await expect(okBtn).toBeEnabled({ timeout: 5000 });
await okBtn.click();
```

## Tabs 标签页

```typescript
import { clickAntTab } from '../../e2e/helpers/antd';

const drawer = page.locator('.ant-drawer');

// 点击 tab（i18n 安全）
await clickAntTab(drawer, /Details|详细信息/);

// 断言 tab 数量
await expect(drawer.locator('.ant-tabs-tab')).toHaveCount(5, { timeout: 3000 });

// 验证 tab 标签文本
await expect(drawer.getByText(/^General$|^基本信息$/)).toBeVisible();
```

## Popconfirm 气泡确认

```typescript
import { confirmPopconfirm } from '../../e2e/helpers/antd';

// 触发动作后确认
await deleteBtn.click();
await confirmPopconfirm(page);
```

## Message 消息提示

```typescript
import { waitForAntMessage } from '../../e2e/helpers/antd';

// 等待成功消息
await waitForAntMessage(page);

// 自定义超时
await waitForAntMessage(page, 10000);
```

## Switch 开关

```typescript
// 定位开关
const toggle = drawer.locator('.ant-switch');
await expect(toggle).toBeVisible({ timeout: 3000 });

// 点击切换
await toggle.click();
await page.waitForTimeout(300);
```

## Button 按钮

```typescript
// 通过文本定位（i18n 安全）
const addBtn = page.locator('button').filter({ hasText: /Add Property|添加属性/ });
await expect(addBtn).toBeVisible({ timeout: 5000 });
await addBtn.click();

// 通过 role 定位（cardinality card）
const card = page.locator('[role="button"]').filter({ hasText: /Many to One|多对一/ });
await card.first().click();
```

## 通用定位技巧

```typescript
// ❌ 避免：短词可能匹配到其他地方
page.getByText('Age')  // 会匹配 "Management" 中的 "age"

// ✅ 推荐：使用 filter 或 exact
page.locator('.ant-table-row').filter({ hasText: 'Age' })
page.getByText('Age', { exact: true })

// ❌ 避免：strict mode 报多元素
page.getByText('E2E Employee')

// ✅ 推荐：用 .first() 规避
page.getByText('E2E Employee').first()
```
