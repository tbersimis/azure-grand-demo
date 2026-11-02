# Azure Grand Hotel demo for Live Hub (Render free hosting)

One small Node.js app that gives you your own copy of the hotel demo, wired to **your** Live Hub account:

| Path | What it is |
|---|---|
| `/` | Hotel website with the "Speak to the concierge" web-call section |
| `/pms/` | Staff dashboard (refreshes every 3 s, start/done/reopen, clear board) |
| `POST /api/requests` | Endpoint your `HotelPMS_update` tool calls |
| `/healthz` | Health check |

## How the free plan behaves

Render's free web service costs nothing and needs no credit card, with two catches:

- **It sleeps after 15 minutes without traffic** and takes about a minute to wake up.
  Open the hotel page or the PMS page about a minute before the demo. The PMS page
  checks for new requests every 3 seconds, so as long as it stays open the app never
  sleeps during your demo.
- **The board is wiped when it sleeps or restarts.** For demos that's handy: every
  session starts with an empty board.

## 1. Put the files on GitHub

1. Sign up or sign in at https://github.com.
2. Click **+** (top right) > **New repository**. Name it `azure-grand-demo`, keep it
   **Public** or **Private**, and click **Create repository**.
3. On the empty repository page click **uploading an existing file**.
4. Unzip `azure-grand-demo.zip` on your computer, open the `azure-grand-demo` folder,
   select **everything inside it** (not the folder itself) and drag it into the browser.
5. Click **Commit changes**.

Check that `package.json` and `server.js` are at the top level of the repository.

## 2. Create the web service on Render

1. Go to https://render.com and sign up with **GitHub**.
2. Click **New** > **Web Service** and pick the `azure-grand-demo` repository
   (allow Render to access it if asked).
3. Fill in:
   - Name: `azure-grand-demo` (this becomes `https://azure-grand-demo.onrender.com`, or similar if taken)
   - Region: **Frankfurt (EU Central)**
   - Language / Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free**
4. Optional: under **Environment Variables** add `ADMIN_TOKEN` with a password of your
   choice. Then only people who know it can clear the board or change statuses.
5. Click **Deploy Web Service** and wait until the log shows `Your service is live`.

## 3. Test it

- Hotel page: `https://<your-name>.onrender.com/`
- PMS: `https://<your-name>.onrender.com/pms/`

## 4. Point the agent at it

Change the URL of the Live Hub tool **HotelPMS_update** to

```
https://<your-name>.onrender.com/api/requests
```

(or send the address to Claude and it can update the tool for you). Method, parameters and body stay the same.

## 5. Add web calling (Click-to-Call)

1. In Live Hub: *Voice channels > SIP Connections > Add new SIP connection*,
   Provider Type **Client Applications**, Provider **Click-to-Call (WebRTC)**.
2. Add a routing rule from that SIP connection to the HotelPMS_AIBot bot connection.
3. On the SIP connection card click the download icon.
4. In GitHub open the `public/c2c` folder > **Add file** > **Upload files** and add:
   - `click-to-call-widget.js` (main file, unchanged)
   - `c2c-config.js` (the content of `basic.js`, without the `<script>` tags, values filled in)
5. Commit. Render redeploys automatically in a minute or two.

If the downloaded example needs a widget tag or another load order, paste that markup into the
`#c2c-slot` block in `public/index.html` (marked with a comment).

Note: with `basic.js`, the Click-to-Call username and password are visible in the page source.
Fine for a demo; for anything more, use the authentication-code method from the Live Hub docs.

## Before each demo

1. Open the PMS page (wakes the app, wait until it shows "Live").
2. Open the hotel page, scroll to **Speak to the concierge**, and call.
3. Ask for towels and pillows, give a room number, say it's urgent.
4. Watch the request appear on the PMS board, then show the call's logs and post-call analysis in Live Hub.

## Optional: keep it awake all the time

If you also demo by phone without opening a page first, the first tool call after a quiet
period can time out (Live Hub waits 10 seconds). A free scheduler such as cron-job.org calling
`https://<your-name>.onrender.com/healthz` every 10 minutes keeps it awake. That uses about
744 of Render's 750 free hours a month, so it only works if this is your only free service.
