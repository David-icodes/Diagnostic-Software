# Local Geist fonts

These unmodified WOFF2 files were copied from this project's existing Next.js
development assets, previously downloaded by `next/font/google`. Their family,
version and variable weight axis were verified from the font metadata using
Next.js's bundled font parser:

- Geist: version 1.800, weights 100–900.
- Geist Mono: version 1.701, weights 100–900.

The Latin faces are preloaded through `next/font/local` in `layout.tsx`.
`fonts.css` preserves all other original glyph subsets and their Unicode ranges,
including the Mono symbols face. No build-time Google Fonts connection is needed.

Source project: https://github.com/vercel/geist-font
Copyright: 2024 The Geist Project Authors.
License: SIL Open Font License 1.1; see `OFL.txt`.
