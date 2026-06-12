# BUGS — Template Decomposition Pipeline

Persistent tracker for recurring issues. Update this file when a bug is fixed, re-opened, or mitigated. Never delete entries — add a new status line instead.

---

## BUG-001 — Stale openpolotno node_modules

**Status**: MITIGATED (workaround documented)  
**Root cause**: `pnpm` with `inject-workspace-packages=true` COPIES workspace packages into `node_modules` at install time. The copy is stale if you add new exports to `libraries/openpolotno` without re-running `pnpm install`.  
**Symptom**: `Export X doesn't exist in target module` build error when calling new functions from `openpolotno`.  
**Fix**: Run `pnpm install --frozen-lockfile` from the `app/` directory to re-copy all workspace packages into `node_modules`.  
**Guard**: If any new function is added to `libraries/openpolotno`, re-run pnpm install before building. CI should run install before build in all cases.  
**First seen**: Session 2026-05

---

## BUG-002 — Font Size Too Small in Decomposed Output

**Status**: FIXED  
**Root cause (1)**: Wrong formula: `(h/n) × CAP_HEIGHT_RATIO` instead of `h / (n × LINE_HEIGHT_FACTOR)`.  
**Root cause (2)**: `CHAR_WIDTH_RATIO_BOLD = 0.62` caused the font size to be aggressively shrunk to fit the box width.  
**Fix**: Corrected formula in `assemble.ts`; reduced `CHAR_WIDTH_RATIO_BOLD` to 0.50 in `fit-text-to-box.ts`.  
**Guard**: If multi-line text appears clipped or smaller than the original, check `heightDerivedFontSize` calculation: `box.height / (lineCount * LINE_HEIGHT_FACTOR)`.  
**First seen**: Session 2026-05

---

## BUG-003 — Logo Rendered as Garbled Glyph Characters

**Status**: FIXED  
**Root cause**: When `ORG_LOGO_URL` was unset, logo OCR boxes fell through to text rendering. The OCR text for a wordmark logo contains rasterised font characters that look garbled as plain text.  
**Fix**: `logo-substitution.ts` now detects `!logoUrl` and emits a grey rect placeholder (`fill:#e8e8e8`, `stroke:#aaaaaa`) + centred "LOGO" text label instead of passing the box to text rendering.  
**Guard**: If you see garbled character strings where the logo should be, check that `ORG_LOGO_URL` is set in `.env` and that the path is a valid file. The placeholder confirms the pipeline knows it's a logo box.  
**Files**: `app/libraries/nestjs-libraries/src/templates/assembler/logo-substitution.ts`  
**First seen**: Session 2026-05

---

## BUG-004 — SVG Logo Renders Blank in Canvas (naturalWidth = 0)

**Status**: FIXED  
**Root cause**: Konva loads SVGs via `<img>`. If the SVG lacks explicit `width` and `height` attributes (only has `viewBox`), `img.naturalWidth` is 0, and the element renders as an invisible zero-size element. `logo.svg` has `viewBox="0 0 800 364.5"` but no `width`/`height`.  
**Fix**: `injectSvgDimensions()` in `template-decompose.service.ts` — reads the SVG buffer, extracts viewBox dimensions, injects `width="W" height="H"` on the `<svg>` tag before converting to data URL.  
**Guard**: If the logo is invisible in the canvas, check that the SVG data URL contains `width=` and `height=` on the `<svg>` tag. Any SVG logo that relies purely on `viewBox` will hit this bug.  
**Files**: `app/libraries/nestjs-libraries/src/templates/template-decompose.service.ts` (function `injectSvgDimensions`)  
**First seen**: Session 2026-05

---

## BUG-005 — Subhead / Body Text Color Hallucinated by Gemini (chromatic override blocked)

**Status**: FIXED  
**Root cause**: Gemini OCR returned `fill_hex: "#DD3779"` (red) for black body text. The pixel color sampler (Otsu-based) correctly returned `#111111`. However, the guard in `applyPixelColorSampling` blocked the override: it prevents replacing a chromatic Gemini color with an achromatic sampled color to protect genuinely red text on dark backgrounds where the Otsu sampler fails. The guard had no exception for near-black sampled values, which are always reliable (dark ink on any background produces a clean bimodal luminance histogram).  
**Fix**: Added luminance exception in `ocr.adapter.ts` — if `hexSaturation(sampled) < 0.1` AND `hexLuminance(sampled) < 60` (near-black), trust the sampler and apply the override regardless of Gemini's chromatic value.  
**Guard**: If text that should be black/dark appears red or another vivid color in the decomposed output, check `applyPixelColorSampling` guard condition. Gemini hallucinating a chromatic color for dark body text is a known failure mode.  
**Files**: `app/libraries/nestjs-libraries/src/templates/stages/ocr.adapter.ts` (function `applyPixelColorSampling`)  
**Papers**: Otsu (1979) — bimodal luminance threshold degrades when fg/bg luminance difference < 60  
**First seen**: Session 2026-05

