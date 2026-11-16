# Larder

A food diary, barcode scanner and macro tracker that runs in the browser and installs to a phone's home screen. Everything you log is stored on your device; there is no account and no server.

## What it does

- **Barcode scanning** with the phone camera (EAN-13, EAN-8, UPC-A, UPC-E). Products are looked up in Open Food Facts and shown as a Nutrition Facts panel with the label's own serving size. Typing the number or using a photo works when the camera is unavailable.
- **Food search** across your own foods, about 80 built-in staples, packaged products from Open Food Facts and, with a free key, generic foods from USDA FoodData Central.
- **Diary** by day and meal with one-tap re-adding of recent foods, quick-add calories, copying a meal to another day, and notes.
- **Goals**: a calorie target estimated from your profile, macros set by percent or by gram, separate goals per weekday, and targets for fiber, sugar, sodium and other nutrients.
- **Recipes and saved meals**: per-serving nutrition from ingredients, and groups of foods logged together.
- **Exercise, water and weight** tracking, with exercise calories optionally added back to the day's budget.
- **Progress**: weight trend against goal, calories per day, average macros and nutrients, and which foods contributed most calories.
- **Backup**: export and restore everything as one file, or export the diary as CSV.
- Works offline after the first visit. Scanning a product you have logged before needs no connection.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` writes a static site to `dist/`. Any static host works. The camera only runs on HTTPS (or `localhost`).

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the "Deploy to GitHub Pages" workflow by hand). The site appears at `https://<user>.github.io/<repo>/`.

On a free GitHub plan, Pages requires the repository to be public. The code holds no personal data; your diary never leaves your phone.

## Install on a phone

Open the site, then:

- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app (or Add to Home screen).

Allow camera access the first time you scan.

## Where the nutrition data comes from

- **[Open Food Facts](https://world.openfoodfacts.org)** for barcodes and packaged products. It is a public database typed in from package labels by volunteers, available under the Open Database License. Entries are usually right but not guaranteed, so compare a product with its label the first time you log it. "Correct these values" on any product saves your fix on the device, and later scans use it.
- **[USDA FoodData Central](https://fdc.nal.usda.gov)** for generic foods, if you add a free [api.data.gov key](https://api.data.gov/signup/) under More → Food databases.
- **Built-in common foods** are typical values rounded from USDA reference data.

Calorie targets use the Mifflin-St Jeor equation and exercise estimates use MET values. Both are estimates for general tracking, not medical advice.

## Project layout

- `src/lib` — nutrition maths, the two database clients, barcode decoding, on-device storage (IndexedDB via Dexie).
- `src/screens` — one file per screen.
- `src/ui` — shared components and charts.
- `tests` — unit tests, including parsing of real Open Food Facts responses.
