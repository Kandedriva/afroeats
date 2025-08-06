module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  
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
  
  // JSX specific
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Other
  endOfLine: 'lf',
  insertPragma: false,
  requirePragma: false,
  
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
      files: '*.css',
      options: {
        parser: 'css',
        printWidth: 120
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