---

## BUG-006 — Shadow / Reflection Detected as Subject Layer

**Status**: FIXED (2026-05)  
**Root cause**: `SUBJECT_DETECT_PROMPT` in `subject-detect.adapter.ts` had no EXCLUDE rule for cast shadows, drop shadows, reflections, or surface light effects. Gemini Vision matched the bear's cast shadow against "Stylized photo objects that overlap text/background regions" — a legitimate INCLUDE rule for overlapping design elements.  
**Fix**: Added to the EXCLUDE list: cast shadows, reflections, surface light effects (glows, gradients, lens flares). See `subject-detect.adapter.ts` lines 28–35.  
**Guard**: If a layer named "Shadow cast by..." or "reflection of..." appears in the layer panel, the EXCLUDE rules have either regressed or been inadequate for a new image type. Re-examine the SUBJECT_DETECT_PROMPT.  
**Files**: `app/libraries/nestjs-libraries/src/templates/stages/subject-detect.adapter.ts`  
**Papers**: SAM (Kirillov et al., ICCV 2023) handles shadow exclusion via semantic segment boundaries; our Gemini-based detector needs explicit exclusion rules.  
**First seen**: Session 2026-05

---

## BUG-007 — Subject Ghosting (Subject Visible in Both Background and Isolated Layer)

**Status**: OPEN  
**Root cause**: After LaMa inpainting, the background plate may still contain a ghost of the subject if the inpaint model failed to fully erase it (common at high-frequency edges — see LaMa paper §4.2). The fallback `buildSubjectFallbacks()` uses a raw bounding-box crop of the ORIGINAL image (with the subject), so the subject is guaranteed to appear in the isolated layer. If the background plate also shows the subject (inpaint failure), it appears in both.  
**Validator gap**: No post-inpaint pixel-delta check existed to detect inpaint failure in subject regions.  
**Fix (partial)**: Added `subject-not-erased` Tier-A quality check in `quality-check.service.ts` — computes mean absolute pixel diff between original and background plate in subject bbox; warns when diff < 15.  
**Remaining gap**: The validator warns but does not fix it. A proper fix would require re-inpainting with a tighter mask or using the isolated mask (alpha channel) to explicitly zero-out the background plate in the subject region.  
**Files**: `app/libraries/nestjs-libraries/src/templates/quality/quality-check.service.ts`  
**Papers**: LaMa (Suvorov et al., 2021) §4.2 — texture faithfulness vs. object removal accuracy tradeoff  
**First seen**: Session 2026-05

---

## BUG-008 — Font Weight Lighter Than Original (Helvetica Neue Black → Inter)

**Status**: FIXED (2026-05)  
**Root cause**: Font substitution mapped Helvetica Neue → Inter. Inter at weight 900 is visually lighter than Helvetica Neue Black (stroke width ratio ~0.85:1). Inter 900 is ExtraBold; Helvetica Neue Black has stroke expansion that Inter lacks.  
**Fix**: Changed substitution to Helvetica Neue → Montserrat. Montserrat 900 has visibly heavier strokes than Inter 900 and is a closer match to Helvetica Neue Black.  
**Files**: `app/libraries/nestjs-libraries/src/templates/assembler/assemble.ts` (FONT_SUBSTITUTIONS map)  
**Guard**: If the headline appears noticeably lighter than the original, check whether the detected `font_family` is being substituted to Montserrat. If Gemini returns "Inter" or another family directly, it bypasses the map.  
**Papers**: TextEraser (Liu et al., CVPR 2021) — stroke width ratio as font matching criterion  
**First seen**: Session 2026-05

---

## BUG-009 — Logo Too Small at Canvas Zoom Levels

**Status**: FIXED (2026-05)  
**Root cause**: `fitLogoInBox()` is correct (preserves aspect ratio, centers in box), but the OCR bounding box for a compact wordmark logo is small (~40–60px height). At canvas 43% zoom, this renders as ~17–26px on screen. No minimum display size was enforced.  
**Fix**: Added minimum height floor in `substituteLogoBoxes()` in `logo-substitution.ts`. The effective box height is `max(box.height, imageHeight * 0.06)` — ensures logo is at least 6% of canvas height regardless of OCR measurement noise. `imageHeight` is now threaded from the call site in `assemble.ts`.  
**Files**: `app/libraries/nestjs-libraries/src/templates/assembler/logo-substitution.ts`, `app/libraries/nestjs-libraries/src/templates/assembler/assemble.ts`  
**Guard**: If logo looks tiny, check that `imageHeight` is correctly passed and that `MIN_LOGO_HEIGHT_FRACTION` (0.06) is applied before `fitLogoInBox`.  
**First seen**: Session 2026-05
