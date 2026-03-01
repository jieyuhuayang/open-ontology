import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import HomeSidebar from './HomeSidebar';

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
    </Layout>
  );
}
