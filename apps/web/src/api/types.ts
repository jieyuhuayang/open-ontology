import type { components } from '@/generated/api';

export type ObjectType = components['schemas']['ObjectTypeWithChangeState'];
export type ObjectTypeCreateRequest = components['schemas']['ObjectTypeCreateRequest'];
export type ObjectTypeUpdateRequest = components['schemas']['ObjectTypeUpdateRequest'];
export type ObjectTypeListResponse = components['schemas']['ObjectTypeListResponse'];
export type Icon = components['schemas']['Icon'];
export type ResourceStatus = components['schemas']['ResourceStatus'];
export type Visibility = components['schemas']['Visibility'];
export type ChangeState = components['schemas']['ChangeState'];

export type LinkType = components['schemas']['LinkTypeWithChangeState'];
export type LinkSide = components['schemas']['LinkSide'];
export type LinkTypeCreateRequest = components['schemas']['LinkTypeCreateRequest'];
export type LinkTypeUpdateRequest = components['schemas']['LinkTypeUpdateRequest'];
export type LinkTypeListResponse = components['schemas']['LinkTypeListResponse'];
export type Cardinality = components['schemas']['Cardinality'];

export type Property = components['schemas']['PropertyWithChangeState'];
export type PropertyCreateRequest = components['schemas']['PropertyCreateRequest'];
export type PropertyUpdateRequest = components['schemas']['PropertyUpdateRequest'];
export type PropertyListResponse = components['schemas']['PropertyListResponse'];
export type PropertySortOrderRequest = components['schemas']['PropertySortOrderRequest'];
export type PropertySortOrderItem = components['schemas']['PropertySortOrderItem'];
export type PropertyBaseType = components['schemas']['PropertyBaseType'];
export type StructField = components['schemas']['StructField'];

export type Dataset = components['schemas']['Dataset'];
export type DatasetListItem = components['schemas']['DatasetListItem'];
export type DatasetListResponse = components['schemas']['DatasetListResponse'];
export type DatasetPreviewResponse = components['schemas']['DatasetPreviewResponse'];
export type DatasetColumn = components['schemas']['DatasetColumn'];
export type MySQLConnection = components['schemas']['MySQLConnection'];
export type MySQLConnectionCreateRequest = components['schemas']['MySQLConnectionCreateRequest'];
export type MySQLConnectionTestRequest = components['schemas']['MySQLConnectionTestRequest'];
export type MySQLTableInfo = components['schemas']['MySQLTableInfo'];
export type MySQLColumnInfo = components['schemas']['MySQLColumnInfo'];
export type MySQLTablePreview = components['schemas']['MySQLTablePreview'];
export type ImportTask = components['schemas']['ImportTask'];
export type ImportTaskStatus = components['schemas']['ImportTaskStatus'];
export type UploadPreviewResponse = components['schemas']['UploadPreviewResponse'];
export type MySQLImportRequest = components['schemas']['MySQLImportRequest'];
export type FileConfirmRequest = components['schemas']['FileConfirmRequest'];
