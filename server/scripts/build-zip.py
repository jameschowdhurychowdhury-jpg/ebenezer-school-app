#!/usr/bin/env python3
"""Builds a clean downloadable .zip folder of the entire Ebenezer H.S. School App + Excel databases."""
import os
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_PATHS = [
    '/home/antigravity/ebenezer-school-app-publish.zip',
    os.path.join(ROOT, 'public', 'assets', 'ebenezer-school-app-publish.zip'),
]
SKIP_DIRS = {'node_modules', '_backups', '.git'}

def build_zip(dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fname in filenames:
                if fname.endswith('.zip') or fname.endswith('.tar.gz'):
                    continue
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, os.path.dirname(ROOT))
                zf.write(full, rel)

if __name__ == '__main__':
    for p in OUT_PATHS:
        build_zip(p)
    print('✔ Built downloadable ZIP:', OUT_PATHS[0])
