# Agent Detective

Live site: https://felipe-calmon.github.io/agent-detective/

A casebook for AI-agent incidents. Load an agent log, and the page rebuilds the timeline, weighs four rival causes (spec gap, excessive permission, prompt injection, advisory rule ignored), lists the critical questions still open (story schemes, Bex & Verheij 2010), and suggests the spec clause that would have stopped the incident. Edit the spec and the verdict is recomputed.

Static site: HTML, CSS and plain JavaScript. No build step, no server, no API key, no LLM. Pasted logs never leave the browser.

## Run locally
Open `index.html` in a browser (double-click works). Or: `python3 -m http.server` in this folder and visit http://localhost:8000.

## Files
- `index.html`, `styles.css`
- `js/engine.js`: the rules (tagging, hypotheses, critical questions, spec parsing, counterfactual replay)
- `js/cases.js`: the three sample cases
- `js/app.js`: the interface
- `samples/case-template.json`: case 1 as JSON, a model for your own logs

## Publish (GitHub Pages)
1. Create a public repository (e.g. `agent-detective`) and upload the contents of this folder to its root.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/agent-detective/` after a minute.
Netlify Drop (drag the folder onto app.netlify.com/drop) or Cloudflare Pages work the same way.

The only external request is Google Fonts; without it the page falls back to system fonts.
