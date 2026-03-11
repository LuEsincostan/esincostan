# esincostan.com

Minimal Astro starter for a personal homepage, ready to deploy to GitHub Pages with a custom domain (`esincostan.com`).

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, enable Pages and select **GitHub Actions** as source.
3. Ensure your default branch is `main` (or update `.github/workflows/deploy.yml`).
4. The workflow publishes `dist/` automatically on every push to `main`.

## Connect custom domain

`public/CNAME` is already set to `esincostan.com`.

In your DNS provider, point your domain to GitHub Pages:

- `A` records for apex (`@`) to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` record for `www` to `<your-github-username>.github.io`

## Customize content

Edit homepage copy in:

- `src/pages/index.astro`

Edit style in:

- `src/styles/global.css`
