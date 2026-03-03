import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import HomeSidebar from './HomeSidebar';
import CreateObjectTypeWizard from '@/pages/object-types/components/CreateObjectTypeWizard';

export default function HomeLayout() {
  return (
    <Layout>
      <aside>
        <HomeSidebar />
      </aside>
      <Layout.Content>
        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </Layout.Content>
      <CreateObjectTypeWizard />
    </Layout>
  );
}
