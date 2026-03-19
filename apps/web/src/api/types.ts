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
export type JoinMethod = components['schemas']['JoinMethod'];

export type Property = components['schemas']['PropertyWithChangeState'];
export type PropertyCreateRequest = components['schemas']['PropertyCreateRequest'];
export type PropertyUpdateRequest = components['schemas']['PropertyUpdateRequest'];
export type PropertyListResponse = components['schemas']['PropertyListResponse'];
export type PropertySortOrderRequest = components['schemas']['PropertySortOrderRequest'];
export type PropertySortOrderItem = components['schemas']['PropertySortOrderItem'];
export type PropertyBaseType = string;
export type StructField = components['schemas']['StructField'];
export type PropertyWithObjectType = components['schemas']['PropertyWithObjectType'];
export type PropertyListAllResponse = components['schemas']['PropertyListAllResponse'];
export type PropertyBatchUpdateRequest = components['schemas']['PropertyBatchUpdateRequest'];
export type PropertyBatchDeleteRequest = components['schemas']['PropertyBatchDeleteRequest'];
export type BatchOperationResponse = components['schemas']['BatchOperationResponse'];

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
export type MySQLImportRequest = components['schemas']['MySQLImportRequest'];
export type FileConfirmRequest = components['schemas']['FileConfirmRequest'];
export type ConnectionTestResponse = components['schemas']['ConnectionTestResponse'];
export type FileUploadPreviewResponse = components['schemas']['FileUploadPreviewResponse'];

export type WorkingState = components['schemas']['WorkingState'];
export type Change = components['schemas']['Change'];
export type ChangeRecord = components['schemas']['ChangeRecord'];
export type HistoryListResponse = components['schemas']['HistoryListResponse'];

export type SearchResponse = components['schemas']['SearchResponse'];
export type SearchResultItem = components['schemas']['SearchResultItem'];
export type SearchTypeResult = components['schemas']['SearchTypeResult'];
export type SearchResourceType = components['schemas']['SearchResourceType'];
