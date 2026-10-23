# USAFA GAFPB Score Calculator

A two-page static site that calculates a German Armed Forces Proficiency Badge result (Gold, Silver, Bronze or No Badge).

## Files

| File | Purpose |
|---|---|
| `index.html` | Calculator |
| `scoring.html` | How scoring works |
| `style.css` | Shared styles (light and dark mode) |
| `calculator.js` | Scoring logic. All standards are in the `CONFIG` object at the top. |

No frameworks, build step or external requests.

## Host on GitHub Pages

1. Create a new repository on GitHub and upload these four files to the root.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Add to Microsoft Teams

1. In your squadron's channel, click **+** (Add a tab).
2. Choose **Website**.
3. Name the tab (for example "GAFPB Calculator") and paste the GitHub Pages URL.

## Updating standards

Edit the `CONFIG` object at the top of `calculator.js`. Every threshold the calculator uses (minimums, point scales, bonuses, medal cutoffs, pistol hits, ruck limits) lives there.
