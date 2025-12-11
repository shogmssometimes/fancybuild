Simple GitHub Pages deploy (Pages API)

[![Deploy Status](https://github.com/OWNER/REPO/actions/workflows/deploy-gh-pages.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/deploy-gh-pages.yml)

This repo builds the `collapse_web_new` app (fancybuild copy) and publishes compiled artifacts directly to GitHub Pages using the Pages API. The automated CI workflow uploads the built `collapse_web_new/docs` artifact and deploys it directly via Actions, no `gh-pages` branch is required.

Deployment pipeline:
- CI: `.github/workflows/deploy-gh-pages.yml` builds `collapse_web_new` on `main` pushes, uploads `collapse_web_new/docs` as an artifact, and publishes via `actions/deploy-pages@v4`.
  - Note: This workflow is pinned to Node 18 for stable builds because some Rollup native bindings work more reliably on Node 18.

Manual deploy:
- Build locally
  ```bash
  cd collapse_web_new
  npm ci
  npm run build
  ```
- GM-only local bundle (keeps player build untouched)
  ```bash
  cd collapse_web_new
  npm ci
  npm run build:gm-local
  # Output: collapse_web_new/docs-gm (uses gm.html entry, relative base for offline use)
  ```
-- (Optional) Push to `gh-pages` manually (overwrite `gh-pages` with the built `docs` directory):
  ```bash
  # From repository root
  git checkout --orphan gh-pages-deploy
  git rm -rf .
  cp -R collapse_web_new/docs/* .
  git add .
  git commit -m "Manual deploy: update gh-pages"
  git push origin HEAD:gh-pages --force
  git checkout main
  git branch -D gh-pages-deploy
  ```

Notes:
- Keep `main` as the default branch for development.
- Protect `main` with required PR reviews and CI checks.

<!-- Deploy trigger: small edit to prompt a Pages API redeploy from GitHub Actions - {{timestamp}} -->
 

- You can view the deployed site URL in the Actions run details under the `Deploy` job > `Deploy to GitHub Pages (via Pages API)` step outputs.
- Example usage in another job within the same workflow to access the URL:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      page_url: ${{ steps.deploy_pages_api.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages (via Pages API)
        id: deploy_pages_api
        uses: actions/deploy-pages@v4

  post-deploy:
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - name: Show deployed URL
        run: echo "Deployed site: ${{ needs.deploy.outputs.page_url }}"
```

If you want to programmatically obtain the Pages site URL from outside of Actions, use the GitHub API (requires a token with repo permissions):

```bash
# Replace OWNER and REPO with your repository details and set `GH_TOKEN` to a PAT with repo scope
curl -s -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/OWNER/REPO/pages | jq -r '.html_url'
```
