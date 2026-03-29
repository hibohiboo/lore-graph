# cloudflareで公開するとき

```
winget install --id Cloudflare.cloudflared
```

```
cloudflared tunnel --url http://localhost:5173
```

vite.config.tsに`server.allowedHosts`を追加

```
export default defineConfig({
   server: {
     allowedHosts: ['xxx-xxx-xxx.trycloudflare.com'],
   },
});
```
