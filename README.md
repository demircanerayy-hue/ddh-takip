# DDH app module map

Current safe split:
- index.html: markup only
- css/style.css: all visual styling
- js/data.js: preloaded static data exports
- js/app.js: current runtime, Firebase, filters, renderers, animation

Next extraction targets:
- js/firebase.js: Firebase config, auth, load/save
- js/filters.js: date and machine filtering helpers
- js/renderDashboard.js: dashboard cards, charts and drill status panel
- js/renderKuyular.js: underground well list, edit/delete row rendering
- js/animation.js: canvas rig drawing and animation loop

Keep app.js as the integration shell while moving one module at a time.