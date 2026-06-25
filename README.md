# tension-wheels

A client-side web calculator that visualizes and computes rubber-band **line-of-action** solutions between two separated wheels. Given axle distance, wheel radii, torques, and either a line angle or a selected coordinate on a wheel, the app determines tension, force components, lever-arm attachment points, and an interactive SVG diagram.

**Live demo:** [https://sbosshardt.github.io/tension-wheels/](https://sbosshardt.github.io/tension-wheels/)

## What it does

- Solves for the tension line when **τ_A + τ_B ≠ 0** (finite slope) or the **vertical** case when **τ_A + τ_B = 0** with equal-and-opposite torques.
- Supports **angle mode** (primary control) and **coordinate-first mode** (click a wheel or enter x/y).
- Shows perpendicular **lever-arm** attachment points on each wheel—not every point along the chord.
- Shares state via URL query parameters for easy linking.

## Coordinate and sign conventions

All user-facing values (inputs, diagram labels, results, URL parameters) use one **wheel-local frame** on each wheel:

| Quantity | Convention |
|----------|------------|
| **x** | Positive to the right |
| **y** | Positive **upward** |
| **Torque τ** | Positive = **counterclockwise** (τ = x·F_y − y·F_x) |
| **Line angle θ** | Measured from **+x** toward **+y** |

SVG rendering uses y-down internally; that mapping is hidden from the UI.

**Wheel placement (global frame):**

- Wheel A origin **O_A** at (0, 0) — drawn at the top
- Wheel B origin **O_B** at (0, d_AB) — drawn below A
- Dashed gray lines show each wheel’s local **x-axis** through the axle

Torque from a force at position **r** = (x, y):

```text
τ = x·F_y − y·F_x
```

## Formula summary

Let **S = τ_A + τ_B**.

### Case 1: S ≠ 0 (finite slope)

Line slope **m = tan(θ)**. Intercepts:

```text
b_A = d_AB · τ_A / S
b_B = −d_AB · τ_B / S     (note b_A = b_B + d_AB)
```

Line equations (local frames):

```text
y_A = m·x_A + b_A
y_B = m·x_B + b_B
```

Tension magnitude:

```text
T = |S| · √(1 + m²) / d_AB
```

Force on wheel A (B is equal and opposite), in the y↑ frame:

```text
F_A = (S / d_AB) · ⟨1, −m⟩
```

where **m** is the internal line slope (displayed slope in results is **−m**).

Perpendicular lever-arm foot from origin to line **y = m·x + b**:

```text
x_foot = −m·b / (1 + m²)
y_foot =  b / (1 + m²)
L = |b| / √(1 + m²)
```

### Vertical case: S = 0, both torques nonzero

Only vertical lines **x = c** (c ≠ 0) are valid:

```text
T = |τ_A| / |c|
F_A = ⟨0, τ_A / c⟩
P_A = P_B = (c, 0)
```

### Coordinate-first mode (S ≠ 0)

Given a point (x, y) on wheel A that must lie on **y = m·x + b_A**:

- **x ≠ 0** → unique **m = (y − b_A) / x**
- **x = 0** and **y = b_A** → infinitely many slopes (pick a point with **x ≠ 0** on the other wheel)
- **x = 0** and **y ≠ b_A** → no solution

### Validation

- Require **R_A + R_B < d_AB** for separated wheels (warning if not).
- Lever-arm distance must satisfy **L_A ≤ R_A** and **L_B ≤ R_B** for the line to intersect each wheel face.

## Local development

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npm run dev      # dev server at http://localhost:5173/tension-wheels/
npm test         # run Vitest math tests
npm run build    # production build to dist/
npm run preview  # preview production build
```

## GitHub Pages deployment

This repo includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds and deploys on push to `main`.

1. Push the repository to GitHub.
2. In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
3. After the workflow succeeds, the site is available at:

   `https://<your-github-username>.github.io/tension-wheels/`

   Replace `<your-github-username>` with your GitHub account name (for example, this project's maintainer deployment is at `https://sbosshardt.github.io/tension-wheels/`).

The Vite `base` path is set to `/tension-wheels/` for project-page hosting.

## License

[MIT](LICENSE) — Copyright (c) 2026 sbosshardt
