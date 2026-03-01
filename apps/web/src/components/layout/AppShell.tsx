import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh', minWidth: 1280 }}>
      <TopBar />
      <Outlet />
    </Layout>
  );
}
