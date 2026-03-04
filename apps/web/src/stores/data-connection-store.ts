import { create } from 'zustand';

type ActiveTab = 'connections' | 'datasets';
type ModalType = 'mysqlImport' | 'fileUpload' | 'newConnection' | null;

interface DataConnectionState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openModal: ModalType;
  setOpenModal: (modal: ModalType) => void;
  selectedConnectionRid: string | null;
  setSelectedConnectionRid: (rid: string | null) => void;
  detailConnectionRid: string | null;
  setDetailConnectionRid: (rid: string | null) => void;
  previewDatasetRid: string | null;
  setPreviewDatasetRid: (rid: string | null) => void;
}

export const useDataConnectionStore = create<DataConnectionState>((set) => ({
  activeTab: 'connections',
  setActiveTab: (tab) => set({ activeTab: tab }),
  openModal: null,
  setOpenModal: (modal) => set({ openModal: modal }),
  selectedConnectionRid: null,
  setSelectedConnectionRid: (rid) => set({ selectedConnectionRid: rid }),
  detailConnectionRid: null,
  setDetailConnectionRid: (rid) => set({ detailConnectionRid: rid }),
  previewDatasetRid: null,
  setPreviewDatasetRid: (rid) => set({ previewDatasetRid: rid }),
}));
