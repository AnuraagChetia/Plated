# Branch workflow

- main is the production branch deployed to Render.
- Do future development on dev. If the checkout is main, switch to dev before editing; preserve any existing uncommitted work.
- Keep the Render production service and render.yaml targeting main.
- Commit and push development changes to dev. Do not merge into main or deploy production unless the user requests a release or production deployment.
- Production uses the existing Supabase database and image bucket. Branch isolation does not isolate database writes; use mocks or a separate development Supabase project for development tests that mutate data.
