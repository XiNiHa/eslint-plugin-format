import { join } from 'node:path'
import type { AST, Rule } from 'eslint'
import { messages, reportDifferences } from 'eslint-formatting-reporter'
import type { Options } from 'prettier'
import { createSyncFn } from 'synckit'
import { dirWorkers } from '../dir'

let format: (code: string, options: Options) => string

export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Use Prettier to format code',
      category: 'Stylistic',
    },
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: {
          parser: {
            type: 'string',
            required: true,
          },
        },
        additionalProperties: true,
      },
    ],
    messages,
  },
  create(context) {
    if (!format)
      format = createSyncFn(join(dirWorkers, 'prettier.cjs')) as any

    return {
      Program() {
        try {
          const sourceCode = context.sourceCode.text
          const formatted = format(sourceCode, {
            filepath: context.filename,
            ...(context.options[0] || {}),
          })

          reportDifferences(context, sourceCode, formatted)
        }
        catch (e) {
          if (!(e instanceof SyntaxError))
            throw e

          let message = `Parsing error: ${e.message}`

          const error = e as SyntaxError & { codeFrame?: string, loc?: AST.SourceLocation }

          // Prettier's message contains a codeframe style preview of the
          // invalid code and the line/column at which the error occurred.
          // ESLint shows those pieces of information elsewhere already so
          // remove them from the message
          if (error.codeFrame)
            message = message.replace(`\n${error.codeFrame}`, '')

          if (error.loc)
            message = message.replace(/ \(\d+:\d+\)$/, '')

          context.report({ message, loc: error.loc ?? { line: 0, column: 0 } })
        }
      },
    }
  },
} satisfies Rule.RuleModule
