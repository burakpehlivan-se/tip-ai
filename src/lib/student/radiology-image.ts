import fs from "node:fs";
import path from "node:path";

const RELATIVE_IMAGE_DIR = path.join("data", "raw", "chestxray", "images_001", "images");

export function radiologyImageDirectories(configuredDirectory = process.env.RADIOLOGY_IMAGES_DIR): readonly string[] {
  const configured = configuredDirectory
    ? [path.isAbsolute(configuredDirectory) ? configuredDirectory : path.resolve(configuredDirectory)]
    : [];
  return [...new Set([...configured, path.join(process.cwd(), RELATIVE_IMAGE_DIR), path.join("/app", RELATIVE_IMAGE_DIR)])];
}

export function resolveRadiologyImagePath(
  imageIndex: string,
  directories = radiologyImageDirectories()
): string | null {
  const fileName = path.basename(imageIndex);
  if (!fileName.toLowerCase().endsWith(".png")) return null;

  for (const directory of directories) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}
