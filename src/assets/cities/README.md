# City background catalog

Place JPG, JPEG, PNG, WebP, or AVIF photographs directly in this directory.
The app discovers supported files automatically with Vite and picks one at
random when the page opens. Automatic new runs keep the same photograph.

Use lowercase file extensions and descriptive names such as `moscow-city.jpg`.
The filename becomes the on-screen caption. Restart Vite or run `npm run build`
after adding or removing images; reload the browser to choose a background.

Landscape photographs work best. The photo fills the viewport with `cover`,
so its edges can be cropped on narrow screens. Use images you can publish;
sources for the bundled photos are in `public/assets/CREDITS.md`.
