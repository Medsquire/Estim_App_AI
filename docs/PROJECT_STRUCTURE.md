# Project Structure

This workspace now has a centralized, non-breaking structure (files copied, originals kept).

## Canonical Folders

- data/pdfs/loa
- data/pdfs/loc
- data/pdfs/sor
- data/pdfs/references
- data/json/loa
- data/json/sor
- data/json/derived
- scripts/python/extractors
- scripts/node
- docs

## What Goes Where

### PDFs

- LOA files: data/pdfs/loa
- LOC files: data/pdfs/loc
- SOR files: data/pdfs/sor
- Shared/reference PDFs: data/pdfs/references

### JSON Data

- LOA JSON: data/json/loa
- SOR JSON: data/json/sor
- Generated/derived/root JSON: data/json/derived

### Extraction Scripts

- Python extraction/parsing scripts: scripts/python/extractors
- Node utility/migration scripts: scripts/node

## Migration Status

The above folders were populated by copying from existing locations:

- uploads/LOA_files -> data/pdfs/loa
- uploads/LOC_files -> data/pdfs/loc
- uploads/SOR_files -> data/pdfs/sor
- src/assets/pdf -> data/pdfs/references
- Json/LOA -> data/json/loa
- Json/SOR -> data/json/sor
- root-level *.json -> data/json/derived
- src/assets/pdf-page-map.json -> data/json/derived
- root-level *.py -> scripts/python/extractors
- root-level *.js, *.mjs -> scripts/node

## Next Cleanup Phase (Optional)

After validating app paths, you can do a final cleanup:

1. Update app/script paths to canonical folders.
2. Verify build and runtime file loading.
3. Remove duplicate legacy copies from old locations.

## Path Convention Recommendation

Use these conventions for all new files:

- Raw and source documents -> data/pdfs/*
- Structured datasets -> data/json/*
- Automation scripts -> scripts/*
- App runtime assets only -> src/assets/*
