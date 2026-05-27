import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is deployed to GitHub Pages as a *project* site, served from a
// subpath that matches the repository name (e.g. /Flight_Simulator/). A
// relative base makes the built asset URLs resolve against whatever subpath the
// page is served from, so it works regardless of repo-name casing and also
// works at the root during local `vite dev`/`preview`. This app loads no
// absolute-pathed assets, so a relative base is safe.
export default defineConfig({
  base: './',
  plugins: [react()],
})
