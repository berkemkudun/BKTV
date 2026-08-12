"use client";

import { create } from "zustand";

interface UiState {
  playlistDialogOpen: boolean;
  sidebarOpen: boolean;
  openPlaylistDialog: () => void;
  closePlaylistDialog: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  playlistDialogOpen: false,
  sidebarOpen: false,
  openPlaylistDialog: () => set({ playlistDialogOpen: true }),
  closePlaylistDialog: () => set({ playlistDialogOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
