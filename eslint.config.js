import js from '@eslint/js';
import globals from 'globals';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.rules'],
    languageOptions: {
      parser: firebaseRulesPlugin.parser,
    },
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin,
    },
    rules: {
      ...firebaseRulesPlugin.configs['flat/recommended'].rules,
    },
  },
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
  }
];
