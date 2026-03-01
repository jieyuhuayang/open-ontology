import { create } from 'zustand';

interface CreateLinkTypeModalStore {
  isOpen: boolean;
  prefilledSideA?: string;
  open: (prefilledSideA?: string) => void;
  close: () => void;
}

export const useCreateLinkTypeModalStore = create<CreateLinkTypeModalStore>()((set) => ({
  isOpen: false,
  prefilledSideA: undefined,
  open: (prefilledSideA?: string) => set({ isOpen: true, prefilledSideA }),
  close: () => set({ isOpen: false, prefilledSideA: undefined }),
}));
