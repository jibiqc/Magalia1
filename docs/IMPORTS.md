## Import spreadsheets policy

**Do not commit** `_imports/*.xlsx` to Git. These are large, environment-specific data drops used for local testing or one-off ingestion.

### Where to store the files

- **Local only**: keep them on your machine in `_imports/` (ignored by Git).

- **If you must share**: upload to a non-Git location (e.g., SharePoint, cloud bucket, or a GitHub *Release* asset) and share the URL internally. Do not attach them to commits or PRs.

### Local workflow

1. Place the spreadsheets under `_imports/` locally.  
2. Run your ingestion scripts as usual.  
3. Verify that `git status` shows **no changes** for these files.

### Rationale

- Keeps repository size small and clones fast.  
- Avoids accidental publication of data.  
- Aligns with our policy: models/templates live in Git; **generated or bulky inputs do not**.



