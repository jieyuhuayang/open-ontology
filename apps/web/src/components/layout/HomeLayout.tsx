import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import HomeSidebar from './HomeSidebar';
import { useSearchStore } from '@/stores/search-store';
import SearchResultsPanel from '@/components/search/SearchResultsPanel';

export default function HomeLayout() {
  const isSearchMode = useSearchStore((s) => s.isSearchMode);

  return (
    <Layout>
      <HomeSidebar />
      <Layout.Content>
        <main style={{ padding: 24 }}>
          {isSearchMode ? <SearchResultsPanel /> : <Outlet />}
        </main>
      </Layout.Content>
    </Layout>
  );
}
