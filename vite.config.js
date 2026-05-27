import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is deployed to GitHub Pages as a *project* site, served from a
// subpath that matches the repository name:
//   https://<user>.github.io/flight_simulator/
// Vite needs `base` set to that subpath so the built asset URLs resolve
// correctly. For local `vite dev`/`preview` the base is harmless.
//
// If you fork this repo under a different name, change the value below to
// '/<your-repo-name>/'.
export default defineConfig({
  base: '/flight_simulator/',
  plugins: [react()],
})
