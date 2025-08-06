module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  doubleQuote: false,
  
  // Indentation
  tabWidth: 2,
  useTabs: false,
  
  // Line length
  printWidth: 100,
  
  // Spacing
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow functions
  arrowParens: 'avoid',
  
  // Quotes
  quoteProps: 'as-needed',
  
  // JSX (not used in backend, but good to have)
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Other
  endOfLine: 'lf',
  insertPragma: false,
  requirePragma: false,
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        printWidth: 80
      }
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        proseWrap: 'always',
        printWidth: 80
      }
    }
  ]
};