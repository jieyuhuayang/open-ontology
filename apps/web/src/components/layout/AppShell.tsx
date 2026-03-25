import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import CreateObjectTypeWizard from '@/pages/object-types/components/CreateObjectTypeWizard';
import CreateLinkTypeWizard from '@/pages/link-types/components/CreateLinkTypeWizard';
import SidekickDrawer from '@/components/sidekick/SidekickDrawer';

export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh', minWidth: 1280 }}>
      <TopBar />
      <Outlet />
      <CreateObjectTypeWizard />
      <CreateLinkTypeWizard />
      <SidekickDrawer />
    </Layout>
  );
}
