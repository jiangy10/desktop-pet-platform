export const assetUrl = (presetId: string, file: string) =>
  `pet-asset://${presetId}/${encodeURIComponent(file)}`;
