import type { Preset, PresetInfo } from "./types";

declare global {
  interface Window {
    petApi: {
      listPresets(): Promise<PresetInfo[]>;
      getActive(): Promise<string | null>;
      setActive(id: string): Promise<void>;
      loadPreset(id: string): Promise<Preset | null>;
      savePreset(preset: Preset): Promise<void>;
      createPreset(name: string): Promise<Preset>;
      deletePreset(id: string): Promise<void>;
      /** Writes an asset into the preset's assets directory and returns the file name actually saved */
      importAsset(presetId: string, fileName: string, bytes: Uint8Array): Promise<string>;
      onPresetChanged(cb: () => void): () => void;
      onPresetListChanged(cb: () => void): () => void;
    };
  }
}
export {};
