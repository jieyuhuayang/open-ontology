import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import HomeSidebar from './HomeSidebar';
import CreateObjectTypeWizard from '@/pages/object-types/components/CreateObjectTypeWizard';
import CreateLinkTypeWizard from '@/pages/link-types/components/CreateLinkTypeWizard';

export default function HomeLayout() {
  return (
    <Layout>
      <HomeSidebar />
      <Layout.Content>
        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </Layout.Content>
      <CreateObjectTypeWizard />
      <CreateLinkTypeWizard />
    </Layout>
  );
}
