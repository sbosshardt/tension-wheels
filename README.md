# tension-wheels

A client-side web calculator that visualizes and computes rubber-band **line-of-action** solutions between two separated wheels. Given axle distance, wheel radii, torques, and either a line angle or a selected coordinate on a wheel, the app determines tension, force components, lever-arm attachment points, and an interactive SVG diagram.

**Live demo:** [https://sbosshardt.github.io/tension-wheels/](https://sbosshardt.github.io/tension-wheels/)

## What it does

- Solves for the tension line when **τ_A + τ_B ≠ 0** (finite slope) or the **vertical** case when **τ_A + τ_B = 0** with equal-and-opposite torques.
- Supports **angle mode** (primary control) and **coordinate-first mode** (click a wheel or enter x/y).
- Shows perpendicular **lever-arm** attachment points on each wheel—not every point along the chord.
- Shares state via URL query parameters for easy linking.

## Coordinate and sign conventions

All numeric results use standard **physics/engineering** coordinates:

| Quantity | Convention |
|----------|------------|
| **x** | Positive to the right |
| **y** | Positive **upward** |
| **Torque τ** | Positive = **counterclockwise** |
| **Line angle θ** | Measured from **+x** toward **+y** (0° = right, 90° = up) |

Torque from a force at position **r** = (x, y):

```text
τ = x·F_y − y·F_x
```

**Wheel placement (global physics frame):**

- Wheel A origin **O_A** at (0, 0)
- Wheel B origin **O_B** at (0, d_AB) — B is **above** A along +y
- A point on wheel B in local coordinates (x_B, y_B) has global coordinates (x_B, d_AB + y_B)

The SVG diagram flips **y** for screen display only; reported numbers remain in the physics frame.

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

Force on wheel A (B is equal and opposite):

```text
F_A = (−S / d_AB) · ⟨1, m⟩
```

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

   `https://sbosshardt.github.io/tension-wheels/`

The Vite `base` path is set to `/tension-wheels/` for project-page hosting.

## License

[MIT](LICENSE) — Copyright (c) 2026 sbosshardt
