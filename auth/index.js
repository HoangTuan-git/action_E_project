require("dotenv").config();
const App = require("./src/app");

async function startApp() {
  const app = new App();
  try {
    await app.connectDB();
    app.start();
  } catch (err) {
    console.error("Failed to start app:", err);
    process.exit(1);
  }
}

startApp();
