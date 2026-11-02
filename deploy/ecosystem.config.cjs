// PM2 process for the VPS deploy (deploy/setup-vps.sh, docs/deploy-vps.md).
// Bound to 127.0.0.1: only nginx talks to it, never the internet directly.
module.exports = {
  apps: [
    {
      name: "yaadigo",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${process.env.APP_PORT || 3100} -H 127.0.0.1`,
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
