import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';

import { queryClient } from '@/queryClient';
import { router } from '@/router';
import theme from '@/theme';

const antdLocaleMap: Record<string, typeof enUS> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

export default function App() {
  const { i18n } = useTranslation();
  const antdLocale = antdLocaleMap[i18n.language] ?? enUS;

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme} locale={antdLocale}>
        <RouterProvider router={router} />
      </ConfigProvider>
    </QueryClientProvider>
  );
}
