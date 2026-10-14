// A body or a footer is prose that can quote a failure word for word, so their lines have no length limit.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
