const config = {
  apps: [
    {
      name: "bot_caretaker",
      script: "./dist/src/bots/zmx_caretaker_bot/zmx_caretaker_bot_v3.js",
      watch: ["./dist/src"],
      ignore_watch: ["node_modules"],
      watch_delay: 1000,
    },
    {
      name: "bot_quill",
      script: "./dist/src/bots/zmx_quill_bot/zmx_quill_bot_v1.js",
      watch: ["./dist/src"],
      ignore_watch: ["node_modules"],
      watch_delay: 1000,
    },
  ],
};

module.exports = config;
