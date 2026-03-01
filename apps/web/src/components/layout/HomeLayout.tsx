import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import HomeSidebar from './HomeSidebar';
import CreateObjectTypeModal from '@/pages/object-types/components/CreateObjectTypeModal';

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
      <CreateObjectTypeModal />
    </Layout>
  );
}
