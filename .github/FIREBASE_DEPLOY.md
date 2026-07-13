# One-time setup for GitHub Actions → Firebase Hosting auto-deploy.
#
# After merging the workflow files, add the service-account secret, then
# pushes to `main` deploy live and PRs get preview URLs.
#
# Option A (easiest, on a machine with Firebase CLI logged in):
#   firebase login
#   firebase init hosting:github
#   # Accept defaults; it creates the service account + GitHub secret for you.
#   # If it also writes workflow files, keep ours or theirs — both are fine.
#
# Option B (manual):
#   1. GCP Console → IAM → Service Accounts → Create
#      Name: github-action-juanpmt
#      Roles:
#        - Firebase Hosting Admin
#        - Firebase Authentication Admin
#        - Cloud Run Viewer
#        - API Keys Viewer
#   2. Keys → Add key → JSON → download
#   3. GitHub repo → Settings → Secrets and variables → Actions → New secret
#      Name:  FIREBASE_SERVICE_ACCOUNT_JUANPMT
#      Value: paste the entire JSON file contents
#   4. Merge this PR (or push workflows to main), then push any change to main
#      to trigger the live deploy.
