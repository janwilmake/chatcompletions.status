Checks status for major platforms, caching it every 5 minutes but with a very long stale-while-revalidate, ensuring this page is megafast.

NB: in localhost it doesn't work due to the cache API usage (bug cloudflare)

To add (or edit) a provider, please send a PR [editing the `status-pages.json` file](https://github.com/janwilmake/chatcompletions.status/edit/main/status-pages.json).
