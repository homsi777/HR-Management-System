const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

// https://vitejs.dev/config/
module.exports = defineConfig({
    plugins: [react()],
    base: './', // Important for Electron paths
    define: {
      // Hardcoded API key as requested by the user for convenience.
      'process.env.API_KEY': JSON.stringify('AIzaSyDjGqZtNbs7i9BPLoWtQoiYgfYoU1yCP9A')
    }
});
