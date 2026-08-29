import os
import zipfile
from pathlib import Path

ROOT_DIR = Path(r"c:\Users\madha\Downloads\RAILOPT_X_SIH_PS_25022 (3)")
OUTPUT_ZIP = Path(r"C:\Users\madha\Downloads\RAILOPT_X_SIH_PS_25022_RESTORED_FINAL_v3.zip")

EXCLUDE_DIRS = {
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".git",
    "dist",
    ".idea",
    ".vscode",
    "build",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".DS_Store",
}

def make_clean_zip():
    if OUTPUT_ZIP.exists():
        OUTPUT_ZIP.unlink()
    
    count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(ROOT_DIR):
            # Modify dirs in-place to avoid traversing excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                if file.endswith(".zip") or file.endswith(".log"):
                    continue
                
                full_path = Path(root) / file
                rel_path = full_path.relative_to(ROOT_DIR)
                zipf.write(full_path, arcname=str(rel_path))
                count += 1

    size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    print(f"SUCCESS: Created clean zip archive {OUTPUT_ZIP.name} with {count} files ({size_mb:.2f} MB)")

if __name__ == "__main__":
    make_clean_zip()
