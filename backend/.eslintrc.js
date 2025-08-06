module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Error Prevention
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',
    
    // Code Quality
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'no-useless-concat': 'warn',
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Best Practices
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'dot-notation': 'error',
    'no-else-return': 'warn',
    'no-empty': 'error',
    'no-empty-function': 'warn',
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2, 100, 1000],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true
    }],
    
    // Style (handled by Prettier, but some logic rules)
    'consistent-return': 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    'no-fallthrough': 'error',
    
    // Async/Promise handling
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Node.js specific
    'no-process-exit': 'warn',
    'no-sync': 'warn'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'no-console': 'off'
      }
    }
  ]
};