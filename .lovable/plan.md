

## Plan: Update Title, Favicon & Default Theme

### 1. Update Page Title & Meta Tags
**File: `index.html`**
- Change `<title>` to "RiskMarshall Insurance CRM"
- Update `og:title`, `description`, and `og:description` meta tags accordingly
- Remove the TODO comments

### 2. Set Favicon to Existing Logo
- Copy `src/assets/logo_rmbg.png` to `public/favicon.png`
- Add `<link rel="icon" href="/favicon.png" type="image/png">` to `index.html`

### 3. Change Default Theme to Light
**File: `src/contexts/ThemeContext.tsx`**
- Change the fallback from `"dark"` to `"light"` on line 15

**Files to modify:** `index.html`, `src/contexts/ThemeContext.tsx`
**Files to copy:** `src/assets/logo_rmbg.png` → `public/favicon.png`

