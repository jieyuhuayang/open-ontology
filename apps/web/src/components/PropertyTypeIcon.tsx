import { Tooltip } from 'antd';
import {
  FontSizeOutlined,
  NumberOutlined,
  CheckOutlined,
  CalendarOutlined,
  FieldBinaryOutlined,
  QuestionOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
  AimOutlined,
  PaperClipOutlined,
  FieldTimeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const ICON_MAP: Record<string, React.ComponentType> = {
  string: FontSizeOutlined,
  integer: NumberOutlined,
  long: NumberOutlined,
  short: NumberOutlined,
  float: NumberOutlined,
  double: NumberOutlined,
  decimal: NumberOutlined,
  boolean: CheckOutlined,
  date: CalendarOutlined,
  timestamp: CalendarOutlined,
  byte: FieldBinaryOutlined,
  array: UnorderedListOutlined,
  struct: ApartmentOutlined,
  vector: UnorderedListOutlined,
  geopoint: AimOutlined,
  geoshape: AimOutlined,
  attachment: PaperClipOutlined,
  'time-series': FieldTimeOutlined,
  'media-reference': PaperClipOutlined,
  marking: LockOutlined,
  cipher: LockOutlined,
};

interface PropertyTypeIconProps {
  baseType: string;
}

export default function PropertyTypeIcon({ baseType }: PropertyTypeIconProps) {
  const { t } = useTranslation();
  const Icon = ICON_MAP[baseType] ?? QuestionOutlined;
  const label = t(`property.baseTypes.${baseType}`, { defaultValue: baseType });

  return (
    <Tooltip title={label}>
      <Icon />
    </Tooltip>
  );
}
