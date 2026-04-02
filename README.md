# Gridwork Site Audit Action

Audit your website for accessibility (WCAG/EAA), performance, SEO, design, and mobile on every deploy or PR. Get scores in your CI and audit results posted as PR comments.

## Usage

```yaml
name: Site Audit
on:
  pull_request:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: thegridwork/siteaudit-action@v1
        with:
          url: 'https://your-site.com'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `url` | URL to audit (required) | — |
| `threshold` | Minimum score (0-100). Fails if below. | `0` (disabled) |
| `categories` | Categories to check threshold against | `accessibility` |
| `fail-on-eaa` | Fail if EAA non-compliant | `false` |
| `comment` | Post results as PR comment | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `overall-score` | Overall score (0-100) |
| `overall-grade` | Grade (A-F) |
| `accessibility-score` | Accessibility score |
| `performance-score` | Performance score |
| `seo-score` | SEO score |
| `design-score` | Design score |
| `mobile-score` | Mobile score |
| `eaa-status` | EAA compliance status |
| `report-url` | Link to full shareable report |

## Examples

### Fail if accessibility drops below 70

```yaml
- uses: thegridwork/siteaudit-action@v1
  with:
    url: 'https://your-site.com'
    threshold: '70'
    categories: 'accessibility'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Block deploys that break EAA compliance

```yaml
- uses: thegridwork/siteaudit-action@v1
  with:
    url: 'https://your-site.com'
    fail-on-eaa: 'true'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Use scores in subsequent steps

```yaml
- uses: thegridwork/siteaudit-action@v1
  id: audit
  with:
    url: 'https://your-site.com'

- run: echo "Score is ${{ steps.audit.outputs.overall-score }}"
```

## What It Checks

- **Accessibility (WCAG 2.1 AA)** — alt text, headings, forms, landmarks, ARIA
- **Performance** — load time, page size, render-blocking, compression
- **SEO** — title, meta, OG tags, structured data, canonical
- **Design** — fonts, colors, hierarchy, touch targets
- **Mobile** — viewport, responsive images, input types

## License

MIT — by [Gridwork](https://github.com/thegridwork)
