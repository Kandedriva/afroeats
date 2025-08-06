module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended'
  ],
  plugins: [
    'react',
    'react-hooks',
    'jsx-a11y'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    // React specific
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'warn',
    'react/no-unused-prop-types': 'warn',
    'react/no-unused-state': 'warn',
    'react/jsx-uses-react': 'off', // Not needed in React 17+
    'react/jsx-uses-vars': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-pascal-case': 'warn',
    'react/jsx-no-bind': ['warn', {
      allowArrowFunctions: true,
      allowFunctions: false,
      allowBind: false
    }],
    
    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // Accessibility
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    
    // General JavaScript rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',
    
    // Performance
    'no-useless-concat': 'warn',
    'prefer-template': 'warn',
    
    // Best practices
    'consistent-return': 'error',
    'default-case': 'error',
    'no-fallthrough': 'error',
    'no-empty': 'error',
    'curly': ['error', 'all'],
    
    // Import/Export
    'no-duplicate-imports': 'error',
    
    // Async/Promise
    'no-async-promise-executor': 'error',
    'prefer-promise-reject-errors': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'],
      env: {
        jest: true
      },
      extends: ['plugin:testing-library/react'],
      plugins: ['testing-library'],
      rules: {
        'no-console': 'off',
        'testing-library/no-unnecessary-act': 'error',
        'testing-library/no-wait-for-empty-callback': 'error',
        'testing-library/prefer-screen-queries': 'error'
      }
    }
  ]
};