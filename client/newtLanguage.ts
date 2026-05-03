import { StreamParser, StringStream } from "@codemirror/language";

// prettier flattened this...
const keywords = [
  "let",
  "in",
  "where",
  "case",
  "of",
  "data",
  "derive",
  "U",
  "do",
  "ptype",
  "pfunc",
  "module",
  "infixl",
  "infixr",
  "infix",
  "∀",
  "forall",
  "import",
  "uses",
  "class",
  "instance",
  "record",
  "constructor",
  "if",
  "then",
  "else",
  "$",
  "λ",
  "?",
  "@",
  ".",
  "->",
  "→",
  ":",
  "=>",
  ":=",
  "$=",
  "=",
  "<-",
  "\\",
  "_",
  "|",
];

// a stack of tokenizers, current is first
// we need to push / pop {} so we can parse strings correctly
interface State {
  tokenizers: Tokenizer[];
}
type Tokenizer = (stream: StringStream, state: State) => string | null;

function tokenizer(stream: StringStream, state: State): string | null {
  if (stream.eatSpace()) return null;
  if (stream.match("--")) {
    stream.skipToEnd();
    return "comment";
  }
  // maybe keyword?
  if (stream.match(/{/)) {
    state.tokenizers.unshift(tokenizer);
    return null;
  }
  if (stream.match(/}/) && state.tokenizers.length > 1) {
    state.tokenizers.shift();
    return state.tokenizers[0] === stringTokenizer ? "keyword" : null;
  }
  if (stream.match(/^[/]-/)) {
    state.tokenizers.unshift(commentTokenizer);
    return state.tokenizers[0](stream, state);
  }
  if (stream.match(/"/)) {
    state.tokenizers.unshift(stringTokenizer);
    return stringTokenizer(stream, state);
  }
  // TODO match tokenizer better..
  if (stream.match(/[^\\(){}[\],.@;\s][^()\\{}\[\],.@;\s]*/)) {
    let word = stream.current();
    if (keywords.includes(word)) return "keyword";
    if (word[0] >= "A" && word[0] <= "Z") return "typeName";
    return "variableName";
  }
  // unhandled
  stream.next();
  return null;
}

function stringTokenizer(stream: StringStream, state: State) {
  while (true) {
    if (stream.current() && stream.match(/^\\{/, false)) {
      return "string";
    }
    if (stream.match(/^\\{/)) {
      state.tokenizers.unshift(tokenizer);
      return "keyword";
    }
    let ch = stream.next();
    if (!ch) return "string";
    if (ch === '"') {
      state.tokenizers.shift();
      return "string";
    }
  }
}

// We have a tokenizer for this because codemirror processes a line at a time.
// So we may need to end the line in `comment` state and see the -/ later
function commentTokenizer(stream: StringStream, state: State): string | null {
  console.log("ctok");
  let dash = false;
  let ch;
  while ((ch = stream.next())) {
    if (dash && ch === "/") {
      state.tokenizers.shift();
      return "comment";
    }
    dash = ch === "-";
  }
  return "comment";
}

export const newt: StreamParser<State> = {
  startState: () => ({ tokenizers: [tokenizer] }),
  token(stream, st) {
    return st.tokenizers[0](stream, st);
  },
  languageData: {
    commentTokens: {
      line: "--",
    },
    // The real list would include almost every character.
    wordChars: "!#$%^&*_+-=<>|",
  },
};

export const scheme: StreamParser<unknown> = {
  startState: () => null,
  token(stream, st) {
    const keywords = [
      "define",
      "let",
      "case",
      "cond",
      "import",
      "include",
      "lambda",
      "else",
    ];
    if (stream.eatSpace()) return null;
    if (stream.match("--")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/[0-9A-Za-z!%&*+./:<=>?@^_~-]+/)) {
      let word = stream.current();
      if (keywords.includes(word)) return "keyword";
      return null;
    }
    // unhandled
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: {
      line: ";;",
    },
    wordChars: "!%&*+-./:<=>?@^_~",
  },
};
