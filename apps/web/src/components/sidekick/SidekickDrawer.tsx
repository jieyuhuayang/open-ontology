import { Button, Drawer, Empty, Flex, Skeleton, Space, Typography, message } from 'antd';
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSidekickStore } from '@/stores/sidekick-store';
import {
  sidekickKeys,
  useApplySuggestion,
  useSidekickSuggestions,
} from '@/api/sidekick';
import type { Suggestion } from '@/api/sidekick';
import { useSidekickContext } from './use-sidekick-context';
import SuggestionCard from './SuggestionCard';
import SuggestionInlineEditor from './SuggestionInlineEditor';

const { Text } = Typography;

export default function SidekickDrawer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const context = useSidekickContext();

  const isOpen = useSidekickStore((s) => s.isOpen);
  const close = useSidekickStore((s) => s.close);
  const editingSuggestionId = useSidekickStore((s) => s.editingSuggestionId);
  const setEditingSuggestionId = useSidekickStore((s) => s.setEditingSuggestionId);
  const ignoredIds = useSidekickStore((s) => s.ignoredSuggestionIds);
  const ignoreSuggestion = useSidekickStore((s) => s.ignoreSuggestion);
  const resetIgnored = useSidekickStore((s) => s.resetIgnored);

  const { data, isLoading, isFetching } = useSidekickSuggestions(
    isOpen ? context : null,
  );
  const applyMutation = useApplySuggestion();

  const visibleSuggestions =
    data?.suggestions.filter((s) => !ignoredIds.has(s.id)) ?? [];
  const llmAvailable = data?.hasLlmSuggestions ?? false;

  const handleAccept = (suggestion: Suggestion) => {
    applyMutation.mutate(
      {
        suggestionType: suggestion.suggestionType,
        entityRid: suggestion.actionPayload?.entityRid as string ?? context?.entityRid ?? '',
        actionPayload: null,
      },
      {
        onSuccess: () => {
          void message.success(t('sidekick.applySuccess'));
          ignoreSuggestion(suggestion.id);
        },
        onError: () => {
          void message.error(t('sidekick.applyError'));
        },
      },
    );
  };

  const handleEditConfirm = (suggestion: Suggestion, payload: Record<string, unknown>) => {
    applyMutation.mutate(
      {
        suggestionType: suggestion.suggestionType,
        entityRid: context?.entityRid ?? '',
        actionPayload: payload,
      },
      {
        onSuccess: () => {
          void message.success(t('sidekick.applySuccess'));
          ignoreSuggestion(suggestion.id);
          setEditingSuggestionId(null);
        },
        onError: () => {
          void message.error(t('sidekick.applyError'));
        },
      },
    );
  };

  const handleRefresh = () => {
    resetIgnored();
    void queryClient.invalidateQueries({ queryKey: sidekickKeys.all });
  };

  return (
    <Drawer
      title={
        <Flex justify="space-between" align="center">
          <Text strong>{t('sidekick.title')}</Text>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={handleRefresh}
          >
            {t('sidekick.refresh')}
          </Button>
        </Flex>
      }
      placement="right"
      width={400}
      open={isOpen}
      onClose={close}
      mask={true}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : visibleSuggestions.length === 0 ? (
        <Empty
          description={t('sidekick.noSuggestions')}
          style={{ marginTop: 48 }}
        >
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => {
              close();
              navigate('/workshop');
            }}
          >
            {t('sidekick.openWorkshop')}
          </Button>
        </Empty>
      ) : (
        <>
          {visibleSuggestions.map((suggestion) => (
            <div key={suggestion.id}>
              <SuggestionCard
                suggestion={suggestion}
                llmAvailable={llmAvailable || !suggestion.requiresLlm}
                onAccept={() => handleAccept(suggestion)}
                onEdit={() => setEditingSuggestionId(suggestion.id)}
                onIgnore={() => ignoreSuggestion(suggestion.id)}
              />
              {editingSuggestionId === suggestion.id && (
                <SuggestionInlineEditor
                  suggestion={suggestion}
                  onConfirm={(payload) => handleEditConfirm(suggestion, payload)}
                  onCancel={() => setEditingSuggestionId(null)}
                />
              )}
            </div>
          ))}

          {!data?.hasLlmSuggestions && (
            <Text
              type="secondary"
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: 12,
                marginTop: 16,
              }}
            >
              {t('sidekick.llmUnavailable')}
            </Text>
          )}
        </>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          type="link"
          icon={<RocketOutlined />}
          onClick={() => {
            close();
            navigate('/workshop');
          }}
        >
          {t('sidekick.openWorkshop')}
        </Button>
      </div>
    </Drawer>
  );
}
