# veydlin.com

Business card site built around a 3D bubble scene.

The scene started from [gsimone/r3f-bubbles](https://github.com/gsimone/r3f-bubbles) and was ported to the current stack: Vite, React 19, TypeScript, @react-three/fiber, @react-three/drei and @react-three/postprocessing. Requires Node 20.19+ or 22.12+.

To run locally:

```bash
yarn
yarn dev
```

Other scripts: `yarn build`, `yarn preview`, `yarn typecheck`, `yarn lint`, `yarn format`.

The environment reflections ship prefiltered in `public/env-cubeuv.png`, baked from `tools/bake-env/cube` so the browser does not have to prefilter them on the first visit. Re-bake after updating `three` (needs a local Chrome, or `BAKE_BROWSER_PATH` pointing to one):

```bash
yarn bake:env
```
