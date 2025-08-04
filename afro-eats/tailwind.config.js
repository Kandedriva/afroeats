module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
      extend: {
        // Add mobile-friendly breakpoints and utilities
        screens: {
          'xs': '475px',
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem',
        },
        minHeight: {
          '44': '44px', // iOS minimum touch target
        },
      },
    },
    plugins: [],
  }