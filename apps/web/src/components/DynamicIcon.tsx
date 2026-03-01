import type { ComponentType } from 'react';
import {
  AppstoreOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BankOutlined,
  CarOutlined,
  HomeOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  DollarOutlined,
  HeartOutlined,
  StarOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  ToolOutlined,
  RocketOutlined,
  BookOutlined,
  CameraOutlined,
  CoffeeOutlined,
  BulbOutlined,
  FlagOutlined,
  GiftOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const ICON_MAP: Record<string, ComponentType<{ style?: React.CSSProperties }>> = {
  AppstoreOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BankOutlined,
  CarOutlined,
  HomeOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  DollarOutlined,
  HeartOutlined,
  StarOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  ToolOutlined,
  RocketOutlined,
  BookOutlined,
  CameraOutlined,
  CoffeeOutlined,
  BulbOutlined,
  FlagOutlined,
  GiftOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

interface DynamicIconProps {
  name: string;
  color?: string;
  size?: number;
}

export default function DynamicIcon({ name, color, size = 20 }: DynamicIconProps) {
  const IconComponent = ICON_MAP[name] ?? AppstoreOutlined;
  return <IconComponent style={{ fontSize: size, color }} />;
}
