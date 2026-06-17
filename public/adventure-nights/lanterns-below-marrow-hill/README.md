# Adventure Nights Package
## Lanterns Below Marrow Hill

This folder is a complete **content bundle** for a browser-first, two-player one-night adventure.

## Why this format?
Because the **subscription web portal** is the main place the game will be played, this package uses a better master format than PDF-only delivery:

- **JSON** = source of truth for adventure data and app logic
- **SVG** = crisp map/tokens for mobile, tablet, and print
- **Print-ready HTML** = easy to export as PDF in any browser
- **Markdown/JSON text assets** = easier to maintain than static PDF masters

## Included
- Adventure content JSON
- Role sheets
- Clue deck
- Endings
- Quick start rules
- Storyboard
- Map SVG
- Token sheet SVG
- Browser preview config
- Cover page HTML

## Suggested next build step
1. Load `content/adventure.json` and `content/browser-preview.json` into the portal
2. Render `assets/map.svg` in the play view
3. Offer the `print/*.html` files as “Download / Print”
4. Optionally batch-convert the HTML files to PDF and the SVG files to PNG in your build pipeline

## Print/Export notes
- Open any file in `print/` or `assets/cover.html` in a browser and choose **Print → Save as PDF**
- Open any SVG in `assets/` and export as PNG if needed for app thumbnails or marketplace cards