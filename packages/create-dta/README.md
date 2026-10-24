# create-dta

```sh
npm create dta
```

Sets up [Design Token Authority](https://github.com/Fuasmattn/design-token-authority) in the current project: it installs `design-token-authority` as a dev dependency (with the package manager you ran it with), then runs `design-token-authority init`.

`npm create dta -- --yes` asks nothing. Without a `dta.config.*` it writes one for exported token files in `tokens/`; with a config it sets up `dta diff` with the detected answers, including the GitHub workflow files.
