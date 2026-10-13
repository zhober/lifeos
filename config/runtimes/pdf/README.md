# Optional PDF execution runtime

The core LifeOS scripts remain dependency-free. PDF output uses the exact PDFKit version and lockfile here. Installed node_modules/font resources stay outside the synced vault. These manifests are model-neutral runtime dependencies, not vendor prompt/configuration trees.

```text
node tools/report-setup.mjs <external-runtime-directory>
node tools/report.mjs generate <permitted-input.json> --runtime <external-runtime-directory>
node tools/report.mjs after-sleep <source-bound-event.json> --runtime <external-runtime-directory>
```

Alternatively set LIFEOS_PDF_RUNTIME in the execution environment. Do not store an absolute machine path, provider credentials or API settings in shared project defaults. Setup uses npm ci with scripts disabled and a runtime-local cache; it does not install globally.

A verified runtime in the workspace's runtime/lifeos-pdf/ beside the lifeos/ directory is discovered for local use. A vault moved/deployed elsewhere supplies --runtime or LIFEOS_PDF_RUNTIME from its execution environment. The dependency path is not copied into shared personal data.

Use an available embeddable CJK font. Windows defaults include Microsoft YaHei/SimHei; macOS/Linux candidates are checked. For another environment pass --font and, for a collection, --font-family. Fonts are embedded into generated PDFs; a viewer does not need local Chinese fonts. Source fonts are not copied into the vault. Only an appropriate font/license should be supplied; a missing runtime/font leaves PDF generation unavailable rather than silently producing unreadable Chinese text.

PDFKIT-LICENSE.txt preserves the installed package's MIT notice. No browser, rendering server, online conversion, model API or clock schedule is required. docs/domains/REPORTING.md defines source/privacy/review/event behavior.
