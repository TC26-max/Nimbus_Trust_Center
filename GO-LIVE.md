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

One real name or string per line. The folder is gitignored. The static gate scans files and, once the repository exists, git history.

```bash
mkdir -p test/private
printf "put one real name or string per line\n" > test/private/forbidden.txt
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

## 4. Vercel (account tc26-max, team service-agents-demo, new project nimbus-trust-center)

Run the commands one at a time. The login uses the device-code flow if the session expired. When vercel asks: scope service-agents-demo, set up a new project named nimbus-trust-center, the root is the backend folder you are in, no build command, no output override. The three env commands prompt for the value: gemini, gemini-2.5-flash, and the same Gemini key as Nimbus (paste it at the prompt, never commit it).

```bash
cd backend
npx vercel login
npx vercel
npx vercel env add PROVIDER production
npx vercel env add CHAT_MODEL production
npx vercel env add API_KEY production
npx vercel --prod
cd ..
```

If Vercel assigns a URL other than https://nimbus-trust-center.vercel.app, put the real one in backend/site.json (live_url and the self target in evidence_targets), run npm test, commit, push, and deploy again. The URL is a committed setting so local builds and CI stay identical.

## 5. Connect the repository to the Vercel project (makes the daily evidence self-deploying)

In the Vercel dashboard: project nimbus-trust-center, Settings, Git: connect TC26-max/Nimbus_Trust_Center, production branch main, Root Directory backend. From then on every push to main deploys, including the daily evidence commit made by GitHub Actions. Also enable Web Analytics under the project's Analytics tab.

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
