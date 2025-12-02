import pluginJs from '@eslint/js';
import pluginTypescript from '@typescript-eslint/eslint-plugin';
import parserTypescript from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default [
	pluginJs.configs.recommended,
	{
		files: ['**/*.ts'],
		plugins: { '@typescript-eslint': pluginTypescript },
		languageOptions: {
			parser: parserTypescript, // Use the TypeScript parser
			sourceType: 'module', // Can also be "commonjs", but "import" and "export" statements will give an eslint error
		},
		rules: {
			// TypeScript Rules

			// Disables dot-notation, as bracket notation is required by TS compiler if the keys of an object are STRINGS
			'dot-notation': 'off',
			'no-undef': 'off', // Prevent ESLint from flagging TypeScript types as undefined
			'@typescript-eslint/explicit-function-return-type': [
				// Enforces all functions to declare their return type
				'error',
				{
					allowExpressions: true, // Adds arrow functions as exceptions, as their return types are usually inferred
				},
			],

			// General Rules

			// Note: Switched to the TS version to support Interfaces/Types, but kept your settings:
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					// Unused variables give a warning
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			semi: ['error', 'always'], // Enforces semicolons be present at the end of every line.
			'semi-spacing': [
				'error',
				{
					// Enforces semicolons have a space after them if they are proceeded by other statements.
					before: false,
					after: true,
				},
			],
			'keyword-spacing': [
				'error',
				{
					// Requires a space be after if, else, for, and while's.
					before: true,
					after: true,
				},
			],
			'space-before-function-paren': ['error', 'never'], // Enforces there be NO space between function DECLARATIONS and ()
			'space-before-blocks': ['error', 'always'], // Enforces there be a space between function parameters and the {} block
			'arrow-spacing': ['error', { before: true, after: true }], // Requires a space before and after "=>" in arrow functions
			'func-call-spacing': ['error', 'never'], // Enforces there be NO space between function CALLS and ()
			'space-infix-ops': ['error', { int32Hint: false }], // Enforces a space around infix operators, like "=" in assignments
			'no-eval': 'error', // Disallows use of `eval()`, as it can lead to security vulnerabilities and performance issues.
			indent: [
				'error',
				'tab',
				{
					// All indentation must use tabs
					SwitchCase: 1, // Enforce switch statements to have indentation (they don't by default)
					ignoredNodes: ['ConditionalExpression', 'ArrayExpression'], // Ignore conditional expressions "?" & ":" over multiple lines, AND array contents over multiple lines!
				},
			],
			'prefer-const': 'error', // "let" variables that are never redeclared must be declared as "const"
			'no-var': 'error', // Disallows declaring variables with "var", as they are function-scoped (not block), so hoisting is very confusing.
			eqeqeq: ['error', 'always'], // Disallows "!=" and "==" to remove type coercion bugs. Use "!==" and "===" instead.
			'no-empty': 'off', // Disable the no-empty rule so blocks aren't entirely red just as we create them
			'no-prototype-builtins': 'off', // Allows Object.hasOwnProperty() to be used
		},
	},
	eslintConfigPrettier,
];
