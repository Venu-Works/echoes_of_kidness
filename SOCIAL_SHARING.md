# Social sharing

Published story pages include WhatsApp, Facebook, LinkedIn, X, and Copy link controls. Supported browsers also show a native Share button. No social SDKs, account credentials, or tracking scripts are required.

## Production configuration

Set `SITE_URL=https://your-public-domain.example` on the web host. This is the canonical origin for shared links and metadata. If omitted, the application uses `NEXTAUTH_URL`, then Vercel's production domain, then `http://localhost:3000`. Set `NEXTAUTH_URL` to the same public origin for authentication.

Localhost and private preview deployments cannot be fetched by social crawlers. Use a publicly accessible HTTPS deployment to validate real link previews.

## Previews and privacy

Only approved stories resolve through the public story page. Metadata includes the story title, public display name, themes, canonical URL, and illustration. It does not include private account fields or story body excerpts. Stories without illustrations use the branded PNG generated at `/opengraph-image`.

## Verification

- On a published story, open each social share composer and verify the URL and title. Publishing remains the visitor's action.
- Copy the link and check that query strings and fragments from the current browser URL are absent.
- On a supporting mobile browser, open native Share and cancel it; cancellation should not show an error.
- If clipboard access is blocked, Copy link should expose a selectable URL.
- Check an illustrated story and a story without an image using platform preview tools on the public deployment. Platforms may cache old previews.
- Confirm pending, rejected, and invalid story links do not expose story details.
