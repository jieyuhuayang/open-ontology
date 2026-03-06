import type { DemoObjectType, DemoLinkType } from '../types';

export const mockObjectTypes: DemoObjectType[] = [
  {
    id: 'customer',
    displayName: 'Customer',
    icon: 'UserOutlined',
    color: '#4096ff',
    properties: [
      { name: 'customerId', type: 'string', description: 'Unique customer identifier' },
      { name: 'fullName', type: 'string', description: 'Customer full name' },
      { name: 'email', type: 'string', description: 'Primary email address' },
      { name: 'registeredAt', type: 'timestamp', description: 'Registration date' },
      { name: 'tier', type: 'string', description: 'Membership tier (Silver/Gold/Platinum)' },
    ],
  },
  {
    id: 'order',
    displayName: 'Order',
    icon: 'ShoppingCartOutlined',
    color: '#52c41a',
    properties: [
      { name: 'orderId', type: 'string', description: 'Unique order identifier' },
      { name: 'orderDate', type: 'timestamp', description: 'Date the order was placed' },
      { name: 'totalAmount', type: 'decimal', description: 'Total order value' },
      { name: 'status', type: 'string', description: 'Order status (pending/shipped/delivered)' },
    ],
  },
  {
    id: 'product',
    displayName: 'Product',
    icon: 'TagOutlined',
    color: '#faad14',
    properties: [
      { name: 'productId', type: 'string', description: 'Unique product identifier' },
      { name: 'name', type: 'string', description: 'Product name' },
      { name: 'price', type: 'decimal', description: 'Unit price' },
      { name: 'sku', type: 'string', description: 'Stock keeping unit code' },
      { name: 'inStock', type: 'boolean', description: 'Whether the product is in stock' },
      { name: 'description', type: 'string', description: 'Product description' },
    ],
  },
  {
    id: 'payment',
    displayName: 'Payment',
    icon: 'CreditCardOutlined',
    color: '#eb2f96',
    properties: [
      { name: 'paymentId', type: 'string', description: 'Unique payment identifier' },
      { name: 'method', type: 'string', description: 'Payment method (card/bank/wallet)' },
      { name: 'amount', type: 'decimal', description: 'Payment amount' },
      { name: 'paidAt', type: 'timestamp', description: 'Payment timestamp' },
    ],
  },
  {
    id: 'shipping-address',
    displayName: 'Shipping Address',
    icon: 'EnvironmentOutlined',
    color: '#13c2c2',
    properties: [
      { name: 'addressId', type: 'string', description: 'Unique address identifier' },
      { name: 'street', type: 'string', description: 'Street address' },
      { name: 'city', type: 'string', description: 'City' },
      { name: 'zipCode', type: 'string', description: 'Postal/ZIP code' },
      { name: 'country', type: 'string', description: 'Country' },
    ],
  },
  {
    id: 'category',
    displayName: 'Category',
    icon: 'AppstoreOutlined',
    color: '#722ed1',
    properties: [
      { name: 'categoryId', type: 'string', description: 'Unique category identifier' },
      { name: 'name', type: 'string', description: 'Category name' },
      { name: 'parentCategory', type: 'string', description: 'Parent category reference' },
    ],
  },
];

export const mockLinkTypes: DemoLinkType[] = [
  {
    id: 'customer-order',
    sourceId: 'customer',
    targetId: 'order',
    label: 'places',
    cardinality: 'one-to-many',
  },
  {
    id: 'order-product',
    sourceId: 'order',
    targetId: 'product',
    label: 'contains',
    cardinality: 'many-to-many',
  },
  {
    id: 'order-payment',
    sourceId: 'order',
    targetId: 'payment',
    label: 'paid by',
    cardinality: 'one-to-one',
  },
  {
    id: 'customer-address',
    sourceId: 'customer',
    targetId: 'shipping-address',
    label: 'ships to',
    cardinality: 'one-to-many',
  },
  {
    id: 'product-category',
    sourceId: 'product',
    targetId: 'category',
    label: 'belongs to',
    cardinality: 'many-to-one',
  },
];
