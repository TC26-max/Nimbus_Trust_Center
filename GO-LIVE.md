# GO-LIVE: exact Terminal steps (macOS)

Everything below runs in your own Terminal on the Mac. Each code block is safe to paste whole: there are no comments inside the blocks (zsh does not treat # as a comment on an interactive line, and it treats angle brackets as redirections). Explanations sit above each block. Paths assume the repo folder sits inside the GRC folder.

## 0. Open the folder, install, test

Expected result of the last command: static 25, endpoint 33, ui 46 checks passed.

```bash
cd "$HOME/Desktop/IT:Cybersecurity Demo/GRC/nimbus-trust-center"
node --version
npm ci
npm test
```

## 1. First real evidence run (needs internet: it checks the live Nimbus site)

The first command writes a dated file plus evidence/latest.json, runs the gates, and rebuilds the page with the bundle embedded. The second is a sanity run. The third opens a local preview in your browser: the status pill says keyword only, and the mapper runs in-page.

```bash
npm run evidence
npm test
open backend/index.html
```

The seed bundle shipped in the folder was generated without network access (scope local-only). After this step the transport and header checks against the Nimbus site are real, and the Trust Center highlights change from "awaiting the first live run" to live evidence.

## 2. Private forbidden-strings list (optional, recommended)

The folder is gitignored. The static gate fails if any line of the file appears anywhere in the repository or its git history, so the file must contain only the real strings themselves (one per line, lines starting with # are ignored), never an example sentence. The second command opens the empty file in TextEdit; type the strings, save, close, then run the gate.

```bash
mkdir -p test/private
touch test/private/forbidden.txt
open -e test/private/forbidden.txt
npm run gate:static
```

## 3. Git and GitHub (account TC26-max, new public repo Nimbus_Trust_Center)

```bash
git init -b main
git config user.name "TC26-max"
git config user.email "TC26-max@users.noreply.github.com"
git add -A
git commit -m "Nimbus Trust Center v1.0.0"
```

Create the empty public repository named Nimbus_Trust_Center on github.com (no README, no license), then:

```bash
git remote add origin https://github.com/TC26-max/Nimbus_Trust_Center.git
git push -u origin main
```

If the repository name differs, change repo_url and security_txt.contact in backend/site.json, run npm test, and commit again.

## 4. Vercel project from the GitHub repository (account tc26-max, team service-agents-demo)

Create the project by importing the repository, which also sets up the Git integration: vercel.com/new, Import Git Repository, TC26-max/Nimbus_Trust_Center (install the Vercel GitHub app for that account if asked). On the configure screen: project name nimbus-trust-center, Framework Preset Other, Root Directory backend (click Edit next to the root directory and pick the backend folder), Build Command empty and override off, Output Directory empty and override off. Add the three environment variables on the same screen: PROVIDER = gemini, CHAT_MODEL = gemini-2.5-flash, API_KEY = the Gemini key (paste it, never commit it). Deploy.

Why the root must be backend: the deploy root carries the generated page, the two ESM serverless functions, vercel.json with the CSP, and its own small package.json with "type": "module" so the functions load as ES modules. There is no build step on Vercel; the page is built and committed by npm test at the repository root. If Root Directory is left at the repository root, Vercel runs the root build script and then fails with "No Output Directory named public".

If the first deployment failed with that message: Settings, Build and Deployment, Root Directory backend, Save; confirm Framework Preset Other with no build or output override; confirm the three environment variables under Settings, Environment Variables; then push any commit or use Redeploy on the failed deployment.

From now on every push to main deploys, including the daily evidence commit made by GitHub Actions. Enable Web Analytics under the project's Analytics tab.

If Vercel assigns a URL other than https://nimbus-trust-center.vercel.app, put the real one in backend/site.json (live_url and the self target in evidence_targets), run npm test, commit, and push. The URL is a committed setting so local builds and CI stay identical.

## 5. Link the CLI (one time, for steps 7 and 8)

Run in the backend folder and pick the existing project nimbus-trust-center from the list:

```bash
cd backend
npx vercel login
npx vercel link
cd ..
```

The scheduled job (.github/workflows/evidence.yml) runs at 06:00 UTC daily and can be run by hand from the Actions tab (Run workflow). It needs no secrets: it reads public pages and the repository only.

## 6. Live checks

Expected: the first command lists the security headers; the second returns ok true and mapper ai; the third returns method ai with up to three proposals; the fourth prints the security.txt file.

```bash
curl -sI https://nimbus-trust-center.vercel.app/ | grep -i -E "content-security|strict-transport|x-content-type|x-frame|referrer|permissions"
curl -s https://nimbus-trust-center.vercel.app/api/health
curl -s -X POST https://nimbus-trust-center.vercel.app/api/map -H "Content-Type: application/json" -d '{"q":"Do you encrypt data in transit and at rest?"}'
curl -s https://nimbus-trust-center.vercel.app/.well-known/security.txt
```

Then in a browser: the status pill should read "AI mapper on: gemini-2.5-flash", the mapper should answer with "AI-proposed", and the Trust Center should show a live evidence timestamp.

The bundle committed before the deploy recorded this site as "not deployed yet". Run the job once more now that the site is live, so the page carries passing checks about itself, then push (with the Git integration from step 5, the push deploys):

```bash
npm run evidence
npm test
git add -A
git commit -m "evidence: first run against the live site"
git push
```

## 7. Measure the model path and publish the number

Twenty gold questions against the live endpoint, paced under the fair-use limit (about a minute). The Tested tab then shows the model-path accuracy instead of "not yet measured".

```bash
npm run eval:live
npm test
git add -A
git commit -m "eval: model path measured against the live endpoint"
git push
```

## 8. Kill switch drill (proves control NC-PR-19; do it once and note how long it took)

After the first two commands the health probe should return ok false and mapper keyword. The last two put the key back.

```bash
cd backend
npx vercel env rm API_KEY production
npx vercel --prod
curl -s https://nimbus-trust-center.vercel.app/api/health
npx vercel env add API_KEY production
npx vercel --prod
cd ..
```

## 9. Publish

- LinkedIn: run the URL through linkedin.com/post-inspector before adding it as a Featured link (forces the card scrape).
- Nimbus sister link: add the Trust Center URL to the Nimbus footer or version.json sister link and redeploy Nimbus.
- Resume line, same register as the others: "Designed and shipped a continuous-assurance GRC control room for a simulated company: 54 controls crosswalked to NIST CSF 2.0, CIS v8.1, SOC 2 and NIST AI RMF, an AI system inventory with runtime permissions, a daily evidence job, a quantified loss scenario, and a board brief; built AI-assisted with published gates and a findings register."

## Rules that never change

- Edit data/, policies/, src/, never backend/index.html or backend/vercel.json (generated). Always npm test before deploying.
- No em dashes or en dashes anywhere; the gate fails the build.
- The real name never goes in files, commits, or card art. The attribution name appears exactly once, in the footer.
- The city stays in data/company.json only.
- The API key lives only in Vercel environment variables.
