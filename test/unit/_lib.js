export class ErrorWithContext extends Error {
  context = {}
}
export function ctxErr(message, context) {
  const E = new ErrorWithContext(message)
  E.context = context
  return E
}