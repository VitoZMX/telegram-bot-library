const config = {
  apps: [
    {
      name: "TG_caretaker",
      script: "./build/src/bots/zmx_caretaker_bot/zmx_caretaker_bot_v3.js",
      watch: ["./build/src"],
      ignore_watch: ["node_modules"],
      watch_delay: 1000,
    },
    {
      name: "TG_quill",
      script: "./build/src/bots/zmx_quill_bot/zmx_quill_bot_v1.js",
      watch: ["./build/src"],
      ignore_watch: ["node_modules"],
      watch_delay: 1000,
    },
  ],
};

module.exports = config;
