## Plan: AI-Powered Policy PDF Upload with Comprehensive Data Extraction

### Overview

When a user uploads a policy PDF, the system will: upload it to storage, call the edge function to extract comprehensive data via Gemini AI, show an animated "AI extracting" UI, then auto-populate form fields with the extracted data for review before saving.

### 1. Update the Edge Function Extraction Prompt

**File: `supabase/functions/extract-policy-data/index.ts**`

Update the Gemini prompt to extract the comprehensive schema matching the user's previous MongoDB model -- vehicle details, premium breakdown (OD, liability, GST), policy details (dates, customer ID, GSTIN), previous policy info, agent/branch details, payment details, add-on covers, deductibles, NCB, and nomination details.

The extracted JSON structure will be stored in the existing `ocr_extracted_data` JSONB column (no DB migration needed).

### 2. New "Upload & Extract" Flow in Policies Page

**File: `src/pages/Policies.tsx**` -- Major rework of the add/edit workflow:

- **New "Upload Policy PDF" button** alongside "New Policy" -- opens an upload dialog
- **Upload dialog**: Drag-and-drop or file picker for PDF, with a prominent upload action
- After upload, show an **animated extraction UI**:
  - Pulsing brain/sparkle icon with "AI is extracting policy data..." text
  - Animated progress bar (indeterminate)
  - Scanning-line animation over a document preview silhouette
- Once extraction completes, transition to a **pre-filled review form** with tabs:
  - **Policy Info** tab: policy number, dates, status, type of cover
  - **Vehicle Details** tab: manufacturer, model, variant, registration, engine/chassis numbers, fuel type, seating capacity, CC
  - **Premium Breakdown** tab: OD (basic, add-ons), Liability (basic TP, PA cover, LL), net premium, GST, final premium, deductibles, NCB
  - **Client & Insurer** tab: client name, address, GSTIN, insurer name, agent details, branch details
  - **Additional Info** tab: previous policy, payment details, add-on covers, limitations, nomination
- User reviews/corrects extracted data, selects matching client/insurer from dropdowns (or creates new), then saves
- Fields that couldn't be extracted show as empty for manual entry

### 3. Enhanced View Dialog for Extracted Data

**File: `src/pages/Policies.tsx**` -- Update the View dialog:

- Replace the raw JSON `<pre>` block with a structured, tabbed display of `ocr_extracted_data`
- Show vehicle details, premium breakdown, and other sections in a readable card layout
- Keep a "Raw Data" collapsible section for debugging

### 4. Animated Extraction Component

**File: `src/components/PolicyExtractionLoader.tsx**` (new)

A reusable animated component showing:

- Animated document icon with scanning line effect
- Sparkle/brain AI icon with pulse animation
- Step indicators: "Uploading document..." → "AI analyzing..." → "Extracting fields..." → "Done!"
- Uses Tailwind animations (pulse, bounce, fade-in)

### Technical Details

**Files to create:**

- `src/components/PolicyExtractionLoader.tsx` -- extraction animation component

**Files to modify:**

- `supabase/functions/extract-policy-data/index.ts` -- comprehensive extraction prompt
- `src/pages/Policies.tsx` -- upload-first flow, tabbed review form, structured view dialog

**No DB migration needed** -- the existing `ocr_extracted_data` JSONB column stores the comprehensive extracted JSON.

**Edge function deployment** -- redeploy `extract-policy-data` after updating the prompt.

Use the given Gemini API keys for OCR extraction